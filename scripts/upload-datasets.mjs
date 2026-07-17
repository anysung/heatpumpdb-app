#!/usr/bin/env node
/**
 * upload-datasets.mjs — ship the built product catalogues to the
 * auth-protected Storage bucket (gs://heatpumpdb-datasets/datasets/<CC>/…).
 *
 * Anti-scraping (2026-07-12): datasets are NO LONGER served as public
 * hosting files (/data/*.json is excluded from hosting deploys). The app
 * downloads them through the Firebase Storage SDK, and storage.rules only
 * admits signed-in, admin-approved accounts.
 *
 * On the way up, one fictitious residential + commercial CANARY record per
 * market (scripts/canary/canary-records.json) is appended to the served
 * copy — the committed/built source files stay clean. A canary surfacing in
 * third-party data is hard evidence of extraction (see the canary file).
 *
 * Usage: node scripts/upload-datasets.mjs [--dry-run]
 * Requires: gcloud auth (Application Default) with access to the bucket.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUCKET = 'gs://heatpumpdb-datasets';
const DRY = process.argv.includes('--dry-run');
// Set only after the gate was run with an explicit, recorded --override.
const GATE_PASSED = process.argv.includes('--gate-passed');

const CANARIES = JSON.parse(readFileSync(join(ROOT, 'scripts/canary/canary-records.json'), 'utf8'));

/** market → { segment → local dataset file } (mirrors countryProfiles.datasetPaths) */
const DATASETS = {
  DE: { residential: 'products.json',    commercial: 'products-commercial.json' },
  GB: { residential: 'products-gb.json', commercial: 'products-commercial-gb.json' },
  FR: { residential: 'products-fr.json', commercial: 'products-commercial-fr.json' },
  PL: { residential: 'products-pl.json', commercial: 'products-commercial-pl.json' },
};

/**
 * Build the canary as a schema-perfect clone of a real record: copy a
 * mid-list record from the same dataset (guarantees every field the app
 * expects exists), then overwrite identity/spec fields and null out any
 * external references that could be "verified" against real registries.
 */
function makeCanary(items, overrides) {
  const skeleton = JSON.parse(JSON.stringify(items[Math.floor(items.length / 2)]));
  const NULL_KEYS = [
    'uuid', 'eprel_registration_number', 'eprel_model', 'eprel_match_type',
    'bafa_reference_id', 'bafa_reference_model', 'bafa_reference_match_type',
    'nf_pac_reference', 'website',
    'outdoor_unit_model', 'idu_model', 'control_box_model', 'tank_model',
    'tower_model', 'hydraulic_module_model', 'indoor_side_equipment_model',
    'outdoor_side_display_model',
    'width_mm', 'height_mm', 'depth_mm', 'weight_kg', 'dimensions_raw', 'weight_raw',
    'physical_specs_confidence', 'physical_specs_estimated', 'physical_specs_source_type',
    'physical_specs_source_note', 'physical_specs_match_type', 'physical_specs_family',
    'scop', 'seer', 'cooling_efficiency', 'cooling_capacity_kw',
    'power_design_35C_kw', 'power_design_55C_kw', 'cop_A10W35',
    'max_electric_power_kw', 'refrigerant_2', 'refrigerant_2_amount_kg',
    'mcs_number', 'mcs_number_base', 'mcs_model_suffix', 'product_name',
  ];
  for (const k of NULL_KEYS) if (k in skeleton) skeleton[k] = null;
  if ('outdoor_side_identified' in skeleton) skeleton.outdoor_side_identified = false;
  if ('outdoor_side_display_kind' in skeleton) skeleton.outdoor_side_display_kind = null;
  return { ...skeleton, ...overrides };
}

/**
 * PUBLICATION GATE — generate → validate → review → publish.
 *
 * Uploading is the ONLY step that touches production, so it is the one step that
 * must not be reachable by accident. The gate re-validates the candidate datasets
 * against the last approved manifest (counts, duplicates, segment integrity, local
 * matching, source-country leakage) and exits non-zero on anything alarming. A
 * failed or half-finished update therefore leaves the live datasets untouched,
 * because we never get here.
 *
 * Override lives in the gate itself (--override --reason="…"), where it is recorded.
 */
if (!DRY && !GATE_PASSED) {
  console.log('Running the dataset gate before publishing…\n');
  try {
    execFileSync(process.execPath, [join(ROOT, 'scripts/dataset-gate.mjs')], { stdio: 'inherit' });
  } catch {
    console.error('\n✗ Dataset gate FAILED — nothing was uploaded. Production is unchanged.');
    console.error('  Fix the cause, or record an override:');
    console.error('  node scripts/dataset-gate.mjs --override --reason="…"  &&  node scripts/upload-datasets.mjs --gate-passed');
    process.exit(1);
  }
}

const tmp = mkdtempSync(join(tmpdir(), 'hpdb-datasets-'));
let failed = false;

for (const [cc, files] of Object.entries(DATASETS)) {
  for (const [segment, file] of Object.entries(files)) {
    const local = join(ROOT, 'public/data', file);
    let data;
    try {
      data = JSON.parse(readFileSync(local, 'utf8'));
    } catch (e) {
      console.error(`✗ ${cc}/${segment}: cannot read ${local} — ${e.message}`);
      failed = true;
      continue;
    }
    const overrides = CANARIES[cc]?.[segment];
    if (!overrides) { console.error(`✗ ${cc}/${segment}: no canary defined`); failed = true; continue; }
    if (data.items.some(i => i.bafa_id === overrides.bafa_id || (i.model === overrides.model && i.manufacturer === overrides.manufacturer))) {
      console.error(`✗ ${cc}/${segment}: canary id/model collides with a real record — pick a new id`);
      failed = true;
      continue;
    }
    const served = {
      ...data,
      _meta: { ...data._meta, total_items: (data._meta?.total_items ?? data.items.length) + 1 },
      items: [...data.items, makeCanary(data.items, overrides)],
    };
    const out = join(tmp, `${cc}-${file}`);
    writeFileSync(out, JSON.stringify(served));
    const dest = `${BUCKET}/datasets/${cc}/${file}`;
    if (DRY) {
      console.log(`[dry-run] would upload ${served.items.length} items → ${dest}`);
      continue;
    }
    execFileSync('gcloud', [
      'storage', 'cp', out, dest,
      '--cache-control=private, max-age=3600',
      '--content-type=application/json',
    ], { stdio: ['ignore', 'ignore', 'inherit'] });
    console.log(`✓ ${dest}  (${served.items.length} items incl. canary)`);
  }
}

rmSync(tmp, { recursive: true, force: true });
if (failed) process.exit(1);
