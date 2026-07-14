#!/usr/bin/env node
/**
 * build-app-products-gb.mjs  v3.0 — canonical technical baseline + PEL listing overlay.
 *
 * ARCHITECTURE (docs/CANONICAL_TECHNICAL_BASELINE_AND_LOCAL_MARKET_OVERLAY.md)
 *
 *   canonical technical products → Data Sheet eligibility → UK public catalogue
 *                                → PEL overlay (listing status only)
 *
 * The UK catalogue IS the canonical catalogue. The Ofgem PEL adds one thing: has
 * the UK listed this product. It never creates a product, never supplies a spec,
 * never changes a capacity or a segment, and a failed match never removes a product.
 *
 * WHAT THIS REPLACES (v2.1 — PEL-first, removed):
 *   The old build published all 4,422 PEL rows as technical products and then
 *   tried to reconstruct their missing specifications from EPREL, a registry
 *   cross-reference and a component-recovery matcher. The PEL publishes no
 *   performance data at all, so 2,134 of those "products" ended up with no
 *   capacity, no segment and a blank data sheet — and every unmatched record was
 *   labelled "Not on PEL", which asserts far more than a failed match proves.
 *
 * Inputs
 *   public/data/products.json / products-commercial.json  (canonical, from the DE build)
 *   data_sources/ofgem_pel/matching/<snap>/canonical-pel-overlay.json   (optional)
 * Output
 *   public/data/products-gb.json + products-commercial-gb.json
 *
 * The full PEL source stays on disk for matching, audit and manufacturer
 * follow-up — it is simply no longer a public product source.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyEligibility, segmentOf, ratedCapacityKw } from '../lib/data-sheet-eligibility.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const loadJSON = p => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
const newest = d => readdirSync(resolve(ROOT, d)).filter(x => /^\d{4}-\d{2}$/.test(x)).sort().reverse()[0] ?? null;

const PRICE_KEY_FRAGMENTS = ['price', 'preis', 'cost', 'brand_tier', 'price_confidence'];

/** German registry status / funding fields — German facts. They do not travel. */
const GERMAN_ONLY_FIELDS = [
  'bafa_listing_status', 'bafa_foerderung_von', 'bafa_foerderung_bis', 'bafa_snapshot_fetched_at',
];

/** German type strings → English display strings. */
const TYPE_EN = {
  'Luft / Wasser': 'Air / Water',
  'Sole / Wasser': 'Ground / Water',
  'Wasser / Wasser': 'Water / Water',
  'Luft / Luft': 'Air / Air',
};

// ── Canonical baseline ───────────────────────────────────────────────────────
const deResidential = loadJSON('public/data/products.json');
const deCommercial = loadJSON('public/data/products-commercial.json');
const canonicalCount = deResidential.items.length + deCommercial.items.length;
console.log(`Canonical baseline: ${canonicalCount} products`);

// ── PEL listing overlay (optional) ───────────────────────────────────────────
const SNAPSHOT = newest('data_sources/ofgem_pel/parsed');
const overlayPath = SNAPSHOT ? `data_sources/ofgem_pel/matching/${SNAPSHOT}/canonical-pel-overlay.json` : null;
const overlayFile = overlayPath && existsSync(resolve(ROOT, overlayPath)) ? loadJSON(overlayPath) : null;
const pelByBafaId = new Map((overlayFile?.overlay ?? []).map(e => [String(e.bafa_id), e]));
console.log(overlayFile
  ? `PEL overlay: ${pelByBafaId.size} mappings (snapshot ${overlayFile._meta.pel_snapshot})`
  : 'PEL overlay: none — every product will show "verification required"');

function pelFetchedAt() {
  const p = resolve(ROOT, `data_sources/ofgem_pel/raw/${SNAPSHOT}/_meta.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')).downloadedAt ?? null; } catch { return null; }
}
const PEL_FETCHED_AT = pelFetchedAt();
const generatedAt = new Date().toISOString();

// ── Build ────────────────────────────────────────────────────────────────────
function toGbItem(p) {
  const o = pelByBafaId.get(String(p.bafa_id)) ?? null;
  const confirmed = o?.status === 'confirmed';
  const item = { ...p };
  for (const f of GERMAN_ONLY_FIELDS) delete item[f];

  return {
    ...item,
    type: TYPE_EN[p.type] ?? p.type,
    country: 'GB',
    source_id: String(p.bafa_id),
    // Provenance is internal. The UI calls this a European reference and never
    // names the source country (EUROPE_DATA_AND_PRODUCT_SEGMENTATION_PRINCIPLES.md).
    primary_source: 'BAFA_REFERENCE',
    performance_source: 'BAFA_REFERENCE',
    bafa_reference_id: p.bafa_id != null ? String(p.bafa_id) : null,
    bafa_reference_model: p.model ?? null,
    bafa_reference_match_type: 'same_record',

    // ── UK local listing overlay — the ONLY thing the PEL contributes ────────
    // 'confirmed'             the UK has listed this product (PEL id shown)
    // 'review_required'       it WAS confirmed and stopped matching. A matcher or
    //                         parser regression is likelier than an Ofgem delisting,
    //                         so the mapping is kept and a human looks. Displayed
    //                         exactly like verification_required — never "not listed".
    // 'verification_required' no reliable match. That is a statement about OUR
    //                         matching, not about the PEL: absence of a match is
    //                         not evidence of absence from the list.
    // Identity travels ONLY with a confirmed listing. An ambiguity-blocked candidate
    // (one MCS number resolving to several canonical products) publishes no id, no
    // method and no dates — asserting nothing. Its candidate ids and evidence live in
    // the internal review file, where a human can settle them.
    pel_match_status: confirmed ? 'confirmed' : (o?.status === 'review_required' ? 'review_required' : 'verification_required'),
    mcs_number: confirmed ? o.mcs_number : null,
    pel_source_id: confirmed ? o.pel_source_id ?? null : null,
    pel_match_method: confirmed ? o.match_method ?? null : null,
    pel_match_confidence: confirmed ? o.match_confidence ?? null : null,
    pel_snapshot: o?.pel_snapshot ?? SNAPSHOT ?? null,
    pel_snapshot_fetched_at: PEL_FETCHED_AT,
    pel_first_matched_at: confirmed ? o.first_matched_at ?? null : null,
    pel_last_confirmed_at: confirmed ? o.last_confirmed_at ?? null : null,

    source_snapshot_generated_at: generatedAt,
  };
}

const resEligible = applyEligibility(deResidential.items);
const comEligible = applyEligibility(deCommercial.items);
const rejected = [...resEligible.rejected, ...comEligible.rejected];
const byReason = {};
for (const r of [resEligible.byReason, comEligible.byReason]) {
  for (const [k, v] of Object.entries(r)) byReason[k] = (byReason[k] ?? 0) + v;
}

const residential = resEligible.eligible.map(toGbItem);
const commercial = comEligible.eligible.map(toGbItem);
const items = [...residential, ...commercial];

// ── Validate ─────────────────────────────────────────────────────────────────
const fail = m => { console.error(`FAIL: ${m}`); process.exit(1); };

if (!items.length) fail('no eligible products — refusing to write an empty catalogue');
if (residential.length && commercial.length
  && Object.keys(residential[0]).join(',') !== Object.keys(commercial[0]).join(',')) {
  fail('residential and commercial record shapes differ');
}

const keys = Object.keys(items[0]);
const priceKeys = keys.filter(k => PRICE_KEY_FRAGMENTS.some(f => k.includes(f)));
if (priceKeys.length) fail(`price-like keys present: ${priceKeys.join(', ')}`);

for (const f of GERMAN_ONLY_FIELDS) {
  if (keys.includes(f)) fail(`German registration/funding field leaked into the GB dataset: ${f}`);
}

const ids = new Set(items.map(i => i.source_id));
if (ids.size !== items.length) fail(`source_id not unique: ${items.length - ids.size} collisions`);

// Every published product must render a data sheet and land in a segment.
const noCap = items.filter(i => ratedCapacityKw(i) == null);
if (noCap.length) fail(`${noCap.length} published products have no rated capacity`);
const unclassified = items.filter(i => segmentOf(i) === 'unclassified');
if (unclassified.length) fail(`${unclassified.length} published products are unclassified`);

// The overlay may only say "confirmed" when a PEL id stands behind it — and nothing
// that is NOT confirmed may carry an id, or the UI could imply a listing we did not
// establish.
const badListing = items.filter(i =>
  (i.pel_match_status === 'confirmed' && !i.mcs_number)
  || (i.pel_match_status !== 'confirmed' && i.mcs_number)
  || !['confirmed', 'review_required', 'verification_required'].includes(i.pel_match_status));
if (badListing.length) fail(`${badListing.length} products have an invalid PEL listing state`);

// One local id, one confirmed product — unless an approved exception says otherwise.
const byLocal = new Map();
items.filter(i => i.pel_match_status === 'confirmed').forEach(i => {
  if (!byLocal.has(i.mcs_number)) byLocal.set(i.mcs_number, []);
  byLocal.get(i.mcs_number).push(i);
});
const stillAmbiguous = [...byLocal.entries()].filter(([, v]) =>
  v.length > 1 && !v.every(x => x.pel_match_method === 'approved_one_to_many'));
if (stillAmbiguous.length) {
  fail(`${stillAmbiguous.length} local ids are confirmed for several canonical products without an approved exception`);
}

// ── Write ────────────────────────────────────────────────────────────────────
const confirmed = items.filter(i => i.pel_match_status === 'confirmed').length;
const reviewReq = items.filter(i => i.pel_match_status === 'review_required').length;
const verifyReq = items.filter(i => i.pel_match_status === 'verification_required').length;

const meta = {
  generated_at: generatedAt,
  generator: 'build-app-products-gb.mjs v3.0 (canonical baseline + PEL listing overlay)',
  country: 'GB',
  architecture: 'Public products come from the canonical technical baseline. The Ofgem PEL is a '
    + 'listing overlay only: it never creates a product, supplies a spec, changes a capacity or a '
    + 'segment, and a failed match never removes a product.',
  canonical_products: canonicalCount,
  data_sheet_eligible: items.length,
  rejected_ineligible: rejected.length,
  rejection_reasons: byReason,
  pel_snapshot: SNAPSHOT,
  pel_overlay_source: overlayPath,
  pel_confirmed: confirmed,
  pel_review_required: reviewReq,
  pel_verification_required: verifyReq,
  listing_semantics: 'A product without a confirmed match shows "PEL verification required". The '
    + 'absence of an automated match is NOT evidence that the product is absent from the PEL.',
};

writeFileSync(resolve(ROOT, 'public/data/products-gb.json'),
  JSON.stringify({ _meta: { ...meta, source_file: 'canonical-residential' }, items: residential }, null, 2));
writeFileSync(resolve(ROOT, 'public/data/products-commercial-gb.json'),
  JSON.stringify({ _meta: { ...meta, source_file: 'canonical-commercial' }, items: commercial }, null, 2));

const seg = { residential: 0, commercial: 0, unclassified: 0 };
items.forEach(i => seg[segmentOf(i)]++);

console.log('\n── Build summary (GB v3.0 — canonical baseline) ───────────');
console.log(`Canonical products:    ${canonicalCount}`);
console.log(`Data Sheet eligible:   ${items.length}  (rejected ${rejected.length})`);
if (rejected.length) console.log(`  rejection reasons:   ${JSON.stringify(byReason)}`);
console.log(`Files:                 ${residential.length} + ${commercial.length}`);
console.log(`23 kW segments:        residential ${seg.residential}, commercial ${seg.commercial}, unclassified ${seg.unclassified}`);
console.log(`PEL overlay:           confirmed ${confirmed} | review required ${reviewReq} | verification required ${verifyReq}`);
console.log(`PEL match rate:        ${(100 * confirmed / items.length).toFixed(1)}%`);
console.log(`Field count:           ${keys.length}`);
console.log('No German status/funding fields ✓   No price keys ✓   source_id unique ✓');
console.log('──────────────────────────────────────────────────────────');
