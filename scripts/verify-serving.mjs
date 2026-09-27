#!/usr/bin/env node
/**
 * verify-serving.mjs — validate the datasets PRODUCTION IS ACTUALLY SERVING
 * (docs/DATASET_ROLLBACK_AND_PANIC.md).
 *
 * The dataset gate validates the CANDIDATE files before publish; this script
 * validates the SERVED bytes. The check logic itself lives in
 * google_cloud_function_billing/datasetChecks.js — the SAME module the Panic
 * Button uses pre/post-restore, so "verified" means one thing everywhere.
 *
 * TWO ROLES, ONE SCRIPT — the bytes examined are the same live objects either
 * way, so the checks must be too:
 *   • default      — POST-publish: did the release we just shipped come out healthy?
 *   • --preflight  — PRE-update (owner decision 2026-07-29): is what is live RIGHT
 *     NOW healthy, BEFORE upload-datasets.mjs freezes it as the run's rollback
 *     point? A snapshot of already-broken data is a worthless restore point —
 *     you would roll back INTO the fault. Failing here means the update never
 *     starts and nothing is touched; the operator is told that live data is
 *     unhealthy, which is more urgent than the update itself.
 *
 * Failure discipline (owner-approved): INFRA-type failures (download/network)
 * are retried 2× with a pause — a transient blip must never trigger a
 * rollback. DATA-type failures (parse, structure, counts, canary) fail
 * immediately — retrying cannot change bytes. Exit 1 on any persistent
 * failure; the caller (upload-datasets.mjs) then restores the run's snapshot
 * IN FULL. This script itself never mutates anything.
 *
 * Count baseline: data_manifests/stable-release.json — the LAST verified
 * release (upload-datasets writes it only AFTER this verification passes, so
 * a new release is always compared against the previous stable one).
 *
 * Usage: node scripts/verify-serving.mjs [--preflight]
 * Requires: gcloud auth with read access to the bucket.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { DATASETS, checkDataset, simulateMarket, basicFileName, checkBasicPair } =
  require(join(ROOT, 'google_cloud_function_billing/datasetChecks.js'));
const BASIC_FIELDS = new Set(JSON.parse(readFileSync(join(ROOT, 'src/config/datasetBasicFields.json'), 'utf8')).fields);

const BUCKET = 'gs://heatpumpdb-datasets';
const CANARIES = JSON.parse(readFileSync(join(ROOT, 'scripts/canary/canary-records.json'), 'utf8'));
const manifestPath = join(ROOT, 'data_manifests/stable-release.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
const expectedItems = new Map((manifest?.objects ?? []).map(o => [o.path, o.items]));

/**
 * Free + Premium split (2026-09-27): every full object has a *.basic.json
 * companion that must be its exact projection (same records, canary included).
 * The companions are REQUIRED after a publish. In --preflight they are
 * required only once the last stable release already carried them — the very
 * first split release runs its pre-update check against a live set that
 * pre-dates the companions, and that set is still healthy.
 */
const liveHasBasic = (manifest?.objects ?? []).some(o => String(o.path).endsWith('.basic.json'));


const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Download stored bytes (INFRA errors throw; caller retries). */
function download(objectPath) {
  return execFileSync('gcloud', ['storage', 'cat', `${BUCKET}/${objectPath}`],
    { maxBuffer: 256 * 1024 * 1024 });
}

/** Decode stored bytes → parsed JSON. DATA errors throw (no retry value). */
function decode(buf) {
  let text;
  try { text = gunzipSync(buf).toString('utf8'); }
  catch { text = buf.toString('utf8'); }
  return JSON.parse(text);
}

// ── Run ─────────────────────────────────────────────────────────────────────
/** Pre-update health check rather than post-publish verification (see header). */
const PREFLIGHT = process.argv.includes('--preflight');
const BASIC_REQUIRED = !PREFLIGHT || liveHasBasic;

console.log(PREFLIGHT
  ? 'PRE-UPDATE CHECK — validating the CURRENTLY LIVE set before it becomes the rollback point…\n'
  : 'Verifying the SERVED datasets…\n');

let failedAny = false;
const parsedBySegment = {};

for (const [cc, files] of Object.entries(DATASETS)) {
  parsedBySegment[cc] = {};
  for (const [segment, file] of Object.entries(files)) {
    const objectPath = `datasets/${cc}/${file}`;
    let ok = false;
    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {   // download retries: INFRA only
      let buf;
      try {
        buf = download(objectPath);
      } catch {
        lastErr = new Error(`download failed (attempt ${attempt})`);
        if (attempt < 3) await sleep(3000);
        continue;
      }
      try {
        const data = decode(buf);
        const { items, manufacturers } = checkDataset(data, {
          cc, segment,
          canaryId: CANARIES[cc]?.[segment]?.bafa_id,
          expectedItems: expectedItems.get(objectPath),
        });
        parsedBySegment[cc][segment] = items;
        console.log(`✓ ${objectPath} — ${items.length} items, ${manufacturers} manufacturers`);
        ok = true;
      } catch (e) {
        lastErr = e;   // DATA failure — retrying cannot help
      }
      break;
    }
    if (!ok) {
      console.error(`✗ ${objectPath} — ${lastErr?.message}`);
      failedAny = true;
    }
  }

  // ── Basic companions: same checks + exact-projection pair check ─────────
  for (const [segment, file] of Object.entries(files)) {
    const objectPath = `datasets/${cc}/${basicFileName(file)}`;
    let buf = null;
    for (let attempt = 1; attempt <= (BASIC_REQUIRED ? 3 : 1); attempt++) {
      try { buf = download(objectPath); break; }
      catch { if (attempt < 3 && BASIC_REQUIRED) await sleep(3000); }
    }
    if (!buf) {
      if (BASIC_REQUIRED) {
        console.error(`✗ ${objectPath} — download failed (basic companion missing?)`);
        failedAny = true;
      } else {
        console.log(`· ${objectPath} — not live yet (pre-split release); not required for this pre-update check`);
      }
      continue;
    }
    try {
      const data = decode(buf);
      const { items } = checkDataset(data, {
        cc, segment,
        canaryId: CANARIES[cc]?.[segment]?.bafa_id,
        expectedItems: expectedItems.get(objectPath),
      });
      const full = parsedBySegment[cc][segment];
      if (!full) throw new Error('full sibling failed its own checks — pair cannot be verified');
      checkBasicPair({ items: full }, data, BASIC_FIELDS);
      console.log(`✓ ${objectPath} — ${items.length} items, exact basic projection of ${file}`);
    } catch (e) {
      console.error(`✗ ${objectPath} — ${e.message}`);
      failedAny = true;
    }
  }

  if (parsedBySegment[cc].residential && parsedBySegment[cc].commercial) {
    try {
      simulateMarket(cc, parsedBySegment[cc].residential, parsedBySegment[cc].commercial);
      console.log(`✓ ${cc} functional simulation (split / search / lookup)`);
    } catch (e) {
      console.error(`✗ ${cc} functional simulation — ${e.message}`);
      failedAny = true;
    }
  }
}

if (failedAny) {
  if (PREFLIGHT) {
    // Not "the update failed" — the update never ran. What failed is production.
    console.error('\n✗ PRE-UPDATE CHECK FAILED — the live datasets are ALREADY unhealthy.');
    console.error('  The update was NOT started and NOTHING was touched. No snapshot was taken,');
    console.error('  because freezing this state would give us a broken rollback point.');
    console.error('\n  This needs an operator decision. Customers are being served the data above.');
    console.error('  Either repair production first (Panic Rollback to a verified snapshot), or,');
    console.error('  if the finding is understood and acceptable, proceed deliberately with:');
    console.error('    node scripts/upload-datasets.mjs --preflight-override --reason="…"');
    process.exit(1);
  }
  console.error('\n✗ SERVING VERIFICATION FAILED — do not declare this release stable.');
  process.exit(1);
}
console.log(PREFLIGHT
  ? '\n✓ Pre-update check passed — live data is healthy and safe to snapshot.'
  : '\n✓ Serving verification passed — the published set is healthy.');
