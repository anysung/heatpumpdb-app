/**
 * build-app-products-from-master-seed.mjs  v2.0
 *
 * Generates public/data/products.json (residential) and
 * public/data/products-commercial.json (commercial) from BAFA master seed v2.
 *
 * Primary source:  data_sources/bafa/master_seed/2026-06/bafa-master-seed.json
 * Overlay source:  scraper/pricing/output/dataset-enriched-full.json
 *   – Provides: installation_type, physical specs, uuid (display-only fields only)
 *   – market_segment is derived from power_35C_kw — NOT from the overlay
 *   – This file is gitignored and must exist locally.
 *
 * Segmentation (capacity-based, v2.0 policy):
 *   power_35C_kw ≤ 20.99 kW  → residential_core  → products.json
 *   21 – 45 kW               → light_commercial   → products-commercial.json
 *   > 45 kW                  → commercial_project → products-commercial.json
 *   null / invalid           → excluded; written to segmentation-pending report
 *
 * Output field count: 75 (72 base + 3 outdoor-side display fields)
 * BAFA List Yes filter: bafa_list_current === true (default export only)
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const EXPECTED_FIELD_COUNT = 75;
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

// ── Capacity-based segmentation (v2.0 policy) ─────────────────────────────────

function classifySegment(power_kw) {
  if (power_kw === null || power_kw === undefined || !Number.isFinite(Number(power_kw))) return null;
  const p = Number(power_kw);
  if (p <= 20.99) return 'residential_core';
  if (p <= 45)   return 'light_commercial';
  return 'commercial_project';
}

// ── Load sources ──────────────────────────────────────────────────────────────

// ── Snapshot selection ────────────────────────────────────────────────────────
// --snapshot=YYYY-MM overrides; default = newest master_seed/YYYY-MM directory.
const snapArg = process.argv.find(a => a.startsWith('--snapshot='))?.split('=')[1] ?? null;
const SEED_DIR = resolve(ROOT, 'data_sources/bafa/master_seed');
const SNAPSHOT = snapArg ?? readdirSync(SEED_DIR).filter(d => /^\d{4}-\d{2}$/.test(d)).sort().reverse()[0];
if (!SNAPSHOT) { console.error('No master seed snapshot found.'); process.exit(1); }
console.log(`Master seed snapshot: ${SNAPSHOT}`);

// Per-snapshot fetch timestamps from raw/_meta.json — bafa_snapshot_fetched_at
// follows each product's last_seen_snapshot, so the app's "BAFA list updated"
// date moves automatically with every regular data update.
function snapshotFetchedAt(id) {
  const p = resolve(ROOT, `data_sources/bafa/raw/${id}/_meta.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')).fetched_at ?? null; } catch { return null; }
}
const FETCHED_AT_BY_SNAPSHOT = new Map(
  readdirSync(resolve(ROOT, 'data_sources/bafa/raw'))
    .filter(d => /^\d{4}-\d{2}$/.test(d))
    .map(id => [id, snapshotFetchedAt(id)])
);

const seed = loadJSON(`data_sources/bafa/master_seed/${SNAPSHOT}/bafa-master-seed.json`);
const enriched = loadJSON('scraper/pricing/output/dataset-enriched-full.json');
const shortNamesFile = loadJSON('scraper/pricing/manufacturer-short-names.json');
const shortNameMap = new Map(Object.entries(shortNamesFile.mapping));
const iduOduMapping = loadJSON('data_sources/bafa/idu_odu_mapping/2026-06/idu-odu-mapping.json');

// ── Build enriched-dataset lookup keyed by bafa_id ───────────────────────────

const enrichedByBafaId = new Map();
for (const item of enriched.items) {
  enrichedByBafaId.set(String(item.bafa_id), item);
}

// ── Build IDU/ODU mapping lookup keyed by bafa_id ────────────────────────────

const iduOduByBafaId = new Map();
for (const item of iduOduMapping.items) {
  iduOduByBafaId.set(String(item.bafa_id), item);
}

// ── Outdoor-side classification (inline from analysis logic) ──────────────────
// Assigns each product to one of:
//   'exact_model'          — outdoor_unit_model extracted and differs from main model
//   'product_is_outdoor_unit' — product itself is the monoblock/standalone outdoor unit
//   'rule_inferred'        — active mapping rule implies outdoor-side
//   'model_name_inferred'  — manufacturer model-name pattern matches outdoor-side
//   'safe_app_fallback'    — app installation_type=Monoblock (safe exclusions applied)
//   null                   — outdoor-side not identified

const B_OUTDOOR_TYPES = new Set(['split_odu', 'monoblock_outdoor_main', 'standalone_outdoor_unit']);
const B_ARCHITECTURES = new Set([
  'monoblock', 'monoblock_with_tank', 'monoblock_with_control_box',
  'monoblock_with_hydraulic_module', 'split', 'component_only',
]);
const B_STATUSES = new Set([
  'outdoor_only', 'outdoor_plus_idu', 'outdoor_plus_tank',
  'outdoor_plus_control_box', 'outdoor_plus_hydraulic_module',
]);

function matchesModelNamePattern(s) {
  const mfr   = (s.manufacturer || '').toLowerCase();
  const model = s.model || '';
  if (mfr.includes('mitsubishi') && /\b(puhz|puz|pud|suhz|suZ)\b/i.test(model)) return true;
  if (mfr.includes('panasonic') && /\bWH-(MXC|MDC|UD|UDZ|WDG)\b/i.test(model)) return true;
  if ((mfr.includes('lg') || mfr.includes('lg electronics')) &&
      (/\b(HM|HU)\d+/i.test(model) || (/\bBULG\b/i.test(model) && /\bMono\b/i.test(model)))) return true;
  if (mfr.includes('samsung') && (/WPLW-(Mono|Split)/i.test(model) || /EHS\s*Mono/i.test(model))) return true;
  if (mfr.includes('vaillant') && /\b(VWL|aroTHERM|recoCOMPACT|versoTHERM)\b/i.test(model)) return true;
  if ((mfr.includes('buderus') || mfr.includes('bosch') || mfr.includes('bsh')) &&
      (/\b(Logaplus|Logatherm|Compress)\b/i.test(model) || /CS\s*7001i?\s*AW/i.test(model) ||
       /\bWLW\d/i.test(model) || /Supraeco\s*A\b/i.test(model))) return true;
  if (mfr.includes('viessmann') && (/\b(AWO|AWOT|HAWO|AWB|AWBT|AWCI)\b/i.test(model) ||
      /Vitocal\s+\d+-A\b/i.test(model) || /Vitocal.*AWB/i.test(model))) return true;
  if (mfr.includes('nibe')) {
    if (/\b(SMO|VVM|S2060|S1155|S1255)\b/i.test(model)) return false;
    if (/\bS2125\b/i.test(model) || /\b(F2040|F2050|F2120)\b/i.test(model) ||
        /\bAMS\s*(10|20)\b/i.test(model)) return true;
  }
  if ((mfr.includes('stiebel') || mfr.includes('tecalor')) &&
      (/\bWPL[-\s]A\b/i.test(model) || /\bWPF-A\b/i.test(model) || /\bHPA-O\b/i.test(model))) return true;
  if (mfr.includes('weishaupt') && (/\bWAB\b/i.test(model) || /\bWWP\s+(LS|LA)\b/i.test(model))) return true;
  if ((mfr.includes('wolf') && (/\b(CHC|CHT)-?MONOBLOCK\b/i.test(model) || /\bCHA\b/i.test(model) || /\bFHA\b/i.test(model)))) return true;
  if (mfr.includes('daikin') && (/\bAltherma\b/i.test(model) || /\bER(GA|LA)\b/i.test(model))) return true;
  return false;
}

function isSafeAppMonoblock(s, installationType) {
  if (!installationType || installationType !== 'Monoblock') return false;
  const mfr = (s.manufacturer || '').toLowerCase();
  if (mfr.includes('mitsubishi') && /\b(EHS|ERS|EHST|ERSD|EHP|ERP)\b/i.test(s.model) &&
      /\b(PUZ|PUD|PUHZ|SUHZ)\b/i.test(s.model)) return false;
  if (mfr.includes('panasonic') && /\bWH-(UD|UDZ|WDG)\b/i.test(s.model)) return false;
  if (mfr.includes('hitachi') && /\bRAS\b/i.test(s.model) && /\bRWM\b/i.test(s.model)) return false;
  if ((mfr.includes('ait') || mfr.includes('ait-deutschland')) &&
      /\[.*LAV.*\+.*HV.*\]/i.test(s.model)) return false;
  if (mfr.includes('clivet') && (/\bEDGE\b/i.test(s.model) || /WiSAN-YME/i.test(s.model))) return false;
  if (/MIM-E03/i.test(s.model)) return false;
  if (mfr.includes('nibe') && /\b(SMO|VVM|S2060)\b/i.test(s.model)) return false;
  return true;
}

function isClearIndoorControllerTankOnly(s) {
  const model = s.model || '';
  const mfr   = (s.manufacturer || '').toLowerCase();
  if (mfr.includes('nilan') && /\bCompact\s*P/i.test(model)) return true;
  if (/\b(Hydraulikmodul|Hydraulic\s*Station|Hydraulic\s*Module)\b/i.test(model)) return true;
  if (/\b(uniTOWER|Indoor\s*Unit|Innengerät|Innenmodul)\b/i.test(model)) return true;
  if ((mfr.includes('stiebel') || mfr.includes('tecalor')) && /\bLWZ\b/i.test(model)) return true;
  if (/\bLWi\b/i.test(model)) return true;
  return false;
}

function isSingleStandaloneModel(s) {
  const model = s.model || '';
  if (/\s\+\s/.test(model)) return false;
  if (/\[.+\/.*\]/.test(model)) return false;
  if (/\b(Set|Paket|Package|Kit|Kombination|Kombi(?!\w))\b/i.test(model)) return false;
  if (/\b(Hydraulikmodul|Hydraulic\s*Module|uniTOWER|Tank\s*Unit|Speichereinheit|Innenmodul)\b/i.test(model)) return false;
  const slashComponentPattern = /[A-Z0-9]{3,}\s*\/\s*[A-Z0-9]{3,}/;
  if (slashComponentPattern.test(model)) {
    const modeSlashPattern = /\b[A-Z]{2,4}\s*\/\s*[A-Z]{2,4}\b/;
    if (!modeSlashPattern.test(model)) return false;
    if (/[A-Z0-9]{5,}\s*\/\s*[A-Z0-9]{5,}/.test(model)) return false;
  }
  return true;
}

function classifyOutdoorSide(s, comp, installationType) {
  const model = s.model;

  // A — exact outdoor_unit_model extracted
  if (comp.outdoor_unit_model) {
    const kind = comp.outdoor_unit_model !== model ? 'exact_model' : 'product_is_outdoor_unit';
    return { identified: true, displayModel: comp.outdoor_unit_model, displayKind: kind };
  }

  // B — mapping rule implies outdoor-side (no extracted model string)
  if (comp.component_rule_id) {
    const cms = comp.component_mapping_status;
    if (cms === 'package_label_only' || cms === 'requires_research' ||
        (cms === 'not_extractable' && comp.classification === 'confirmed_set') ||
        B_OUTDOOR_TYPES.has(comp.outdoor_unit_type) ||
        B_ARCHITECTURES.has(comp.system_architecture) ||
        B_STATUSES.has(cms)) {
      return { identified: true, displayModel: model, displayKind: 'rule_inferred' };
    }
  }

  // C — model-name pattern
  if (matchesModelNamePattern(s)) {
    return { identified: true, displayModel: model, displayKind: 'model_name_inferred' };
  }

  // D — safe app monoblock fallback
  if (isSafeAppMonoblock(s, installationType)) {
    return { identified: true, displayModel: model, displayKind: 'safe_app_fallback' };
  }

  // E1 — commercial (>=21 kW) single standalone (practical inference)
  const kw = s.power_35C_kw;
  if (kw != null && kw >= 21 && !isClearIndoorControllerTankOnly(s) && isSingleStandaloneModel(s)) {
    return { identified: true, displayModel: model, displayKind: 'rule_inferred' };
  }

  // Not identified
  return { identified: false, displayModel: null, displayKind: null };
}

// ── Export ALL master-seed products ───────────────────────────────────────────
// Products absent from the current BAFA snapshot are NOT deleted — they are
// exported with bafa_listing_status 'delisted' so the app's BAFA-listed-only
// filter can distinguish them while their data remains fully available.

const bafaListYes = seed.items;
const listYesCount = seed.items.filter(s => s.bafa_list_current === true).length;
const delistedCount = seed.items.length - listYesCount;

const generatedAt = new Date().toISOString();

// ── Build a single output item (65 fields) ────────────────────────────────────

function buildItem(s) {
  const legacy = enrichedByBafaId.get(String(s.bafa_id)) ?? null;
  const pricing = legacy?._pricing ?? {};
  const phys = legacy?._physical_specs ?? {};
  const comp = iduOduByBafaId.get(String(s.bafa_id)) ?? {};
  const outdoor = classifyOutdoorSide(s, comp, pricing.installation_type ?? null);

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

    // ── Segmentation (capacity-derived, v2.0) ───────────────────────────────
    market_segment: classifySegment(s.power_35C_kw),
    installation_type: pricing.installation_type ?? null,  // display-only from overlay

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
    bafa_listing_status: s.bafa_list_current === true ? 'listed_in_snapshot' : 'delisted',
    bafa_foerderung_von: null,
    bafa_foerderung_bis: null,
    bafa_snapshot_fetched_at: FETCHED_AT_BY_SNAPSHOT.get(s.last_seen_snapshot) ?? null,
    source_snapshot_generated_at: generatedAt,

    // ── Component fields (from IDU/ODU mapping, display-only) ───────────────
    outdoor_unit_model: comp.outdoor_unit_model ?? null,
    idu_model: comp.idu_model ?? null,
    control_box_model: comp.control_box_model ?? null,
    tank_model: comp.tank_model ?? null,
    tower_model: comp.tower_model ?? null,
    hydraulic_module_model: comp.hydraulic_module_model ?? null,
    indoor_side_equipment_model: comp.indoor_side_equipment_model ?? null,

    // ── Outdoor-side display fields (computed from classification) ───────────
    outdoor_side_identified: outdoor.identified,
    outdoor_side_display_model: outdoor.displayModel,
    outdoor_side_display_kind: outdoor.displayKind,
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

// ── Split by capacity-derived segment ────────────────────────────────────────

const residential = allItems.filter(i => i.market_segment === 'residential_core');
const commercial  = allItems.filter(i => i.market_segment === 'light_commercial' || i.market_segment === 'commercial_project');
const pending     = allItems.filter(i => i.market_segment === null);

// ── Write output ──────────────────────────────────────────────────────────────

function writeOutput(relPath, items, dataset, segmentsIncluded) {
  const payload = {
    _meta: {
      generated: generatedAt,
      generator: 'build-app-products-from-master-seed.mjs v2.0',
      dataset,
      description: 'BAFA master seed v2 export. Segmentation: capacity-based (power_35C_kw). Overlay source: dataset-enriched-full.json for installation_type, physical specs, uuid.',
      total_items: items.length,
      primary_source: `data_sources/bafa/master_seed/${SNAPSHOT}/bafa-master-seed.json`,
      overlay_source: 'scraper/pricing/output/dataset-enriched-full.json',
      segments_included: segmentsIncluded,
      segmentation_policy: 'capacity_v2: ≤20.99kW=residential_core, 21-45kW=light_commercial, >45kW=commercial_project',
      exported_total: bafaListYes.length,
      bafa_list_yes_total: listYesCount,
      bafa_delisted_preserved_total: delistedCount,
      snapshot_fetched_at: Object.fromEntries(FETCHED_AT_BY_SNAPSHOT),
    },
    items,
  };
  writeFileSync(resolve(ROOT, relPath), JSON.stringify(payload));
  console.log(`Wrote ${items.length} items → ${relPath}`);
}

writeOutput('public/data/products.json', residential, 'residential', ['residential_core']);
writeOutput('public/data/products-commercial.json', commercial, 'commercial', ['light_commercial', 'commercial_project']);

// ── Write pending report (null power_35C_kw) ─────────────────────────────────

if (pending.length > 0) {
  const pendingDir = resolve(ROOT, 'data_sources/bafa/segmentation-pending');
  mkdirSync(pendingDir, { recursive: true });
  const pendingReport = {
    _meta: {
      generated: generatedAt,
      description: 'BAFA List Yes products excluded from app export due to null or invalid power_35C_kw. These cannot be capacity-classified and require manual review.',
      total_excluded: pending.length,
      policy: 'Capacity-only segmentation v2.0: power_35C_kw is required for segment assignment.',
    },
    items: pending.map(i => ({
      source_id: i.source_id,
      bafa_id: i.bafa_id,
      manufacturer: i.manufacturer,
      model: i.model,
      power_35C_kw: i.power_35C_kw,
      bafa_list_current: true,
      reason: 'power_35C_kw is null or non-numeric',
    })),
  };
  const pendingPath = resolve(pendingDir, '2026-06-capacity-missing.json');
  writeFileSync(pendingPath, JSON.stringify(pendingReport, null, 2));
  console.log(`Wrote ${pending.length} pending items → data_sources/bafa/segmentation-pending/2026-06-capacity-missing.json`);
}

// ── Summary ───────────────────────────────────────────────────────────────────

const withOverlay = allItems.filter(i => enrichedByBafaId.has(String(i.bafa_id))).length;
const withoutOverlay = allItems.length - withOverlay;
const withODU = allItems.filter(i => i.outdoor_unit_model !== null).length;
const withIDU = allItems.filter(i => i.idu_model !== null).length;
const outdoorIdentified = allItems.filter(i => i.outdoor_side_identified === true).length;
const outdoorDisplayModel = allItems.filter(i => i.outdoor_side_display_model !== null).length;
const lightCommercial = commercial.filter(i => i.market_segment === 'light_commercial').length;
const commProject = commercial.filter(i => i.market_segment === 'commercial_project').length;

console.log('');
console.log('── Build summary ──────────────────────────────────────────');
console.log(`Exported (all):       ${bafaListYes.length}  (listed: ${listYesCount}, delisted preserved: ${delistedCount})`);
console.log(`  with enriched overlay:  ${withOverlay}`);
console.log(`  no overlay (new 2026-06): ${withoutOverlay}`);
console.log(`Segmentation (capacity-based, v2.0):`);
console.log(`  Residential (≤20.99 kW):  ${residential.length}  → products.json`);
console.log(`  Light Commercial (21-45):  ${lightCommercial}`);
console.log(`  Commercial Project (>45):  ${commProject}`);
console.log(`  Commercial total:          ${commercial.length}  → products-commercial.json`);
console.log(`  Pending (null capacity):   ${pending.length}  → segmentation-pending report`);
console.log(`Component fields joined from IDU/ODU mapping:`);
console.log(`  outdoor_unit_model:  ${withODU}`);
console.log(`  idu_model:           ${withIDU}`);
console.log(`Outdoor-side display (all exported records):`);
console.log(`  outdoor_side_identified=true: ${outdoorIdentified}`);
console.log(`  outdoor_side_display_model:   ${outdoorDisplayModel}`);
console.log(`Field count:          ${fieldCount} ✓`);
console.log(`No price keys:        ✓`);
console.log(`Provenance complete:  ✓`);
console.log('──────────────────────────────────────────────────────────');
