/**
 * build-app-products-fr.mjs  v1.0  (France dataset builder)
 *
 * Strategy (user decision 2026-07-07): manufacturers sell largely the same
 * hardware in France as in Germany, so the FR catalogue is DERIVED FROM THE
 * GERMAN BAFA-BASED DATASET — faster and far more complete than building from
 * a French registry. NF PAC (Certita) certification references are attached
 * as an optional enrichment overlay ONLY where a confident match exists;
 * uncertain matches are never shown.
 *
 * Inputs:
 *   public/data/products.json + products-commercial.json
 *     (DE builder output — run build-app-products-from-master-seed.mjs first)
 *   data_sources/nf_pac/matching/YYYY-MM/fr-nfpac-matches.json (optional)
 *     { matches: [{ bafa_id, nf_pac_reference, ... }] }
 *
 * Outputs: public/data/products-fr.json + products-commercial-fr.json
 *
 * Honesty policy (FR):
 *   - Specs are German BAFA registry values presented in the French market —
 *     a technical cross-reference (performance_source='BAFA_REFERENCE'), not
 *     French certification data. The data sheet says so.
 *   - MaPrimeRénov'/CEE eligibility is CRITERIA-based (ηs thresholds, RGE
 *     installer) — the app never claims eligibility; it links to official
 *     sources. NF PAC references appear only on confident matches.
 *   - German type strings are localised (Luft/Wasser → Air/Eau) for display.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const EXPECTED_FIELD_COUNT = 83; // DE 78 + performance_source + bafa_reference_*(3) + nf_pac_reference
const PRICE_KEY_FRAGMENTS = ['price', 'brand_tier', 'price_confidence', 'package_scope', 'capacity_band', 'refrigerant_group'];

function loadJSON(relPath, hint) {
  const abs = resolve(ROOT, relPath);
  if (!existsSync(abs)) {
    console.error(`Missing ${relPath}${hint ? ` — ${hint}` : ''}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(abs, 'utf8'));
}

const deResidential = loadJSON('public/data/products.json', 'run scripts/bafa/build-app-products-from-master-seed.mjs first');
const deCommercial = loadJSON('public/data/products-commercial.json', 'run scripts/bafa/build-app-products-from-master-seed.mjs first');

// Optional NF PAC overlay — newest matching snapshot if present.
const NFPAC_DIR = resolve(ROOT, 'data_sources/nf_pac/matching');
const nfpacSnapshot = existsSync(NFPAC_DIR)
  ? readdirSync(NFPAC_DIR).filter(d => /^\d{4}-\d{2}$/.test(d)).sort().reverse()[0] ?? null
  : null;
const nfpacFile = nfpacSnapshot
  ? JSON.parse(readFileSync(resolve(NFPAC_DIR, nfpacSnapshot, 'fr-nfpac-matches.json'), 'utf8'))
  : null;
const nfpacByBafaId = new Map((nfpacFile?.matches ?? []).map(m => [String(m.bafa_id), m]));
console.log(nfpacFile
  ? `NF PAC overlay: ${nfpacByBafaId.size} confident matches (snapshot ${nfpacSnapshot})`
  : 'NF PAC overlay: none (references will appear once confident match data exists)');

const generatedAt = new Date().toISOString();

/** German BAFA type strings → French display strings. Unknown values pass through. */
const TYPE_FR = {
  'Luft / Wasser': 'Air / Eau',
  'Sole / Wasser': 'Eau glycolée / Eau',
  'Wasser / Wasser': 'Eau / Eau',
  'Luft / Luft': 'Air / Air',
};

function toFrItem(p) {
  return {
    ...p,
    type: TYPE_FR[p.type] ?? p.type,
    country: 'FR',
    // Specs are the same hardware's German BAFA registry values — mark them as
    // a cross-reference exactly like the GB edition does.
    performance_source: 'BAFA_REFERENCE',
    bafa_reference_id: p.bafa_id != null ? String(p.bafa_id) : null,
    bafa_reference_model: p.model ?? null,
    bafa_reference_match_type: 'same_record',
    nf_pac_reference: nfpacByBafaId.get(String(p.bafa_id))?.nf_pac_reference ?? null,
  };
}

const residential = deResidential.items.map(toFrItem);
const commercial = deCommercial.items.map(toFrItem);
const allItems = [...residential, ...commercial];

// ── Validate ──────────────────────────────────────────────────────────────────

const fieldCount = Object.keys(allItems[0]).length;
if (fieldCount !== EXPECTED_FIELD_COUNT) {
  console.error(`FAIL: field count mismatch: expected ${EXPECTED_FIELD_COUNT}, got ${fieldCount}`);
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

const badProvenance = allItems.filter(i =>
  !i.bafa_id || !i.source_id || i.country !== 'FR' || i.performance_source !== 'BAFA_REFERENCE'
);
if (badProvenance.length > 0) {
  console.error(`FAIL: ${badProvenance.length} items missing required FR provenance`);
  process.exit(1);
}

if (allItems.length !== deResidential.items.length + deCommercial.items.length) {
  console.error('FAIL: record count mismatch vs DE source datasets');
  process.exit(1);
}

// NF PAC references must never be guessed — every value must come from the overlay.
const nfpacSet = allItems.filter(i => i.nf_pac_reference !== null).length;
if (!nfpacFile && nfpacSet > 0) {
  console.error('FAIL: NF PAC references present without an overlay file');
  process.exit(1);
}

// ── Write output ──────────────────────────────────────────────────────────────

function writeOutput(relPath, items, dataset, sourceMeta) {
  const payload = {
    _meta: {
      generated: generatedAt,
      generator: 'build-app-products-fr.mjs v1.0',
      dataset,
      country: 'FR',
      primary_source: 'BAFA',
      description: 'French market catalogue derived from the German BAFA-based dataset (same hardware sold in '
        + 'both markets). All technical specifications are German BAFA registry values presented as a '
        + "cross-reference (performance_source='BAFA_REFERENCE'), not French certification data. "
        + "MaPrimeRénov'/CEE eligibility is criteria-based — this app makes no eligibility claims. "
        + 'NF PAC (Certita) references are attached only where a confident match exists; uncertain matches '
        + 'are never shown.',
      total_items: items.length,
      derived_from: {
        de_dataset_generated: sourceMeta.generated,
        de_generator: sourceMeta.generator,
        bafa_seed: sourceMeta.primary_source,
      },
      nf_pac_overlay_source: nfpacFile ? `data_sources/nf_pac/matching/${nfpacSnapshot}/fr-nfpac-matches.json` : null,
      nf_pac_referenced_total: items.filter(i => i.nf_pac_reference !== null).length,
      eprel_linked_total: items.filter(i => i.eprel_registration_number != null).length,
      segments_included: dataset === 'residential' ? ['residential_core'] : ['light_commercial', 'commercial_project'],
    },
    items,
  };
  writeFileSync(resolve(ROOT, relPath), JSON.stringify(payload));
  console.log(`Wrote ${items.length} items → ${relPath}`);
}

writeOutput('public/data/products-fr.json', residential, 'residential', deResidential._meta);
writeOutput('public/data/products-commercial-fr.json', commercial, 'commercial', deCommercial._meta);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('');
console.log('── Build summary (FR) ─────────────────────────────────────');
console.log(`Derived from DE dataset:  ${allItems.length} items (residential ${residential.length}, commercial ${commercial.length})`);
console.log(`  EPREL linked:           ${allItems.filter(i => i.eprel_registration_number != null).length}`);
console.log(`  NF PAC referenced:      ${nfpacSet}${nfpacFile ? '' : '  (no overlay yet)'}`);
console.log(`Field count:              ${fieldCount} ✓`);
console.log(`No price keys:            ✓`);
console.log(`FR provenance complete:   ✓`);
console.log('──────────────────────────────────────────────────────────');
