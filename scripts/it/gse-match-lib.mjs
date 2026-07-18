/**
 * gse-match-lib.mjs — the matching rules of the canonical→GSE overlay (IT),
 * extracted as pure functions so the production matcher
 * (match-canonical-to-gse.mjs), the audit instrumentation
 * (audit-gse-matching.mjs) and the unit tests all execute the SAME code.
 *
 * Nothing here is a similarity heuristic: every confirming path is exact
 * identity (compact-string equality/containment of long identifiers, the
 * catalogue's own ODU/IDU codes, or the registry's own published values used
 * to disambiguate an identity-key family). See match-canonical-to-gse.mjs
 * header for the method contract.
 */
import { identityKeys, compact, numericConflict, refrigerantIn, phaseIn } from '../ofgem/pel-match-lib.mjs';
import { ratedCapacityKw } from '../lib/data-sheet-eligibility.mjs';

export { compact, identityKeys, numericConflict, refrigerantIn, phaseIn };

/* ── Brand identity ──────────────────────────────────────────────────────── */
export const LEGAL_TOKENS = new Set(['GMBH', 'KG', 'CO', 'COKG', 'SP', 'SPK', 'ZOO', 'SA', 'AG', 'SE',
  'SRL', 'SRLS', 'SAS', 'LTD', 'LLC', 'BV', 'AS', 'OY', 'AB', 'SPA', 'THE', 'GROUP', 'HOLDING',
  'ITALIA', 'ITALY', 'POLAND', 'POLSKA', 'EUROPE', 'DEUTSCHLAND', 'AIRCONDITIONING', 'AIR',
  'CONDITIONING', 'HEATING', 'CLIMATE', 'SOLUTIONS', 'TECHNIK', 'TECHNIKA', 'INTERNATIONAL']);

export const brandTokens = s => new Set(String(s ?? '').toUpperCase().normalize('NFKD')
  .replace(/[^A-Z ]+/g, ' ').split(/\s+/)
  .filter(t => t.length >= 3 && !LEGAL_TOKENS.has(t)));

/**
 * Brand string minus legal noise, compacted — "De Dietrich Heiztechnik" →
 * "DEDIETRICHHEIZTECHNIK". Unlike brandTokens, SHORT words are kept ("De",
 * "LG"): they are exactly what spacing-variant legal names differ by.
 */
export const brandCompact = s => String(s ?? '').toUpperCase().normalize('NFKD')
  .replace(/[^A-Z ]+/g, ' ').split(/\s+/)
  .filter(t => t.length >= 1 && !LEGAL_TOKENS.has(t)).join('');

/** The production matching rule set (audited 2026-07 — see delta-*.json). */
export const PRODUCTION_MATCH_OPTS = { brandCompactIdentity: true, plusAwareComponents: false };

/**
 * DISTINCT makers that share a house-name token. "Mitsubishi Electric" and
 * "Mitsubishi Heavy Industries" are separate manufacturers with separate
 * product lines; a shared "MITSUBISHI" token must never bridge them
 * (2026-07 audit: latent false-confirm risk — MHI's 12 air/water GSE entries
 * would otherwise be allowed to land on Mitsubishi Electric canonical records
 * if a model code ever coincided). Both sides carrying the shared token with
 * OPPOSING discriminator tokens is a hard brand contradiction.
 */
const DISTINCT_MAKER_GROUPS = [
  { shared: 'MITSUBISHI', a: ['ELECTRIC'], b: ['HEAVY', 'INDUSTRIES'] },
];
const brandContradiction = (A, B) => {
  for (const g of DISTINCT_MAKER_GROUPS) {
    if (!A.has(g.shared) || !B.has(g.shared)) continue;
    const aInA = g.a.some(t => A.has(t)), aInB = g.a.some(t => B.has(t));
    const bInA = g.b.some(t => A.has(t)), bInB = g.b.some(t => B.has(t));
    if ((aInA && bInB) || (bInA && aInB)) return true;
  }
  return false;
};

/**
 * Same maker? Token overlap ("LG ELECTRONICS" ↔ "LG Electronics Deutschland"),
 * refused on a distinct-maker contradiction. This is the BASELINE rule
 * (identical to the shipped ZUM/GSE matchers plus the contradiction guard).
 */
export const mfrConsistentTokens = (a, b) => {
  const A = brandTokens(a), B = brandTokens(b);
  if (!A.size || !B.size) return false;
  if (brandContradiction(A, B)) return false;
  for (const t of A) if (B.has(t)) return true;
  return false;
};

/**
 * IMPROVED brand rule (opt-in via createMatcher opts.brandCompactIdentity):
 * token overlap first, then EXACT compact-name identity for spacing-only legal
 * variants the token rule cannot see — the GSE brand "DEDIETRICH" is one token,
 * the canonical "De Dietrich" two, so no token ever overlaps, but their
 * compacted brand strings are IDENTICAL, which is formatting, not similarity.
 * Containment requires the full shorter name (≥8 chars) inside the longer, so
 * short tokens cannot bridge different makers.
 */
export const mfrConsistentCompact = (a, b) => {
  if (mfrConsistentTokens(a, b)) return true;
  const ca = brandCompact(a), cb = brandCompact(b);
  if (ca.length >= 5 && cb.length >= 5 && ca === cb) return true;
  if (ca.length >= 8 && cb.includes(ca)) return true;
  if (cb.length >= 8 && ca.includes(cb)) return true;
  return false;
};

/* ── Families / classes ──────────────────────────────────────────────────── */
export const bandOf = eta => eta == null ? null : eta >= 150 ? 'A+++' : eta >= 125 ? 'A++' : eta >= 98 ? 'A+' : 'A';
const CLASS_ORDER = ['A', 'A+', 'A++', 'A+++'];
export const classGap = (a, b) => {
  const i = CLASS_ORDER.indexOf(a ?? ''), j = CLASS_ORDER.indexOf(b ?? '');
  return i < 0 || j < 0 ? null : Math.abs(i - j);
};
export const typeFamily = t =>
  /Luft \/ Luft|Aria \/ Aria/i.test(t ?? '') ? 'air_air'
    : /Luft|Aria/i.test(t ?? '') ? 'air_water'
      : /Sole|Salamoia|Wasser \/ Wasser|Acqua \/ Acqua/i.test(t ?? '') ? 'ground'
        : 'other';
export const gseFamily = scambio =>
  /aria\s*\/\s*aria/i.test(scambio ?? '') ? 'air_air'
    : /aria\s*\/\s*acqua/i.test(scambio ?? '') ? 'air_water'
      : /salamoia/i.test(scambio ?? '') ? 'ground'
        : /acqua\s*\/\s*acqua/i.test(scambio ?? '') ? 'water_water'
          : /acqua\s*\/\s*aria/i.test(scambio ?? '') ? 'water_air'
            : 'other';

/* ── Capacity / spec helpers ─────────────────────────────────────────────── */
export const gseKws = z => z.ratings.map(r => r.kw).filter(v => typeof v === 'number' && v > 0);

export function capacityDeviation(z, c) {
  const kws = gseKws(z);
  const cands = [c.power_35C_kw, c.power_design_35C_kw, c.power_55C_kw, c.power_design_55C_kw, ratedCapacityKw(c)]
    .filter(v => typeof v === 'number' && v > 0);
  if (!kws.length || !cands.length) return null;
  let best = Infinity;
  for (const zk of kws) for (const ck of cands) {
    best = Math.min(best, Math.abs(zk - ck) / Math.max(zk, ck));
  }
  return best;
}

/** "230V" / "400V" markers: a different supply voltage is different hardware. */
export const voltageIn = s => (String(s ?? '').toUpperCase().match(/\b(230|400)\s?V\b/) || [])[1] ?? null;

/**
 * Numeric-subset guard for the weakest resolution rungs: every numeric token
 * of the ENTRY's string must appear in the candidate's — a suffix digit the
 * candidate does not carry ("…/NpG4-E" vs "…/NhH3-E": 4 vs 3) distinguishes a
 * variant, while EXTRA canonical detail ("…, Typ AWO-AC-AF 251.B40" behind
 * "Vitocal 250-A PRO") is fine. Asymmetric by design.
 */
export const numericSubset = (a, b) => {
  const nums = s => new Set(String(s ?? '').match(/\d+(?:[.,]\d+)?/g)?.map(x => x.replace(',', '.')) ?? []);
  const B = nums(b);
  for (const n of nums(a)) if (!B.has(n)) return false;
  return true;
};

export function exactIdentity(zModel, cModel) {
  const a = compact(zModel ?? ''), b = compact(cModel ?? '');
  if (a.length < 12 || b.length < 12) return a === b && a.length > 0;
  return a === b || a.includes(b) || b.includes(a);
}

/** Contradiction check; returns list of conflicts (empty = sane). */
export function conflicts(z, c) {
  const out = [];
  const identity = exactIdentity(z.model, c.model);
  // Variant guards: a declared voltage, phase or refrigerant that differs is a
  // different product, however similar the name (both sides must declare it).
  const zv = voltageIn(z.model), cv = voltageIn(c.model);
  if (zv && cv && zv !== cv) out.push(`voltage:${zv}V≠${cv}V`);
  const zp = phaseIn(z.model), cp = phaseIn(c.model);
  if (zp && cp && zp !== cp) out.push(`phase:${zp}≠${cp}`);
  const zr = refrigerantIn(z.model), cr = refrigerantIn(c.model) ?? refrigerantIn(c.refrigerant);
  if (zr && cr && zr !== cr) out.push(`refrigerant:R${zr}≠R${cr}`);
  const zf = gseFamily(z.scambio);
  if (zf !== 'other') {
    const cf = typeFamily(c.type);
    // water_water ↔ canonical 'ground' family (Wasser/Wasser) are the same class.
    const zfc = zf === 'water_water' ? 'ground' : zf;
    if (cf !== 'other' && zfc !== 'water_air' && zfc !== cf) out.push(`type:${zf}≠${cf}`);
  }
  const dev = capacityDeviation(z, c);
  // GSE rates at Conto Termico reference conditions, and an entry often lists
  // several rating points; with verbatim model identity a capacity delta is a
  // measurement-condition artifact up to a wider band. Without identity the
  // tight band stays: capacity is then doing identity work.
  if (dev != null && dev > (identity ? 0.40 : 0.15)) out.push(`capacity:${gseKws(z).join('/')}vs${ratedCapacityKw(c)}`);
  // ηs guard: the catalogue does not state its temperature basis, so compare
  // against BOTH canonical bases and only flag when neither is within one band.
  const zEtas = z.ratings.map(r => r.etas).filter(v => v != null);
  if (zEtas.length && (c.efficiency_35C_percent != null || c.efficiency_55C_percent != null)) {
    let bestGap = null;
    for (const e of zEtas) for (const ce of [c.efficiency_35C_percent, c.efficiency_55C_percent]) {
      if (ce == null) continue;
      const gap = classGap(bandOf(e), bandOf(ce));
      if (gap != null) bestGap = bestGap == null ? gap : Math.min(bestGap, gap);
    }
    if (bestGap != null && bestGap > 1) out.push(`etas-class-gap:${bestGap}`);
  }
  return out;
}

/* ── Model decomposition ─────────────────────────────────────────────────── */
/** BASELINE package split (identical to the shipped matcher): '+', '/', wide gaps. */
export const componentsOfBaseline = s => String(s ?? '').split(/\s*[+/]\s*|\s{2,}/)
  .map(p => compact(p)).filter(p => p.length >= 6);

/**
 * IMPROVED split (opt-in via createMatcher opts.plusAwareComponents): '+' is
 * the package separator when present ("VWL 45/8.2 AS + VWL 67/8.2 IS" — the
 * '/' there is part of the model code, splitting on it would shred both
 * identifiers); '/'-separated packages ("AQS80X1o/AQS100T240X13i") are only
 * split when no '+' exists.
 */
export const componentsOfPlusAware = s => {
  const str = String(s ?? '');
  return (str.includes('+') ? str.split(/\s*\+\s*/) : str.split(/\s*\/\s*|\s{2,}/))
    .map(p => compact(p)).filter(p => p.length >= 6);
};

export const specIdentical = (a, b) =>
  (a.power_55C_kw ?? null) === (b.power_55C_kw ?? null)
  && (a.efficiency_55C_percent ?? null) === (b.efficiency_55C_percent ?? null)
  && (a.refrigerant ?? null) === (b.refrigerant ?? null);

export const mfrOf = c => c.manufacturer_normalized ?? c.manufacturer ?? '';
export const identityHaystack = c => compact(c.model ?? '') + '|' + compact(c.outdoor_unit_model ?? '')
  + '|' + compact(c.idu_model ?? '') + '|' + compact(c.outdoor_side_display_model ?? '');

/* ── Matcher factory ─────────────────────────────────────────────────────── */
/**
 * Build the classifier over a canonical dataset. `xref` is the committed
 * official-mapping list (may be empty).
 *
 * opts (each defaults OFF = the exact shipped-baseline behavior, so the audit
 * can measure every improvement against a byte-identical reproduction):
 *   brandCompactIdentity — mfrConsistentCompact instead of token-overlap only
 *   plusAwareComponents  — componentsOfPlusAware instead of the '/'-eager split
 *
 * Returns { classify, resolveModel, resolveMonobloc, resolveComponents, byKey, byCompact }.
 */
export function createMatcher(canonical, xref = [], opts = {}) {
  const mfrConsistent = opts.brandCompactIdentity ? mfrConsistentCompact : mfrConsistentTokens;
  const componentsOf = opts.plusAwareComponents ? componentsOfPlusAware : componentsOfBaseline;
  const byKey = new Map();
  const byCompact = new Map();
  for (const c of canonical) {
    const cm = compact(c.model ?? '');
    if (cm) {
      if (!byCompact.has(cm)) byCompact.set(cm, []);
      byCompact.get(cm).push(c);
    }
    for (const src of [c.model, c.outdoor_unit_model, c.idu_model, c.outdoor_side_display_model]) {
      if (!src) continue;
      for (const k of identityKeys(src)) {
        if (!byKey.has(k)) byKey.set(k, []);
        if (!byKey.get(k).includes(c)) byKey.get(k).push(c);
      }
    }
  }

  function containsIdentity(zModelString, c) {
    const zc = compact(zModelString);
    if (!zc || zc.length < 12) return false;
    const cAll = identityHaystack(c);
    if (cAll.includes(zc)) return true;
    const parts = componentsOf(zModelString);
    if (parts.length >= 2 && parts.every(p => cAll.includes(p))) return true;
    return false;
  }

  function resolveModel(z, modelString, method) {
    const zc = compact(modelString);
    if (!zc) return null;
    const full = (byCompact.get(zc) ?? []).filter(c => mfrConsistent(z.brand, mfrOf(c)));
    if (full.length === 1) {
      const conf = conflicts(z, full[0]);
      return conf.length
        ? { state: 'conflict', method, target: full[0], conflicts: conf }
        : { state: 'confirmed', method, target: full[0], confidence: 'high' };
    }
    if (full.length > 1) {
      if (full.every(c => specIdentical(c, full[0]))) {
        const rep = [...full].sort((a, b) => String(a.bafa_id).localeCompare(String(b.bafa_id)))[0];
        const conf = conflicts(z, rep);
        if (!conf.length) return { state: 'confirmed', method: `${method}_duplicate_representative`, target: rep, confidence: 'high' };
      }
      return { state: 'review', method: `${method}_duplicate`, targets: full };
    }
    const hits = new Set();
    for (const k of identityKeys(modelString)) for (const c of byKey.get(k) ?? []) hits.add(c);
    const mfrHits = [...hits].filter(c => mfrConsistent(z.brand, mfrOf(c)));
    if (!mfrHits.length && hits.size) {
      return { state: 'review', method: 'cross_brand_identity', targets: [...hits].slice(0, 8) };
    }
    if (mfrHits.length === 1) {
      const c = mfrHits[0];
      if (numericConflict(modelString, c.model ?? '')) {
        return { state: 'review', method: `${method}_numeric_conflict`, targets: [c] };
      }
      const conf = conflicts(z, c);
      return conf.length
        ? { state: 'conflict', method: `${method}_code`, target: c, conflicts: conf }
        : { state: 'confirmed', method: method === 'exact_model' ? 'exact_model_code' : method, target: c, confidence: 'high' };
    }
    if (mfrHits.length > 1) {
      const containing = mfrHits.filter(c => containsIdentity(modelString, c));
      if (containing.length === 1 && !conflicts(z, containing[0]).length) {
        return { state: 'confirmed', method: componentsOf(modelString).length >= 2 ? 'component_identity' : method, target: containing[0], confidence: 'high' };
      }
      if (containing.length > 1 && containing.every(c => specIdentical(c, containing[0]))) {
        const rep = [...containing].sort((a, b) => String(a.bafa_id).localeCompare(String(b.bafa_id)))[0];
        if (!conflicts(z, rep).length) {
          return { state: 'confirmed', method: `${method}_duplicate_representative`, target: rep, confidence: 'high' };
        }
      }
      // Disambiguate by the catalogue's own published values — but ONLY among
      // candidates that already contain the entry's FULL component identity.
      // When the GSE string is a multi-component package, a candidate sharing
      // just the primary (outdoor) component is exactly the forbidden ODU-only
      // overlap: capacity agreement must never finish what identity did not
      // start (2026-07 audit: "OU: HPM-V120W/R3-D + IU: HM-120/DR3-D" was
      // capacity-confirmed onto the WRONG package "…/SR3-B + HM-90/DM").
      // Single-identifier strings (commercial names, monobloc codes) may still
      // resolve among primary-sharing family variants.
      const zParts = componentsOf(modelString);
      const zPrimary = zParts[0] ?? compact(modelString);
      const hasPrimary = c => zPrimary.length >= 6 && identityHaystack(c).includes(zPrimary);
      const pool = zParts.length >= 2
        ? containing
        : (containing.length > 1 ? containing : mfrHits).filter(hasPrimary);
      const kws = gseKws(z);
      if (kws.length && pool.length) {
        const within = pool.filter(c => {
          const kw = c.power_55C_kw ?? c.power_design_55C_kw ?? ratedCapacityKw(c);
          return kw != null && kws.some(zk => Math.abs(kw - zk) / Math.max(kw, zk) <= 0.10);
        });
        if (within.length === 1 && numericSubset(modelString, within[0].model)
          && !conflicts(z, within[0]).length) {
          return { state: 'confirmed', method: `${method}_capacity_resolved`, target: within[0], confidence: 'high' };
        }
        if (within.length > 1) {
          const zEtas = z.ratings.map(r => r.etas).filter(v => v != null);
          const spec = within.filter(c =>
            !zEtas.length || c.efficiency_35C_percent == null
            || zEtas.some(e => Math.abs(e - c.efficiency_35C_percent) <= 2));
          if (spec.length === 1 && numericSubset(modelString, spec[0].model)
            && !conflicts(z, spec[0]).length) {
            return { state: 'confirmed', method: `${method}_spec_resolved`, target: spec[0], confidence: 'high' };
          }
        }
      }
      return { state: 'review', method: `${method}_ambiguous`, targets: mfrHits.slice(0, 8) };
    }
    return null;
  }

  function resolveMonobloc(z) {
    if (z.idu_id) return null;
    const odu = compact(z.odu_id ?? '');
    if (odu.length < 6) return null;
    const cands = canonical.filter(c =>
      !compact(c.idu_model ?? '')
      && identityHaystack(c).includes(odu)
      && mfrConsistent(z.brand, mfrOf(c)));
    if (!cands.length) return null;
    if (cands.length === 1) {
      const conf = conflicts(z, cands[0]);
      return conf.length
        ? { state: 'conflict', method: 'monobloc_identity', target: cands[0], conflicts: conf }
        : { state: 'confirmed', method: 'monobloc_identity', target: cands[0], confidence: 'high' };
    }
    if (cands.every(c => specIdentical(c, cands[0]))) {
      const rep = [...cands].sort((a, b) => String(a.bafa_id).localeCompare(String(b.bafa_id)))[0];
      if (!conflicts(z, rep).length) {
        return { state: 'confirmed', method: 'monobloc_identity_duplicate_representative', target: rep, confidence: 'high' };
      }
    }
    const kws = gseKws(z);
    if (kws.length) {
      const within = cands.filter(c => {
        const kw = c.power_55C_kw ?? c.power_design_55C_kw ?? ratedCapacityKw(c);
        return kw != null && kws.some(zk => Math.abs(kw - zk) / Math.max(kw, zk) <= 0.10);
      });
      if (within.length === 1 && !conflicts(z, within[0]).length) {
        return { state: 'confirmed', method: 'monobloc_capacity_resolved', target: within[0], confidence: 'high' };
      }
    }
    return { state: 'review', method: 'monobloc_ambiguous', targets: cands.slice(0, 8) };
  }

  function resolveComponents(z) {
    const odu = compact(z.odu_id ?? ''), idu = compact(z.idu_id ?? '');
    if (odu.length < 6 || idu.length < 6) return null;
    const cands = canonical.filter(c => {
      const hay = identityHaystack(c);
      return hay.includes(odu) && hay.includes(idu) && mfrConsistent(z.brand, mfrOf(c));
    });
    if (cands.length === 1) {
      const conf = conflicts(z, cands[0]);
      return conf.length
        ? { state: 'conflict', method: 'component_identity', target: cands[0], conflicts: conf }
        : { state: 'confirmed', method: 'component_identity', target: cands[0], confidence: 'high' };
    }
    if (cands.length > 1) {
      if (cands.every(c => specIdentical(c, cands[0]))) {
        const rep = [...cands].sort((a, b) => String(a.bafa_id).localeCompare(String(b.bafa_id)))[0];
        if (!conflicts(z, rep).length) {
          return { state: 'confirmed', method: 'component_identity_duplicate_representative', target: rep, confidence: 'high' };
        }
      }
      return { state: 'review', method: 'component_identity_ambiguous', targets: cands.slice(0, 8) };
    }
    return null;
  }

  const xrefByKey = new Map(xref.map(m => [m.gse_entry_key, m]));

  function classify(z) {
    // 0) committed official mapping outranks automation
    const official = xrefByKey.get(z.gse_entry_key);
    if (official) {
      const c = canonical.find(x => String(x.bafa_id) === String(official.canonical_id));
      if (c) return { state: 'confirmed', method: 'manufacturer_official', target: c, confidence: 'high' };
    }
    // 1) the catalogue's own ODU+IDU component identity (its strongest evidence)
    const viaComponents = resolveComponents(z);
    if (viaComponents?.state === 'confirmed') return viaComponents;
    // 1b) monobloc entries: the ODU id is the complete hardware identity
    const viaMonobloc = resolveMonobloc(z);
    if (viaMonobloc?.state === 'confirmed') return viaMonobloc;
    // 2) exact model identity ladder on the catalogue's model string
    const viaModel = resolveModel(z, z.model ?? '', 'exact_model');
    if (viaModel?.state === 'confirmed') return viaModel;
    // 3) commercial denomination — only when it is itself a strong identifier
    if (z.denominazione && compact(z.denominazione).length >= 8) {
      const viaDenom = resolveModel(z, z.denominazione, 'exact_model');
      if (viaDenom?.state === 'confirmed') return { ...viaDenom, method: 'denomination_model' };
    }
    if (viaComponents) return viaComponents;
    if (viaMonobloc) return viaMonobloc;
    if (viaModel) return viaModel;
    return { state: 'unmatched' };
  }

  return { classify, resolveModel, resolveMonobloc, resolveComponents, byKey, byCompact };
}
