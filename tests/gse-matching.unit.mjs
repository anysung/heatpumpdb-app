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

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const is = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}  — expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`); }
};

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
