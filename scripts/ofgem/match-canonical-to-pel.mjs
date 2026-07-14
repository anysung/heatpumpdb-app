/**
 * match-canonical-to-pel.mjs — attach the UK local-listing overlay to canonical products.
 *
 * ARCHITECTURE (docs/CANONICAL_TECHNICAL_BASELINE_AND_LOCAL_MARKET_OVERLAY.md):
 * the direction is canonical → local registry, never the other way round.
 *
 *     canonical technical product  →  match against the Ofgem PEL  →  listing overlay
 *
 * The product exists because the canonical baseline says it exists. The PEL can
 * only tell us whether the UK has listed it. A failed match removes nothing,
 * changes no capacity, and never touches a technical field.
 *
 * The old pipeline did the opposite: it published 4,422 PEL rows as products and
 * then tried to reconstruct their missing specs from EPREL and component
 * inference. That is why 2,134 UK "products" had no capacity at all.
 *
 * Evidence accepted (never fuzzy, never an outdoor-unit-only match):
 *   exact_model          identical model identity after formatting normalization
 *   component_identity   one side's product codes wholly contain the other's
 *   family_market_suffix the same model with a UK/GB market suffix, numbers equal
 * A shared outdoor unit does NOT prove the PEL package is this canonical package,
 * so it only produces a review candidate — it never confirms a listing.
 *
 * MATCH HISTORY (data_sources/ofgem_pel/pel-match-history.json — committed):
 * a confirmed listing that stops matching is NOT silently downgraded to
 * "unlisted". It becomes `review_required` and keeps its PEL id, because the far
 * likelier cause is a matcher or parser regression, not Ofgem delisting a product.
 *
 * Inputs : public/data/products*.json (canonical), PEL normalized snapshot, brand maps
 * Outputs: data_sources/ofgem_pel/matching/<snap>/canonical-pel-overlay.json  (gitignored)
 *          data_sources/ofgem_pel/matching/<snap>/canonical-pel-review.json   (gitignored)
 *          data_sources/ofgem_pel/pel-match-history.json                      (committed)
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compact, identityKeys, findCandidates, numericConflict } from './pel-match-lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const loadJSON = p => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
const newest = d => readdirSync(resolve(ROOT, d)).filter(x => /^\d{4}-\d{2}$/.test(x)).sort().reverse()[0] ?? null;

const SNAPSHOT = process.argv.find(a => a.startsWith('--pel='))?.split('=')[1] ?? newest('data_sources/ofgem_pel/parsed');
if (!SNAPSHOT) { console.error('No PEL snapshot found.'); process.exit(1); }
const NOW = new Date().toISOString();

/** Methods that may CONFIRM a listing, with the confidence recorded on the record. */
const CONFIRMING = { exact_model: 'high', component_identity: 'high', family_market_suffix: 'medium' };

// ── Inputs ───────────────────────────────────────────────────────────────────
const canonical = [
  ...loadJSON('public/data/products.json').items,
  ...loadJSON('public/data/products-commercial.json').items,
];
const pel = loadJSON(`data_sources/ofgem_pel/parsed/${SNAPSHOT}/pel-normalized.json`)
  .filter(r => ['ASHP', 'WSHP', 'EAHP'].includes(r.technology_type));

const gbShort = loadJSON('scripts/ofgem/manufacturer-short-names-gb.json').mapping;
const HISTORY_PATH = 'data_sources/ofgem_pel/pel-match-history.json';
const history = existsSync(resolve(ROOT, HISTORY_PATH))
  ? loadJSON(HISTORY_PATH)
  : { version: 1, updated_at: null, note: 'Confirmed canonical↔PEL mappings. A mapping that stops matching becomes review_required, never silently unlisted.', matches: {} };

/**
 * Official manufacturer cross-references (data_sources/manufacturer_cross_reference/).
 *
 * Some products can NEVER be matched automatically: Daikin's UK registry codes do
 * not exist in any European source, and the European registry publishes no Daikin
 * component codes at all. The only way through is the manufacturer telling us which
 * product is which — so there is a committed file for exactly that, and adding a
 * mapping to it requires no code change. These outrank automated matching.
 */
const XREF_PATH = 'data_sources/manufacturer_cross_reference/canonical-to-pel.json';
const xref = existsSync(resolve(ROOT, XREF_PATH))
  ? (loadJSON(XREF_PATH).mappings ?? []).filter(m => m.local_registry === 'PEL')
  : [];

console.log(`canonical products: ${canonical.length} | PEL heat pumps: ${pel.length} (snapshot ${SNAPSHOT})`);
console.log(`official manufacturer cross-references: ${xref.length}`);
console.log(`match history: ${Object.keys(history.matches).length} previously confirmed mappings`);

// ── PEL candidate pool, indexed by the brand short name ──────────────────────
const pool = new Map();
for (const r of pel) {
  const brand = (gbShort[r.brand] ?? '').toUpperCase();
  if (!brand) continue;
  if (!pool.has(brand)) pool.set(brand, []);
  pool.get(brand).push({
    source: 'OFGEM_PEL',
    id: r.mcs_number,
    model: r.model,
    raw: r,
    specs: {},                       // the PEL publishes no technical data — by design
    ck: compact(r.model),
    keys: identityKeys(r.model),
  });
}

// ── Match ────────────────────────────────────────────────────────────────────
const overlay = new Map();           // bafa_id → overlay entry
const review = [];
const stats = { confirmed: 0, review_candidate: 0, no_candidate: 0, brand_not_on_pel: 0, ambiguous: 0 };
const byMethod = {};

for (const p of canonical) {
  const brand = (p.manufacturer_short ?? '').toUpperCase();
  const cands = pool.get(brand);
  if (!cands?.length) { stats.brand_not_on_pel++; continue; }

  const found = findCandidates(p.model, cands);
  if (!found) { stats.no_candidate++; continue; }

  // An outdoor-unit-only overlap does not prove the PEL package IS this package.
  if (found.method === 'shared_component') {
    stats.review_candidate++;
    review.push({
      bafa_id: String(p.bafa_id), canonical_model: p.model, manufacturer: p.manufacturer,
      candidates: found.hits.slice(0, 3).map(c => ({ mcs_number: c.id, pel_model: c.model })),
      reason: 'only an outdoor-unit code is shared — not proof of the same complete system',
    });
    continue;
  }
  // A market-suffix family match must not disagree on the numbers.
  const hits = found.method === 'family_market_suffix'
    ? found.hits.filter(c => !numericConflict(p.model, c.model))
    : found.hits;
  if (!hits.length) { stats.no_candidate++; continue; }

  const confidence = CONFIRMING[found.method];
  if (!confidence) { stats.review_candidate++; continue; }

  // Several PEL rows may list the same product (variants of one certificate).
  // That is not ambiguity — they all confirm the same listing. Keep the first as
  // the displayed id and record the rest.
  const primary = hits[0];
  if (hits.length > 1) stats.ambiguous++;

  const prev = history.matches[String(p.bafa_id)];
  overlay.set(String(p.bafa_id), {
    bafa_id: String(p.bafa_id),
    mcs_number: primary.id,
    pel_source_id: primary.raw.source_id,
    pel_model: primary.model,
    all_mcs_numbers: hits.map(h => h.id),
    match_method: found.method,
    match_confidence: confidence,
    pel_snapshot: SNAPSHOT,
    status: 'confirmed',
    first_matched_at: prev?.first_matched_at ?? NOW,
    last_confirmed_at: NOW,
    previous_status: prev?.status ?? null,
  });
  stats.confirmed++;
  byMethod[found.method] = (byMethod[found.method] ?? 0) + 1;
}

// ── Official manufacturer mappings — applied last, and they win ──────────────
// A matcher regression must never erase a mapping the manufacturer confirmed.
let official = 0;
for (const m of xref) {
  const id = String(m.canonical_id);
  const prev = history.matches[id];
  overlay.set(id, {
    bafa_id: id,
    mcs_number: m.local_id,
    pel_source_id: m.local_id,
    pel_model: null,
    all_mcs_numbers: [m.local_id],
    match_method: 'manufacturer_official',
    match_confidence: 'official',
    pel_snapshot: SNAPSHOT,
    status: 'confirmed',
    evidence: m.evidence ?? null,
    first_matched_at: prev?.first_matched_at ?? m.added_at ?? NOW,
    last_confirmed_at: NOW,
    previous_status: prev?.status ?? null,
  });
  official++;
}
if (official) { stats.confirmed += official; byMethod.manufacturer_official = official; }

// ── Match stability: a confirmed mapping that stopped matching ───────────────
// It does NOT become "not listed". Ofgem removing a product is possible; a
// matcher or parser regression is far likelier, and only the source can prove
// removal. So the mapping is preserved and flagged for a human.
const canonicalIds = new Set(canonical.map(p => String(p.bafa_id)));
let lost = 0;
for (const [id, prev] of Object.entries(history.matches)) {
  if (overlay.has(id)) continue;
  if (!canonicalIds.has(id)) continue;                 // product itself is gone from the baseline
  lost++;
  overlay.set(id, {
    ...prev,
    bafa_id: id,
    status: 'review_required',
    previous_status: prev.status,
    lost_in_snapshot: SNAPSHOT,
    last_confirmed_at: prev.last_confirmed_at ?? null,
  });
}

// ── Write ────────────────────────────────────────────────────────────────────
const outDir = resolve(ROOT, `data_sources/ofgem_pel/matching/${SNAPSHOT}`);
mkdirSync(outDir, { recursive: true });
const meta = {
  generated: NOW,
  generator: 'match-canonical-to-pel.mjs v1.0',
  direction: 'canonical → PEL (the local registry is an overlay, never the product source)',
  pel_snapshot: SNAPSHOT,
  confirming_methods: Object.keys(CONFIRMING),
  policy: 'Fuzzy similarity and outdoor-unit-only overlap never confirm a listing. '
    + 'A confirmed mapping that stops matching becomes review_required, never "not listed".',
  canonical_products: canonical.length,
  pel_records: pel.length,
  stats: { ...stats, lost_previously_confirmed: lost },
  by_method: byMethod,
};
writeFileSync(resolve(outDir, 'canonical-pel-overlay.json'),
  JSON.stringify({ _meta: meta, overlay: [...overlay.values()] }, null, 2));
writeFileSync(resolve(outDir, 'canonical-pel-review.json'),
  JSON.stringify({ _meta: { ...meta, note: 'Human review. Never applied automatically.' }, review }, null, 2));

// ── Manufacturer follow-up list ──────────────────────────────────────────────
// Canonical products with no confirmed local listing, grouped by manufacturer.
// This is what we ask a manufacturer to map for us (Daikin above all: its UK
// registry codes exist in no European source, so no matcher will ever link them).
// Mappings come back via data_sources/manufacturer_cross_reference/ — no code change.
const followUp = {};
for (const p of canonical) {
  if (overlay.get(String(p.bafa_id))?.status === 'confirmed') continue;
  const brand = p.manufacturer_short ?? p.manufacturer ?? '(unknown)';
  (followUp[brand] ??= []).push({ canonical_id: String(p.bafa_id), model: p.model });
}
const followUpSorted = Object.entries(followUp).sort((a, b) => b[1].length - a[1].length);
writeFileSync(resolve(outDir, 'canonical-pel-followup.json'), JSON.stringify({
  _meta: {
    ...meta,
    note: 'Canonical products with no confirmed local listing, by manufacturer. Ask the '
      + 'manufacturer to map these to their UK PEL/MCS designations; add the result to '
      + 'data_sources/manufacturer_cross_reference/canonical-to-pel.json.',
    manufacturers: followUpSorted.length,
    products: canonical.length - stats.confirmed,
  },
  by_manufacturer: Object.fromEntries(followUpSorted.map(([k, v]) => [k, { count: v.length, products: v }])),
}, null, 2));

// History keeps only CONFIRMED mappings (review_required entries retain their
// last confirmed state, so a recovered match resumes its original first_matched_at).
const nextHistory = { ...history, updated_at: NOW, matches: { ...history.matches } };
for (const e of overlay.values()) {
  if (e.status !== 'confirmed') continue;
  nextHistory.matches[e.bafa_id] = {
    mcs_number: e.mcs_number, pel_source_id: e.pel_source_id,
    match_method: e.match_method, match_confidence: e.match_confidence,
    first_matched_at: e.first_matched_at, last_confirmed_at: e.last_confirmed_at,
    last_snapshot: e.pel_snapshot, status: 'confirmed',
  };
}
writeFileSync(resolve(ROOT, HISTORY_PATH), JSON.stringify(nextHistory, null, 2) + '\n');

console.log('\n── Canonical → PEL overlay ────────────────────────────────');
console.log(`confirmed listings:        ${stats.confirmed}  (${Object.entries(byMethod).map(([m, n]) => `${m}: ${n}`).join(', ')})`);
console.log(`  listed by several PEL rows: ${stats.ambiguous}`);
console.log(`review candidates (ODU only): ${stats.review_candidate}`);
console.log(`previously confirmed, now unmatched → review_required: ${lost}`);
console.log(`no PEL candidate:          ${stats.no_candidate}`);
console.log(`brand not on the PEL:      ${stats.brand_not_on_pel}`);
console.log(`manufacturer follow-up:    ${followUpSorted.length} manufacturers, top: ${followUpSorted.slice(0, 3).map(([b, v]) => `${b} ${v.length}`).join(', ')}`);
console.log(`→ ${SNAPSHOT}/canonical-pel-{overlay,review,followup}.json  +  ${HISTORY_PATH}`);
console.log('──────────────────────────────────────────────────────────');
