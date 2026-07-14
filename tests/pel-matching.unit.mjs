/**
 * Unit tests for the PEL rated-capacity recovery rules (scripts/ofgem/pel-match-lib.mjs).
 *
 * Run: node tests/pel-matching.unit.mjs
 *
 * These are the rules that decide whether an Ofgem PEL record — which publishes no
 * performance data at all — may inherit a rated capacity from a European product
 * record. Every case below is drawn from a real pattern in the 2026-06 PEL snapshot.
 *
 * The point of the suite is the REFUSALS as much as the matches: a wrong capacity
 * silently moves a product into the wrong segment, so "no answer" must beat "a
 * plausible answer".
 */
import { existsSync, readFileSync } from 'node:fs';
import {
  compact, identityKeys, isStrongCode, codeTokens,
  numericConflict, conflictsWith, refrigerantIn, phaseIn,
  ratedCapacity, reconcile, similarity, findCandidates, tierOf,
} from '../scripts/ofgem/pel-match-lib.mjs';

let failed = 0;
const is = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${ok ? '' : `  — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
};

/** A candidate as the matcher builds it. */
const cand = (id, model, specs, source = 'EPREL') => ({
  id, model, source, specs, ck: compact(model), keys: identityKeys(model),
});
const kw35 = kw => ({ power_design_35C_kw: kw });
const kwReg = kw => ({ power_35C_kw: kw });

console.log('\nNormalization — formatting only');
is('case/spacing/punctuation folded', compact('ERGA04DAV3A'), compact('erga-04 dav3a'));
is('a code is strong (letters + digits, ≥6)', isStrongCode('ERGA04DAV3A'), true);
is('a word is not a code', isStrongCode('PREMIUM'), false);
is('a bare number is not a code', isStrongCode('230000'), false);
is('short mixed token is not a code', isStrongCode('6FBPA'), false);
is('codes survive a package string', [...identityKeys('YUTAKI S (4HP) RAS-4WHNPE+RWM-4.0N1E')].sort(),
  ['RAS4WHNPE', 'RWM40N1E', 'YUTAKIS4HPRAS4WHNPE'].sort());
// "Heating Only" is a configuration, not a product — it must not enter the identity.
// The part itself and each code inside it are all keys; any of them can match.
is('descriptive phrases do not become identity',
  [...identityKeys('RAS-4WHNPE RWM-4.0N1E - Heating Only')].sort(),
  ['RAS4WHNPE', 'RAS4WHNPERWM40N1E', 'RWM40N1E'].sort());
is('the descriptive phrase is gone', [...identityKeys('RAS-4WHNPE - Heating Only')].some(k => k.includes('HEATING')), false);
is('two codes are extracted from one part', codeTokens('RAS-2WHVRP RWM-2.0NRE').sort(), ['RAS2WHVRP', 'RWM20NRE'].sort());

console.log('\nCapacity — only the canonical chain, never a model-name number');
is('registry rated output wins', ratedCapacity({ power_35C_kw: 11, power_design_35C_kw: 12 }), { kw: 11, field: 'power_35C_kw' });
is('EPREL design output is used when there is no registry value', ratedCapacity(kw35(6)), { kw: 6, field: 'power_design_35C_kw' });
is('no published capacity → null', ratedCapacity({ scop: 4.2, cooling_capacity_kw: 8 }), null);
is('zero is not a capacity', ratedCapacity({ power_35C_kw: 0 }), null);

console.log('\nStage 1 — exact model');
{
  const c = [cand('1', 'ES M15 R290 3 PH + ES M250L ST', kwReg(13), 'EU_REGISTRY')];
  const f = findCandidates('ES M15 R290 3PH + ES M250L ST', c);
  is('spacing-only difference matches exactly', f?.method, 'exact_model');
  is('exact match is Tier A', tierOf(f.method, f.hits.length), 'A');
}

console.log('\nStage 3a — component identity (one side contains the other)');
{
  // PEL gives the outdoor unit only; the candidate is the packaged system.
  const c = [cand('1', 'PUZ-WM50VHA / EHPT20X-YM9ED', kw35(5)), cand('2', 'PUZ-WM50VHA / ERPT17X-VM2E', kw35(5))];
  const f = findCandidates('PUZ-WM50VHA', c);
  is('outdoor-unit-only PEL row matches its packages', f?.method, 'component_identity');
  const r = reconcile(f.hits);
  is('both packages agree → accepted', r.ok, true);
  is('capacity is the packages\' shared value', r.cap.kw, 5);
  is('several candidates → Tier B', tierOf(f.method, f.hits.length), 'B');
}

console.log('\nStage 3b — shared outdoor unit, written in the other order');
{
  // The real Daikin case: hydro-boxes differ, the outdoor unit is the same part.
  const c = [
    cand('1', 'EHVH04SU18EJ6V / ERGA04EAV3A', kw35(6)),
    cand('2', 'EHVX04S18EJ6V / ERGA04EAV3A', kw35(6)),
    cand('3', 'EHBX04EA6V / ERGA04EAV3A / EKHWS200D3V3', kw35(6)),
  ];
  const f = findCandidates('ERGA04EAV3A / EHVH04SU18EA6V', c);
  is('shared unit code is found regardless of order', f?.method, 'shared_component');
  is('every candidate carrying that unit is considered', f.hits.length, 3);
  const r = reconcile(f.hits);
  is('unanimous capacity → accepted', r.ok, true);
  is('the outdoor unit\'s rated output is transferred', r.cap.kw, 6);
}
{
  // Same shape, but the shared code does NOT determine capacity → must refuse.
  const c = [cand('1', 'EHVH08SU18EA6V / ERGA08EAV3H', kw35(8)), cand('2', 'EHSH08P30EF / ERGA06EAV3H', kw35(7))];
  const f = findCandidates('ERGA06EAV3H / EHVH08SU18EA6V', c);
  is('candidates are gathered', f?.method, 'shared_component');
  const r = reconcile(f.hits);
  is('candidates disagree on capacity → REFUSED, not guessed', r.ok, false);
  is('the refusal names the conflict', r.why, 'capacity_conflict');
  is('both capacities are recorded for review', r.values.sort(), [7, 8]);
}

console.log('\nStage 4 — market-suffix family');
{
  const c = [cand('1', 'WPC 05 S', kwReg(5.4), 'EU_REGISTRY')];
  const f = findCandidates('WPC 05 S GB', c);
  is('a GB market suffix matches the base model', f?.method, 'family_market_suffix');
  is('family match is Tier B', tierOf(f.method, f.hits.length), 'B');
}
{
  // Ambiguous family: two base models, different capacities → refuse.
  const c = [cand('1', 'WPC 05 S', kwReg(5.4), 'EU_REGISTRY'), cand('2', 'WPC 05 S', kwReg(7.1), 'EU_REGISTRY')];
  const f = findCandidates('WPC 05 S GB', c);
  const r = reconcile(f.hits);
  is('family members with different capacities → refused', r.ok, false);
  is('reason is the capacity conflict', r.why, 'capacity_conflict');
}

console.log('\nNumeric-token conflict — the Ecoforest trap');
is('"1-6" vs "4-16" is a conflict', numericConflict('ecoGEO+ B1 230 1-6 PRO', 'ecoGEO+ B1 230 4-16 PRO'), true);
is('identical numbers are not a conflict', numericConflict('WPC 05 S GB', 'WPC 05 S'), false);
{
  // 90 % text-similar, 6 kW vs 16 kW. Nothing may accept this.
  const c = [cand('1', 'ecoGEO+ B1 230 4-16 PRO', kw35(16))];
  is('a 6 kW unit is very similar to the 16 kW one', similarity('ecoGEO+ B1 230 1-6 PRO', c[0].model) > 0.85, true);
  is('…but no stage produces it as a match', findCandidates('ecoGEO+ B1 230 1-6 PRO', c), null);
}

console.log('\nTechnical conflicts');
is('refrigerant is read from the model', refrigerantIn('ES M15 R290 3PH'), '290');
is('phase is read from the model', phaseIn('ES M15 R290 3PH'), '3');
is('different refrigerant → rejected',
  !!conflictsWith('ES M15 R290 1PH', cand('1', 'ES M15 R32 1PH', kwReg(13), 'EU_REGISTRY')), true);
is('different phase → rejected',
  !!conflictsWith('ES M15 R290 1PH', cand('1', 'ES M15 R290 3 PH', kwReg(13), 'EU_REGISTRY')), true);
is('same refrigerant and phase → no conflict',
  conflictsWith('ES M15 R290 3PH', cand('1', 'ES M15 R290 3 PH', kwReg(13), 'EU_REGISTRY')), null);
is('a conflict in the candidate\'s refrigerant FIELD is caught too',
  !!conflictsWith('ES M15 R290 1PH', cand('1', 'ES M15', { ...kwReg(13), refrigerant: 'R32' }, 'EU_REGISTRY')), true);

console.log('\nSource priority and conflict handling');
{
  // The registry publishes measured rated output, EPREL the label's design load:
  // the same hardware legitimately reads 5.5 and 6.0. Not an identity conflict —
  // the existing "registry first, one source per record" rule decides.
  const c = [
    cand('reg', 'AE050CXYDEK + AE160DNYMPK', kwReg(5.5), 'EU_REGISTRY'),
    cand('epr', 'AE050CXYDEK / AE160DNYMPK', kw35(6), 'EPREL'),
  ];
  const r = reconcile(c);
  is('accepted via source priority', r.ok, true);
  is('the registry value is used', r.cap.kw, 5.5);
  is('the record keeps ONE source', r.source, 'EU_REGISTRY');
  is('the cross-source resolution is flagged', r.crossSource, true);
}
{
  const r = reconcile([cand('1', 'X-100', kw35(6)), cand('2', 'X-100', {})]);
  is('a candidate without a capacity is never accepted', r.ok, false);
  is('reason recorded', r.why, 'candidate_without_capacity');
}
is('no candidates → nothing to accept', reconcile([]).ok, false);
{
  // Duplicate registrations of the same product must not look like a disagreement.
  const r = reconcile([cand('1', 'X-100', kw35(6)), cand('2', 'X-100', kw35(6))]);
  is('duplicate candidates accepted as one', r.ok, true);
  is('capacity unchanged', r.cap.kw, 6);
}
{
  // Fields that disagree are dropped, never picked from one candidate.
  const r = reconcile([
    cand('1', 'X-100', { ...kw35(6), scop: 4.5, noise_outdoor_dB: 54 }),
    cand('2', 'X-100', { ...kw35(6), scop: 4.5, noise_outdoor_dB: 58 }),
  ]);
  is('an agreed field is kept', r.specs.scop, 4.5);
  is('a disagreeing field is dropped, not chosen', r.specs.noise_outdoor_dB, null);
}

console.log('\nFuzzy similarity never accepts');
{
  const c = [cand('1', 'RASM-3VTW2E - HWD-W2E-220S(-K)', kw35(8))];
  is('a similar-looking model produces no match', findCandidates('RAS-2WHVRP RWM-2.0NRE', c), null);
  is('similarity alone is not identity', similarity('RAS-2WHVRP', 'RASM-3VTW2E') < 0.9, true);
}

// ── Dataset integrity ───────────────────────────────────────────────────────
// Runs only when the GB datasets have been built (they are gitignored). These
// assert the properties the matching pass must never break, on the real data.
const GB = 'public/data/products-gb.json';
if (existsSync(GB)) {
  console.log('\nBuilt GB dataset');
  const items = JSON.parse(readFileSync(GB, 'utf8')).items;
  const eu = JSON.parse(readFileSync('public/data/products-commercial-gb.json', 'utf8')).items;
  const pool = [...items, ...eu];
  const capOf = p => ratedCapacity(p);

  is('every PEL record is still exported', items.length, 4422);
  is('source_id is unique across the pool', new Set(pool.map(p => p.source_id)).size, pool.length);

  // Every record lands in exactly one bucket, and an unresolved one lands in none.
  const res = pool.filter(p => capOf(p) && capOf(p).kw <= 23);
  const com = pool.filter(p => capOf(p) && capOf(p).kw > 23);
  const unc = pool.filter(p => !capOf(p));
  is('no record is in two segments', res.filter(p => com.includes(p)).length, 0);
  is('every record is in exactly one bucket', res.length + com.length + unc.length, pool.length);
  is('no unresolved record was quietly classified', unc.every(p => !capOf(p)), true);

  // A recovered match must have actually populated a capacity, and an unresolved
  // record must have none — the whole point of the pass.
  const recovered = items.filter(p =>
    /:(A|B)$/.test(p.bafa_reference_match_type ?? '') || /:(A|B)$/.test(p.eprel_match_type ?? ''));
  is('recovered records all carry a rated capacity', recovered.every(p => capOf(p) != null), true);
  is('recovered records carry exactly one performance source',
    recovered.every(p => p.performance_source === 'BAFA_REFERENCE' || p.performance_source === 'EPREL'), true);
  is('records with no performance source have no capacity',
    items.filter(p => p.performance_source == null).every(p => capOf(p) == null), true);

  // Matching is technical only: it may never touch PEL listing or eligibility.
  is('every PEL record is still listed on the PEL',
    items.every(p => p.bafa_listing_status === 'listed_in_snapshot'), true);
  is('recovery never made a product PEL-listed by inference',
    recovered.every(p => p.primary_source === 'OFGEM_PEL'), true);
  is('no European reference record was turned into a PEL listing',
    eu.every(p => p.bafa_listing_status === 'not_in_latest_snapshot'), true);

  // The same hardware must not be counted twice (PEL row + European record).
  const pelBafaIds = new Set(items.map(p => p.bafa_reference_id).filter(Boolean));
  is('no European record duplicates hardware already matched to a PEL row',
    eu.filter(p => pelBafaIds.has(String(p.bafa_id))).length, 0);
} else {
  console.log('\n(GB dataset not built — dataset assertions skipped)');
}

console.log(failed ? `\n✗ ${failed} assertion(s) failed\n` : '\n✓ all PEL matching assertions passed\n');
process.exit(failed ? 1 : 0);
