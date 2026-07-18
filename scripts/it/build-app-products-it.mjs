/**
 * build-app-products-it.mjs  v1.0  (Italy dataset builder)
 *
 * Strategy: the IT catalogue IS the canonical (German-registry-derived)
 * European catalogue — same hardware sold across the EU, exactly like FR/GB/PL.
 *
 * Layers:
 *   1. Canonical baseline (public/data/products*.json) — identity, specs and
 *      the 23 kW segmentation are inherited unchanged.
 *   2. GSE Conto Termico LISTING OVERLAY (data_sources/gse_ct/matching/YYYY-MM/
 *      canonical-gse-overlay.json) — a confirmed match may attach the
 *      catalogue facts; it never creates/changes/removes a canonical product.
 *      Unmatched products carry gse_match_status='verification_required'
 *      (never a claim of absence — the PEL rule).
 *
 * There is NO IT-market extension layer, deliberately: the GSE catalogue
 * publishes brand, model, unit ids, capacity, ηs and SCOP/COP only — no
 * refrigerant, no sound power — so a catalogue-native record can never pass
 * the shared Data-Sheet eligibility rule (a model name is not a data sheet).
 *
 * Honesty policy (IT):
 *   - Canonical specs are European reference values (performance_source =
 *     'EU_MEASURED_REFERENCE' publicly), not Italian certification data.
 *   - Catalogue presence is a condition of the Conto Termico incentive on the
 *     appliance side; the app NEVER claims incentive eligibility (applicant/
 *     building/intervention rules).
 *   - GSE data is used facts-only: source attribution + snapshot dates, no
 *     GSE branding, and the overlay carries only what the catalogue publishes.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataSheetEligibility, segmentOf } from '../lib/data-sheet-eligibility.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const EXPECTED_FIELD_COUNT = 88; // DE 78 − 4 German fields + performance_source
                                 // + european_reference_*(3, public names) + gse_*(11)
const PRICE_KEY_FRAGMENTS = ['price', 'brand_tier', 'price_confidence', 'package_scope', 'capacity_band', 'refrigerant_group'];

function loadJSON(relPath, hint) {
  const abs = resolve(ROOT, relPath);
  if (!existsSync(abs)) {
    console.error(`Missing ${relPath}${hint ? ` — ${hint}` : ''}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(abs, 'utf8'));
}
const newestSnapshot = rel => {
  const dir = resolve(ROOT, rel);
  return existsSync(dir)
    ? readdirSync(dir).filter(d => /^\d{4}-\d{2}$/.test(d)).sort().reverse()[0] ?? null
    : null;
};

const deResidential = loadJSON('public/data/products.json', 'run the DE builder first');
const deCommercial = loadJSON('public/data/products-commercial.json', 'run the DE builder first');

/* ── GSE overlay (optional — build proceeds unenriched without it) ────────── */
const overlaySnapshot = newestSnapshot('data_sources/gse_ct/matching');
const overlayFile = overlaySnapshot
  ? JSON.parse(readFileSync(resolve(ROOT, 'data_sources/gse_ct/matching', overlaySnapshot, 'canonical-gse-overlay.json'), 'utf8'))
  : null;
const overlayByBafaId = new Map(Object.entries(overlayFile?.overlay ?? {}));
console.log(overlayFile
  ? `GSE overlay: ${overlayByBafaId.size} products carry listing state (snapshot ${overlaySnapshot})`
  : 'GSE overlay: none (all products will show verification_required)');

const generatedAt = new Date().toISOString();

/** German BAFA type strings → Italian display strings. Unknown values pass through. */
const TYPE_IT = {
  'Luft / Wasser': 'Aria / Acqua',
  'Sole / Wasser': 'Salamoia / Acqua',
  'Wasser / Wasser': 'Acqua / Acqua',
  'Luft / Luft': 'Aria / Aria',
};

/** German registry status / funding fields — German facts. They do not travel. */
const GERMAN_ONLY_FIELDS = [
  'bafa_listing_status', 'bafa_foerderung_von', 'bafa_foerderung_bis', 'bafa_snapshot_fetched_at',
];

const EMPTY_GSE_BLOCK = {
  gse_match_status: 'verification_required',
  gse_entry_key: null,
  gse_catalogue: null,
  gse_brand: null,
  gse_model: null,
  gse_match_method: null,
  gse_match_confidence: null,
  gse_snapshot: overlaySnapshot ?? null,
  gse_snapshot_fetched_at: overlayFile?.meta?.generated_at ?? null,
  gse_first_matched_at: null,
  gse_last_confirmed_at: null,
};

function toItItem(p) {
  const base = { ...p };
  for (const f of GERMAN_ONLY_FIELDS) delete base[f];
  const ov = overlayByBafaId.get(String(p.bafa_id));
  return {
    ...base,
    type: TYPE_IT[p.type] ?? p.type,
    country: 'IT',
    performance_source: 'BAFA_REFERENCE',
    bafa_reference_id: p.bafa_id != null ? String(p.bafa_id) : null,
    bafa_reference_model: p.model ?? null,
    bafa_reference_match_type: 'same_record',
    ...EMPTY_GSE_BLOCK,
    ...(ov ?? {}),
  };
}

const residential = deResidential.items.map(toItItem);
const commercial = deCommercial.items.map(toItItem);

/* ── Public-schema transform: no German-market field names leave Italy ─────
   Internal building above uses the canonical field names (bafa_id, …) so the
   overlay/matching artifacts stay traceable. The PUBLIC Italian dataset
   renames them to neutral European-reference terminology (same as PL):
     bafa_id                   → european_reference_id
     bafa_reference_model      → european_reference_model
     bafa_reference_match_type → european_reference_match_type
     bafa_reference_id         → (dropped — same value as european_reference_id)
     performance_source        'BAFA_REFERENCE' → 'EU_MEASURED_REFERENCE'
     primary_source            'BAFA' → 'EU_REFERENCE'                        */
function toPublicItItem(p) {
  const {
    bafa_id, bafa_reference_id, bafa_reference_model, bafa_reference_match_type,
    ...rest
  } = p;
  return {
    ...rest,
    european_reference_id: bafa_id != null ? String(bafa_id) : null,
    european_reference_model: bafa_reference_model ?? null,
    european_reference_match_type: bafa_reference_match_type ?? null,
    performance_source: p.performance_source === 'BAFA_REFERENCE' ? 'EU_MEASURED_REFERENCE' : p.performance_source,
    primary_source: p.primary_source === 'BAFA' ? 'EU_REFERENCE' : p.primary_source,
  };
}
const publicResidential = residential.map(toPublicItItem);
const publicCommercial = commercial.map(toPublicItItem);

const allItems = [...publicResidential, ...publicCommercial];

/* ── Validate ─────────────────────────────────────────────────────────────── */

const fieldCount = Object.keys(allItems[0]).length;
if (fieldCount !== EXPECTED_FIELD_COUNT) {
  console.error(`FAIL: field count mismatch: expected ${EXPECTED_FIELD_COUNT}, got ${fieldCount}`);
  console.error('Fields:', Object.keys(allItems[0]).join(', '));
  process.exit(1);
}
const badKeySets = allItems.filter(x => Object.keys(x).length !== fieldCount);
if (badKeySets.length) {
  console.error(`FAIL: ${badKeySets.length} public records deviate from the shared schema`);
  process.exit(1);
}

// The public Italian schema must carry NO German-market field names or source
// labels — machine-readable payloads included, not just visible text.
const bafaKeyLeak = Object.keys(allItems[0]).filter(k => /bafa/i.test(k));
const bafaValueLeak = allItems.filter(i => /BAFA/i.test(String(i.performance_source ?? '')) || /^BAFA$/i.test(String(i.primary_source ?? '')));
if (bafaKeyLeak.length || bafaValueLeak.length) {
  console.error(`FAIL: German-market provenance in the public schema (keys: ${bafaKeyLeak.join(',') || 'none'}; value leaks: ${bafaValueLeak.length})`);
  process.exit(1);
}

const priceKeysFound = Object.keys(allItems[0]).filter(k =>
  PRICE_KEY_FRAGMENTS.some(frag => k.includes(frag)));
if (priceKeysFound.length > 0) {
  console.error('FAIL: price-like keys present:', priceKeysFound.join(', '));
  process.exit(1);
}

const germanLeak = allItems.filter(i => GERMAN_ONLY_FIELDS.some(f => f in i));
if (germanLeak.length > 0) {
  console.error(`FAIL: ${germanLeak.length} items carry German-only registry fields`);
  process.exit(1);
}

const badProvenance = allItems.filter(i =>
  !i.european_reference_id || !i.source_id || i.country !== 'IT'
  || i.performance_source !== 'EU_MEASURED_REFERENCE');
if (badProvenance.length > 0) {
  console.error(`FAIL: ${badProvenance.length} items missing required IT provenance`);
  process.exit(1);
}

const ids = allItems.map(i => String(i.source_id));
if (new Set(ids).size !== ids.length) {
  console.error('FAIL: duplicate source_id in IT catalogue');
  process.exit(1);
}

// Listing-state integrity: confirmed ⇔ has gse_entry_key; nothing else carries one.
const badListing = allItems.filter(i =>
  (i.gse_match_status === 'confirmed') !== Boolean(i.gse_entry_key));
if (badListing.length > 0) {
  console.error(`FAIL: ${badListing.length} items violate confirmed⇔gse_entry_key integrity`);
  process.exit(1);
}

// One GSE catalogue entry → one product.
const gseKeys = allItems.filter(i => i.gse_entry_key).map(i => i.gse_entry_key);
if (new Set(gseKeys).size !== gseKeys.length) {
  console.error('FAIL: a GSE entry is attached to more than one product');
  process.exit(1);
}

// Every product must be publishable and classifiable.
const inelig = allItems.filter(i => !dataSheetEligibility(i).eligible);
if (inelig.length > 0) {
  console.error(`FAIL: ${inelig.length} items fail Data-Sheet eligibility`);
  process.exit(1);
}
const unclassified = allItems.filter(i => segmentOf(i) === 'unclassified');
if (unclassified.length > 0) {
  console.error(`FAIL: ${unclassified.length} items unclassifiable (no rated capacity)`);
  process.exit(1);
}

const derivedCount = deResidential.items.length + deCommercial.items.length;
if (allItems.length !== derivedCount) {
  console.error('FAIL: record count mismatch vs DE source');
  process.exit(1);
}

/* ── Write output ─────────────────────────────────────────────────────────── */

function writeOutput(relPath, items, dataset, sourceMeta) {
  const payload = {
    _meta: {
      generated: generatedAt,
      generator: 'build-app-products-it.mjs v1.0',
      dataset,
      country: 'IT',
      primary_source: 'EU_REFERENCE',
      description: 'Italian market catalogue: the canonical European reference dataset — technical '
        + 'specifications are EU-harmonised measured reference values (EN 14511/14825, EU 811/2013; '
        + "performance_source='EU_MEASURED_REFERENCE'), not Italian certification data — plus a GSE "
        + 'Conto Termico 3.0 pre-qualified-appliance listing overlay (catalogue III.A, confirmed '
        + 'matches only; a failed match is shown as verification-required, never as absence). '
        + 'Conto Termico / detrazioni fiscali eligibility is applicant-, building- and intervention-'
        + 'dependent — this app makes no eligibility claims.',
      total_items: items.length,
      reference_dataset_generated: sourceMeta.generated,
      gse_overlay_source: overlayFile ? `data_sources/gse_ct/matching/${overlaySnapshot}/canonical-gse-overlay.json` : null,
      gse_snapshot: overlaySnapshot ?? null,
      gse_confirmed_total: items.filter(i => i.gse_match_status === 'confirmed').length,
      segments_included: dataset === 'residential' ? ['residential_core'] : ['light_commercial', 'commercial_project'],
    },
    items,
  };
  writeFileSync(resolve(ROOT, relPath), JSON.stringify(payload));
  console.log(`Wrote ${items.length} items → ${relPath}`);
}

writeOutput('public/data/products-it.json', publicResidential, 'residential', deResidential._meta);
writeOutput('public/data/products-commercial-it.json', publicCommercial, 'commercial', deCommercial._meta);

/* ── Summary ──────────────────────────────────────────────────────────────── */

const confirmedTotal = allItems.filter(i => i.gse_match_status === 'confirmed').length;
console.log('');
console.log('── Build summary (IT) ─────────────────────────────────────');
console.log(`Catalogue:                ${allItems.length} items (residential ${residential.length}, commercial ${commercial.length})`);
console.log(`  derived from DE:        ${derivedCount}`);
console.log(`  GSE listed (confirmed): ${confirmedTotal}`);
console.log(`  review_required:        ${allItems.filter(i => i.gse_match_status === 'review_required').length}`);
console.log(`  EPREL linked:           ${allItems.filter(i => i.eprel_registration_number != null).length}`);
console.log(`Field count:              ${fieldCount} ✓   No price keys ✓   IT provenance ✓   listing integrity ✓`);
console.log('──────────────────────────────────────────────────────────');
