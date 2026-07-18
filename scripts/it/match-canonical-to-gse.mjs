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
 * CONFIRMING methods (each guarded by contradiction checks — type family,
 * rated capacity, ηs class band):
 *   manufacturer_official — committed mapping in
 *       data_sources/manufacturer_cross_reference/canonical-to-gse.json
 *   component_identity — the catalogue's own outdoor-unit AND indoor-unit
 *       model identifiers both appear in one canonical product's identity.
 *       An ODU-only overlap NEVER confirms — it goes to review.
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
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identityKeys, compact, numericConflict, refrigerantIn, phaseIn } from '../ofgem/pel-match-lib.mjs';
import { ratedCapacityKw } from '../lib/data-sheet-eligibility.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SNAPSHOT = (process.argv.find(a => a.startsWith('--snapshot=')) ?? '').split('=')[1]
  || fs.readdirSync(path.join(ROOT, 'data_sources/gse_ct/parsed')).filter(d => /^\d{4}-\d{2}$/.test(d)).sort().pop();
const PARSED = path.join(ROOT, 'data_sources/gse_ct/parsed', SNAPSHOT, 'gse-normalized.json');
const OUT_DIR = path.join(ROOT, 'data_sources/gse_ct/matching', SNAPSHOT);
const HISTORY_PATH = path.join(ROOT, 'data_sources/gse_ct/gse-match-history.json');
const XREF_PATH = path.join(ROOT, 'data_sources/manufacturer_cross_reference/canonical-to-gse.json');
fs.mkdirSync(OUT_DIR, { recursive: true });

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

/* ── Matching helpers ────────────────────────────────────────────────────── */
const LEGAL_TOKENS = new Set(['GMBH', 'KG', 'CO', 'COKG', 'SP', 'SPK', 'ZOO', 'SA', 'AG', 'SE',
  'SRL', 'SAS', 'LTD', 'LLC', 'BV', 'AS', 'OY', 'AB', 'SPA', 'THE', 'GROUP', 'HOLDING',
  'ITALIA', 'ITALY', 'POLAND', 'POLSKA', 'EUROPE', 'DEUTSCHLAND', 'AIRCONDITIONING', 'AIR',
  'CONDITIONING', 'HEATING', 'CLIMATE', 'SOLUTIONS', 'TECHNIK', 'TECHNIKA', 'INTERNATIONAL']);
const brandTokens = s => new Set(String(s ?? '').toUpperCase().normalize('NFKD')
  .replace(/[^A-Z ]+/g, ' ').split(/\s+/)
  .filter(t => t.length >= 3 && !LEGAL_TOKENS.has(t)));
const mfrConsistent = (a, b) => {
  const A = brandTokens(a), B = brandTokens(b);
  if (!A.size || !B.size) return false;
  for (const t of A) if (B.has(t)) return true;
  return false;
};

const bandOf = eta => eta == null ? null : eta >= 150 ? 'A+++' : eta >= 125 ? 'A++' : eta >= 98 ? 'A+' : 'A';
const CLASS_ORDER = ['A', 'A+', 'A++', 'A+++'];
const classGap = (a, b) => {
  const i = CLASS_ORDER.indexOf(a ?? ''), j = CLASS_ORDER.indexOf(b ?? '');
  return i < 0 || j < 0 ? null : Math.abs(i - j);
};
const typeFamily = t =>
  /Luft \/ Luft/i.test(t ?? '') ? 'air_air'
    : /Luft/i.test(t ?? '') ? 'air_water'
      : /Sole|Wasser \/ Wasser/i.test(t ?? '') ? 'ground'
        : 'other';
const gseFamily = scambio =>
  /aria\s*\/\s*aria/i.test(scambio ?? '') ? 'air_air'
    : /aria\s*\/\s*acqua/i.test(scambio ?? '') ? 'air_water'
      : /salamoia|acqua\s*\/\s*acqua/i.test(scambio ?? '') ? 'ground'
        : 'other';

/** Every kW the catalogue lists for this entry (multiple climate/rating points). */
const gseKws = z => z.ratings.map(r => r.kw).filter(v => typeof v === 'number' && v > 0);
/** Best (smallest) relative capacity deviation across the entry's rating points. */
function capacityDeviation(z, c) {
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

/**
 * Full model identity — containment of long compacted strings IS identity
 * (registries decorate the same hardware differently), never a similarity score.
 */
function exactIdentity(zModel, cModel) {
  const a = compact(zModel ?? ''), b = compact(cModel ?? '');
  if (a.length < 12 || b.length < 12) return a === b && a.length > 0;
  return a === b || a.includes(b) || b.includes(a);
}

/** "230V" / "400V" markers: a different supply voltage is different hardware. */
const voltageIn = s => (String(s ?? '').toUpperCase().match(/\b(230|400)\s?V\b/) || [])[1] ?? null;

/** Contradiction check; returns list of conflicts (empty = sane). */
function conflicts(z, c) {
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
    if (cf !== 'other' && zf !== cf) out.push(`type:${zf}≠${cf}`);
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

/* ── Canonical lookups ───────────────────────────────────────────────────── */
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
const mfrOf = c => c.manufacturer_normalized ?? c.manufacturer ?? '';
const identityHaystack = c => compact(c.model ?? '') + '|' + compact(c.outdoor_unit_model ?? '')
  + '|' + compact(c.idu_model ?? '') + '|' + compact(c.outdoor_side_display_model ?? '');

const componentsOf = s => String(s ?? '').split(/\s*[+/]\s*|\s{2,}/)
  .map(p => compact(p)).filter(p => p.length >= 6);

const specIdentical = (a, b) =>
  (a.power_55C_kw ?? null) === (b.power_55C_kw ?? null)
  && (a.efficiency_55C_percent ?? null) === (b.efficiency_55C_percent ?? null)
  && (a.refrigerant ?? null) === (b.refrigerant ?? null);

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
    // Disambiguate by the catalogue's own published values, but the winner must
    // CONTAIN the entry's primary component — otherwise a shared hydro-box with
    // identical platform specs confirms the wrong outdoor unit.
    const zPrimary = componentsOf(modelString)[0] ?? compact(modelString);
    const hasPrimary = c => zPrimary.length >= 6 && identityHaystack(c).includes(zPrimary);
    const pool = (containing.length > 1 ? containing : mfrHits).filter(hasPrimary);
    const kws = gseKws(z);
    if (kws.length && pool.length) {
      const within = pool.filter(c => {
        const kw = c.power_55C_kw ?? c.power_design_55C_kw ?? ratedCapacityKw(c);
        return kw != null && kws.some(zk => Math.abs(kw - zk) / Math.max(kw, zk) <= 0.10);
      });
      if (within.length === 1 && !conflicts(z, within[0]).length) {
        return { state: 'confirmed', method: `${method}_capacity_resolved`, target: within[0], confidence: 'high' };
      }
      if (within.length > 1) {
        const zEtas = z.ratings.map(r => r.etas).filter(v => v != null);
        const spec = within.filter(c =>
          !zEtas.length || c.efficiency_35C_percent == null
          || zEtas.some(e => Math.abs(e - c.efficiency_35C_percent) <= 2));
        if (spec.length === 1 && !conflicts(z, spec[0]).length) {
          return { state: 'confirmed', method: `${method}_spec_resolved`, target: spec[0], confidence: 'high' };
        }
      }
    }
    return { state: 'review', method: `${method}_ambiguous`, targets: mfrHits.slice(0, 8) };
  }
  return null;
}

/**
 * Monobloc identity: the GSE entry has NO indoor unit — its outdoor-unit id IS
 * the complete hardware identity. It may match only a canonical product that is
 * also IDU-free (monobloc): containment of the ODU id in a PACKAGE product
 * would be exactly the forbidden ODU-only overlap, so packages are excluded.
 */
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
  // Same-family variants sharing the code: the catalogue's own kW picks the one.
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

/** Component identity: the catalogue's own ODU AND IDU ids inside ONE product. */
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

function classify(z) {
  // 0) committed official mapping outranks automation
  const official = xref.find(m => m.gse_entry_key === z.gse_entry_key);
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
  //    (many entries carry a descriptive label there, which resolveModel's
  //    strong-code rules refuse on their own).
  if (z.denominazione && compact(z.denominazione).length >= 8) {
    const viaDenom = resolveModel(z, z.denominazione, 'exact_model');
    if (viaDenom?.state === 'confirmed') return { ...viaDenom, method: 'denomination_model' };
  }
  if (viaComponents) return viaComponents;
  if (viaMonobloc) return viaMonobloc;
  if (viaModel) return viaModel;
  return { state: 'unmatched' };
}

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
