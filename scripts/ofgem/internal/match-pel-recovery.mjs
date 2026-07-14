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
 * match-pel-recovery.mjs  v1.0  (GB — rated-capacity recovery for unmatched PEL records)
 *
 * The Ofgem PEL publishes NO performance data at all, so a PEL record only has a
 * rated capacity if we can match it to a European product record. After
 * match-pel-to-bafa + match-pel-to-eprel, 2,745 of 4,422 PEL heat pumps still had
 * none — they are `unclassified` in the app (never silently residential; see
 * docs/EUROPE_DATA_AND_PRODUCT_SEGMENTATION_PRINCIPLES.md).
 *
 * Those two matchers compare the model as ONE ordered token sequence. That is why
 * they missed:
 *   · component pairs written in the other order
 *       PEL "ERGA04DAV3A / EHBH04DA6V"   vs  EPREL "EHBH04DA6V / ERGA04DAV3A / EKHWS…"
 *   · a package name prefixed to the unit code
 *       PEL "WiSAN-YME 1 S 2.1"          vs  registry "EDGE Evo 2.0 / WiSAN-YME 1 S 2.1"
 *   · market/config suffixes and descriptive phrases
 *       PEL "WPC 05 S GB", "… - UK Version - Heating Only"
 *   · one ODU sold in several packages: the old rule demanded that ALL ~30 copied
 *     spec fields be identical across candidates, so a tank-size difference threw
 *     the record away even when every candidate agreed on the rated capacity.
 *
 * This pass fixes exactly those, and nothing else. It is deliberately conservative:
 * a capacity is recovered ONLY from a product-identity match, never from a model
 * name's number, a PEL category, or a typical range. Where the evidence is not
 * decisive the record STAYS unclassified and goes to a human review queue.
 *
 * Inputs (newest snapshots auto-selected):
 *   data_sources/ofgem_pel/parsed/YYYY-MM/pel-normalized.json
 *   data_sources/bafa/master_seed/YYYY-MM/bafa-master-seed.json
 *   data_sources/eprel_raw/raw/YYYY-MM/spaceheaters-heatpump/page-*.json
 *   data_sources/ofgem_pel/matching/<pel>/pel-bafa-matches.json     (already-resolved)
 *   data_sources/ofgem_pel/matching/<pel>/pel-eprel-matches.json    (already-resolved)
 *   scripts/ofgem/manufacturer-short-names-gb.json  +  scraper/pricing/manufacturer-short-names.json
 *
 * Outputs (gitignored, like all snapshot data):
 *   .../pel-recovery-matches.json   accepted Tier A/B — consumed by build-app-products-gb.mjs
 *   .../pel-recovery-review.json    Tier C — human review queue, NEVER auto-applied
 *   .../pel-recovery-audit.json     one entry per input record, with the reason
 *
 * Honesty: the match says "this is the same hardware as a European registry/EPREL
 * record". It transfers technical data only. It NEVER makes a product PEL-listed,
 * BUS-eligible, or German in the UI — provenance stays internal.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// Every matching RULE lives in the library, so tests/pel-matching.unit.mjs
// exercises exactly the logic that runs here — not a copy of it.
import {
  SPEC_FIELDS, CAPACITY_CHAIN, ratedCapacity, compact, identityKeys,
  conflictsWith, numericConflict, reconcile, similarity, findCandidates, tierOf,
} from '../pel-match-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const loadJSON = p => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
const newest = d => readdirSync(resolve(ROOT, d)).filter(x => /^\d{4}-\d{2}$/.test(x)).sort().reverse()[0] ?? null;

const PEL_SNAPSHOT = process.argv.find(a => a.startsWith('--pel='))?.split('=')[1] ?? newest('data_sources/ofgem_pel/parsed');
const SEED_SNAPSHOT = process.argv.find(a => a.startsWith('--seed='))?.split('=')[1] ?? newest('data_sources/bafa/master_seed');
const EPREL_SNAPSHOT = process.argv.find(a => a.startsWith('--eprel='))?.split('=')[1] ?? newest('data_sources/eprel_raw/raw');
console.log(`PEL ${PEL_SNAPSHOT} | seed ${SEED_SNAPSHOT} | EPREL ${EPREL_SNAPSHOT}`);

// ── Load the PEL population ──────────────────────────────────────────────────

const pelAll = loadJSON(`data_sources/ofgem_pel/parsed/${PEL_SNAPSHOT}/pel-normalized.json`)
  .filter(r => ['ASHP', 'WSHP', 'EAHP'].includes(r.technology_type));

const mkey = r => `${r.mcs_number}||${r.model}`;
const resolvedKeys = new Set();
for (const f of ['pel-bafa-matches.json', 'pel-eprel-matches.json']) {
  const p = `data_sources/ofgem_pel/matching/${PEL_SNAPSHOT}/${f}`;
  if (!existsSync(resolve(ROOT, p))) continue;
  for (const m of loadJSON(p).matches ?? []) resolvedKeys.add(m.match_key);
}
const input = pelAll.filter(r => !resolvedKeys.has(mkey(r)));
console.log(`PEL heat pumps ${pelAll.length} | already resolved ${resolvedKeys.size} | recovery input ${input.length}`);

// ── Candidate pools, indexed by brand ────────────────────────────────────────

const gbShort = loadJSON('scripts/ofgem/manufacturer-short-names-gb.json').mapping;
const deShort = loadJSON('scraper/pricing/manufacturer-short-names.json').mapping;
const brandOf = pelBrand => (gbShort[pelBrand] ?? '').toUpperCase();

const pool = new Map();                 // brand → candidate[]
const addCandidate = (brand, c) => {
  if (!brand) return;
  if (!pool.has(brand)) pool.set(brand, []);
  pool.get(brand).push(c);
};

// European registry seed
const seed = loadJSON(`data_sources/bafa/master_seed/${SEED_SNAPSHOT}/bafa-master-seed.json`).items;
for (const s of seed) {
  const brand = (deShort[s.manufacturer_normalized] ?? '').toUpperCase();
  const specs = Object.fromEntries(SPEC_FIELDS.map(k => [k, s[k] ?? null]));
  addCandidate(brand, {
    source: 'EU_REGISTRY',              // internal provenance; never UI wording
    id: String(s.bafa_id),
    model: s.model,
    specs,
    cap: ratedCapacity(specs),
    keys: identityKeys(s.model),
    ck: compact(s.model),
  });
}

// EPREL
const shorts = [...new Set(Object.values(gbShort))];
const tokens = s => (s ?? '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
const isSubseq = (a, b) => {
  if (!a.length || a.length > b.length) return false;
  outer: for (let i = 0; i <= b.length - a.length; i++) {
    for (let j = 0; j < a.length; j++) if (b[i + j] !== a[j]) continue outer;
    return true;
  }
  return false;
};
const eprelDir = `data_sources/eprel_raw/raw/${EPREL_SNAPSHOT}/spaceheaters-heatpump`;
let eprelCount = 0;
for (const f of readdirSync(resolve(ROOT, eprelDir))) {
  if (!f.startsWith('page-') || !f.endsWith('.json')) continue;
  for (const r of loadJSON(`${eprelDir}/${f}`).hits ?? []) {
    if (r.status && r.status !== 'PUBLISHED') continue;
    eprelCount++;
    const num = v => (typeof v === 'number' && isFinite(v) && v > 0 ? v : null);
    const specs = Object.fromEntries(SPEC_FIELDS.map(k => [k, null]));
    specs.efficiency_35C_percent = num(r.seasonalSpaceHeatingEnergyEfficiency);
    specs.efficiency_55C_percent = num(r.seasonalSpaceHeatingEnergyEfficiencyAverage55);
    specs.power_design_35C_kw = num(r.ratedHeatOutputAverage35);
    specs.power_design_55C_kw = num(r.mediumTempRatedHeatOutputAverage);
    specs.noise_outdoor_dB = num(r.outdoorNoise);
    specs.noise_indoor_dB = num(r.noise);
    const st = tokens(r.supplierOrTrademark), ot = tokens(r.organisation?.organisationName);
    const cand = {
      source: 'EPREL',
      id: String(r.eprelRegistrationNumber),
      model: r.modelIdentifier,
      specs,
      cap: ratedCapacity(specs),
      keys: identityKeys(r.modelIdentifier),
      ck: compact(r.modelIdentifier),
    };
    for (const s of shorts) {
      const sk = tokens(s);
      if (isSubseq(sk, st) || isSubseq(sk, ot)) addCandidate(s.toUpperCase(), cand);
    }
  }
}
console.log(`candidate pool: ${seed.length} registry records + ${eprelCount} EPREL registrations`);

const audit = [];
const accepted = [];
const review = [];
const stats = {};
const bump = k => { stats[k] = (stats[k] ?? 0) + 1; };

for (const r of input) {
  const brand = brandOf(r.brand);
  const cands = pool.get(brand) ?? [];
  const base = {
    pelId: r.mcs_number,
    match_key: mkey(r),
    manufacturerOriginal: r.brand,
    modelOriginal: r.model,
    normalizedManufacturer: brand || null,
    normalizedModel: compact(r.model),
    technology: r.technology_type,
  };

  if (!brand || !cands.length) {
    bump('brand_absent_from_european_sources');
    audit.push({ ...base, matchMethod: 'none', confidenceTier: 'D', accepted: false,
      rejectionReason: 'brand not present in any European source (registry or EPREL)' });
    continue;
  }

  // The staged search lives in pel-match-lib.mjs — strongest stage first, and a
  // weaker stage never runs once a stronger one has produced candidates.
  const found = findCandidates(r.model, cands);
  const method = found?.method ?? null;
  const hits = found?.hits ?? [];
  const pk = found?.keys ?? identityKeys(r.model);

  if (!method || !hits.length) {
    // Stage 5 — fuzzy: produces a REVIEW candidate, never an acceptance.
    const scored = cands
      .map(c => ({ c, score: similarity(r.model, c.model) }))
      .filter(x => x.score >= 0.55 && !numericConflict(r.model, x.c.model))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    if (scored.length) {
      bump('review_fuzzy_candidate');
      review.push({
        ...base,
        candidates: scored.map(({ c, score }) => ({
          candidateId: c.id, candidateModel: c.model, source: c.source,
          similarity: Number(score.toFixed(3)),
          ratedKw: c.cap?.kw ?? null, capacitySource: c.cap?.field ?? null,
          conflict: conflictsWith(r.model, c),
        })),
        confidenceTier: 'C',
        reasonNotAutoApproved: 'text similarity only — no shared product code, no exact identity',
      });
      audit.push({ ...base, matchMethod: 'fuzzy_candidate', confidenceTier: 'C', accepted: false,
        rejectionReason: 'fuzzy candidate — queued for human review, capacity NOT applied' });
    } else {
      bump('no_candidate');
      audit.push({ ...base, matchMethod: 'none', confidenceTier: 'D', accepted: false,
        rejectionReason: 'brand present in a European source, but no candidate shares this product identity' });
    }
    continue;
  }

  // Hard technical conflicts remove candidates before reconciliation.
  const conflicts = hits.map(c => conflictsWith(r.model, c)).filter(Boolean);
  const clean = hits.filter(c => !conflictsWith(r.model, c));
  if (!clean.length) {
    bump('rejected_technical_conflict');
    audit.push({ ...base, matchMethod: method, confidenceTier: 'D', accepted: false,
      rejectionReason: `all candidates conflict — ${conflicts[0]}` });
    continue;
  }

  const rec = reconcile(clean);
  if (!rec.ok) {
    bump(`rejected_${rec.why}`);
    if (rec.why === 'capacity_conflict') {
      review.push({
        ...base,
        candidates: clean.map(c => ({ candidateId: c.id, candidateModel: c.model, source: c.source,
          ratedKw: c.cap?.kw ?? null, capacitySource: c.cap?.field ?? null })),
        confidenceTier: 'C',
        reasonNotAutoApproved: `candidates disagree on rated capacity (${rec.values.join(', ')} kW) — not resolved silently`,
      });
    }
    audit.push({ ...base, matchMethod: method, confidenceTier: 'D', accepted: false,
      candidateId: clean[0].id, candidateModel: clean[0].model,
      rejectionReason: rec.why === 'capacity_conflict'
        ? `candidates disagree on rated capacity: ${rec.values.join(', ')} kW`
        : rec.why === 'candidate_without_capacity'
          ? 'matched candidate publishes no rated capacity'
          : 'candidates come from different sources' });
    continue;
  }

  // Tier A — deterministic identity: an exact model, or a containment match with a
  // single candidate. Tier B — several candidates, accepted only because every one
  // of them agrees on the rated capacity (one outdoor unit, several packages), or a
  // market-suffix family. Nothing weaker is ever accepted.
  const tier = (method === 'exact_model' || (method === 'component_identity' && rec.cands.length === 1)) ? 'A' : 'B';
  // The codes of THIS record that a candidate carries. Under the shared-component
  // rule the candidate set is the UNION over these codes, so a code need not be in
  // every candidate — which is why unanimity across the whole set is the guard.
  const matchedCodes = [...pk].filter(k => rec.cands.some(c => c.keys.has(k)));
  const evidence = [
    method === 'exact_model' ? 'identical model identity after formatting-only normalization'
      : method === 'component_identity' ? `one side's product codes contain the other's: ${matchedCodes.join(', ')}`
        : method === 'shared_component' ? `shared unit code(s): ${matchedCodes.join(', ')}`
          : 'identical base model after market-suffix normalization, numeric tokens equal',
    `${rec.cands.length} candidate(s), every one publishing ${rec.cap.kw} kW (${rec.cap.field})`,
    `brand gate: ${brand}`,
    ...(rec.crossSource ? ['registry and EPREL both matched — registry used, per the one-source-per-record rule'] : []),
  ];
  if (rec.crossSource) bump('cross_source_resolved_by_priority');
  bump(`accepted_${method}_tier${tier}`);
  accepted.push({
    match_key: base.match_key,
    mcs_number: r.mcs_number,
    pel_model: r.model,
    pel_brand: r.brand,
    brand_key: brand,
    source: rec.source,                      // EU_REGISTRY | EPREL (internal)
    candidate_id: rec.cands[0].id,
    candidate_model: rec.cands[0].model,
    candidates: rec.cands.length,
    candidate_ids: rec.cands.map(c => c.id),
    match_method: method,
    confidence_tier: tier,
    matched_codes: matchedCodes,
    rated_kw: rec.cap.kw,
    capacity_field: rec.cap.field,
    evidence,
    specs: rec.specs,
  });
  audit.push({ ...base, matchMethod: method, confidenceTier: tier, accepted: true,
    candidateId: rec.cands[0].id, candidateModel: rec.cands[0].model, matchedCodes,
    ratedKw: rec.cap.kw, capacitySource: rec.cap.field, evidence, rejectionReason: null });
}

// ── Dedupe: duplicate PEL rows share a match_key and resolve identically ─────
const byKey = new Map(accepted.map(m => [m.match_key, m]));

// ── Write ────────────────────────────────────────────────────────────────────

const outDir = resolve(ROOT, `data_sources/ofgem_pel/matching/${PEL_SNAPSHOT}`);
mkdirSync(outDir, { recursive: true });
const meta = {
  generated: new Date().toISOString(),
  generator: 'match-pel-recovery.mjs v1.0',
  pel_snapshot: PEL_SNAPSHOT,
  seed_snapshot: SEED_SNAPSHOT,
  eprel_snapshot: EPREL_SNAPSHOT,
  policy: 'Brand-gated. Stage 1 exact identity; Stage 3 order-insensitive component/ODU identity '
    + '(PEL codes ⊆ candidate, or candidate ⊆ PEL); Stage 4 market-suffix family. Multiple candidates are '
    + 'accepted ONLY when every one publishes the same rated capacity; fields that disagree are dropped, not chosen. '
    + 'Refrigerant and phase conflicts reject. Fuzzy similarity never accepts — it only queues for review.',
  semantics: 'A match means the same hardware appears in a European source. It transfers technical data only — '
    + 'never PEL listing, never BUS eligibility, never a source country in the UI.',
  capacity_chain: CAPACITY_CHAIN,
  input_records: input.length,
  accepted: byKey.size,
  review_queue: review.length,
  stats,
};
writeFileSync(resolve(outDir, 'pel-recovery-matches.json'), JSON.stringify({ _meta: meta, matches: [...byKey.values()] }, null, 2));
writeFileSync(resolve(outDir, 'pel-recovery-review.json'), JSON.stringify({ _meta: { ...meta, note: 'Tier C — human review. NEVER applied automatically.' }, review }, null, 2));
writeFileSync(resolve(outDir, 'pel-recovery-audit.json'), JSON.stringify({ _meta: meta, audit }, null, 2));

const tally = k => Object.entries(stats).filter(([s]) => s.startsWith(k)).reduce((a, [, v]) => a + v, 0);
console.log('');
console.log('── Recovery summary ───────────────────────────────────────');
console.log(`input (unresolved):        ${input.length}`);
console.log(`accepted (Tier A + B):     ${byKey.size}`);
for (const [k, v] of Object.entries(stats).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(5)}  ${k}`);
console.log(`review queue (Tier C):     ${review.length}`);
console.log(`still unresolved:          ${input.length - byKey.size - tally('review')}`);
console.log(`→ ${`data_sources/ofgem_pel/matching/${PEL_SNAPSHOT}/`}pel-recovery-{matches,review,audit}.json`);
console.log('──────────────────────────────────────────────────────────');
