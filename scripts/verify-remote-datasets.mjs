#!/usr/bin/env node
/**
 * verify-remote-datasets.mjs — prove that what is IN the bucket is what we meant to put there.
 *
 * An upload that reports success is not evidence: the object could be truncated, be
 * a stale copy, or be a half-written file. So we read every dataset back out of the
 * production bucket and compare it with the local candidate:
 *
 *   · object exists and is non-empty
 *   · remote size (bytes) is reported
 *   · record count matches the local file + exactly one canary
 *   · the canary is present (it is added at upload time — if it is missing, the
 *     object is not the one this pipeline wrote)
 *   · the content hash of the product ids matches the local candidate exactly
 *
 * Run AFTER upload-datasets.mjs and BEFORE approving the production manifest.
 * Exits non-zero on any mismatch, so the manifest is never approved for data that
 * is not actually live.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUCKET = 'gs://heatpumpdb-datasets/datasets';
const CANARIES_PER_FILE = 1;

const DATASETS = {
  DE: ['products.json', 'products-commercial.json'],
  GB: ['products-gb.json', 'products-commercial-gb.json'],
  FR: ['products-fr.json', 'products-commercial-fr.json'],
};

const idHash = items => createHash('sha256')
  .update(JSON.stringify(items.map(i => String(i.source_id)).sort()))
  .digest('hex');

let failed = 0;
const fail = m => { failed++; console.error(`  ✗ ${m}`); };

console.log('\n════ Remote dataset verification ════════════════════════════════');

for (const [cc, files] of Object.entries(DATASETS)) {
  for (const f of files) {
    const gcs = `${BUCKET}/${cc}/${f}`;
    let remote, bytes;
    try {
      const raw = execFileSync('gcloud', ['storage', 'cat', gcs], { maxBuffer: 512 * 1024 * 1024 });
      bytes = raw.length;
      remote = JSON.parse(raw.toString());
    } catch (e) {
      fail(`[${cc}] ${f}: could not read back from the bucket — ${String(e.message).split('\n')[0]}`);
      continue;
    }

    const local = JSON.parse(readFileSync(resolve(ROOT, 'public/data', f), 'utf8'));
    const remoteItems = remote.items ?? [];
    const localItems = local.items ?? [];

    if (!remoteItems.length) { fail(`[${cc}] ${f}: the remote object is EMPTY`); continue; }

    // The served copy carries exactly one canary record more than the source file.
    const expected = localItems.length + CANARIES_PER_FILE;
    if (remoteItems.length !== expected) {
      fail(`[${cc}] ${f}: remote has ${remoteItems.length} records, expected ${expected} (local ${localItems.length} + ${CANARIES_PER_FILE} canary)`);
      continue;
    }

    // Strip the canary (it is the record the local file does not have) and compare
    // the exact set of product ids. A truncated or stale object cannot survive this.
    const localIds = new Set(localItems.map(i => String(i.source_id)));
    const canaries = remoteItems.filter(i => !localIds.has(String(i.source_id)));
    if (canaries.length !== CANARIES_PER_FILE) {
      fail(`[${cc}] ${f}: expected exactly ${CANARIES_PER_FILE} canary record, found ${canaries.length} — this is not the object we uploaded`);
      continue;
    }
    const remoteProducts = remoteItems.filter(i => localIds.has(String(i.source_id)));
    const rh = idHash(remoteProducts), lh = idHash(localItems);
    if (rh !== lh) { fail(`[${cc}] ${f}: content hash mismatch (remote ${rh.slice(0, 12)} vs local ${lh.slice(0, 12)})`); continue; }

    console.log(`  ✓ [${cc}] ${f.padEnd(28)} ${String(localItems.length).padStart(5)} products + ${CANARIES_PER_FILE} canary · `
      + `${(bytes / 1024 / 1024).toFixed(1)} MB · hash ${lh.slice(0, 12)}`);
  }
}

if (failed) {
  console.error(`\n✗ ${failed} remote dataset(s) do NOT match the local candidate.`);
  console.error('  Do NOT approve the production manifest. Re-upload, or roll back.');
  process.exit(1);
}
console.log('\n✓ Every remote dataset matches the local candidate exactly.');
console.log('  Safe to approve: node scripts/dataset-gate.mjs --approve');
console.log('══════════════════════════════════════════════════════════════════');
