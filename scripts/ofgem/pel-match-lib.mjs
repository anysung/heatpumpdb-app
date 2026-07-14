/**
 * pel-match-lib.mjs — the matching rules used to recover a rated capacity for
 * Ofgem PEL records (match-pel-recovery.mjs). Pure functions, no I/O, so every
 * rule below is unit-tested in tests/pel-matching.unit.mjs.
 *
 * The rules exist to answer one question — "is this the same physical product?" —
 * and to refuse to answer when the evidence does not settle it. A capacity is
 * NEVER derived from a number in a model name, a PEL category, or a typical range.
 */

/** Copied from a matched European record (same set the BAFA matcher copies). */
export const SPEC_FIELDS = [
  'refrigerant', 'refrigerant_2', 'refrigerant_amount_kg', 'refrigerant_2_amount_kg',
  'power_35C_kw', 'efficiency_35C_percent', 'power_design_35C_kw',
  'power_55C_kw', 'efficiency_55C_percent', 'power_design_55C_kw',
  'cop_A7W35', 'cop_A2W35', 'cop_AMinus7W35', 'cop_A10W35', 'scop', 'seer',
  'cooling_efficiency', 'cooling_capacity_kw',
  'noise_outdoor_dB', 'noise_indoor_dB', 'max_electric_power_kw',
  'drive_type', 'power_control', 'num_compressors',
  'defrost_tested', 'defrost_type', 'temp_diff',
];

/**
 * The canonical rated capacity — the SAME chain, in the same order, the app
 * segments on (src/config/segmentation.ts → HpVM.ratedKw). Nothing else may be
 * substituted: not peak output, not cooling capacity, not a model-name number.
 */
export const CAPACITY_CHAIN = ['power_35C_kw', 'power_design_35C_kw', 'power_55C_kw', 'power_design_55C_kw'];

export function ratedCapacity(specs) {
  for (const f of CAPACITY_CHAIN) {
    const v = specs?.[f];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return { kw: v, field: f };
  }
  return null;
}

// ── Normalization: formatting only ───────────────────────────────────────────
// Nothing that distinguishes one product from another is removed — capacity
// numbers, generation digits, series letters, refrigerant and phase markers all
// survive. Only case, spacing, punctuation and non-identifying phrases go.

/** Phrases that describe a configuration, not a product identity. */
const DESCRIPTIVE = [
  /\bwith cooling kit\b/gi, /\bheating only\b/gi, /\bcooling kit\b/gi,
  /\buk version\b/gi, /\bgb version\b/gi, /\beu version\b/gi,
  /\bheat pump\b/gi, /\bpackaged?\b/gi,
];

/** A market suffix: the same hardware sold into a market. Stripped only in the family stage. */
export const MARKET_SUFFIX = /\s*[-–]?\s*\b(GB|UK|IE|EU)\b\s*$/i;

export const stripDescriptive = s => DESCRIPTIVE.reduce((acc, re) => acc.replace(re, ' '), s ?? '');

/** Compact identity key: case/space/punctuation folded away, characters kept. */
export const compact = s => (s ?? '').toUpperCase().normalize('NFKD').replace(/[^A-Z0-9]/g, '');

/** The components a package is built from. */
export const partsOf = s => stripDescriptive(s ?? '')
  .split(/[/,+&]| - |—|–/)
  .map(p => p.trim())
  .filter(Boolean);

/**
 * A "strong code" is a product identifier, not a word or a bare number: ≥6
 * characters with BOTH letters and digits. "ERGA04DAV3A" and "WISANYME1S21"
 * qualify; "PREMIUM", "230" and "S" do not — matching on those is matching on
 * nothing.
 */
export const isStrongCode = k => k.length >= 6 && /[A-Z]/.test(k) && /[0-9]/.test(k);

/** Product codes embedded in a part ("RAS-2WHVRP RWM-2.0NRE" → two codes). */
export const codeTokens = s => partsOf(s)
  .flatMap(p => p.split(/\s+/))
  .map(compact)
  .filter(isStrongCode);

/** A record's identity: its set of product codes. Order-insensitive, by design. */
export function identityKeys(model) {
  const keys = new Set();
  for (const p of partsOf(model)) { const k = compact(p); if (isStrongCode(k)) keys.add(k); }
  for (const k of codeTokens(model)) keys.add(k);
  return keys;
}

// ── Conflict guards ──────────────────────────────────────────────────────────

export const refrigerantIn = s =>
  (String(s ?? '').toUpperCase().match(/\bR\s?(290|32|410A|454C|744|1234ZE|407C)\b/) || [])[1] ?? null;

export const phaseIn = s => {
  const m = String(s ?? '').toUpperCase().match(/\b([13])\s?(?:PH|P)\b/);
  return m ? m[1] : null;
};

/**
 * Numbers in a model name usually ARE the product: Ecoforest's
 * "ecoGEO+ B1 230 1-6 PRO" (a 1–6 kW unit) is 90 % text-similar to
 * "ecoGEO+ B1 230 4-16 PRO" (16 kW). Accepting that on similarity would put
 * 16 kW on a 6 kW product and move it into the wrong segment.
 *
 * So wherever identity rests on the NAME (family, fuzzy), differing numeric
 * tokens disqualify the candidate. It is deliberately NOT applied to the
 * shared-component stage, where identity rests on a shared unit code and the
 * numbers that differ are package details (tank litres, hydro-box variant) that
 * cannot change the outdoor unit's rated heat output.
 */
export const numbersOf = s => (String(s ?? '').match(/\d+(?:\.\d+)?/g) ?? []).join(',');
export const numericConflict = (a, b) => numbersOf(a) !== numbersOf(b);

/** A different refrigerant or a different phase is a different product, however similar the name. */
export function conflictsWith(pelModel, cand) {
  const pr = refrigerantIn(pelModel);
  const cr = refrigerantIn(cand.model) ?? refrigerantIn(cand.specs?.refrigerant);
  if (pr && cr && pr !== cr) return `refrigerant conflict: PEL R${pr} vs candidate R${cr}`;
  const pp = phaseIn(pelModel), cp = phaseIn(cand.model);
  if (pp && cp && pp !== cp) return `phase conflict: PEL ${pp}PH vs candidate ${cp}PH`;
  return null;
}

// ── Acceptance ───────────────────────────────────────────────────────────────

const EPS = 0.05;

/**
 * Decide what a set of candidates actually proves.
 *
 * One performance source per record, never mixed — the project's existing rule.
 * The registry and EPREL publish DIFFERENT quantities (measured rated output vs
 * the label's design load), so the same hardware legitimately reads 5.5 kW in one
 * and 6.0 kW in the other. That is not an identity conflict and must not be
 * "resolved" by averaging or by taking the larger: the established source priority
 * (registry first) decides, and reconciliation then happens within that source.
 *
 * Within the chosen source EVERY candidate must publish the same rated capacity.
 * That single rule is what makes "one outdoor unit, several packages" safe — and
 * it is also what protects us if the shared code turns out not to determine
 * capacity, because then the candidates disagree and the record is refused.
 *
 * Fields that disagree across candidates are DROPPED, never picked from one.
 */
export function reconcile(cands) {
  if (!cands?.length) return { ok: false, why: 'no_candidate' };

  const registry = cands.filter(c => c.source === 'EU_REGISTRY');
  const crossSource = registry.length > 0 && registry.length < cands.length;
  const pick = registry.length ? registry : cands;

  const withCap = pick.filter(c => ratedCapacity(c.specs));
  if (!withCap.length || withCap.length !== pick.length) return { ok: false, why: 'candidate_without_capacity' };

  const caps = withCap.map(c => ratedCapacity(c.specs));
  const distinct = [...new Set(caps.map(c => Math.round(c.kw / EPS)))];
  if (distinct.length > 1) {
    return { ok: false, why: 'capacity_conflict', values: [...new Set(caps.map(c => c.kw))] };
  }

  const specs = {};
  for (const f of SPEC_FIELDS) {
    const vals = new Set(withCap.map(c => JSON.stringify(c.specs[f] ?? null)));
    specs[f] = vals.size === 1 ? withCap[0].specs[f] ?? null : null;   // disagreement → drop, never choose
  }
  return { ok: true, specs, cap: caps[0], cands: withCap, source: withCap[0].source, crossSource };
}

/** Similarity is for the REVIEW QUEUE only. It never accepts anything by itself. */
export function similarity(a, b) {
  const A = compact(a), B = compact(b);
  if (!A || !B) return 0;
  const bi = s => { const g = new Set(); for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2)); return g; };
  const ga = bi(A), gb = bi(B);
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter++;
  return (2 * inter) / (ga.size + gb.size || 1);
}

/**
 * The staged candidate search. Returns { method, hits } or null.
 * Stages are ordered strongest first; a later, weaker stage never runs once an
 * earlier one has produced candidates.
 */
export function findCandidates(pelModel, cands) {
  const pck = compact(pelModel);
  const pk = identityKeys(pelModel);

  // 1 — exact identity after formatting-only normalization.
  let hits = cands.filter(c => c.ck === pck);
  if (hits.length) return { method: 'exact_model', hits, keys: pk };

  if (pk.size) {
    // 3a — one side's product codes wholly contain the other's (the candidate
    // merely adds a package name or a tank).
    hits = cands.filter(c => {
      if (!c.keys?.size) return false;
      if (![...pk].some(k => c.keys.has(k))) return false;
      return [...pk].every(k => c.keys.has(k)) || [...c.keys].every(k => pk.has(k));
    });
    if (hits.length) return { method: 'component_identity', hits, keys: pk };

    // 3b — a shared unit code. PEL "ERGA04EAV3A / EHVH04SU18EA6V" and EPREL
    // "EHVH04SU18EJ6V / ERGA04EAV3A" contain neither one another, but the OUTDOOR
    // UNIT is the same part — and the outdoor unit is what has a rated heat output.
    hits = cands.filter(c => [...pk].some(k => c.keys?.has(k)));
    if (hits.length) return { method: 'shared_component', hits, keys: pk };
  }

  // 4 — family: the same unit carrying a market suffix (…-GB / -UK / -EU).
  // Name-based, so a numeric-token difference disqualifies.
  const famKey = compact(stripDescriptive(pelModel).replace(MARKET_SUFFIX, ''));
  if (famKey && famKey !== pck) {
    hits = cands.filter(c =>
      compact(stripDescriptive(c.model).replace(MARKET_SUFFIX, '')) === famKey
      && !numericConflict(pelModel, c.model));
    if (hits.length) return { method: 'family_market_suffix', hits, keys: pk };
  }

  return null;
}

/** Tier A — deterministic identity. Tier B — several candidates that all agree. */
export const tierOf = (method, candidateCount) =>
  (method === 'exact_model' || (method === 'component_identity' && candidateCount === 1)) ? 'A' : 'B';
