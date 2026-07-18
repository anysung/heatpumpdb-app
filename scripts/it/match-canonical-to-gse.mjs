/**
 * match-canonical-to-gse.mjs — canonical → GSE Conto Termico listing overlay (IT).
 *
 * Direction is always CANONICAL → GSE: the overlay may confirm that Italy's
 * official pre-qualified appliance catalogue (Conto Termico 3.0, III.A) carries
 * a canonical product, attach the catalogue facts, and never anything else. A
 * failed match changes nothing
 * (docs/CANONICAL_TECHNICAL_BASELINE_AND_LOCAL_MARKET_OVERLAY.md).
 *
 * Only catalogue III.A (heat pumps) can confirm: III.B lists hybrid COMBOS
 * (HP + boiler) — a combo listing is never evidence that the standalone HP is
 * listed (the ODU-overlap rule) — and III.E (DHW water heaters) has no
 * canonical counterpart to match.
 *
 * The matching rules live in gse-match-lib.mjs (shared verbatim with the audit
 * instrumentation and the unit tests). CONFIRMING methods (each guarded by
 * contradiction checks — voltage/phase/refrigerant variant markers, type
 * family, rated capacity, ηs class band):
 *   manufacturer_official — committed mapping in
 *       data_sources/manufacturer_cross_reference/canonical-to-gse.json
 *   component_identity — the catalogue's own outdoor-unit AND indoor-unit
 *       model identifiers both appear in one canonical product's identity.
 *       An ODU-only overlap NEVER confirms — it goes to review.
 *   monobloc_identity — the entry has NO indoor unit, so its ODU id is the
 *       complete hardware identity; only IDU-free canonical products qualify.
 *   exact_model / exact_model_code / *_capacity_resolved / *_spec_resolved —
 *       full compact-string model identity, manufacturer-consistent, resolved
 *       through the same evidence ladder as the PEL/ZUM matchers.
 *
 * NEVER confirming: fuzzy similarity, manufacturer-only, capacity-only,
 * family spread, ODU-only overlap. Those go to canonical-gse-review.json.
 *
 * The GSE catalogue publishes NO per-row identifier and NO EPREL numbers, so
 * there are no eprel_* methods here and the overlay's gse_entry_key is OUR
 * deterministic key (parse-gse.mjs), used for history/integrity only — the UI
 * shows listing status, never the key as an official id.
 *
 * MATCH_OPTS below selects the evidence-normalization layers (audited
 * 2026-07-18, data_sources/gse_ct/audit/2026-07/delta-*.json):
 *   brandCompactIdentity ON — accepts spacing-only legal-name variants by
 *     exact compacted-name identity ("DEDIETRICH" ↔ "De Dietrich"). Measured
 *     delta on 2026-07: +0/−0 confirms (it unlocks brand pools whose models
 *     are currently absent from canonical) — enabled because it is exact
 *     identity with zero measured false-positive surface.
 *   plusAwareComponents OFF — measured HARMFUL (−4 correct confirms: the
 *     '/'-eager split is load-bearing for Vaillant "(AS/S2)"-style collapsed
 *     package notations). Kept available for future re-measurement only.
 *
 * States on the overlay record:
 *   confirmed        — reproducible identity match (this run).
 *   review_required  — in committed gse-match-history.json but no longer
 *                      matching (matcher regression likelier than delisting).
 *   (everything else)— verification_required, assigned by the builder.
 *
 * Outputs (per snapshot, gitignored):
 *   data_sources/gse_ct/matching/YYYY-MM/canonical-gse-overlay.json
 *   data_sources/gse_ct/matching/YYYY-MM/canonical-gse-review.json
 * Committed state:
 *   data_sources/gse_ct/gse-match-history.json (first/last confirmed dates)
 *
 * Flags: --snapshot=YYYY-MM   --baseline-rules (disable MATCH_OPTS layers —
 * used by the audit to reproduce the original shipped behavior exactly)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMatcher, PRODUCTION_MATCH_OPTS } from './gse-match-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SNAPSHOT = (process.argv.find(a => a.startsWith('--snapshot=')) ?? '').split('=')[1]
  || fs.readdirSync(path.join(ROOT, 'data_sources/gse_ct/parsed')).filter(d => /^\d{4}-\d{2}$/.test(d)).sort().pop();
const BASELINE_RULES = process.argv.includes('--baseline-rules');
const PARSED = path.join(ROOT, 'data_sources/gse_ct/parsed', SNAPSHOT, 'gse-normalized.json');
const OUT_DIR = path.join(ROOT, 'data_sources/gse_ct/matching', SNAPSHOT);
const HISTORY_PATH = path.join(ROOT, 'data_sources/gse_ct/gse-match-history.json');
const XREF_PATH = path.join(ROOT, 'data_sources/manufacturer_cross_reference/canonical-to-gse.json');
fs.mkdirSync(OUT_DIR, { recursive: true });

const MATCH_OPTS = PRODUCTION_MATCH_OPTS;
const OPTS = BASELINE_RULES ? {} : MATCH_OPTS;

/* ── Load inputs ─────────────────────────────────────────────────────────── */
const loadJson = (p, fallback = null) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback;

const gse = loadJson(PARSED);
if (!gse) { console.error(`FATAL: ${PARSED} missing — run parse-gse.mjs first`); process.exit(1); }

const canonical = [
  ...(loadJson(path.join(ROOT, 'public/data/products.json'))?.items ?? []),
  ...(loadJson(path.join(ROOT, 'public/data/products-commercial.json'))?.items ?? []),
];
if (canonical.length < 5000) { console.error('FATAL: canonical datasets missing/short — build DE first'); process.exit(1); }

const history = loadJson(HISTORY_PATH, { mappings: {} });
const xref = (loadJson(XREF_PATH, { mappings: [] }).mappings ?? []).filter(m => m.local_registry === 'GSE');

const { classify } = createMatcher(canonical, xref, OPTS);

/* ── Run ─────────────────────────────────────────────────────────────────── */
const now = new Date().toISOString();
const overlay = {};        // bafa_id -> gse block
const review = [];
const confirmedByKey = new Map();
let conflictCount = 0, unmatched = 0;

const METHOD_RANK = ['manufacturer_official', 'component_identity',
  'component_identity_duplicate_representative', 'monobloc_identity',
  'monobloc_identity_duplicate_representative', 'exact_model',
  'exact_model_duplicate_representative', 'denomination_model', 'exact_model_code',
  'exact_model_spec_resolved', 'exact_model_capacity_resolved',
  'monobloc_capacity_resolved'];
const rankOf = m => {
  const i = METHOD_RANK.indexOf(m);
  return i === -1 ? METHOD_RANK.length : i;
};

const classifications = gse.entries.map(z => ({ z, r: classify(z) }));
const confirmations = classifications
  .filter(({ r }) => r.state === 'confirmed')
  .sort((a, b) => rankOf(a.r.method) - rankOf(b.r.method));

for (const { z, r } of confirmations) {
  const bafaId = String(r.target.bafa_id);
  if (overlay[bafaId]) {
    // One canonical product carries ONE confirmed catalogue entry — with no
    // per-row GSE id, extra combos of the same hardware add no information.
    review.push({ gse_entry_key: z.gse_entry_key, reason: 'second_confirmation_same_product', existing: overlay[bafaId].gse_entry_key, method: r.method });
    continue;
  }
  const prior = history.mappings[z.gse_entry_key];
  overlay[bafaId] = {
    gse_entry_key: z.gse_entry_key,
    gse_match_status: 'confirmed',
    gse_catalogue: z.catalogue,
    gse_brand: z.brand,
    gse_model: z.model,
    gse_match_method: r.method,
    gse_match_confidence: r.confidence ?? 'high',
    gse_snapshot: SNAPSHOT,
    gse_snapshot_fetched_at: gse.meta.fetched_at,
    gse_first_matched_at: prior?.first_matched_at ?? now,
    gse_last_confirmed_at: now,
  };
  confirmedByKey.set(z.gse_entry_key, bafaId);
}

for (const { z, r } of classifications) {
  if (r.state === 'confirmed') continue;
  if (r.state === 'conflict') {
    conflictCount++;
    review.push({ gse_entry_key: z.gse_entry_key, reason: 'contradiction', method: r.method, conflicts: r.conflicts, candidate: String(r.target.bafa_id), gse_model: z.model, canonical_model: r.target.model });
  } else if (r.state === 'review') {
    review.push({
      gse_entry_key: z.gse_entry_key,
      reason: r.method,
      candidates: (r.targets ?? []).map(c => String(c.bafa_id)).slice(0, 8),
      gse_model: z.model,
      gse_brand: z.brand,
    });
  } else {
    unmatched++;
  }
}

/* ── review_required: previously confirmed, no longer matching ───────────── */
let reviewRequired = 0;
for (const [key, m] of Object.entries(history.mappings)) {
  if (confirmedByKey.has(key)) continue;
  const bafaId = String(m.canonical_id);
  if (overlay[bafaId]) continue;
  reviewRequired++;
  overlay[bafaId] = {
    gse_entry_key: null, // key withheld — listing is no longer proven
    gse_match_status: 'review_required',
    gse_catalogue: null,
    gse_brand: null,
    gse_model: null,
    gse_match_method: null,
    gse_match_confidence: null,
    gse_snapshot: SNAPSHOT,
    gse_snapshot_fetched_at: gse.meta.fetched_at,
    gse_first_matched_at: m.first_matched_at,
    gse_last_confirmed_at: m.last_confirmed_at,
  };
  review.push({ gse_entry_key: key, reason: 'previously_confirmed_no_longer_matching', canonical_id: bafaId });
}

/* ── Persist history (confirmed only; append-preserving) ─────────────────── */
for (const [key, bafaId] of confirmedByKey) {
  const prior = history.mappings[key];
  history.mappings[key] = {
    canonical_id: bafaId,
    first_matched_at: prior?.first_matched_at ?? now,
    last_confirmed_at: now,
    method: overlay[bafaId].gse_match_method,
  };
}
fs.writeFileSync(HISTORY_PATH, JSON.stringify({
  _readme: 'Confirmed canonical↔GSE (Conto Termico III.A) mappings. Keys are OUR deterministic entry keys (the catalogue publishes no per-row id). first_matched_at survives snapshot cleanup; a mapping that stops matching becomes review_required, never silently deleted.',
  updated_at: now,
  mappings: history.mappings,
}, null, 1));

const summary = {
  snapshot: SNAPSHOT,
  generated_at: now,
  rules: BASELINE_RULES ? 'baseline' : `improved(${Object.keys(MATCH_OPTS).filter(k => MATCH_OPTS[k]).join(',')})`,
  gse_iiia_entries: gse.entries.length,
  confirmed: confirmedByKey.size,
  by_method: [...confirmedByKey.keys()].reduce((a, key) => {
    const m = overlay[confirmedByKey.get(key)].gse_match_method;
    a[m] = (a[m] ?? 0) + 1; return a;
  }, {}),
  conflicts: conflictCount,
  review_rows: review.length,
  review_required: reviewRequired,
  unmatched_gse_entries: unmatched,
  canonical_products_with_overlay: Object.keys(overlay).length,
};
fs.writeFileSync(path.join(OUT_DIR, 'canonical-gse-overlay.json'),
  JSON.stringify({ meta: summary, overlay }, null, 1));
fs.writeFileSync(path.join(OUT_DIR, 'canonical-gse-review.json'),
  JSON.stringify({ meta: summary, review }, null, 1));
console.log(JSON.stringify(summary, null, 2));
