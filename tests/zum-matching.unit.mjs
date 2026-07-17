/**
 * ZUM matching — output invariants of the canonical→Lista-ZUM overlay.
 *
 * The PEL suite (pel-matching.unit.mjs) exercises the shared matching library;
 * this suite guards the ZUM overlay ARTIFACTS the PL builder consumes — the
 * contracts that, if broken, would publish a listing we never established:
 *   - every overlay state is one of the three allowed states
 *   - confirmed ⇔ carries zum_id + method + confidence + dates
 *   - one ZUM id confirms at most one canonical product
 *   - history: first_matched_at ≤ last_confirmed_at, never lost between runs
 *   - review_required entries carry NO public zum_id
 *
 * Runs against the newest data_sources/lista_zum/matching snapshot; skips
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

const dir = join(root, 'data_sources/lista_zum/matching');
const snap = existsSync(dir) ? readdirSync(dir).filter(d => /^\d{4}-\d{2}$/.test(d)).sort().pop() : null;

if (!snap) {
  console.log('(no ZUM matching snapshot — overlay assertions skipped)');
  process.exit(0);
}

console.log(`\nZUM overlay invariants — snapshot ${snap}\n`);
const { overlay } = JSON.parse(readFileSync(join(dir, snap, 'canonical-zum-overlay.json'), 'utf8'));
const entries = Object.entries(overlay);

const STATES = ['confirmed', 'review_required', 'verification_required'];
is('every overlay state is an allowed state',
  entries.every(([, o]) => STATES.includes(o.zum_match_status)), true);

const confirmed = entries.filter(([, o]) => o.zum_match_status === 'confirmed');
is('confirmed entries exist (matching ran against real data)', confirmed.length > 0, true);
is('confirmed → zum_id + method + confidence present',
  confirmed.every(([, o]) => o.zum_id && o.zum_match_method && o.zum_match_confidence), true);
is('confirmed → first/last confirmation dates present',
  confirmed.every(([, o]) => o.zum_first_matched_at && o.zum_last_confirmed_at), true);
is('first_matched_at ≤ last_confirmed_at',
  confirmed.every(([, o]) => o.zum_first_matched_at <= o.zum_last_confirmed_at), true);

const ids = confirmed.map(([, o]) => o.zum_id);
is('one ZUM id confirms at most one canonical product', new Set(ids).size, ids.length);

is('review_required carries NO public zum_id (listing no longer proven)',
  entries.filter(([, o]) => o.zum_match_status === 'review_required')
    .every(([, o]) => o.zum_id == null), true);

const CONFIRMING = ['manufacturer_official', 'eprel_exact', 'eprel_bridge', 'exact_model',
  'exact_model_code', 'exact_model_capacity_resolved', 'eprel_capacity_resolved',
  'alias_model', 'approved_one_to_many', 'component_identity',
  'exact_model_duplicate_representative', 'exact_model_spec_resolved',
  'eprel_bridge_duplicate_representative'];
is('every confirmation used a whitelisted confirming method',
  confirmed.every(([, o]) => CONFIRMING.includes(o.zum_match_method)), true);

// History file contract
const hist = JSON.parse(readFileSync(join(root, 'data_sources/lista_zum/zum-match-history.json'), 'utf8'));
is('every confirmed mapping is persisted in the committed history',
  confirmed.every(([bafaId, o]) => hist.mappings[o.zum_id]?.canonical_id === bafaId), true);

console.log(failed ? `\n✗ ${failed} assertion(s) failed\n` : `\n✓ all ZUM overlay assertions passed (${passed})\n`);
process.exit(failed ? 1 : 0);
