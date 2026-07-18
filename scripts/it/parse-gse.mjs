/**
 * parse-gse.mjs — normalize a raw GSE Conto Termico 3.0 catalogue snapshot (IT).
 *
 * Input:  data_sources/gse_ct/raw/YYYY-MM/{IIIA,IIIB,IIIE}.pdf  (fetch-gse.mjs)
 * Output: data_sources/gse_ct/parsed/YYYY-MM/gse-normalized.json
 *
 * The catalogues are PDF prints of GSE's internal Excel files, so parsing goes
 * through `pdftotext -layout` (poppler) and a tolerant column parser:
 *   - fields are separated by runs of ≥2 spaces; values keep single spaces;
 *   - the RIGHT side of a row is 2–4 numeric columns (potenza, [ηs], SCOP/COP,
 *     [NO2]) — some air/air form factors publish no ηs;
 *   - a handful of multisplit rows wrap their indoor-unit id list onto bare
 *     continuation lines, which are re-attached to the preceding row;
 *   - source glitches (decimal-comma typos like a COP of "50,8") are nulled,
 *     never guessed.
 *
 * One entry per unique (catalogue, brand, model, odu, idu) identity; the same
 * identity listed at several rating points keeps all its ratings. Each entry
 * gets a deterministic internal key (gse_entry_key) used for match history and
 * integrity checks — it is OUR key, not a GSE identifier, and is never shown
 * in the UI as an official id (the catalogue publishes no per-row id).
 *
 * Strict accounting on III.A (the matching source): every input line must be
 * classified (data / header / continuation / rejected) and rejects must stay
 * under 0.5% or the parse fails. III.B (hybrids) and III.E (DHW) are parsed as
 * snapshot facts only — they never feed the matcher (a hybrid combo listing is
 * not evidence for a standalone HP; the canonical baseline has no DHW).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SNAPSHOT = (process.argv.find(a => a.startsWith('--snapshot=')) ?? '').split('=')[1]
  || fs.readdirSync(path.join(ROOT, 'data_sources/gse_ct/raw')).filter(d => /^\d{4}-\d{2}$/.test(d)).sort().pop();
const RAW_DIR = path.join(ROOT, 'data_sources/gse_ct/raw', SNAPSHOT);
const OUT_DIR = path.join(ROOT, 'data_sources/gse_ct/parsed', SNAPSHOT);
fs.mkdirSync(OUT_DIR, { recursive: true });

const rawMeta = JSON.parse(fs.readFileSync(path.join(RAW_DIR, '_meta.json'), 'utf8'));

const textOf = key => execFileSync('pdftotext', ['-layout', path.join(RAW_DIR, `${key}.pdf`), '-'],
  { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });

const num = s => {
  if (s == null || s === '-' || s === '') return null;
  const v = Number(String(s).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};
// A measurement value (kW, ηs, SCOP, NO2) never carries 7+ digits — but the
// catalogue's unit identifiers are often long article numbers ("0010039603",
// "398000761") that would otherwise be eaten by the numeric-tail parser.
const isNumericTok = s => /^-?\d[\d.]*(,\d+)?$/.test(s ?? '')
  && (String(s).match(/\d/g) ?? []).length <= 6;
const dash = s => (s === '-' || s === '' || s == null) ? null : s;

const HEADER_FRAGMENTS = [
  'Tipologia', 'intervento', 'Commerciale', 'unità esterna', 'unità interna',
  '[kWt]', '[Wt]', 'Potenza', 'Efficienza', 'Catalogo 20', 'Marca', 'Modello',
  'Capacità', 'Classe', 'caldaia', 'Alimentazione', 'Rendimento',
];
const isHeaderLine = l => HEADER_FRAGMENTS.some(f => l.includes(f));

/* ── III.A — pompe di calore (the matching source) ───────────────────────── */
function parseIIIA() {
  const lines = textOf('IIIA').split('\n');
  const rows = [];
  const stats = { data: 0, header: 0, blank: 0, continuation: 0, rejected: 0, rejectedSamples: [] };
  let last = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\f/g, '');
    if (!line.trim()) { stats.blank++; continue; }
    if (!/^\s*III\.A\s/.test(line)) {
      if (isHeaderLine(line)) { stats.header++; last = null; continue; }
      // Bare continuation line: a wrapped indoor-unit id list for the previous row.
      const cont = line.trim();
      if (last && /^[A-Za-z0-9][A-Za-z0-9 ./+-]*$/.test(cont)) {
        last.idu_id = last.idu_id ? `${last.idu_id}-${cont}` : cont;
        stats.continuation++;
        continue;
      }
      stats.rejected++;
      if (stats.rejectedSamples.length < 10) stats.rejectedSamples.push(cont.slice(0, 120));
      continue;
    }

    const toks = line.trim().split(/\s{2,}/);
    // Left anchors: intervento, funzionamento (PdC …), scambio (…/…).
    const [intervento, funzionamento, scambio, ...rest] = toks;
    if (intervento !== 'III.A' || !/^pdc/i.test(funzionamento ?? '') || !/\//.test(scambio ?? '')) {
      stats.rejected++;
      if (stats.rejectedSamples.length < 10) stats.rejectedSamples.push(line.trim().slice(0, 120));
      continue;
    }
    // Right anchors: 2–4 trailing numeric columns.
    const nums = [];
    while (rest.length && isNumericTok(rest[rest.length - 1]) && nums.length < 4) nums.unshift(rest.pop());
    let kw = null, etas = null, scop = null, no2 = null;
    if (nums.length === 4) [kw, etas, scop, no2] = nums.map(num);
    else if (nums.length === 3) [kw, etas, scop] = nums.map(num);
    else if (nums.length === 2) { kw = num(nums[0]); scop = num(nums[1]); } // no ηs published (some air/air form factors)
    else {
      stats.rejected++;
      if (stats.rejectedSamples.length < 10) stats.rejectedSamples.push(line.trim().slice(0, 120));
      continue;
    }
    // Middle: [denominazione, marca, modello, odu, idu] — ids may be absent/wrapped.
    let denom = null, marca = null, modello = null, odu = null, idu = null;
    if (rest.length === 5) [denom, marca, modello, odu, idu] = rest;
    else if (rest.length === 4) [denom, marca, modello, odu] = rest;   // idu wrapped or absent
    else if (rest.length === 3) [denom, marca, modello] = rest;
    else {
      stats.rejected++;
      if (stats.rejectedSamples.length < 10) stats.rejectedSamples.push(line.trim().slice(0, 120));
      continue;
    }
    // Source glitches: values outside physical ranges are nulled, never guessed.
    if (scop != null && (scop < 0.5 || scop > 15)) scop = null;
    if (etas != null && (etas < 40 || etas > 450)) etas = null;
    if (kw != null && (kw <= 0 || kw > 5000)) kw = null;

    const row = {
      funzionamento: funzionamento.trim(),
      scambio: scambio.trim(),
      denominazione: dash(denom?.trim()),
      brand: dash(marca?.trim()),
      model: dash(modello?.trim()),
      odu_id: dash(odu?.trim()),
      idu_id: dash(idu?.trim()),
      kw, etas, scop, no2,
    };
    if (!row.brand || !row.model) {
      stats.rejected++;
      if (stats.rejectedSamples.length < 10) stats.rejectedSamples.push(line.trim().slice(0, 120));
      continue;
    }
    rows.push(row);
    last = row;
    stats.data++;
  }

  if (stats.data < 10_000) { console.error(`FATAL: III.A parsed only ${stats.data} rows — layout change?`); process.exit(1); }
  if (stats.rejected / (stats.data + stats.rejected) > 0.005) {
    console.error(`FATAL: III.A reject rate too high (${stats.rejected}/${stats.data + stats.rejected})`);
    console.error('Samples:', stats.rejectedSamples);
    process.exit(1);
  }
  return { rows, stats };
}

/* ── III.B / III.E — snapshot facts only (never feed the matcher) ────────── */
function parseIIIB() {
  const rows = [];
  for (const rawLine of textOf('IIIB').split('\n')) {
    const line = rawLine.replace(/\f/g, '');
    if (!/^\s*III\.B\s/.test(line)) continue;
    const toks = line.trim().split(/\s{2,}/);
    if (toks.length < 14) continue;
    const [, marca, modelloPdc, odu, idu, alimentazione, scambio, kwPdc, etas, scop] = toks;
    rows.push({
      brand: dash(marca), model_pdc: dash(modelloPdc), odu_id: dash(odu), idu_id: dash(idu),
      alimentazione: dash(alimentazione), scambio: dash(scambio),
      kw_pdc: num(kwPdc), etas: num(etas), scop: num(scop),
      boiler_type: dash(toks[toks.length - 4]), boiler_model: dash(toks[toks.length - 3]),
    });
  }
  return rows;
}
function parseIIIE() {
  const rows = [];
  for (const rawLine of textOf('IIIE').split('\n')) {
    const line = rawLine.replace(/\f/g, '');
    if (!/^\s*III\.E\s/.test(line)) continue;
    const toks = line.trim().split(/\s{2,}/);
    if (toks.length < 7) continue;
    const [, marca, modello, wt, tipologia, classe, litri] = toks;
    rows.push({ brand: dash(marca), model: dash(modello), watt: num(wt), form: dash(tipologia), energy_class: dash(classe), tank_litres: num(litri) });
  }
  return rows;
}

/* ── Merge III.A rows into identity entries ──────────────────────────────── */
const { rows: iiiaRows, stats: iiiaStats } = parseIIIA();
const compact = s => (s ?? '').toUpperCase().normalize('NFKD').replace(/[^A-Z0-9]/g, '');

const entries = new Map();
for (const r of iiiaRows) {
  const identity = ['IIIA', compact(r.brand), compact(r.model), compact(r.odu_id), compact(r.idu_id)].join('|');
  const key = `IIIA-${createHash('sha1').update(identity).digest('hex').slice(0, 12)}`;
  if (!entries.has(key)) {
    entries.set(key, {
      gse_entry_key: key,
      catalogue: 'III.A',
      funzionamento: r.funzionamento,
      scambio: r.scambio,
      denominazione: r.denominazione,
      brand: r.brand,
      model: r.model,
      odu_id: r.odu_id,
      idu_id: r.idu_id,
      ratings: [],
    });
  }
  entries.get(key).ratings.push({ kw: r.kw, etas: r.etas, scop: r.scop, no2: r.no2 });
}

const iiib = parseIIIB();
const iiie = parseIIIE();

const out = {
  meta: {
    source: 'GSE Conto Termico 3.0 — catalogo apparecchi prequalificati',
    snapshot: SNAPSHOT,
    generated_at: new Date().toISOString(),
    fetched_at: rawMeta.fetched_at,
    files: rawMeta.files,
    iiia_rows: iiiaStats.data,
    iiia_rejected: iiiaStats.rejected,
    iiia_entries: entries.size,
    iiib_rows: iiib.length,
    iiie_rows: iiie.length,
  },
  entries: [...entries.values()],
  hybrids: iiib,
  water_heaters: iiie,
};
fs.writeFileSync(path.join(OUT_DIR, 'gse-normalized.json'), JSON.stringify(out, null, 1));
console.log(`III.A: ${iiiaStats.data} rows → ${entries.size} identity entries `
  + `(headers ${iiiaStats.header}, continuations ${iiiaStats.continuation}, rejected ${iiiaStats.rejected})`);
console.log(`III.B: ${iiib.length} hybrid rows (facts only) · III.E: ${iiie.length} DHW rows (facts only)`);
console.log(`Wrote ${path.relative(ROOT, path.join(OUT_DIR, 'gse-normalized.json'))}`);
