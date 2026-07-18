/**
 * audit-gse-extraction.mjs — field-level quality audit of the III.A PDF parse.
 *
 * "0 rejected rows" proves the parser ACCEPTED everything, not that every field
 * landed in the right column. This audit cross-checks the production parse
 * against the raw pdftotext lines with independent methods:
 *
 *   1. per-brand row counts: independent grep-style tally vs parsed tally;
 *   2. numeric-tail reconstruction: an independent regex re-derives the
 *      trailing measurement columns (kW / ηs / SCOP / NO2, honouring the
 *      ≥7-digit = identifier rule) and compares them with the parsed ratings;
 *   3. token-loss scan: any long alphanumeric token present in the source line
 *      but absent from every parsed field of that row is flagged;
 *   4. ODU/IDU order: where both ids parsed, they must appear in the line in
 *      that order (reversal detector);
 *   5. page-boundary sample list + continuation rows for manual visual
 *      comparison against rendered PDF pages (pdftoppm), which is the only
 *      true ground truth for 0/O-style glyph doubts.
 *
 * Output: data_sources/gse_ct/audit/YYYY-MM/extraction-sample.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SNAPSHOT = (process.argv.find(a => a.startsWith('--snapshot=')) ?? '').split('=')[1]
  || fs.readdirSync(path.join(ROOT, 'data_sources/gse_ct/parsed')).filter(d => /^\d{4}-\d{2}$/.test(d)).sort().pop();
const OUT_DIR = path.join(ROOT, 'data_sources/gse_ct/audit', SNAPSHOT);
fs.mkdirSync(OUT_DIR, { recursive: true });

const compact = s => (s ?? '').toUpperCase().normalize('NFKD').replace(/[^A-Z0-9]/g, '');

/* ── Load raw text with page numbers ─────────────────────────────────────── */
const raw = execFileSync('pdftotext', ['-layout', path.join(ROOT, 'data_sources/gse_ct/raw', SNAPSHOT, 'IIIA.pdf'), '-'],
  { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
let page = 1;
const lines = [];
for (const l of raw.split('\n')) {
  if (l.includes('\f')) page++;
  lines.push({ page, text: l.replace(/\f/g, '') });
}
const dataLines = lines.filter(l => /^\s*III\.A\s/.test(l.text));

/* ── Load the production parse (rows re-derived from identities) ─────────── */
const parsed = JSON.parse(fs.readFileSync(path.join(ROOT, 'data_sources/gse_ct/parsed', SNAPSHOT, 'gse-normalized.json'), 'utf8'));

/* 1. Row-count integrity */
const counts = {
  pdf_data_lines: dataLines.length,
  parsed_rows: parsed.meta.iiia_rows,
  parsed_identities: parsed.meta.iiia_entries,
  identity_rating_rows: parsed.entries.reduce((a, e) => a + e.ratings.length, 0),
};

/* 2. Per-brand tallies — independent containment count vs parsed count.
   (A raw line's brand column is not isolated here, so this is a containment
   tally: it catches brands the parser dropped or misassigned wholesale.) */
const parsedBrandRows = {};
for (const e of parsed.entries) parsedBrandRows[e.brand] = (parsedBrandRows[e.brand] ?? 0) + e.ratings.length;
const brandCheck = [];
for (const [brand, n] of Object.entries(parsedBrandRows).sort((a, b) => b[1] - a[1]).slice(0, 40)) {
  const needle = ` ${brand} `;
  const rawN = dataLines.filter(l => l.text.includes(needle)).length;
  brandCheck.push({ brand, parsed_rows: n, raw_lines_containing: rawN, ok: rawN >= n });
}

/* 3-4. Line-level field verification for EVERY row (not a sample):
   re-derive the numeric tail independently and check token loss + id order. */
const isMeasurementTok = s => /^-?\d[\d.]*(,\d+)?$/.test(s) && (s.match(/\d/g) ?? []).length <= 6;
const num = s => Number(String(s).replace(/\./g, '').replace(',', '.'));

// Look up each raw line's identity: index parsed entries by their identity
// tuple, and re-derive the same tuple from the line with the production
// tokenization rules (the *stored entry fields* are then verified against the
// *line content* — merge/storage integrity plus containment checks; visual PDF
// comparison below remains the glyph-level ground truth).
const byIdentity = new Map();
for (const e of parsed.entries) {
  byIdentity.set(['IIIA', compact(e.brand), compact(e.model), compact(e.odu_id), compact(e.idu_id)].join('|'), e);
}
const dash = s => (s === '-' || s === '' || s == null) ? null : s;
function tokenizeRow(text) {
  const toks = text.trim().split(/\s{2,}/);
  const [intervento, funzionamento, scambio, ...rest] = toks;
  if (intervento !== 'III.A' || !/^pdc/i.test(funzionamento ?? '') || !/\//.test(scambio ?? '')) return null;
  const nums = [];
  while (rest.length && isMeasurementTok(rest[rest.length - 1]) && nums.length < 4) nums.unshift(rest.pop());
  let denom = null, marca = null, modello = null, odu = null, idu = null;
  if (rest.length === 5) [denom, marca, modello, odu, idu] = rest;
  else if (rest.length === 4) [denom, marca, modello, odu] = rest;
  else if (rest.length === 3) [denom, marca, modello] = rest;
  else return null;
  return { brand: dash(marca), model: dash(modello), odu: dash(odu), idu: dash(idu), nums: nums.map(num), rest };
}

const problems = { numericTailMismatch: [], tokenLoss: [], idOrderReversed: [], identityNotFound: [], untokenizable: [] };
const okCounts = { numericTail: 0, tokens: 0, idOrder: 0, aligned: 0 };

for (const dl of dataLines) {
  const row = tokenizeRow(dl.text);
  if (!row) { problems.untokenizable.push({ page: dl.page, line: dl.text.trim().slice(0, 140) }); continue; }
  // Continuation-affected rows appended their idu later; try both with and without idu.
  const e = byIdentity.get(['IIIA', compact(row.brand), compact(row.model), compact(row.odu), compact(row.idu)].join('|'))
    ?? [...byIdentity.values()].find(x => compact(x.brand) === compact(row.brand)
      && compact(x.model) === compact(row.model) && compact(x.odu_id) === compact(row.odu));
  if (!e) { problems.identityNotFound.push({ page: dl.page, line: dl.text.trim().slice(0, 140) }); continue; }
  okCounts.aligned++;
  // numeric tail: the independently derived tail values (sanity-filtered the
  // same way the parser filters glitches) must appear in one stored rating.
  const tailOk = e.ratings.some(r => {
    const vals = [r.kw, r.etas, r.scop, r.no2].filter(v => v != null);
    return vals.every(v => row.nums.some(d => Math.abs(d - v) < 1e-9));
  });
  tailOk ? okCounts.numericTail++ : problems.numericTailMismatch.push({ page: dl.page, line: dl.text.trim().slice(0, 140), derived: row.nums });
  // token loss: every ≥6-char alphanumeric token in the line must appear in a stored field
  const fields = compact([e.brand, e.model, e.denominazione, e.odu_id, e.idu_id, e.funzionamento, e.scambio, ...(e.scambio_alt ?? [])].join('|'));
  const lost = row.rest.flatMap(t => t.split(/\s+/)).map(compact)
    .filter(t => t.length >= 6 && !fields.includes(t));
  lost.length ? problems.tokenLoss.push({ page: dl.page, lost, line: dl.text.trim().slice(0, 140) }) : okCounts.tokens++;
  // ODU before IDU in the raw line
  if (e.odu_id && row.idu) {
    const line = compact(dl.text);
    const oi = line.indexOf(compact(e.odu_id)), ii = line.lastIndexOf(compact(row.idu));
    (oi !== -1 && ii !== -1 && oi <= ii) ? okCounts.idOrder++ : problems.idOrderReversed.push({ page: dl.page, odu: e.odu_id, idu: row.idu });
  }
}

/* 5. Manual visual sample: page starts/ends, continuations, long models */
const visualSample = [];
const pick = (dl, why) => visualSample.push({ page: dl.page, why, line: dl.text.trim().slice(0, 160) });
for (let p = 2; p <= page; p += Math.floor(page / 5)) {
  const onPage = dataLines.filter(l => l.page === p);
  if (onPage.length) { pick(onPage[0], `first row of page ${p}`); pick(onPage[onPage.length - 1], `last row of page ${p}`); }
}
dataLines.filter(l => l.text.length > 220).slice(0, 3).forEach(l => pick(l, 'very long row'));

const report = {
  counts,
  row_alignment: { aligned_rows: okCounts.aligned, pdf_lines: dataLines.length, identity_not_found: problems.identityNotFound.length, untokenizable: problems.untokenizable.length },
  field_checks: {
    numeric_tail_ok: okCounts.numericTail,
    numeric_tail_mismatch: problems.numericTailMismatch.length,
    token_loss_rows: problems.tokenLoss.length,
    tokens_ok: okCounts.tokens,
    id_order_ok: okCounts.idOrder,
    id_order_reversed: problems.idOrderReversed.length,
  },
  brand_tally: brandCheck,
  problem_samples: {
    numericTailMismatch: problems.numericTailMismatch.slice(0, 15),
    tokenLoss: problems.tokenLoss.slice(0, 15),
    idOrderReversed: problems.idOrderReversed.slice(0, 15),
    identityNotFound: problems.identityNotFound.slice(0, 15),
    untokenizable: problems.untokenizable.slice(0, 15),
  },
  visual_sample: visualSample,
};
fs.writeFileSync(path.join(OUT_DIR, 'extraction-sample.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ counts, field_checks: report.field_checks }, null, 1));
console.log(`wrote audit/${SNAPSHOT}/extraction-sample.json`);
