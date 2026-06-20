/**
 * build-app-products-from-master-seed.mjs
 *
 * Generates public/data/products.json (residential) and
 * public/data/products-commercial.json (commercial) from BAFA master seed v2.
 *
 * Primary source:  data_sources/bafa/master_seed/2026-06/bafa-master-seed.json
 * Overlay source:  scraper/pricing/output/dataset-enriched-full.json
 *   – Provides: installation_type, market_segment, physical specs, uuid
 *   – This file is gitignored and must exist locally.
 *   – Products not found in the overlay (new June 2026 additions) receive null
 *     for all overlay fields. market_segment=null defaults to the residential
 *     tab in the app (see src/config/searchConfig.ts).
 *
 * Output field count: 65 (matching existing schema)
 * BAFA List Yes filter: bafa_list_current === true (default export only)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const MARCH_SNAPSHOT_FETCHED_AT = '2026-03-19T12:07:14.787Z';
const JUNE_SNAPSHOT_FETCHED_AT = '2026-06-19T05:17:14.627Z';
const COMMERCIAL_SEGMENTS = new Set(['light_commercial', 'commercial_project']);
const EXPECTED_FIELD_COUNT = 65;
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

// ── Load sources ──────────────────────────────────────────────────────────────

const seed = loadJSON('data_sources/bafa/master_seed/2026-06/bafa-master-seed.json');
const enriched = loadJSON('scraper/pricing/output/dataset-enriched-full.json');
const shortNamesFile = loadJSON('scraper/pricing/manufacturer-short-names.json');
const shortNameMap = new Map(Object.entries(shortNamesFile.mapping));

// ── Build enriched-dataset lookup keyed by bafa_id ───────────────────────────

const enrichedByBafaId = new Map();
for (const item of enriched.items) {
  enrichedByBafaId.set(String(item.bafa_id), item);
}

// ── Filter to BAFA List Yes products ─────────────────────────────────────────

const bafaListYes = seed.items.filter(s => s.bafa_list_current === true);

const generatedAt = new Date().toISOString();

// ── Build a single output item (65 fields) ────────────────────────────────────

function buildItem(s) {
  const legacy = enrichedByBafaId.get(String(s.bafa_id)) ?? null;
  const pricing = legacy?._pricing ?? {};
  const phys = legacy?._physical_specs ?? {};

  return {
    // ── Identity ────────────────────────────────────────────────────────────
    bafa_id: s.bafa_id ?? null,
    uuid: legacy?.uuid ?? null,

    // ── Product info ────────────────────────────────────────────────────────
    manufacturer: s.manufacturer ?? null,
    manufacturer_normalized: s.manufacturer_normalized ?? null,
    manufacturer_short: shortNameMap.get(s.manufacturer_normalized) ?? null,
    model: s.model ?? null,
    type: s.type ?? null,

    // ── Refrigerant ─────────────────────────────────────────────────────────
    refrigerant: s.refrigerant ?? null,
    refrigerant_2: s.refrigerant_2 ?? null,
    refrigerant_amount_kg: s.refrigerant_amount_kg ?? null,
    refrigerant_2_amount_kg: s.refrigerant_2_amount_kg ?? null,

    // ── Heating performance ─────────────────────────────────────────────────
    power_35C_kw: s.power_35C_kw ?? null,
    efficiency_35C_percent: s.efficiency_35C_percent ?? null,
    power_design_35C_kw: s.power_design_35C_kw ?? null,
    power_55C_kw: s.power_55C_kw ?? null,
    efficiency_55C_percent: s.efficiency_55C_percent ?? null,
    power_design_55C_kw: s.power_design_55C_kw ?? null,

    // ── COP / SCOP / SEER ──────────────────────────────────────────────────
    cop_A7W35: s.cop_A7W35 ?? null,
    cop_A2W35: s.cop_A2W35 ?? null,
    cop_AMinus7W35: s.cop_AMinus7W35 ?? null,
    cop_A10W35: s.cop_A10W35 ?? null,
    scop: s.scop ?? null,
    seer: s.seer ?? null,

    // ── Cooling ─────────────────────────────────────────────────────────────
    cooling_efficiency: s.cooling_efficiency ?? null,
    cooling_capacity_kw: s.cooling_capacity_kw ?? null,

    // ── Noise & electrical ──────────────────────────────────────────────────
    noise_outdoor_dB: s.noise_outdoor_dB ?? null,
    noise_indoor_dB: s.noise_indoor_dB ?? null,
    max_electric_power_kw: s.max_electric_power_kw ?? null,

    // ── System ──────────────────────────────────────────────────────────────
    drive_type: s.drive_type ?? null,
    power_control: s.power_control ?? null,
    num_compressors: s.num_compressors ?? null,
    grid_ready: s.grid_ready ?? false,
    grid_ready_type: s.grid_ready_type ?? null,
    ee_display: s.ee_display ?? null,
    ee_display_type: s.ee_display_type ?? null,
    heat_meter: s.heat_meter ?? null,
    defrost_tested: s.defrost_tested ?? null,
    defrost_type: s.defrost_type ?? null,
    temp_diff: s.temp_diff ?? null,
    website: s.website ?? null,

    // ── Segmentation (overlay: enriched dataset) ────────────────────────────
    market_segment: pricing.market_segment ?? null,
    installation_type: pricing.installation_type ?? null,

    // ── Physical specs (overlay: enriched dataset) ──────────────────────────
    width_mm: phys.width_mm ?? null,
    height_mm: phys.height_mm ?? null,
    depth_mm: phys.depth_mm ?? null,
    weight_kg: phys.weight_kg ?? null,
    dimensions_raw: phys.dimensions_raw ?? null,
    weight_raw: phys.weight_raw ?? null,
    physical_specs_confidence: phys.physical_specs_confidence ?? null,
    physical_specs_estimated: phys.physical_specs_estimated ?? null,
    physical_specs_source_type: phys.physical_specs_source_type ?? null,
    physical_specs_source_note: phys.physical_specs_source_note ?? null,
    physical_specs_match_type: phys.physical_specs_match_type ?? null,
    physical_specs_family: phys.physical_specs_family ?? null,
    physical_specs_quarantined: phys.physical_specs_quarantined ?? null,
    physical_specs_quarantine_reason: phys.physical_specs_quarantine_reason ?? null,
    physical_specs_last_checked_at: phys.physical_specs_last_checked_at ?? null,

    // ── Provenance ──────────────────────────────────────────────────────────
    source_id: String(s.bafa_id),
    country: 'DE',
    primary_source: 'BAFA',
    bafa_listing_status: 'listed_in_snapshot',
    bafa_foerderung_von: null,
    bafa_foerderung_bis: null,
    bafa_snapshot_fetched_at: s.seen_in_reference_baseline
      ? MARCH_SNAPSHOT_FETCHED_AT
      : JUNE_SNAPSHOT_FETCHED_AT,
    source_snapshot_generated_at: generatedAt,
  };
}

// ── Build all output items ────────────────────────────────────────────────────

const allItems = bafaListYes.map(buildItem);

// ── Validate ──────────────────────────────────────────────────────────────────

const fieldCount = Object.keys(allItems[0]).length;
if (fieldCount !== EXPECTED_FIELD_COUNT) {
  console.error(`Field count mismatch: expected ${EXPECTED_FIELD_COUNT}, got ${fieldCount}`);
  console.error('Fields:', Object.keys(allItems[0]).join(', '));
  process.exit(1);
}

const priceKeysFound = Object.keys(allItems[0]).filter(k =>
  PRICE_KEY_FRAGMENTS.some(frag => k.includes(frag))
);
if (priceKeysFound.length > 0) {
  console.error('FAIL: price-like keys present:', priceKeysFound.join(', '));
  process.exit(1);
}

const missingProvenance = allItems.filter(i =>
  !i.bafa_id || !i.source_id || !i.country || !i.primary_source || !i.bafa_snapshot_fetched_at
);
if (missingProvenance.length > 0) {
  console.error(`FAIL: ${missingProvenance.length} items missing required provenance`);
  process.exit(1);
}

// ── Split residential / commercial ────────────────────────────────────────────

const residential = allItems.filter(i => !COMMERCIAL_SEGMENTS.has(i.market_segment));
const commercial = allItems.filter(i => COMMERCIAL_SEGMENTS.has(i.market_segment));

// ── Write output ──────────────────────────────────────────────────────────────

function writeOutput(relPath, items, dataset, segmentsIncluded) {
  const payload = {
    _meta: {
      generated: generatedAt,
      generator: 'build-app-products-from-master-seed.mjs v1.0',
      dataset,
      description: 'BAFA master seed v2 export. Primary source: BAFA master seed. Overlay source: dataset-enriched-full.json for installation_type, market_segment, physical specs, uuid.',
      total_items: items.length,
      primary_source: 'data_sources/bafa/master_seed/2026-06/bafa-master-seed.json',
      overlay_source: 'scraper/pricing/output/dataset-enriched-full.json',
      segments_included: segmentsIncluded,
      bafa_list_yes_total: bafaListYes.length,
      bafa_snapshot_march_fetched_at: MARCH_SNAPSHOT_FETCHED_AT,
      bafa_snapshot_june_fetched_at: JUNE_SNAPSHOT_FETCHED_AT,
    },
    items,
  };
  writeFileSync(resolve(ROOT, relPath), JSON.stringify(payload));
  console.log(`Wrote ${items.length} items → ${relPath}`);
}

writeOutput('public/data/products.json', residential, 'residential', ['residential_core', 'null_segment_defaulted_to_residential']);
writeOutput('public/data/products-commercial.json', commercial, 'commercial', ['light_commercial', 'commercial_project']);

// ── Summary ───────────────────────────────────────────────────────────────────

const withOverlay = allItems.filter(i => enrichedByBafaId.has(String(i.bafa_id))).length;
const withoutOverlay = allItems.length - withOverlay;

console.log('');
console.log('── Build summary ──────────────────────────────────────────');
console.log(`BAFA List Yes:        ${bafaListYes.length}`);
console.log(`  with enriched overlay:  ${withOverlay} (baseline products)`);
console.log(`  no overlay (new 2026-06): ${withoutOverlay} → null segment → residential`);
console.log(`Residential:          ${residential.length}  (products.json)`);
console.log(`Commercial:           ${commercial.length}  (products-commercial.json)`);
console.log(`Total:                ${allItems.length}`);
console.log(`Field count:          ${fieldCount} ✓`);
console.log(`No price keys:        ✓`);
console.log(`Provenance complete:  ✓`);
console.log('──────────────────────────────────────────────────────────');
