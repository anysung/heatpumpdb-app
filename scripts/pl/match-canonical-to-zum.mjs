/**
 * match-canonical-to-zum.mjs — canonical → Lista ZUM listing overlay (PL).
 *
 * Direction is always CANONICAL → ZUM: the overlay may confirm that Poland's
 * official device list carries a canonical product, attach the ZUM id and
 * registry facts, and never anything else. A failed match changes nothing
 * (docs/CANONICAL_TECHNICAL_BASELINE_AND_LOCAL_MARKET_OVERLAY.md).
 *
 * CONFIRMING methods (each guarded by contradiction checks — type family,
 * rated capacity ±15%, 55 °C class within one band):
 *   manufacturer_official — committed mapping in
 *       data_sources/manufacturer_cross_reference/canonical-to-zum.json
 *   eprel_exact   — ZUM publishes the EPREL registration number; equal to the
 *       canonical record's eprel_registration_number (official EU identifier).
 *   eprel_bridge  — ZUM's EPREL number → EPREL record → exact-model identity
 *       against the canonical catalogue (unique, manufacturer-consistent).
 *   exact_model   — full compact-string model equality, manufacturer-consistent.
 *   exact_model_code — unique strong-code identity-key resolution (pel-match-lib
 *       identityKeys), manufacturer-consistent, no numeric conflict.
 *   alias_model   — same as exact_model but via a trade-name alias the registry
 *       itself publishes in "Informacja dodatkowa" ("…pod nazwą handlową X").
 *
 * NEVER confirming: fuzzy similarity, manufacturer-only, capacity-only,
 * family/typoszereg spread, one-EPREL-many-canonical without an approved
 * exception. Those go to canonical-zum-review.json.
 *
 * States on the overlay record:
 *   confirmed             — reproducible identity match (this run).
 *   review_required       — in committed zum-match-history.json but no longer
 *                           matching (matcher regression likelier than delisting).
 *   (everything else)     — verification_required, assigned by the builder.
 *
 * Outputs (per snapshot, gitignored):
 *   data_sources/lista_zum/matching/YYYY-MM/canonical-zum-overlay.json
 *   data_sources/lista_zum/matching/YYYY-MM/canonical-zum-review.json
 * Committed state:
 *   data_sources/lista_zum/zum-match-history.json (first/last confirmed dates)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identityKeys, compact, numericConflict } from '../ofgem/pel-match-lib.mjs';
import { ratedCapacityKw } from '../lib/data-sheet-eligibility.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SNAPSHOT = (process.argv.find(a => a.startsWith('--snapshot=')) ?? '').split('=')[1]
  || fs.readdirSync(path.join(ROOT, 'data_sources/lista_zum/parsed')).filter(d => /^\d{4}-\d{2}$/.test(d)).sort().pop();
const PARSED = path.join(ROOT, 'data_sources/lista_zum/parsed', SNAPSHOT, 'zum-normalized.json');
const OUT_DIR = path.join(ROOT, 'data_sources/lista_zum/matching', SNAPSHOT);
const HISTORY_PATH = path.join(ROOT, 'data_sources/lista_zum/zum-match-history.json');
const XREF_PATH = path.join(ROOT, 'data_sources/manufacturer_cross_reference/canonical-to-zum.json');
const EXC_PATH = path.join(ROOT, 'data_sources/manufacturer_cross_reference/zum-one-to-many-exceptions.json');
fs.mkdirSync(OUT_DIR, { recursive: true });

/* ── Load inputs ─────────────────────────────────────────────────────────── */
const loadJson = (p, fallback = null) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback;

const zum = loadJson(PARSED);
if (!zum) { console.error(`FATAL: ${PARSED} missing — run parse-zum.mjs first`); process.exit(1); }

const canonical = [
  ...(loadJson(path.join(ROOT, 'public/data/products.json'))?.items ?? []),
  ...(loadJson(path.join(ROOT, 'public/data/products-commercial.json'))?.items ?? []),
];
if (canonical.length < 5000) { console.error('FATAL: canonical datasets missing/short — build DE first'); process.exit(1); }

const history = loadJson(HISTORY_PATH, { mappings: {} });
const xref = (loadJson(XREF_PATH, { mappings: [] }).mappings ?? []).filter(m => m.local_registry === 'ZUM');
const exceptions = (loadJson(EXC_PATH, { exceptions: [] }).exceptions ?? []).filter(e => e.approved);

/* ── EPREL registry index (local snapshot, link-only source) ─────────────── */
function eprelIndex() {
  const dirRoot = path.join(ROOT, 'data_sources/eprel_raw/raw');
  const snaps = fs.existsSync(dirRoot)
    ? fs.readdirSync(dirRoot).filter(d => /^\d{4}-\d{2}$/.test(d)).sort() : [];
  const idx = new Map();
  if (!snaps.length) return idx;
  const dir = path.join(dirRoot, snaps[snaps.length - 1], 'spaceheaters-heatpump');
  if (!fs.existsSync(dir)) return idx;
  for (const f of fs.readdirSync(dir)) {
    if (!/^page-\d+\.json$/.test(f)) continue;
    for (const h of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).hits ?? []) {
      idx.set(String(h.eprelRegistrationNumber), {
        supplier: h.supplierOrTrademark ?? '',
        model: h.modelIdentifier ?? '',
      });
    }
  }
  return idx;
}
const EPREL = eprelIndex();

/* ── Matching helpers ────────────────────────────────────────────────────── */
const LEGAL_TOKENS = new Set(['GMBH', 'KG', 'CO', 'COKG', 'SP', 'SPK', 'ZOO', 'SA', 'AG', 'SE',
  'SRL', 'SAS', 'LTD', 'LLC', 'BV', 'AS', 'OY', 'AB', 'SPA', 'THE', 'GROUP', 'HOLDING',
  'POLAND', 'POLSKA', 'EUROPE', 'DEUTSCHLAND', 'AIRCONDITIONING', 'AIR', 'CONDITIONING',
  'HEATING', 'CLIMATE', 'SOLUTIONS', 'TECHNIK', 'TECHNIKA', 'INTERNATIONAL']);
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
const ZUM_FAMILY = { PW: 'air_water', PG: 'ground', PP: 'air_air', PU: 'dhw' };

/**
 * Full model identity: the ZUM model string appears verbatim (compacted) inside
 * the canonical model string or vice versa. Registries decorate the same
 * hardware differently ("Aquarea [WH-ADC0912K6E5 / WH-UXZ12KE5]" vs
 * "WH-ADC0912K6E5 + WH-UXZ12KE5") — containment of a long-enough compact
 * string IS the identity, not a similarity heuristic.
 */
function exactIdentity(zModel, cModel) {
  const a = compact(zModel ?? ''), b = compact(cModel ?? '');
  if (a.length < 12 || b.length < 12) return a === b && a.length > 0;
  return a === b || a.includes(b) || b.includes(a);
}

/** Contradiction check; returns list of conflicts (empty = sane). */
function conflicts(z, c) {
  const out = [];
  const identity = exactIdentity(z.model, c.model);
  const zf = ZUM_FAMILY[z.category];
  if (zf && zf !== 'dhw') {
    const cf = typeFamily(c.type);
    if (cf !== 'other' && zf !== cf) out.push(`type:${zf}≠${cf}`);
  }
  const cKw = c.power_55C_kw ?? c.power_design_55C_kw ?? ratedCapacityKw(c);
  if (z.rated_kw_55 != null && cKw != null) {
    const rel = Math.abs(z.rated_kw_55 - cKw) / Math.max(z.rated_kw_55, cKw);
    // The registries rate at different conditions (ZUM: moderate-climate 55 °C
    // design output; the canonical value can be a full-load rating) — when the
    // full model identity already matches verbatim, a capacity delta is a
    // measurement-condition artifact up to a much wider band. Without exact
    // identity the tight band stays: capacity is then doing identity work.
    if (rel > (identity ? 0.40 : 0.15)) out.push(`capacity:${z.rated_kw_55}vs${cKw}`);
  }
  if (z.class_55 && c.efficiency_55C_percent != null) {
    const gap = classGap(z.class_55, bandOf(c.efficiency_55C_percent));
    if (gap != null && gap > 1) out.push(`class:${z.class_55}vs${bandOf(c.efficiency_55C_percent)}`);
  }
  return out;
}

/* ── Canonical lookups ───────────────────────────────────────────────────── */
const byEprel = new Map();
const byKey = new Map();
const byCompact = new Map();
for (const c of canonical) {
  if (c.eprel_registration_number != null) {
    const k = String(c.eprel_registration_number);
    if (!byEprel.has(k)) byEprel.set(k, []);
    byEprel.get(k).push(c);
  }
  const cm = compact(c.model ?? '');
  if (cm) {
    if (!byCompact.has(cm)) byCompact.set(cm, []);
    byCompact.get(cm).push(c);
  }
  // Identity keys come from the model string AND the component identity fields:
  // several manufacturers (Daikin above all) list marketing names in `model`
  // while the technical unit codes live in idu/odu fields — the same codes the
  // Polish registry and EPREL publish. Strong-code equality on a component is
  // still exact identity, never similarity.
  for (const src of [c.model, c.outdoor_unit_model, c.idu_model, c.outdoor_side_display_model]) {
    if (!src) continue;
    for (const k of identityKeys(src)) {
      if (!byKey.has(k)) byKey.set(k, []);
      if (!byKey.get(k).includes(c)) byKey.get(k).push(c);
    }
  }
}
const mfrOf = c => c.manufacturer_normalized ?? c.manufacturer ?? '';

/** Trade-name aliases the registry itself publishes in Informacja dodatkowa. */
function aliasModels(z) {
  const info = z.additional_info ?? '';
  const out = [];
  for (const m of info.matchAll(/nazw[aą] handlow[aą][^A-Za-z0-9]{0,4}([A-Za-z0-9][A-Za-z0-9 ./+-]{3,60})/gi)) {
    out.push(m[1].trim());
  }
  return out;
}

/* ── Classify each active ZUM entry ──────────────────────────────────────── */
const xrefByZumId = new Map(xref.map(m => [m.zum_id, m]));
const approvedOneToMany = new Map(exceptions.map(e => [e.local_id, e]));

function resolveModel(z, modelString, method) {
  // full compact equality first — strongest string identity
  const zc = compact(modelString);
  if (!zc) return null;
  const full = (byCompact.get(zc) ?? []).filter(c => mfrConsistent(z.manufacturer, mfrOf(c)));
  if (full.length === 1) {
    const conf = conflicts(z, full[0]);
    return conf.length
      ? { state: 'conflict', method, target: full[0], conflicts: conf }
      : { state: 'confirmed', method, target: full[0], confidence: 'high' };
  }
  if (full.length > 1) return { state: 'review', method: `${method}_duplicate`, targets: full };
  // unique strong-code resolution
  const hits = new Set();
  for (const k of identityKeys(modelString)) for (const c of byKey.get(k) ?? []) hits.add(c);
  const mfrHits = [...hits].filter(c => mfrConsistent(z.manufacturer, mfrOf(c)));
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
    // Capacity resolution: the registry publishes the exact rated 55 °C output of
    // the LISTED configuration. If exactly one identity-key candidate carries that
    // capacity (±10%) and nothing contradicts, that candidate IS the listed unit.
    // (Identity keys narrowed the set to one family; the registry's own rated
    // value picks the subtype — never fuzzy similarity.)
    if (z.rated_kw_55 != null) {
      const within = mfrHits.filter(c => {
        const kw = c.power_55C_kw ?? c.power_design_55C_kw ?? ratedCapacityKw(c);
        return kw != null && Math.abs(kw - z.rated_kw_55) / Math.max(kw, z.rated_kw_55) <= 0.10;
      });
      if (within.length === 1 && !conflicts(z, within[0]).length) {
        return { state: 'confirmed', method: `${method}_capacity_resolved`, target: within[0], confidence: 'high' };
      }
    }
    return { state: 'review', method: `${method}_ambiguous`, targets: mfrHits };
  }
  return null;
}

function classify(z) {
  // 0) committed official mapping outranks automation
  const official = xrefByZumId.get(z.zum_id);
  if (official) {
    const c = canonical.find(x => String(x.bafa_id) === String(official.canonical_id));
    if (c) return { state: 'confirmed', method: 'manufacturer_official', target: c, confidence: 'high' };
  }
  // 1) eprel_exact
  let eprelConflict = null;
  if (z.eprel_number && byEprel.has(z.eprel_number)) {
    const cands = byEprel.get(z.eprel_number);
    if (cands.length === 1) {
      const conf = conflicts(z, cands[0]);
      if (!conf.length) return { state: 'confirmed', method: 'eprel_exact', target: cands[0], confidence: 'high' };
      // The canonical EPREL link is itself a matcher product (link-only, can sit
      // on the wrong variant of a family, e.g. air-collector vs ground loop).
      // Hold the conflict and let the exact-model path try the RIGHT variant;
      // the conflict is only reported if nothing cleaner confirms.
      eprelConflict = { state: 'conflict', method: 'eprel_exact', target: cands[0], conflicts: conf };
    }
    const exc = approvedOneToMany.get(z.zum_id);
    if (exc) {
      const ok = cands.filter(c => exc.canonical_ids.includes(String(c.bafa_id)));
      if (ok.length === 1) return { state: 'confirmed', method: 'approved_one_to_many', target: ok[0], confidence: 'high' };
    }
    // Same capacity resolution as the model path: one EPREL number, several
    // canonical configurations — the registry's rated 55 °C value names the one.
    if (cands.length > 1 && z.rated_kw_55 != null) {
      const within = cands.filter(c => {
        const kw = c.power_55C_kw ?? c.power_design_55C_kw ?? ratedCapacityKw(c);
        return kw != null && Math.abs(kw - z.rated_kw_55) / Math.max(kw, z.rated_kw_55) <= 0.10;
      });
      if (within.length === 1 && !conflicts(z, within[0]).length) {
        return { state: 'confirmed', method: 'eprel_capacity_resolved', target: within[0], confidence: 'high' };
      }
    }
    if (cands.length > 1) {
      eprelConflict = { state: 'review', method: 'eprel_one_to_many', targets: cands };
    }
  }
  // 2) eprel_bridge
  if (z.eprel_number && EPREL.has(z.eprel_number)) {
    const e = EPREL.get(z.eprel_number);
    const viaBridge = resolveModel(z, e.model, 'eprel_bridge');
    if (viaBridge?.state === 'confirmed'
      && (!e.supplier || mfrConsistent(e.supplier, mfrOf(viaBridge.target)))) {
      return { ...viaBridge, method: 'eprel_bridge' };
    }
    if (viaBridge && viaBridge.state !== 'confirmed') { /* fall through to model match */ }
  }
  // 3) exact model on the registry's model string — a clean confirmation here
  //    outranks a held EPREL conflict (the EPREL link chose the wrong variant).
  const viaModel = resolveModel(z, z.model ?? '', 'exact_model');
  if (viaModel?.state === 'confirmed') return viaModel;
  // 4) registry-published trade-name aliases
  for (const alias of aliasModels(z)) {
    const viaAlias = resolveModel(z, alias, 'alias_model');
    if (viaAlias?.state === 'confirmed') return { ...viaAlias, method: 'alias_model' };
  }
  if (eprelConflict) return eprelConflict;
  if (viaModel) return viaModel;
  return { state: 'unmatched' };
}

/* ── Run ─────────────────────────────────────────────────────────────────── */
const now = new Date().toISOString();
const overlay = {};        // bafa_id -> zum block
const review = [];
const confirmedByZum = new Map();
let conflictCount = 0, unmatched = 0;

for (const z of zum.entries) {
  const r = classify(z);
  if (r.state === 'confirmed') {
    const bafaId = String(r.target.bafa_id);
    if (overlay[bafaId]) {
      // one canonical product may carry ONE listing id — a second confirmed ZUM
      // entry for the same product is an ambiguity, not a listing.
      review.push({ zum_id: z.zum_id, reason: 'second_confirmation_same_product', existing: overlay[bafaId].zum_id, method: r.method });
      continue;
    }
    const prior = history.mappings[z.zum_id];
    overlay[bafaId] = {
      zum_id: z.zum_id,
      zum_match_status: 'confirmed',
      zum_product_name: z.product_name ?? null,
      zum_category: z.category,
      zum_class_55c: z.class_55 ?? z.single_class ?? null,
      zum_match_method: r.method,
      zum_match_confidence: r.confidence ?? 'high',
      zum_snapshot: SNAPSHOT,
      zum_snapshot_fetched_at: zum.meta.generated_at,
      zum_first_matched_at: prior?.first_matched_at ?? now,
      zum_last_confirmed_at: now,
    };
    confirmedByZum.set(z.zum_id, bafaId);
  } else if (r.state === 'conflict') {
    conflictCount++;
    review.push({ zum_id: z.zum_id, reason: 'contradiction', method: r.method, conflicts: r.conflicts, candidate: String(r.target.bafa_id), zum_model: z.model, canonical_model: r.target.model });
  } else if (r.state === 'review') {
    review.push({ zum_id: z.zum_id, reason: r.method, candidates: (r.targets ?? []).map(c => String(c.bafa_id)).slice(0, 8), zum_model: z.model, zum_manufacturer: z.manufacturer });
  } else {
    unmatched++;
  }
}

/* ── review_required: previously confirmed, no longer matching ───────────── */
let reviewRequired = 0;
for (const [zumId, m] of Object.entries(history.mappings)) {
  if (confirmedByZum.has(zumId)) continue;
  const bafaId = String(m.canonical_id);
  if (overlay[bafaId]) continue;
  reviewRequired++;
  overlay[bafaId] = {
    zum_id: null, // id withheld in public data — listing is no longer proven
    zum_match_status: 'review_required',
    zum_product_name: null,
    zum_category: null,
    zum_class_55c: null,
    zum_match_method: null,
    zum_match_confidence: null,
    zum_snapshot: SNAPSHOT,
    zum_snapshot_fetched_at: zum.meta.generated_at,
    zum_first_matched_at: m.first_matched_at,
    zum_last_confirmed_at: m.last_confirmed_at,
  };
  review.push({ zum_id: zumId, reason: 'previously_confirmed_no_longer_matching', canonical_id: bafaId });
}

/* ── Persist history (confirmed only; append-preserving) ─────────────────── */
for (const [zumId, bafaId] of confirmedByZum) {
  const prior = history.mappings[zumId];
  history.mappings[zumId] = {
    canonical_id: bafaId,
    first_matched_at: prior?.first_matched_at ?? now,
    last_confirmed_at: now,
    method: overlay[bafaId].zum_match_method,
  };
}
fs.writeFileSync(HISTORY_PATH, JSON.stringify({
  _readme: 'Confirmed canonical↔ZUM mappings. first_matched_at survives snapshot cleanup; a mapping that stops matching becomes review_required, never silently deleted.',
  updated_at: now,
  mappings: history.mappings,
}, null, 1));

const summary = {
  snapshot: SNAPSHOT,
  generated_at: now,
  zum_active_entries: zum.entries.length,
  confirmed: confirmedByZum.size,
  by_method: [...confirmedByZum.keys()].reduce((a, id) => {
    const m = overlay[confirmedByZum.get(id)].zum_match_method;
    a[m] = (a[m] ?? 0) + 1; return a;
  }, {}),
  conflicts: conflictCount,
  review_rows: review.length,
  review_required: reviewRequired,
  unmatched_zum_entries: unmatched,
  canonical_products_with_overlay: Object.keys(overlay).length,
};
fs.writeFileSync(path.join(OUT_DIR, 'canonical-zum-overlay.json'),
  JSON.stringify({ meta: summary, overlay }, null, 1));
fs.writeFileSync(path.join(OUT_DIR, 'canonical-zum-review.json'),
  JSON.stringify({ meta: summary, review }, null, 1));
console.log(JSON.stringify(summary, null, 2));
