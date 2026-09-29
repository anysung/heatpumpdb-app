#!/usr/bin/env node
/**
 * compute-dataset-changes.mjs — per-market change list for the Premium
 * watchlist ("changed in the latest update") and the change-alert mails.
 *
 *   previous  = the LIVE full objects in gs://heatpumpdb-datasets/datasets/<CC>/
 *               (what customers see right now — canaries stripped)
 *   candidate = the local build in public/data/ (about to be published)
 *
 * It therefore has to run BEFORE the publish step of the monthly window: after
 * publishing, live == candidate and the diff is empty.
 *
 *   node scripts/compute-dataset-changes.mjs                  dry run: counts only, writes nothing
 *   node scripts/compute-dataset-changes.mjs --save           + data_sources/dataset_changes/<CC>/<YYYY-MM>.json
 *   node scripts/compute-dataset-changes.mjs --publish-saved  push the SAVED files of this month to
 *                                                             Firestore countries/{cc}/changes/{YYYY-MM|latest}
 *   node scripts/compute-dataset-changes.mjs --write          --save + --publish-saved in one go (manual use)
 *   options: --month=YYYY-MM (default: current month, Europe/Berlin)
 *            --data-dir=<dir> (default: public/data)   --markets=DE,GB
 *
 * The window runs --save before publishing and --publish-saved after it, so a
 * release that fails verification (and is rolled back) never announces changes
 * that did not ship.
 *
 * NEVER FATAL BY DESIGN: a market whose live object or local build cannot be
 * read is skipped (never diffed against nothing — that would announce the whole
 * catalogue as new). An all-zero diff never overwrites a saved non-zero one
 * (a re-run after publishing would otherwise erase the month's changes).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diffMarket, capForStorage } from './lib/dataset-diff.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUCKET = 'gs://heatpumpdb-datasets';
const args = process.argv.slice(2);
const arg = (n) => args.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const WRITE = args.includes('--write');
const SAVE = WRITE || args.includes('--save');
const PUBLISH = WRITE || args.includes('--publish-saved');
const DATA_DIR = resolve(arg('data-dir') ?? join(ROOT, 'public/data'));
const OUT_DIR = join(ROOT, 'data_sources/dataset_changes');

/** Same map as upload-datasets.mjs (market → segment → file). */
const DATASETS = {
  DE: ['products.json', 'products-commercial.json'],
  GB: ['products-gb.json', 'products-commercial-gb.json'],
  FR: ['products-fr.json', 'products-commercial-fr.json'],
  PL: ['products-pl.json', 'products-commercial-pl.json'],
  IT: ['products-it.json', 'products-commercial-it.json'],
};
const MARKETS = (arg('markets') ?? Object.keys(DATASETS).join(',')).split(',').map(s => s.trim().toUpperCase()).filter(cc => DATASETS[cc]);

const berlinMonth = () => {
  const p = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit' })
    .formatToParts(new Date()).reduce((a, x) => (a[x.type] = x.value, a), {});
  return `${p.year}-${p.month}`;
};
const MONTH = arg('month') ?? berlinMonth();
if (!/^\d{4}-\d{2}$/.test(MONTH)) { console.error(`bad --month=${MONTH}`); process.exit(2); }

const CANARIES = JSON.parse(readFileSync(join(ROOT, 'scripts/canary/canary-records.json'), 'utf8'));

function readLive(cc, file) {
  const raw = execFileSync('gcloud', ['storage', 'cat', `${BUCKET}/datasets/${cc}/${file}`],
    { maxBuffer: 512 * 1024 * 1024, timeout: 180_000, stdio: ['ignore', 'pipe', 'pipe'] });
  let text;
  try { text = gunzipSync(raw).toString('utf8'); } catch { text = raw.toString('utf8'); }
  return JSON.parse(text).items ?? [];
}
const readLocal = (file) => JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8')).items ?? [];

const allZero = (c) => !c || (c.listing + c.added + c.removed + c.specs) === 0;
const savedPath = (cc) => join(OUT_DIR, cc, `${MONTH}.json`);

let problems = 0;
let computed = 0, published = 0;
const summary = [];

if (SAVE || !PUBLISH) {
  for (const cc of MARKETS) {
    let previous = [], candidate = [];
    try {
      for (const f of DATASETS[cc]) previous.push(...readLive(cc, f));
    } catch (e) { console.error(`! ${cc}: live objects unreadable — skipped (${String(e.message).slice(0, 160)})`); problems++; continue; }
    try {
      for (const f of DATASETS[cc]) candidate.push(...readLocal(f));
    } catch (e) { console.error(`! ${cc}: local build unreadable in ${DATA_DIR} — skipped (${String(e.message).slice(0, 160)})`); problems++; continue; }

    const diff = diffMarket(cc, previous, candidate, { canaries: CANARIES });
    const c = diff.counts;
    // A diff this large is far likelier a broken build than a real month; the
    // dataset gate would block its publication anyway. Recorded, but alerts
    // skip a suspect market rather than mail a false story.
    const suspect = c.previous > 0 && (c.removed / c.previous > 0.25 || c.added / c.previous > 0.5);
    const capped = capForStorage({ ...diff, month: MONTH, generatedAt: new Date().toISOString(), suspect });
    summary.push({ cc, ...c, suspect, truncated: capped.truncated });
    computed++;

    if (SAVE) {
      const p = savedPath(cc);
      if (allZero(c) && existsSync(p)) {
        try {
          const old = JSON.parse(readFileSync(p, 'utf8'));
          if (!allZero(old.counts)) { console.warn(`  ${cc}: all-zero diff — keeping the saved non-zero ${MONTH} list (re-run after publish?)`); continue; }
        } catch { /* unreadable old file → overwrite */ }
      }
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify(capped, null, 1) + '\n');
    }
  }

  console.log(`\nDataset changes ${MONTH} (live bucket → ${DATA_DIR})${SAVE ? '' : '  [dry run — nothing written]'}`);
  console.log('  market  previous candidate  listing   added removed   specs');
  for (const s of summary) {
    console.log(`  ${s.cc.padEnd(6)} ${String(s.previous).padStart(9)} ${String(s.candidate).padStart(9)} ${String(s.listing).padStart(8)} ${String(s.added).padStart(7)} ${String(s.removed).padStart(7)} ${String(s.specs).padStart(7)}`
      + (s.suspect ? '  SUSPECT' : '') + (s.truncated ? `  (stored lists capped: ${JSON.stringify(s.truncated)})` : ''));
  }
}

if (PUBLISH) {
  const { setDoc } = await import('./lib/firestore-rest.mjs');
  for (const cc of MARKETS) {
    const p = savedPath(cc);
    if (!existsSync(p)) { console.warn(`  ${cc}: no saved ${MONTH} change list — nothing to publish`); continue; }
    try {
      const doc = JSON.parse(readFileSync(p, 'utf8'));
      const payload = { ...doc, month: MONTH, publishedAt: new Date().toISOString() };
      await setDoc(`countries/${cc}/changes/${MONTH}`, payload);
      await setDoc(`countries/${cc}/changes/latest`, payload);
      published++;
      console.log(`  ✓ ${cc}: countries/${cc}/changes/{${MONTH},latest}`);
    } catch (e) { console.error(`! ${cc}: Firestore write failed — ${String(e.message).slice(0, 200)}`); problems++; }
  }
}

// A partial result is still a result: one unreadable market must not hold back
// the other four (problems are printed above). Non-zero only when NOTHING worked,
// which is what the window uses to skip the dependent steps.
if (problems) console.error(`\n${problems} problem(s) — see above`);
const nothing = ((SAVE || !PUBLISH) && computed === 0) || (PUBLISH && published === 0);
process.exit(nothing ? 1 : 0);
