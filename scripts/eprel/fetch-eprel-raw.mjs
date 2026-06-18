#!/usr/bin/env node
/**
 * EPREL raw data fetcher — Heatpump Data Base internal data research.
 *
 * POLICY (do not weaken):
 *  - Uses ONLY the official EPREL Public API with a valid API key.
 *  - An API key must be requested at:
 *      https://eprel.ec.europa.eu/screen/requestpublicapikey
 *    and used under the official Terms & Conditions (see
 *    data_sources/eprel_raw/terms/API_TERMS_AND_CONDITIONS_EN.pdf).
 *  - WITHOUT a key this script runs in DRY-RUN ONLY: it prints the fetch plan
 *    and exits. It never falls back to anonymous bulk scraping.
 *  - Never bypasses authentication, tokens, CAPTCHAs, or anti-bot measures.
 *  - Never writes outside data_sources/eprel_raw/.
 *
 * Modes:
 *    node scripts/eprel/fetch-eprel-raw.mjs
 *      Dry-run: prints plan; probes API base if key is set; exits without saving data.
 *
 *    node scripts/eprel/fetch-eprel-raw.mjs --test
 *      Requires EPREL_API_KEY. Downloads 2 pages per category into:
 *        data_sources/eprel_raw/raw/test/official-api/
 *
 *    node scripts/eprel/fetch-eprel-raw.mjs --full
 *      Requires EPREL_API_KEY. Full paginated download into a versioned monthly snapshot:
 *        data_sources/eprel_raw/raw/YYYY-MM/
 *      Defaults to the current UTC month. Requires typing 'yes' to confirm.
 *
 *    node scripts/eprel/fetch-eprel-raw.mjs --full --snapshot 2026-06
 *      Same as --full but writes to an explicit snapshot label (e.g. for re-downloads).
 *
 * Environment:
 *    EPREL_API_KEY     the official Public API key (required for --test / --full)
 *    EPREL_API_BASE    optional override for the API base URL (skip candidate probing)
 */

import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createInterface } from 'node:readline';

// ─── Configuration ───────────────────────────────────────────────────────────

const REPO_ROOT = resolve(new URL('../..', import.meta.url).pathname);
const OUT_ROOT = resolve(REPO_ROOT, 'data_sources/eprel_raw');
const FETCH_LOG = resolve(OUT_ROOT, 'fetch-log.md');

function loadEnvLocal() {
  const envPath = resolve(REPO_ROOT, '.env.local');
  if (!existsSync(envPath)) return;

  const raw = readFileSync(envPath, 'utf8').trim();
  if (!raw) return;

  // Convenience mode: if .env.local contains only the raw key value (no '='),
  // treat that single line as EPREL_API_KEY.
  if (!raw.includes('=') && !raw.includes('\n')) {
    process.env.EPREL_API_KEY ||= raw;
    return;
  }

  // Standard .env.local mode: KEY=value lines.
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    process.env[key.trim()] ||= value;
  }
}

loadEnvLocal();

const API_KEY = process.env.EPREL_API_KEY || null;

// Candidate API base URLs, probed in order. The first to return parseable JSON wins.
// Confirmed 2026-06-18: https://eprel.ec.europa.eu/api responds 200 with X-API-KEY.
//                       https://eprel.ec.europa.eu/api/public responds 403 even with a valid key.
const CANDIDATE_BASES = process.env.EPREL_API_BASE
  ? [process.env.EPREL_API_BASE]
  : [
      'https://eprel.ec.europa.eu/api',        // confirmed working; X-API-KEY accepted
      'https://eprel.ec.europa.eu/api/public', // returns 403 with key; kept as secondary candidate
    ];

const USER_AGENT =
  'HeatpumpDataBase-internal-data-research/0.1 (EPREL Public API client; contact: sungyongsoo1976@gmail.com)';

// Conservative pacing: one request at a time, fixed inter-request delay.
const DELAY_MS = 1000;
const MAX_RETRIES = 4;
const PAGE_SIZE = 100;

// Categories to download. `query` parameters are appended to every list request.
// NOTE: spaceheaterpackages (111,497 records) is intentionally EXCLUDED until a
//       server-side heat-pump filter is confirmed in the official API docs —
//       the public-site endpoint ignored type/preferentialHeaterType filters.
const CATEGORIES = [
  {
    group: 'spaceheaters',
    folder: 'spaceheaters-heatpump',
    query: { type: 'HEAT_PUMP' },
    note: 'Space heaters/Combination heaters (Reg. EU 811/2013), heat pumps only (~45,480 records as of 2026-06-18)',
  },
  {
    group: 'spaceheatertemperaturecontrol',
    folder: 'temperature-controls',
    query: {},
    note: 'Temperature controls for space heaters (~840 records) — separate raw reference data',
  },
  {
    group: 'spaceheatersolardevice',
    folder: 'solar-devices',
    query: {},
    note: 'Solar devices for space heaters (~207 records) — separate raw reference data',
  },
];

// ─── Safety guards ───────────────────────────────────────────────────────────

function assertInsideOutRoot(path) {
  const abs = resolve(path);
  if (abs !== OUT_ROOT && !abs.startsWith(OUT_ROOT + sep)) {
    throw new Error(`SAFETY: refusing to write outside ${OUT_ROOT}: ${abs}`);
  }
  if (abs.includes(`${sep}public${sep}data${sep}`)) {
    throw new Error(`SAFETY: refusing to touch app dataset path: ${abs}`);
  }
  return abs;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function confirm(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function log(line) {
  const stamped = `- ${new Date().toISOString()} ${line}`;
  console.log(stamped);
  await appendFile(assertInsideOutRoot(FETCH_LOG), stamped + '\n');
}

// ─── HTTP ────────────────────────────────────────────────────────────────────

async function apiGet(url) {
  let attempt = 0;
  for (;;) {
    attempt += 1;
    let res = null;
    try {
      res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
          'X-API-KEY': API_KEY,
        },
      });
    } catch (err) {
      if (attempt > MAX_RETRIES) throw err;
      await sleep(DELAY_MS * 2 ** attempt);
      continue;
    }
    if (res.ok) return res;
    // Respect rate limiting; back off on server errors. Any other status is final.
    if ((res.status === 429 || res.status >= 500) && attempt <= MAX_RETRIES) {
      const retryAfter = Number(res.headers.get('retry-after')) || 0;
      await sleep(Math.max(retryAfter * 1000, DELAY_MS * 2 ** attempt));
      continue;
    }
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} for ${url} :: ${body.slice(0, 200)}`);
  }
}

function listUrl(base, cat, page, limit) {
  const params = new URLSearchParams({
    ...cat.query,
    _page: String(page),
    _limit: String(limit),
  });
  return `${base}/products/${cat.group}?${params}`;
}

// Probe candidate bases with a minimal 1-record request and return the first
// base that answers with parseable JSON.
async function resolveApiBase() {
  for (const base of CANDIDATE_BASES) {
    const url = listUrl(base, CATEGORIES[0], 1, 1);
    try {
      const res = await apiGet(url);
      const text = await res.text();
      JSON.parse(text);
      await log(`probe OK: ${base} (HTTP ${res.status})`);
      return base;
    } catch (err) {
      await log(`probe failed: ${base} → ${String(err).slice(0, 160)}`);
    }
    await sleep(DELAY_MS);
  }
  return null;
}

// ─── Fetch loop ──────────────────────────────────────────────────────────────

/**
 * Download all pages for one category.
 *
 * @param {string} base  - confirmed API base URL
 * @param {object} cat   - entry from CATEGORIES
 * @param {object} opts
 *   maxPages   {number|null} - stop after this many pages (test mode); null = no limit
 *   outDir     {string}      - path relative to OUT_ROOT where pages are written
 *   snapshot   {string|null} - YYYY-MM label; written into _meta.json if writeMeta is true
 *   writeMeta  {boolean}     - write _meta.json after all pages complete (full mode only)
 */
async function fetchCategory(base, cat, { maxPages, outDir, snapshot = null, writeMeta = false }) {
  const dir = assertInsideOutRoot(resolve(OUT_ROOT, outDir, cat.folder));
  await mkdir(dir, { recursive: true });

  const startedAt = new Date().toISOString();
  let page = 1;
  let total = null;
  let saved = 0;
  let skipped = 0;

  for (;;) {
    const file = resolve(dir, `page-${String(page).padStart(4, '0')}.json`);

    // Skip pages already downloaded in a previous (interrupted) run.
    // A page is considered valid only if it parses and has non-empty hits.
    if (existsSync(file)) {
      try {
        const cached = JSON.parse(readFileSync(file, 'utf8'));
        if (Array.isArray(cached.hits) && cached.hits.length > 0) {
          if (total === null) total = cached.size ?? null;
          saved += cached.hits.length;
          skipped++;
          const lastPage = total !== null ? Math.ceil(total / PAGE_SIZE) : page;
          if (page >= lastPage) break;
          if (maxPages && page >= maxPages) break;
          page += 1;
          continue;
        }
      } catch (_) { /* corrupt or empty file — fall through to re-fetch */ }
    }

    const url = listUrl(base, cat, page, PAGE_SIZE);
    const res = await apiGet(url);
    const text = await res.text(); // save verbatim — no transformation
    const parsed = JSON.parse(text); // parse only to read pagination metadata
    if (total === null) {
      total = parsed.size ?? null;
      await log(`${cat.group}: total reported = ${total}`);
    }
    await writeFile(assertInsideOutRoot(file), text);
    saved += parsed.hits?.length ?? 0;
    await log(`${cat.group}: saved page ${page} (${parsed.hits?.length ?? 0} records)`);

    const lastPage = total !== null ? Math.ceil(total / PAGE_SIZE) : page;
    if (page >= lastPage || (parsed.hits?.length ?? 0) === 0) break;
    if (maxPages && page >= maxPages) {
      await log(`${cat.group}: stopping at maxPages=${maxPages} (test mode)`);
      break;
    }
    page += 1;
    await sleep(DELAY_MS);
  }

  if (skipped > 0) {
    await log(`${cat.group}: skipped ${skipped} already-downloaded pages (resume mode)`);
  }

  // Write _meta.json for full snapshots. This file records what was downloaded,
  // from where, and whether the snapshot is complete. It is gitignored (inside raw/20*/).
  if (writeMeta && snapshot) {
    const completedAt = new Date().toISOString();
    const totalPagesExpected = total !== null ? Math.ceil(total / PAGE_SIZE) : page;
    const complete = total !== null && page >= totalPagesExpected;
    const meta = {
      snapshot,
      group: cat.group,
      categoryKey: cat.folder,
      apiBase: base,
      endpoint: `${base}/products/${cat.group}`,
      filters: cat.query,
      pageSize: PAGE_SIZE,
      totalRecordsExpected: total,
      totalPagesExpected,
      pagesSaved: page,
      pagesSkippedThisRun: skipped,
      recordsSaved: saved,
      startedAt,
      completedAt,
      complete,
    };
    const metaPath = assertInsideOutRoot(resolve(dir, '_meta.json'));
    await writeFile(metaPath, JSON.stringify(meta, null, 2));
    await log(`${cat.group}: wrote _meta.json (complete=${complete}, records=${saved}/${total ?? '?'})`);
  }

  return {
    group: cat.group,
    totalReported: total,
    recordsSaved: saved,
    pagesSaved: page,
    pagesSkipped: skipped,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const MODE = args.has('--full') ? 'full' : args.has('--test') ? 'test' : 'dry-run';

// Snapshot label for --full output path: defaults to the current UTC month (YYYY-MM).
// Override with --snapshot YYYY-MM to target a specific month (e.g. re-download or backfill).
function currentSnapshot() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
const snapshotArgIdx = rawArgs.indexOf('--snapshot');
const SNAPSHOT_ARG = snapshotArgIdx !== -1 ? (rawArgs[snapshotArgIdx + 1] ?? null) : null;
const SNAPSHOT = (SNAPSHOT_ARG && /^\d{4}-\d{2}$/.test(SNAPSHOT_ARG))
  ? SNAPSHOT_ARG
  : currentSnapshot();

console.log(`EPREL raw fetcher — mode: ${MODE}`);
console.log(`Output root: ${OUT_ROOT}`);
console.log('Plan:');
for (const cat of CATEGORIES) {
  const dest =
    MODE === 'full' ? `raw/${SNAPSHOT}/${cat.folder}/` :
    MODE === 'test' ? `raw/test/official-api/${cat.folder}/` :
    '(no output — dry-run)';
  console.log(`  • ${cat.group} → ${dest}  (${cat.note})`);
}
console.log('  • spaceheaterpackages: EXCLUDED (no confirmed heat-pump filter; 111k records)');

if (!API_KEY) {
  console.log(`
No EPREL_API_KEY set → dry-run only, nothing fetched.

To proceed:
  1. Request an official Public API key:  https://eprel.ec.europa.eu/screen/requestpublicapikey
  2. Review the Terms & Conditions:       data_sources/eprel_raw/terms/API_TERMS_AND_CONDITIONS_EN.pdf
  3. Add the key to .env.local (gitignored): EPREL_API_KEY=<key>
  4. Run test mode to validate:           node scripts/eprel/fetch-eprel-raw.mjs --test
  5. If the test succeeds, run full:      node scripts/eprel/fetch-eprel-raw.mjs --full

This script will NOT download bulk data anonymously.`);
  process.exit(0);
}

const base = await resolveApiBase();
if (!base) {
  await log('FATAL: no candidate API base answered with this key. Check the official docs for the correct base URL and set EPREL_API_BASE.');
  process.exit(1);
}

if (MODE === 'dry-run') {
  await log('dry-run with key: API base probe succeeded; no data fetched. Use --test next.');
  process.exit(0);
}

if (MODE === 'full') {
  const snapshotDir = resolve(OUT_ROOT, 'raw', SNAPSHOT);
  // Estimated page counts based on counts confirmed 2026-06-18.
  const estimatedPagesHP = Math.ceil(45480 / PAGE_SIZE);
  const estimatedPagesTC = Math.ceil(840 / PAGE_SIZE);
  const estimatedPagesSD = Math.ceil(207 / PAGE_SIZE);
  const estimatedPages = estimatedPagesHP + estimatedPagesTC + estimatedPagesSD;
  const estimatedSecs = Math.ceil((estimatedPages * DELAY_MS) / 1000);
  console.log(`\n──────────────────────────────────────────────────────`);
  console.log(`FULL download summary:`);
  console.log(`  Snapshot   : ${SNAPSHOT}`);
  console.log(`  Categories : ${CATEGORIES.length} (spaceheaters/heat-pumps, temp-controls, solar-devices)`);
  console.log(`  Est. pages : ~${estimatedPages} (${estimatedPagesHP} + ${estimatedPagesTC} + ${estimatedPagesSD})`);
  console.log(`  Est. time  : ~${Math.ceil(estimatedSecs / 60)} minutes at ${DELAY_MS}ms/req`);
  console.log(`  Output dir : ${snapshotDir}`);
  console.log(`  _meta.json : written per category folder after completion`);
  console.log(`  NOTE: This key is for PRODUCTION use only — do not use in load tests.`);
  console.log(`──────────────────────────────────────────────────────`);
  const answer = await confirm('\nType "yes" to proceed with full download, anything else to abort: ');
  if (answer !== 'yes') {
    console.log('Aborted.');
    process.exit(0);
  }
}

const results = [];
for (const cat of CATEGORIES) {
  results.push(
    await fetchCategory(base, cat, MODE === 'test'
      ? { maxPages: 2, outDir: 'raw/test/official-api', snapshot: null, writeMeta: false }
      : { maxPages: null, outDir: `raw/${SNAPSHOT}`, snapshot: SNAPSHOT, writeMeta: true }),
  );
  await sleep(DELAY_MS);
}

await log(`run complete (${MODE}): ${JSON.stringify(results)}`);
console.log('\nDone. Update data_sources/eprel_raw/manifest.json with these results:');
console.table(results);
