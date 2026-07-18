/**
 * GSE matching — output invariants of the canonical→GSE-catalogue overlay (IT).
 *
 * The PEL suite (pel-matching.unit.mjs) exercises the shared matching library;
 * this suite guards the GSE overlay ARTIFACTS the IT builder consumes — the
 * contracts that, if broken, would publish a listing we never established:
 *   - every overlay state is one of the three allowed states
 *   - confirmed ⇔ carries gse_entry_key + method + confidence + dates
 *   - one GSE catalogue entry confirms at most one canonical product
 *   - only whitelisted (identity-based) confirming methods appear —
 *     an ODU-only or fuzzy method name showing up here is a matcher regression
 *   - history: first_matched_at ≤ last_confirmed_at, never lost between runs
 *   - review_required entries carry NO entry key (listing no longer proven)
 *
 * Runs against the newest data_sources/gse_ct/matching snapshot; skips
 * cleanly when no snapshot exists (fresh checkout).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mfrConsistentTokens, mfrConsistentCompact, componentsOfBaseline,
  componentsOfPlusAware, numericSubset, createMatcher, voltageIn,
  PRODUCTION_MATCH_OPTS as MATCH_OPTS,
} from '../scripts/it/gse-match-lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const is = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}  — expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`); }
};

/* ── Matching-library rules (pure, no snapshot needed) ───────────────────── */
console.log('\nGSE matching library rules\n');

// Brand identity
is('token overlap: LG ELECTRONICS ↔ LG Electronics Deutschland',
  mfrConsistentTokens('LG ELECTRONICS', 'LG Electronics Deutschland GmbH'), true);
is('legal-name spacing needs the compact rule: DEDIETRICH ↔ De Dietrich (tokens)',
  mfrConsistentTokens('DEDIETRICH', 'De Dietrich Heiztechnik'), false);
is('legal-name spacing: DEDIETRICH ↔ De Dietrich (compact identity)',
  mfrConsistentCompact('DEDIETRICH', 'De Dietrich Heiztechnik'), true);
is('compact rule never bridges different makers: BERETTA ↔ Riello',
  mfrConsistentCompact('BERETTA', 'Riello S.p.A'), false);
// Distinct-maker guard — a shared house token must not bridge separate makers.
is('Mitsubishi Heavy Industries ≠ Mitsubishi Electric (token rule)',
  mfrConsistentTokens('Mitsubishi Heavy Industries', 'Mitsubishi Electric Europe B.V.'), false);
is('Mitsubishi Heavy Industries ≠ Mitsubishi Electric (compact rule)',
  mfrConsistentCompact('Mitsubishi Heavy Industries', 'Mitsubishi Electric Europe B.V.'), false);
is('Mitsubishi Electric ↔ Mitsubishi Electric Europe still consistent',
  mfrConsistentTokens('Mitsubishi Electric', 'Mitsubishi Electric Europe B.V.'), true);

// Package decomposition
is('baseline split shreds slash-coded models (why plus-aware stays OFF for containment users)',
  componentsOfBaseline('AQS80X1o/AQS100T240X13i'), ['AQS80X1O', 'AQS100T240X13I']);
is('plus-aware split keeps slash-coded components intact on + packages',
  componentsOfPlusAware('VWL 45/8.2 AS 230V S3 + VWL 67/8.2 IS'), ['VWL4582AS230VS3', 'VWL6782IS']);
is('production rules: plusAwareComponents stays OFF (measured −4 correct confirms 2026-07)',
  MATCH_OPTS.plusAwareComponents, false);
is('production rules: brandCompactIdentity ON (exact identity, zero measured false positives)',
  MATCH_OPTS.brandCompactIdentity, true);

// Numeric-subset guard (weak-rung resolution)
is('suffix digit the candidate lacks blocks resolution (NpG4 vs NhH3)',
  numericSubset('GRS-CQ6.0Pd/NpG4-E', 'GRS-CQ6.0Pd/NhH3-E'), false);
is('extra canonical detail is allowed (Vitocal 250-A PRO)',
  numericSubset('Vitocal 250-A PRO', 'Vitocal 250-A PRO, Typ AWO-AC-AF 251.B40'), true);

// Voltage marker
is('voltage marker parses 230V/400V', [voltageIn('VWL 45/8.2 AS 230V S3'), voltageIn('X 400 V')], ['230', '400']);

// Capacity resolution must never finish what identity did not start:
// a multi-component GSE package may NOT confirm a primary-only overlap.
{
  const canonical = [{
    bafa_id: '1', manufacturer: 'Shenling', manufacturer_normalized: 'SHENLING',
    model: 'OU: HPM-V120W/SR3-B + IU: HM-90/DM', type: 'Luft / Wasser',
    power_35C_kw: 12.2, power_55C_kw: 12.2, efficiency_35C_percent: 180, refrigerant: 'R32',
  }];
  const { classify } = createMatcher(canonical, [], MATCH_OPTS);
  const z = {
    gse_entry_key: 'IIIA-test', brand: 'Shenling', scambio: 'Aria/acqua',
    model: 'OU: HPM-V120W/R3-D + IU: HM-120/DR3-D', odu_id: null, idu_id: null,
    ratings: [{ kw: 12.2, etas: 180, scop: null, no2: null }],
  };
  const r = classify(z);
  is('shared-ODU package with a DIFFERENT indoor unit is never confirmed', r.state !== 'confirmed', true);
}
// Monobloc identity requires the canonical side to be IDU-free.
{
  const pkg = [{
    bafa_id: '2', manufacturer: 'X', manufacturer_normalized: 'XBRAND HEAT',
    model: 'PKG-1000X + TANK-200', idu_model: 'TANK-200', type: 'Luft / Wasser',
    power_35C_kw: 10, efficiency_35C_percent: 180, refrigerant: 'R290',
  }];
  const { resolveMonobloc } = createMatcher(pkg, [], MATCH_OPTS);
  const z = { brand: 'XBRAND', scambio: 'Aria/acqua', model: 'Serie X', odu_id: 'PKG-1000X', idu_id: null, ratings: [{ kw: 10, etas: 180 }] };
  is('an ODU-only entry never confirms against a PACKAGE (forbidden ODU-only overlap)',
    resolveMonobloc(z) === null || resolveMonobloc(z).state !== 'confirmed', true);
}

const dir = join(root, 'data_sources/gse_ct/matching');
const snap = existsSync(dir) ? readdirSync(dir).filter(d => /^\d{4}-\d{2}$/.test(d)).sort().pop() : null;

if (!snap) {
  console.log('(no GSE matching snapshot — overlay assertions skipped)');
  process.exit(0);
}

console.log(`\nGSE overlay invariants — snapshot ${snap}\n`);
const { overlay } = JSON.parse(readFileSync(join(dir, snap, 'canonical-gse-overlay.json'), 'utf8'));
const entries = Object.entries(overlay);

const STATES = ['confirmed', 'review_required', 'verification_required'];
is('every overlay state is an allowed state',
  entries.every(([, o]) => STATES.includes(o.gse_match_status)), true);

const confirmed = entries.filter(([, o]) => o.gse_match_status === 'confirmed');
is('confirmed entries exist (matching ran against real data)', confirmed.length > 0, true);
is('confirmed → entry key + method + confidence present',
  confirmed.every(([, o]) => o.gse_entry_key && o.gse_match_method && o.gse_match_confidence), true);
is('confirmed → catalogue-published brand/model facts present',
  confirmed.every(([, o]) => o.gse_catalogue === 'III.A' && o.gse_brand && o.gse_model), true);
is('confirmed → first/last confirmation dates present',
  confirmed.every(([, o]) => o.gse_first_matched_at && o.gse_last_confirmed_at), true);
is('first_matched_at ≤ last_confirmed_at',
  confirmed.every(([, o]) => o.gse_first_matched_at <= o.gse_last_confirmed_at), true);

const keys = confirmed.map(([, o]) => o.gse_entry_key);
is('one GSE catalogue entry confirms at most one canonical product', new Set(keys).size, keys.length);

is('review_required carries NO entry key (listing no longer proven)',
  entries.filter(([, o]) => o.gse_match_status === 'review_required')
    .every(([, o]) => o.gse_entry_key == null), true);

// Identity-based methods only. The GSE catalogue has no EPREL numbers and no
// per-row ids, so the whitelist is narrower than PEL/ZUM — and an ODU-only
// method must never appear (monobloc_identity is the ODU-IS-the-product case,
// which requires an IDU-free entry AND an IDU-free canonical product).
const CONFIRMING = ['manufacturer_official', 'component_identity',
  'component_identity_duplicate_representative', 'monobloc_identity',
  'monobloc_identity_duplicate_representative', 'monobloc_capacity_resolved',
  'exact_model', 'exact_model_duplicate_representative', 'denomination_model',
  'exact_model_code', 'exact_model_spec_resolved', 'exact_model_capacity_resolved'];
is('every confirmation used a whitelisted confirming method',
  confirmed.every(([, o]) => CONFIRMING.includes(o.gse_match_method)), true);

// History file contract
const hist = JSON.parse(readFileSync(join(root, 'data_sources/gse_ct/gse-match-history.json'), 'utf8'));
is('every confirmed mapping is persisted in the committed history',
  confirmed.every(([bafaId, o]) => hist.mappings[o.gse_entry_key]?.canonical_id === bafaId), true);

console.log(failed ? `\n✗ ${failed} assertion(s) failed\n` : `\n✓ all GSE overlay assertions passed (${passed})\n`);
process.exit(failed ? 1 : 0);
