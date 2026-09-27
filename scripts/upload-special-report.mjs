#!/usr/bin/env node
/**
 * upload-special-report.mjs — put a PREMIUM Special Report edition's report
 * file into the auth-protected datasets bucket (owner, 2026-09-27).
 *
 * Free samples (2026-08, 2026-09) ship on public hosting as before. From the
 * October 2026 edition (special-report-store: isPremiumEdition) the public
 * build deliberately leaves the report file out, and this script is how it
 * reaches members instead:
 *
 *   gs://heatpumpdb-datasets/special-report/<edition>/<reportFile>
 *
 * storage.rules lets only entitled (Premium / trial / admin) accounts read that
 * path; the app's Special Report page downloads it with the Storage SDK.
 *
 *   node scripts/upload-special-report.mjs --dry-run
 *   node scripts/upload-special-report.mjs [--edition 2026-10]
 *
 * Idempotent: re-running overwrites the same object.
 */
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, statSync } from 'node:fs';
import { editions, isPremiumEdition, premiumReportPath } from './lib/special-report-store.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUCKET = 'gs://heatpumpdb-datasets';
const DRY = process.argv.includes('--dry-run');
const wanted = (() => {
  const i = process.argv.indexOf('--edition');
  return i >= 0 ? process.argv[i + 1] : null;
})();

const targets = editions(ROOT)
  .filter((ed) => isPremiumEdition(ed))
  .filter((ed) => !wanted || ed.id === wanted);

if (wanted && !targets.length) {
  console.error(`upload-special-report: ${wanted} is not a Premium edition (or has no article.json) — nothing to upload.`);
  process.exit(1);
}
if (!targets.length) {
  console.log('upload-special-report: no Premium editions yet — nothing to do.');
  process.exit(0);
}

for (const ed of targets) {
  const src = join(ed.dir, ed.meta.reportFile);
  if (!existsSync(src)) { console.error(`  ✗ ${ed.id}: ${src} missing`); process.exitCode = 1; continue; }
  const dest = `${BUCKET}/${premiumReportPath(ed)}`;
  const kb = (statSync(src).size / 1024).toFixed(0);
  if (DRY) { console.log(`  · would upload ${ed.id} (${kb} kB) → ${dest}`); continue; }
  execFileSync('gcloud', [
    'storage', 'cp', src, dest,
    '--content-type=text/html; charset=utf-8',
    '--cache-control=private, max-age=3600',
  ], { stdio: 'inherit' });
  console.log(`  ✓ ${ed.id} (${kb} kB) → ${dest}`);
}
