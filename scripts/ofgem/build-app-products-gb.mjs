/**
 * build-app-products-gb.mjs  v1.0  (UK dataset builder — Phase A)
 *
 * Generates public/data/products-gb.json and public/data/products-commercial-gb.json
 * from the parsed Ofgem BUS Product Eligibility List (PEL).
 *
 * Primary source:  data_sources/ofgem_pel/parsed/YYYY-MM/pel-normalized.json
 *                  (newest snapshot auto-selected; --snapshot=YYYY-MM overrides)
 * Short names:     scripts/ofgem/manufacturer-short-names-gb.json (curated, committed)
 * Overlay source:  data_sources/ofgem_pel/matching/YYYY-MM/pel-bafa-matches.json
 *                  (optional; produced by match-pel-to-bafa.mjs — BAFA_REFERENCE
 *                  technical specs for PEL models also listed on the German
 *                  BAFA registry; performance_source is stamped 'BAFA_REFERENCE')
 *
 * Output shape mirrors the DE builder (build-app-products-from-master-seed.mjs):
 * same 75 base keys (DE-only values null) + 17 GB/PEL provenance keys
 * + 4 BAFA_REFERENCE keys = 96 fields.
 * The app loader reads `data.items`; the view model renders nulls as '—'.
 *
 * Policies:
 *   - Biomass records are excluded (heat pump app).
 *   - PEL publishes no performance data. Records matched to BAFA get technical
 *     specs copied as a cross-reference (performance_source='BAFA_REFERENCE');
 *     unmatched records keep null performance fields.
 *   - Segmentation: matched records are capacity-classified like DE
 *     (≤20.99 kW residential_core, 21–45 light_commercial, >45 commercial_project);
 *     light_commercial/commercial_project go to products-commercial-gb.json.
 *     Unmatched records (no capacity data) stay in products-gb.json with
 *     market_segment null.
 *   - Duplicate MCS numbers are real model variants sharing one certification
 *     number (e.g. Ares MB5 ×9). They are KEPT; source_id gets a '#n' suffix
 *     (n ≥ 2) for uniqueness. mcs_number stays raw for display.
 *   - installation_type is derived only from explicit Monobloc/Split keywords
 *     in product_name/model (installation_type_derived = 'name_keyword'), else null.
 *   - Eligibility honesty: PEL listing ≠ full BUS eligibility. certification
 *     status + caveat fields are passed through unchanged.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const EXPECTED_FIELD_COUNT = 96;
const PRICE_KEY_FRAGMENTS = ['price', 'brand_tier', 'price_confidence', 'package_scope', 'capacity_band', 'refrigerant_group'];

function loadJSON(relPath) {
  const abs = resolve(ROOT, relPath);
  try {
    return JSON.parse(readFileSync(abs, 'utf8'));
  } catch (err) {
    console.error(`Failed to load ${relPath}: ${err.message}`);
    process.exit(1);
  }
}

// ── Snapshot selection ────────────────────────────────────────────────────────
const snapArg = process.argv.find(a => a.startsWith('--snapshot='))?.split('=')[1] ?? null;
const PARSED_DIR = resolve(ROOT, 'data_sources/ofgem_pel/parsed');
const SNAPSHOT = snapArg ?? readdirSync(PARSED_DIR).filter(d => /^\d{4}-\d{2}$/.test(d)).sort().reverse()[0];
if (!SNAPSHOT) { console.error('No parsed PEL snapshot found.'); process.exit(1); }
console.log(`PEL parsed snapshot: ${SNAPSHOT}`);

const records = loadJSON(`data_sources/ofgem_pel/parsed/${SNAPSHOT}/pel-normalized.json`);
const shortNamesFile = loadJSON('scripts/ofgem/manufacturer-short-names-gb.json');
const shortNameMap = new Map(Object.entries(shortNamesFile.mapping));

// Raw snapshot download timestamp → pel_snapshot_fetched_at
function snapshotFetchedAt(id) {
  const p = resolve(ROOT, `data_sources/ofgem_pel/raw/${id}/_meta.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')).downloadedAt ?? null; } catch { return null; }
}
const PEL_FETCHED_AT = snapshotFetchedAt(SNAPSHOT);

// BAFA_REFERENCE overlay (optional) — produced by match-pel-to-bafa.mjs
const matchPath = resolve(ROOT, `data_sources/ofgem_pel/matching/${SNAPSHOT}/pel-bafa-matches.json`);
const matchFile = existsSync(matchPath) ? JSON.parse(readFileSync(matchPath, 'utf8')) : null;
const matchByKey = new Map((matchFile?.matches ?? []).map(m => [m.match_key, m]));
console.log(matchFile
  ? `BAFA_REFERENCE overlay: ${matchByKey.size} matches (seed ${matchFile._meta.bafa_seed_snapshot})`
  : 'BAFA_REFERENCE overlay: none (building without enrichment)');

const generatedAt = new Date().toISOString();

// ── Capacity-based segmentation (same policy as DE builder v2.0) ─────────────
function classifySegment(power_kw) {
  if (power_kw === null || power_kw === undefined || !Number.isFinite(Number(power_kw))) return null;
  const p = Number(power_kw);
  if (p <= 20.99) return 'residential_core';
  if (p <= 45) return 'light_commercial';
  return 'commercial_project';
}

// ── Filters & helpers ─────────────────────────────────────────────────────────

const HEAT_PUMP_TECH = new Set(['ASHP', 'WSHP', 'EAHP']);

/** UI type label per technology (English; GB build has no German type strings). */
const TYPE_LABEL = {
  ASHP: 'Air / Water',
  WSHP: 'Ground / Water',
  EAHP: 'Exhaust Air / Water',
};

/** 'Tue Jan 23 2024 00:00:00 GMT+0100 (…)' → '2024-01-23' (null-safe). */
function toISODate(s) {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  // Use UTC-noon shift-free date parts from the parsed local date to avoid TZ drift.
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Derive Monoblock/Split only from explicit name keywords; else null. */
function deriveInstallationType(r) {
  const s = `${r.product_name ?? ''} ${r.model ?? ''}`;
  if (/mono\s?blo[ck]k?/i.test(s)) return 'Monoblock';
  if (/\bsplit\b/i.test(s)) return 'Split';
  return null;
}

// ── Select heat pump records & assign unique source_id ───────────────────────

const biomassCount = records.filter(r => r.technology_type === 'Biomass').length;
const hp = records.filter(r => HEAT_PUMP_TECH.has(r.technology_type));

const seen = new Map(); // mcs_number → occurrences so far
const suffixed = [];
function uniqueSourceId(mcsNumber) {
  const n = (seen.get(mcsNumber) ?? 0) + 1;
  seen.set(mcsNumber, n);
  if (n === 1) return mcsNumber;
  const id = `${mcsNumber}#${n}`;
  suffixed.push(id);
  return id;
}

// ── Build one output item (92 fields) ─────────────────────────────────────────

function buildItem(r) {
  const installationType = deriveInstallationType(r);
  const m = matchByKey.get(`${r.mcs_number}||${r.model}`) ?? null;
  const sp = m?.specs ?? {};
  return {
    // ── Identity ────────────────────────────────────────────────────────────
    bafa_id: null,                       // GB records have no BAFA identity
    uuid: null,

    // ── Product info ────────────────────────────────────────────────────────
    manufacturer: r.brand ?? null,
    manufacturer_normalized: (r.brand ?? '').trim().toUpperCase() || null,
    manufacturer_short: shortNameMap.get(r.brand) ?? null,
    model: r.model ?? r.product_name ?? null,
    type: TYPE_LABEL[r.technology_type] ?? null,

    // ── Refrigerant (PEL: none; filled from BAFA_REFERENCE when matched) ────
    refrigerant: sp.refrigerant ?? null,
    refrigerant_2: sp.refrigerant_2 ?? null,
    refrigerant_amount_kg: sp.refrigerant_amount_kg ?? null,
    refrigerant_2_amount_kg: sp.refrigerant_2_amount_kg ?? null,

    // ── Heating performance (PEL: none; BAFA_REFERENCE when matched) ────────
    power_35C_kw: sp.power_35C_kw ?? null,
    efficiency_35C_percent: sp.efficiency_35C_percent ?? null,
    power_design_35C_kw: sp.power_design_35C_kw ?? null,
    power_55C_kw: sp.power_55C_kw ?? null,
    efficiency_55C_percent: sp.efficiency_55C_percent ?? null,
    power_design_55C_kw: sp.power_design_55C_kw ?? null,

    // ── COP / SCOP / SEER (PEL: none; BAFA_REFERENCE when matched) ──────────
    cop_A7W35: sp.cop_A7W35 ?? null,
    cop_A2W35: sp.cop_A2W35 ?? null,
    cop_AMinus7W35: sp.cop_AMinus7W35 ?? null,
    cop_A10W35: sp.cop_A10W35 ?? null,
    scop: r.scop ?? sp.scop ?? null,
    seer: sp.seer ?? null,

    // ── Cooling ─────────────────────────────────────────────────────────────
    cooling_efficiency: sp.cooling_efficiency ?? null,
    cooling_capacity_kw: sp.cooling_capacity_kw ?? null,

    // ── Noise & electrical ──────────────────────────────────────────────────
    noise_outdoor_dB: sp.noise_outdoor_dB ?? null,
    noise_indoor_dB: sp.noise_indoor_dB ?? null,
    max_electric_power_kw: sp.max_electric_power_kw ?? null,

    // ── System ──────────────────────────────────────────────────────────────
    drive_type: sp.drive_type ?? null,
    power_control: sp.power_control ?? null,
    num_compressors: sp.num_compressors ?? null,
    grid_ready: false,                  // German SG-Ready attestation — not copied
    grid_ready_type: null,
    ee_display: null,
    ee_display_type: null,
    heat_meter: null,
    defrost_tested: sp.defrost_tested ?? null,
    defrost_type: sp.defrost_type ?? null,
    temp_diff: sp.temp_diff ?? null,
    website: null,

    // ── Segmentation (capacity from BAFA_REFERENCE when matched) ─────────────
    market_segment: classifySegment(sp.power_35C_kw),
    installation_type: installationType,
    installation_type_derived: installationType ? 'name_keyword' : null,

    // ── Physical specs (no GB overlay yet) ──────────────────────────────────
    width_mm: null,
    height_mm: null,
    depth_mm: null,
    weight_kg: null,
    dimensions_raw: null,
    weight_raw: null,
    physical_specs_confidence: null,
    physical_specs_estimated: null,
    physical_specs_source_type: null,
    physical_specs_source_note: null,
    physical_specs_match_type: null,
    physical_specs_family: null,
    physical_specs_quarantined: null,
    physical_specs_quarantine_reason: null,
    physical_specs_last_checked_at: null,

    // ── Provenance (source-neutral) ─────────────────────────────────────────
    source_id: uniqueSourceId(r.mcs_number),
    country: 'GB',
    primary_source: 'OFGEM_PEL',
    bafa_listing_status: null,
    bafa_foerderung_von: null,
    bafa_foerderung_bis: null,
    bafa_snapshot_fetched_at: null,
    source_snapshot_generated_at: generatedAt,

    // ── GB / PEL provenance ─────────────────────────────────────────────────
    mcs_number: r.mcs_number,
    mcs_number_base: r.mcs_number_base ?? null,
    mcs_model_suffix: r.mcs_model_suffix ?? null,
    product_name: r.product_name ?? null,
    technology_type: r.technology_type,
    technology_type_raw: r.technology_type_raw ?? null,
    pel_certification_status: r.certification_status ?? null,
    mcs_cert_date: toISODate(r.mcs_cert_date),
    expiry_date: toISODate(r.expiry_date),
    pel_eligibility_interpretation: r.eligibility_interpretation ?? null,
    pel_eligibility_caveat: r.eligibility_caveat ?? null,
    pel_snapshot: r.source_snapshot ?? SNAPSHOT,
    pel_source_period: r.source_period ?? null,
    pel_source_last_modified: r.source_last_modified ?? null,
    pel_source_url: r.source_url ?? null,
    pel_snapshot_fetched_at: PEL_FETCHED_AT,

    // ── BAFA_REFERENCE enrichment provenance ────────────────────────────────
    performance_source: m ? 'BAFA_REFERENCE' : null,
    bafa_reference_id: m?.bafa_id ?? null,
    bafa_reference_model: m?.bafa_model ?? null,
    bafa_reference_match_type: m?.match_type ?? null,

    // ── Component / outdoor-side fields (no GB classification yet) ──────────
    outdoor_unit_model: null,
    idu_model: null,
    control_box_model: null,
    tank_model: null,
    tower_model: null,
    hydraulic_module_model: null,
    indoor_side_equipment_model: null,
    outdoor_side_identified: false,
    outdoor_side_display_model: null,
    outdoor_side_display_kind: null,
  };
}

const items = hp.map(buildItem);

// ── Validate ──────────────────────────────────────────────────────────────────

const fieldCount = Object.keys(items[0]).length;
if (fieldCount !== EXPECTED_FIELD_COUNT) {
  console.error(`FAIL: field count mismatch: expected ${EXPECTED_FIELD_COUNT}, got ${fieldCount}`);
  console.error('Fields:', Object.keys(items[0]).join(', '));
  process.exit(1);
}

const priceKeysFound = Object.keys(items[0]).filter(k =>
  PRICE_KEY_FRAGMENTS.some(frag => k.includes(frag))
);
if (priceKeysFound.length > 0) {
  console.error('FAIL: price-like keys present:', priceKeysFound.join(', '));
  process.exit(1);
}

const missingProvenance = items.filter(i =>
  !i.source_id || !i.mcs_number || i.country !== 'GB' ||
  i.primary_source !== 'OFGEM_PEL' || !i.pel_snapshot_fetched_at || !i.pel_certification_status
);
if (missingProvenance.length > 0) {
  console.error(`FAIL: ${missingProvenance.length} items missing required provenance`);
  process.exit(1);
}

const ids = new Set(items.map(i => i.source_id));
if (ids.size !== items.length) {
  console.error(`FAIL: source_id not unique: ${items.length - ids.size} collisions`);
  process.exit(1);
}

if (items.some(i => i.technology_type === 'Biomass')) {
  console.error('FAIL: Biomass records leaked into output');
  process.exit(1);
}

if (items.length !== records.length - biomassCount) {
  console.error(`FAIL: record count mismatch: ${items.length} !== ${records.length} - ${biomassCount}`);
  process.exit(1);
}

const enrichedCount = items.filter(i => i.performance_source === 'BAFA_REFERENCE').length;
if (matchFile && enrichedCount === 0) {
  console.error('FAIL: overlay present but zero items enriched — match_key join broken?');
  process.exit(1);
}

// ── Split by capacity segment (unmatched = no capacity → residential file) ────

const residential = items.filter(i => i.market_segment === null || i.market_segment === 'residential_core');
const commercial = items.filter(i => i.market_segment === 'light_commercial' || i.market_segment === 'commercial_project');

// ── Write output ──────────────────────────────────────────────────────────────

function writeOutput(relPath, outItems, dataset, segmentsIncluded) {
  const payload = {
    _meta: {
      generated: generatedAt,
      generator: 'build-app-products-gb.mjs v1.1',
      dataset,
      country: 'GB',
      primary_source: 'OFGEM_PEL',
      description: 'UK heat pump dataset built from the Ofgem BUS Product Eligibility List (PEL). '
        + 'PEL publishes identity/certification fields only. Records matched to the German BAFA registry '
        + '(match-pel-to-bafa.mjs) carry technical specs as a cross-reference (performance_source=BAFA_REFERENCE); '
        + 'unmatched records have null performance fields. Matched records are capacity-segmented like DE; '
        + 'unmatched records stay in the residential dataset with market_segment null. '
        + 'PEL listing is an administrative eligibility reference only and does not guarantee full BUS eligibility.',
      total_items: outItems.length,
      primary_source_file: `data_sources/ofgem_pel/parsed/${SNAPSHOT}/pel-normalized.json`,
      overlay_source: matchFile ? `data_sources/ofgem_pel/matching/${SNAPSHOT}/pel-bafa-matches.json` : null,
      bafa_reference_seed_snapshot: matchFile?._meta.bafa_seed_snapshot ?? null,
      bafa_reference_enriched_total: enrichedCount,
      segments_included: segmentsIncluded,
      segmentation_policy: 'capacity_v2 on BAFA_REFERENCE kW: ≤20.99=residential_core, 21-45=light_commercial, >45=commercial_project; unmatched (null kW) → residential dataset, market_segment null',
      pel_snapshot: SNAPSHOT,
      pel_snapshot_fetched_at: PEL_FETCHED_AT,
      pel_records_total: records.length,
      biomass_excluded: biomassCount,
      duplicate_mcs_variants_suffixed: suffixed,
      technology_distribution: outItems.reduce((acc, i) => {
        acc[i.technology_type] = (acc[i.technology_type] ?? 0) + 1; return acc;
      }, {}),
    },
    items: outItems,
  };
  writeFileSync(resolve(ROOT, relPath), JSON.stringify(payload));
  console.log(`Wrote ${outItems.length} items → ${relPath}`);
}

writeOutput('public/data/products-gb.json', residential, 'residential', ['residential_core', null]);
writeOutput('public/data/products-commercial-gb.json', commercial, 'commercial', ['light_commercial', 'commercial_project']);

// ── Summary ───────────────────────────────────────────────────────────────────

const statusDist = items.reduce((a, i) => { a[i.pel_certification_status] = (a[i.pel_certification_status] ?? 0) + 1; return a; }, {});
const techDist = items.reduce((a, i) => { a[i.technology_type] = (a[i.technology_type] ?? 0) + 1; return a; }, {});
const segDist = items.reduce((a, i) => { a[i.market_segment ?? 'null'] = (a[i.market_segment ?? 'null'] ?? 0) + 1; return a; }, {});
const withShort = items.filter(i => i.manufacturer_short !== null).length;
const withInstall = items.filter(i => i.installation_type !== null).length;

console.log('');
console.log('── Build summary (GB) ─────────────────────────────────────');
console.log(`PEL records:          ${records.length}  (biomass excluded: ${biomassCount})`);
console.log(`Exported heat pumps:  ${items.length}  (residential file: ${residential.length}, commercial file: ${commercial.length})`);
console.log(`  technology:         ${JSON.stringify(techDist)}`);
console.log(`  certification:      ${JSON.stringify(statusDist)}`);
console.log(`  segments:           ${JSON.stringify(segDist)}`);
console.log(`  BAFA_REFERENCE enriched: ${enrichedCount}/${items.length}`);
console.log(`  manufacturer_short: ${withShort}/${items.length}`);
console.log(`  installation_type (name keyword): ${withInstall}`);
console.log(`  duplicate-variant source_ids suffixed: ${suffixed.length}`);
console.log(`Field count:          ${fieldCount} ✓`);
console.log(`No price keys:        ✓`);
console.log(`Provenance complete:  ✓`);
console.log(`source_id unique:     ✓`);
console.log('──────────────────────────────────────────────────────────');
