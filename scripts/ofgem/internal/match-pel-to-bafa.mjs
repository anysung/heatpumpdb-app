/**
 * ⚠ INTERNAL / AUDIT ONLY — NOT part of the production data pipeline.
 *
 * This script belongs to the retired PEL-FIRST architecture, in which Ofgem PEL
 * rows were published as technical products and their missing specifications were
 * reconstructed from EPREL and component inference. That is exactly what produced
 * 2,134 UK "products" with no capacity, no segment and a blank data sheet.
 *
 * Since v3.0 the UK catalogue is built from the canonical technical baseline and
 * the PEL is only a listing overlay (match-canonical-to-pel.mjs →
 * build-app-products-gb.mjs). See
 * docs/CANONICAL_TECHNICAL_BASELINE_AND_LOCAL_MARKET_OVERLAY.md.
 *
 * Kept because the matching evidence and audit trails are still useful for
 * manufacturer follow-up and for investigating PEL data quality. DO NOT wire this
 * back into a builder or into update-all.mjs.
 */
/**
 * match-pel-to-bafa.mjs  v1.0  (Phase B — BAFA_REFERENCE enrichment matching)
 *
 * Matches Ofgem PEL heat pump records against the BAFA master seed to fill
 * performance fields (kW, COP, SCOP, noise, refrigerant, …) that the PEL
 * does not publish.
 *
 * Inputs (newest snapshots auto-selected; --pel= / --seed= override):
 *   data_sources/ofgem_pel/parsed/YYYY-MM/pel-normalized.json
 *   data_sources/bafa/master_seed/YYYY-MM/bafa-master-seed.json
 *   scripts/ofgem/manufacturer-short-names-gb.json   (PEL brand → short name)
 *   scraper/pricing/manufacturer-short-names.json    (BAFA normalized → short name)
 *
 * Output: data_sources/ofgem_pel/matching/<pel-snapshot>/pel-bafa-matches.json
 *   (gitignored, like all snapshot data)
 *
 * Matching policy — conservative, unambiguous-only:
 *   Brand gate: PEL short name === BAFA short name (uppercased). No cross-brand
 *   matching ever.
 *   1. exact_model        — identical model token sequences.
 *   2. token_subsequence  — one model's full token sequence appears as a
 *      CONTIGUOUS subsequence of the other's (contained side needs ≥2 tokens,
 *      or 1 token of length ≥6). Catches BAFA package strings like
 *      "AQUAREA [WH-MXC09J3E8]" ⊇ PEL "WH-MXC09J3E8".
 *   Multiple candidates are accepted ONLY if their copied spec fields are
 *   identical; otherwise the record is left unmatched (ambiguous). Plain
 *   substring matching is NOT used — it produced false variant matches
 *   (e.g. "WPL 25 AS" vs "WPL 25 A").
 *
 * Honesty: a match means "the same hardware is listed on the German BAFA
 * registry"; copied values are a technical cross-reference (BAFA_REFERENCE),
 * not UK certification data. The builder stamps performance_source accordingly.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');

function loadJSON(relPath) {
  const abs = resolve(ROOT, relPath);
  try {
    return JSON.parse(readFileSync(abs, 'utf8'));
  } catch (err) {
    console.error(`Failed to load ${relPath}: ${err.message}`);
    process.exit(1);
  }
}

function newestSnapshot(relDir) {
  return readdirSync(resolve(ROOT, relDir)).filter(d => /^\d{4}-\d{2}$/.test(d)).sort().reverse()[0] ?? null;
}

const pelArg = process.argv.find(a => a.startsWith('--pel='))?.split('=')[1] ?? null;
const seedArg = process.argv.find(a => a.startsWith('--seed='))?.split('=')[1] ?? null;
const PEL_SNAPSHOT = pelArg ?? newestSnapshot('data_sources/ofgem_pel/parsed');
const SEED_SNAPSHOT = seedArg ?? newestSnapshot('data_sources/bafa/master_seed');
if (!PEL_SNAPSHOT || !SEED_SNAPSHOT) { console.error('Missing PEL or seed snapshot.'); process.exit(1); }
console.log(`PEL snapshot: ${PEL_SNAPSHOT} | BAFA seed snapshot: ${SEED_SNAPSHOT}`);

const pel = loadJSON(`data_sources/ofgem_pel/parsed/${PEL_SNAPSHOT}/pel-normalized.json`)
  .filter(r => ['ASHP', 'WSHP', 'EAHP'].includes(r.technology_type));
const seed = loadJSON(`data_sources/bafa/master_seed/${SEED_SNAPSHOT}/bafa-master-seed.json`);
const gbShort = new Map(Object.entries(loadJSON('scripts/ofgem/manufacturer-short-names-gb.json').mapping));
const deShort = new Map(Object.entries(loadJSON('scraper/pricing/manufacturer-short-names.json').mapping));

// ── Spec fields copied from a matched BAFA record ─────────────────────────────
// Technical device specs only. BAFA listing/provenance fields, grid_ready and
// German attestation fields (ee_display, heat_meter) are NOT copied.
const SPEC_FIELDS = [
  'refrigerant', 'refrigerant_2', 'refrigerant_amount_kg', 'refrigerant_2_amount_kg',
  'power_35C_kw', 'efficiency_35C_percent', 'power_design_35C_kw',
  'power_55C_kw', 'efficiency_55C_percent', 'power_design_55C_kw',
  'cop_A7W35', 'cop_A2W35', 'cop_AMinus7W35', 'cop_A10W35', 'scop', 'seer',
  'cooling_efficiency', 'cooling_capacity_kw',
  'noise_outdoor_dB', 'noise_indoor_dB', 'max_electric_power_kw',
  'drive_type', 'power_control', 'num_compressors',
  'defrost_tested', 'defrost_type', 'temp_diff',
];

const tokens = s => (s ?? '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
const tokenKey = s => tokens(s).join(' ');
const specsOf = s => Object.fromEntries(SPEC_FIELDS.map(k => [k, s[k] ?? null]));
const specSig = s => JSON.stringify(specsOf(s));

/** True when `short` is a contiguous subsequence of `long`. */
function isContiguousSubseq(short, long) {
  if (short.length === 0 || short.length > long.length) return false;
  outer: for (let i = 0; i <= long.length - short.length; i++) {
    for (let j = 0; j < short.length; j++) {
      if (long[i + j] !== short[j]) continue outer;
    }
    return true;
  }
  return false;
}

/** Contained side must carry enough signal to be meaningful. */
const containable = tk => tk.length >= 2 || (tk.length === 1 && tk[0].length >= 6);

// ── Index BAFA seed by brand short name ──────────────────────────────────────

const byBrand = new Map();
for (const s of seed.items) {
  const b = (deShort.get(s.manufacturer_normalized) ?? '').toUpperCase();
  if (!b) continue;
  if (!byBrand.has(b)) byBrand.set(b, []);
  byBrand.get(b).push({ s, tk: tokens(s.model), key: tokenKey(s.model) });
}

// ── Match ─────────────────────────────────────────────────────────────────────

const matches = [];
const stats = { exact_model: 0, token_subsequence: 0, ambiguous: 0, no_model_match: 0, brand_not_in_bafa: 0 };
const byBrandMatched = {};

function accept(r, hits, matchType) {
  // Multiple candidates OK only when their copied specs are identical.
  if (hits.length > 1 && new Set(hits.map(h => specSig(h.s))).size > 1) return false;
  const c = hits[0];
  stats[matchType]++;
  const brandKey = (gbShort.get(r.brand) ?? '').toUpperCase();
  byBrandMatched[brandKey] = (byBrandMatched[brandKey] ?? 0) + 1;
  matches.push({
    match_key: `${r.mcs_number}||${r.model}`,
    mcs_number: r.mcs_number,
    pel_model: r.model,
    pel_brand: r.brand,
    brand_key: brandKey,
    bafa_id: String(c.s.bafa_id),
    bafa_model: c.s.model,
    bafa_manufacturer: c.s.manufacturer,
    match_type: matchType,
    candidates: hits.length,
    specs: specsOf(c.s),
  });
  return true;
}

for (const r of pel) {
  const brandKey = (gbShort.get(r.brand) ?? '').toUpperCase();
  const cands = byBrand.get(brandKey);
  if (!cands) { stats.brand_not_in_bafa++; continue; }

  const gtk = tokens(r.model);
  const gkey = tokenKey(r.model);

  let hits = cands.filter(c => c.key === gkey);
  if (hits.length > 0) {
    if (accept(r, hits, 'exact_model')) continue;
    stats.ambiguous++; continue;
  }

  hits = cands.filter(c =>
    (containable(gtk) && isContiguousSubseq(gtk, c.tk)) ||
    (containable(c.tk) && isContiguousSubseq(c.tk, gtk))
  );
  if (hits.length > 0) {
    if (accept(r, hits, 'token_subsequence')) continue;
    stats.ambiguous++; continue;
  }

  stats.no_model_match++;
}

// Dedupe guard: one match per match_key (duplicate PEL rows share key + same match result)
const byKey = new Map(matches.map(m => [m.match_key, m]));

// ── Write output ──────────────────────────────────────────────────────────────

const outDir = resolve(ROOT, `data_sources/ofgem_pel/matching/${PEL_SNAPSHOT}`);
mkdirSync(outDir, { recursive: true });
const payload = {
  _meta: {
    generated: new Date().toISOString(),
    generator: 'match-pel-to-bafa.mjs v1.0',
    pel_snapshot: PEL_SNAPSHOT,
    bafa_seed_snapshot: SEED_SNAPSHOT,
    policy: 'Brand-gated (short-name equality) + exact token sequence or contiguous token subsequence. '
      + 'Multi-candidate accepted only with identical copied specs. No plain substring matching.',
    semantics: 'A match = same hardware listed on the German BAFA registry. Copied specs are a technical '
      + 'cross-reference (BAFA_REFERENCE), not UK certification data.',
    spec_fields_copied: SPEC_FIELDS,
    pel_heat_pump_records: pel.length,
    unique_match_keys: byKey.size,
    stats,
    matched_by_brand: Object.fromEntries(Object.entries(byBrandMatched).sort((a, b) => b[1] - a[1])),
  },
  matches: [...byKey.values()],
};
writeFileSync(resolve(outDir, 'pel-bafa-matches.json'), JSON.stringify(payload, null, 2));

console.log('');
console.log('── Match summary ──────────────────────────────────────────');
console.log(`PEL heat pump records:   ${pel.length}`);
console.log(`Matched (records):       ${stats.exact_model + stats.token_subsequence}  (exact: ${stats.exact_model}, token_subsequence: ${stats.token_subsequence})`);
console.log(`Unique match keys:       ${byKey.size}`);
console.log(`Ambiguous (rejected):    ${stats.ambiguous}`);
console.log(`No model match:          ${stats.no_model_match}`);
console.log(`Brand not on BAFA:       ${stats.brand_not_in_bafa}`);
console.log(`Top matched brands:      ${Object.entries(byBrandMatched).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([b, n]) => `${b}:${n}`).join(', ')}`);
console.log(`→ data_sources/ofgem_pel/matching/${PEL_SNAPSHOT}/pel-bafa-matches.json`);
console.log('──────────────────────────────────────────────────────────');
