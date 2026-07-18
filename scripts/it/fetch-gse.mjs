/**
 * fetch-gse.mjs — download the GSE Conto Termico 3.0 pre-qualified appliance
 * catalogues (Italy).
 *
 * Source: GSE "Apparecchi Prequalificati – Conto Termico 3.0"
 *   https://www.gse.it/servizi-per-te/efficienza-energetica/conto-termico-3-0/apparecchi-prequalificati
 *
 * The catalogues are published as PDFs (Acrobat prints of GSE's internal Excel
 * files) at stable URLs and replaced in place on update — so we record ETag /
 * Last-Modified per file and keep dated snapshots, exactly like the other
 * registry fetchers. Facts-only use (source attribution + snapshot dates in the
 * app); no GSE branding is ever displayed.
 *
 * We fetch the three heat-pump-relevant catalogues:
 *   III.A — pompe di calore            (the matching source for the IT overlay)
 *   III.B — sistemi ibridi             (kept as snapshot facts; a hybrid combo
 *                                       listing is never evidence that a
 *                                       standalone HP is listed — ODU-overlap rule)
 *   III.E — scaldacqua a pompa di calore (kept as snapshot facts; the canonical
 *                                       baseline has no DHW products to match)
 *
 * Output: data_sources/gse_ct/raw/YYYY-MM/{IIIA.pdf,IIIB.pdf,IIIE.pdf,_meta.json}
 * Args:   --snapshot=YYYY-MM (default: current month)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SNAPSHOT = (process.argv.find(a => a.startsWith('--snapshot=')) ?? '').split('=')[1]
  || new Date().toISOString().slice(0, 7);
const OUT_DIR = path.join(ROOT, 'data_sources/gse_ct/raw', SNAPSHOT);
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE = 'https://www.gse.it/documenti_site/Documenti%20GSE/Servizi%20per%20te/CONTO%20TERMICO%203/Moduli%20e%20modelli/';
const FILES = [
  { key: 'IIIA', label: 'III.A Catalogo pompe di calore', url: `${BASE}III.A%20-%20CATALOGO%20POMPE%20DI%20CALORE.pdf` },
  { key: 'IIIB', label: 'III.B Catalogo sistemi ibridi', url: `${BASE}III.B%20-%20CATALOGO%20SISTEMI%20IBRIDI.pdf` },
  { key: 'IIIE', label: 'III.E Catalogo scaldacqua PdC', url: `${BASE}III.E%20-%20CATALOGO%20SCALDACQUA%20PDC.pdf` },
];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const POLITENESS_MS = 1500;

const sleep = ms => new Promise(r => setTimeout(r, ms));

const meta = { source: 'GSE Conto Termico 3.0 — apparecchi prequalificati', fetched_at: new Date().toISOString(), files: {} };

for (const f of FILES) {
  const dest = path.join(OUT_DIR, `${f.key}.pdf`);
  process.stdout.write(`Fetching ${f.label} … `);
  const headers = execFileSync('curl', ['-sS', '-D', '-', '-o', dest, '-L', '--fail', '-A', UA, f.url],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const h = Object.fromEntries(headers.split(/\r?\n/)
    .filter(l => l.includes(':'))
    .map(l => [l.slice(0, l.indexOf(':')).trim().toLowerCase(), l.slice(l.indexOf(':') + 1).trim()]));
  const size = fs.statSync(dest).size;
  if (size < 10_000) { console.error(`\nFATAL: ${f.key} suspiciously small (${size} B) — layout change?`); process.exit(1); }
  if (!fs.readFileSync(dest).subarray(0, 5).toString('latin1').startsWith('%PDF-')) {
    console.error(`\nFATAL: ${f.key} is not a PDF — page/URL layout changed`); process.exit(1);
  }
  meta.files[f.key] = { url: f.url, label: f.label, bytes: size, etag: h.etag ?? null, last_modified: h['last-modified'] ?? null };
  console.log(`${(size / 1024).toFixed(0)} KB (last-modified: ${h['last-modified'] ?? 'n/a'})`);
  await sleep(POLITENESS_MS);
}

fs.writeFileSync(path.join(OUT_DIR, '_meta.json'), JSON.stringify(meta, null, 2));
console.log(`Snapshot ${SNAPSHOT} written to ${path.relative(ROOT, OUT_DIR)}`);
