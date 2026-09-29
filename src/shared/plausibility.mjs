/**
 * Data plausibility — ONE rule set for the app, the publish step and the
 * page builders (owner decision 2026-09-29). Plain ESM so Node scripts and the
 * Vite/TS client import the same file (types in plausibility.d.mts).
 *
 *  A · PHYSICALLY IMPOSSIBLE → the value is REMOVED (never shown, never ranked):
 *      COP at or above the Carnot limit of its test condition
 *        (A7/W35 11.0 · A2/W35 9.3 · A−7/W35 7.3), COP below 1, or an outdoor
 *        sound power below 30 dB(A). The record keeps every other value and is
 *        marked "manufacturer check needed".
 *  B · INTERNALLY INCONSISTENT → the value is SHOWN in red and the model carries
 *      the "manufacturer check needed" mark; it never wins a BEST or a ranking:
 *        COP must fall as the source gets colder — A7 ≥ A2 ≥ A−7 (tolerance
 *        0.3); SCOP must match the EU relation SCOP = 2.5·(ηs,35 + 3)/100 within
 *        0.15.
 *  C · UNUSUALLY HIGH but possible (> 65 % of Carnot) → used as is.
 *
 * Source values are never corrected or guessed — A removes, B flags.
 */
const K = 273.15;
const carnot = (tSource, tSink) => (tSink + K) / (tSink - tSource);
export const CARNOT = {
  cop_A7W35: carnot(7, 35),
  cop_A2W35: carnot(2, 35),
  cop_AMinus7W35: carnot(-7, 35),
};
export const COP_FIELDS = ['cop_A7W35', 'cop_A2W35', 'cop_AMinus7W35'];
const ORDER_TOL = 0.3;
const SCOP_TOL = 0.15;
const MIN_SOUND = 30;
const REGISTRY_NATIVE = new Set(['GSE_CATALOGUE', 'ZUM_REGISTRY']);

const num = (v) => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Fields whose value is physically impossible (category A). */
export function impossibleFields(r) {
  const out = [];
  for (const f of COP_FIELDS) {
    const v = num(r[f]);
    if (v != null && (v >= CARNOT[f] || v < 1)) out.push(f);
  }
  const s = num(r.noise_outdoor_dB);
  if (s != null && s < MIN_SOUND) out.push('noise_outdoor_dB');
  return out;
}

/** Fields that contradict each other (category B), computed on the values
 *  that survive A. */
export function inconsistentFields(r) {
  const out = new Set();
  const a7 = num(r.cop_A7W35), a2 = num(r.cop_A2W35), m7 = num(r.cop_AMinus7W35);
  if (a7 != null && a2 != null && a2 > a7 + ORDER_TOL) { out.add('cop_A7W35'); out.add('cop_A2W35'); }
  if (a2 != null && m7 != null && m7 > a2 + ORDER_TOL) { out.add('cop_A2W35'); out.add('cop_AMinus7W35'); }
  if (a2 == null && a7 != null && m7 != null && m7 > a7 + ORDER_TOL) { out.add('cop_A7W35'); out.add('cop_AMinus7W35'); }
  // SCOP ↔ ηs is checked only on the canonical (EU-measured) records: the
  // national registries (IT GSE catalogue, PL Lista ZUM) publish their SCOP on
  // their own test basis, so a gap there is a basis difference, not an error.
  const scop = num(r.scop), eta = num(r.efficiency_35C_percent);
  const nativeBasis = REGISTRY_NATIVE.has(String(r.performance_source || ''));
  if (!nativeBasis && scop != null && eta != null && Math.abs(scop - 2.5 * (eta + 3) / 100) > SCOP_TOL) out.add('scop');
  return [...out];
}

/**
 * Publish-time sanitation: returns a NEW record with A-values removed and the
 * audit trail in `qa_removed` (field names) and `qa_flags` (B field names).
 * Records that were already sanitised (qa_removed present) are left as they are.
 */
export function sanitizeRecord(r) {
  const removed = impossibleFields(r);
  const clean = { ...r };
  for (const f of removed) clean[f] = null;
  const prevRemoved = Array.isArray(r.qa_removed) ? r.qa_removed : [];
  const allRemoved = [...new Set([...prevRemoved, ...removed])];
  const flags = inconsistentFields(clean);
  // If a COP of the set was physically impossible, the surviving COPs of the
  // same test set cannot be trusted either — they are flagged (red), not removed.
  if (allRemoved.some((f) => COP_FIELDS.includes(f))) {
    for (const f of COP_FIELDS) if (clean[f] != null && !flags.includes(f)) flags.push(f);
  }
  if (allRemoved.length) clean.qa_removed = allRemoved; else delete clean.qa_removed;
  if (flags.length) clean.qa_flags = flags; else delete clean.qa_flags;
  return clean;
}

/** Client view: which fields to hide / paint red, and whether to mark the model. */
export function plausibilityOf(r) {
  const clean = sanitizeRecord(r);
  const removed = clean.qa_removed ?? [];
  const flags = clean.qa_flags ?? [];
  return { removed, flags, needsCheck: removed.length > 0 || flags.length > 0 };
}
