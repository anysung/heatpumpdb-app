/**
 * Basic dataset allowlist (Free + Premium split, 2026-09-27).
 *
 *   src/config/datasetBasicFields.json   — the ONE allowlist
 *   datasetChecks.js projectBasicRecord  — the pipeline / Panic Button projection
 *   src/services/basicProjection.ts      — the client (dev-server) projection
 *
 * Asserts: the allowlist keeps every field segmentation, local listing and the
 * W35/W55 class derivation need; drops every premium field; both projections
 * agree; and, for every market file in public/data, the basic projection keeps
 * every record with an unchanged segment, listing status and energy classes.
 *
 * Run: node tests/dataset-basic-fields.unit.mjs
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { transform } from 'esbuild';

const root = new URL('../', import.meta.url);
const path = rel => fileURLToPath(new URL(rel, root));
const require = createRequire(import.meta.url);

const BASIC = JSON.parse(await readFile(path('src/config/datasetBasicFields.json'), 'utf8'));
const FIELDS = new Set(BASIC.fields);
const checks = require(path('google_cloud_function_billing/datasetChecks.js'));

/** Load a TS module in-process (same approach as segmentation.unit.mjs). */
async function loadTs(rel, replacements = {}) {
  let src = await readFile(path(rel), 'utf8');
  for (const [a, b] of Object.entries(replacements)) src = src.replace(a, b);
  const { code } = await transform(src, { loader: 'ts', format: 'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
const seg = await loadTs('src/config/segmentation.ts');
// basicProjection.ts imports the JSON; inline it for the data: URL import.
const client = await loadTs('src/services/basicProjection.ts', {
  "import basicFields from '../config/datasetBasicFields.json';":
    `const basicFields = ${JSON.stringify(BASIC)};`,
});

let failed = 0, passed = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { passed++; return; }
  failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
};

// ── 1. The allowlist itself ────────────────────────────────────────────────
const MUST_KEEP = [
  // identity / keys (App keying, honeytoken filter, search, registry ids)
  'source_id', 'bafa_id', 'european_reference_id', 'bafa_reference_id', 'mcs_number',
  'manufacturer', 'manufacturer_short', 'model', 'outdoor_unit_model', 'outdoor_side_display_model', 'idu_model',
  'type', 'installation_type',
  // every capacity segmentation.ts ratedCapacityKw reads + the 55 °C column
  'power_35C_kw', 'power_design_35C_kw', 'power_55C_kw', 'power_design_55C_kw', 'declared_capacity_kw',
  // SCOP + ηs → W35/W55 energy classes
  'scop', 'efficiency_35C_percent', 'efficiency_55C_percent',
  'refrigerant',
  // local listing (src/hpiq/listing.ts) + snapshot dates + NF PAC
  'bafa_listing_status', 'bafa_snapshot_fetched_at', 'pel_match_status', 'pel_snapshot_fetched_at',
  'zum_match_status', 'zum_id', 'gse_match_status', 'gse_entry_key', 'gse_match_method', 'gse_snapshot',
  'agrement_match_status', 'agrement_number', 'nf_pac_reference',
  // EPREL + provenance
  'eprel_registration_number', 'performance_source', 'source_snapshot_generated_at',
];
for (const k of MUST_KEEP) ok(`allowlist keeps ${k}`, FIELDS.has(k));

const PREMIUM = [
  'cop_A7W35', 'cop_A2W35', 'cop_AMinus7W35', 'cop_A10W35',
  'noise_outdoor_dB', 'noise_indoor_dB',
  'refrigerant_amount_kg', 'refrigerant_2_amount_kg',
  'grid_ready', 'grid_ready_type',
  'gse_ratings', 'gse_temp_assignment',
  'seer', 'cooling_capacity_kw', 'cooling_efficiency', 'max_electric_power_kw',
  'temp_diff', 'defrost_tested', 'defrost_type', 'drive_type', 'power_control', 'num_compressors',
  'heat_meter', 'ee_display', 'ee_display_type',
  // already stripped from every served copy — must never re-enter via basic
  'uuid', 'dimensions_raw', 'weight_kg', 'width_mm', 'height_mm', 'depth_mm',
];
for (const k of PREMIUM) ok(`allowlist drops premium ${k}`, !FIELDS.has(k));
ok('no COP/noise/charge pattern in allowlist',
  ![...FIELDS].some(k => /^cop_|noise|_amount_kg$|^grid_ready|ratings$/i.test(k)),
  [...FIELDS].filter(k => /^cop_|noise|_amount_kg$|^grid_ready|ratings$/i.test(k)).join(', '));
ok('allowlist has no duplicates', FIELDS.size === BASIC.fields.length);
ok('allowlist carries a _readme', Array.isArray(BASIC._readme) && BASIC._readme.length > 0);

// ── 2. Both projections agree, on a synthetic record ───────────────────────
const sample = {
  source_id: 'X1', manufacturer: 'M', model: 'A B C', power_35C_kw: 24, power_55C_kw: 22,
  efficiency_35C_percent: 180, efficiency_55C_percent: 130, scop: 4.5, refrigerant: 'R290',
  cop_A7W35: 5, cop_A2W35: 4, noise_outdoor_dB: 50, refrigerant_amount_kg: 1.2, grid_ready: true,
  gse_ratings: [{ kw: 1 }], pel_match_status: 'confirmed', mcs_number: 'MCS-1',
};
const a = checks.projectBasicRecord(sample, BASIC.fields);
const b = client.projectBasic(sample);
ok('client and pipeline projections agree', JSON.stringify(a) === JSON.stringify(b),
  `${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
ok('projection drops COP/noise/charge/grid/gse_ratings',
  !('cop_A7W35' in a) && !('noise_outdoor_dB' in a) && !('refrigerant_amount_kg' in a) && !('grid_ready' in a) && !('gse_ratings' in a));
ok('projection keeps absent keys absent (no invented nulls)', !('bafa_id' in a));
ok('projected record segments identically', seg.segmentOfProduct(a) === seg.segmentOfProduct(sample) && seg.segmentOfProduct(a) === 'commercial');
ok('file naming', client.datasetFileForTier('products-fr.json', 'basic') === 'products-fr.basic.json'
  && client.datasetFileForTier('products-fr.json', 'full') === 'products-fr.json'
  && checks.basicFileName('products-commercial-it.json') === 'products-commercial-it.basic.json');
ok('expected restore set = 10 full + 10 basic', checks.expectedObjectPaths().length === 20
  && checks.expectedObjectPaths({ basic: false }).length === 10);

// checkBasicPair rejects a premium leak and a dropped record
const pairFull = { items: [sample, { ...sample, source_id: 'X2' }] };
const pairBasic = checks.projectBasicDataset(pairFull, BASIC.fields, BASIC.version);
let threw = null;
try { checks.checkBasicPair(pairFull, pairBasic, BASIC.fields); } catch (e) { threw = e; }
ok('checkBasicPair accepts an exact projection', threw === null, threw?.message);
threw = null;
try { checks.checkBasicPair(pairFull, { items: [pairBasic.items[0]] }, BASIC.fields); } catch (e) { threw = e; }
ok('checkBasicPair rejects a dropped record', threw !== null);
threw = null;
try { checks.checkBasicPair(pairFull, { items: pairFull.items }, BASIC.fields); } catch (e) { threw = e; }
ok('checkBasicPair rejects a premium field in a basic object', threw !== null);

// ── 3. Every market file in public/data ────────────────────────────────────
const cls = eta => {
  if (eta == null || !Number.isFinite(eta)) return '—';
  return eta >= 150 ? 'A+++' : eta >= 125 ? 'A++' : eta >= 98 ? 'A+' : eta >= 90 ? 'A' : eta >= 82 ? 'B' : eta >= 75 ? 'C' : eta >= 36 ? 'D' : 'E';
};
const LISTING = ['bafa_listing_status', 'pel_match_status', 'zum_match_status', 'zum_id', 'gse_match_status',
  'agrement_match_status', 'agrement_number', 'mcs_number', 'nf_pac_reference', 'eprel_registration_number'];
const EXPECTED_FILES = Object.values(checks.DATASETS).flatMap(f => Object.values(f));
const dataDir = path('public/data/');
if (!existsSync(dataDir)) {
  console.warn('  ⚠ public/data missing — per-file checks skipped (build the datasets first)');
} else {
  const present = new Set(await readdir(dataDir));
  for (const file of EXPECTED_FILES) {
    if (!present.has(file)) { ok(`${file} present`, false); continue; }
    const full = JSON.parse(await readFile(dataDir + file, 'utf8'));
    const basic = checks.projectBasicDataset(full, BASIC.fields, BASIC.version);
    ok(`${file}: basic count == full count`, basic.items.length === full.items.length,
      `${basic.items.length} vs ${full.items.length}`);
    let segDiff = 0, listDiff = 0, classDiff = 0, leak = 0, noId = 0;
    const leakedKeys = new Set();
    full.items.forEach((r, i) => {
      const p = basic.items[i];
      if (seg.segmentOfProduct(r) !== seg.segmentOfProduct(p) || seg.ratedCapacityKw(r) !== seg.ratedCapacityKw(p)) segDiff++;
      if (LISTING.some(k => (r[k] ?? null) !== (p[k] ?? null))) listDiff++;
      if (cls(r.efficiency_35C_percent) !== cls(p.efficiency_35C_percent)
        || cls(r.efficiency_55C_percent) !== cls(p.efficiency_55C_percent)
        || (r.power_55C_kw ?? null) !== (p.power_55C_kw ?? null)
        || (r.scop ?? null) !== (p.scop ?? null)) classDiff++;
      for (const k of Object.keys(p)) if (PREMIUM.includes(k)) { leak++; leakedKeys.add(k); }
      if (!(p.source_id || p.bafa_id || p.european_reference_id) || !p.manufacturer || !p.model) noId++;
    });
    ok(`${file}: segmentation unchanged`, segDiff === 0, `${segDiff} records`);
    ok(`${file}: listing/EPREL fields unchanged`, listDiff === 0, `${listDiff} records`);
    ok(`${file}: 55°C capacity, SCOP and W35/W55 classes unchanged`, classDiff === 0, `${classDiff} records`);
    ok(`${file}: no premium field survives`, leak === 0, [...leakedKeys].join(', '));
    ok(`${file}: every record keeps identity`, noId === 0, `${noId} records`);
    // Native layers keep their provenance (PL ZUM_REGISTRY, IT GSE_CATALOGUE).
    const natives = full.items.filter(r => r.performance_source === 'ZUM_REGISTRY' || r.performance_source === 'GSE_CATALOGUE').length;
    if (natives) {
      const kept = basic.items.filter(r => r.performance_source === 'ZUM_REGISTRY' || r.performance_source === 'GSE_CATALOGUE').length;
      ok(`${file}: native-layer provenance kept`, kept === natives, `${kept} vs ${natives}`);
      const gseNative = basic.items.filter(r => r.gse_match_method === 'gse_native').length;
      const gseNativeFull = full.items.filter(r => r.gse_match_method === 'gse_native').length;
      ok(`${file}: gse_native source-mix marker kept`, gseNative === gseNativeFull);
    }
  }
}

console.log(failed ? `\n✗ ${failed} of ${passed + failed} assertion(s) failed\n` : `\n✓ all ${passed} basic-dataset assertions passed\n`);
process.exit(failed ? 1 : 0);
