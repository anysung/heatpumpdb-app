/**
 * audit-gse-matching.mjs — root-cause audit of the canonical↔GSE match rate (IT).
 *
 * Answers, with entry-level evidence, WHERE the 10,268 GSE III.A identities go:
 *   scope (product classes outside the canonical catalogue's world),
 *   manufacturer coverage (brands with zero canonical presence),
 *   canonical component-field readiness (ODU/IDU identifiers available?),
 *   identity granularity (combination rows vs package products),
 *   normalization gaps (brand legal-name spacing, '+'-package decomposition),
 *   conflict guards, and the residual truly-unmatched population.
 *
 * It runs the SAME matcher code as production (gse-match-lib.mjs) in four rule
 * modes — baseline, +brandCompactIdentity, +plusAwareComponents, both — so
 * every proposed improvement is measured, not asserted, and every newly
 * confirmed match is listed for manual review BEFORE the production rules are
 * switched.
 *
 * Output: data_sources/gse_ct/audit/YYYY-MM/*.json (committed — small,
 * aggregate, reproducible reports; no raw dumps).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  createMatcher, mfrConsistentTokens, mfrConsistentCompact, brandTokens,
  compact, identityKeys, gseFamily, typeFamily, gseKws, conflicts, mfrOf,
  identityHaystack, voltageIn, phaseIn, refrigerantIn,
} from './gse-match-lib.mjs';
import { ratedCapacityKw, segmentOf } from '../lib/data-sheet-eligibility.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SNAPSHOT = (process.argv.find(a => a.startsWith('--snapshot=')) ?? '').split('=')[1]
  || fs.readdirSync(path.join(ROOT, 'data_sources/gse_ct/parsed')).filter(d => /^\d{4}-\d{2}$/.test(d)).sort().pop();
const OUT_DIR = path.join(ROOT, 'data_sources/gse_ct/audit', SNAPSHOT);
fs.mkdirSync(OUT_DIR, { recursive: true });

const loadJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const pct = (a, b) => b ? +(100 * a / b).toFixed(1) : 0;

/* ── Inputs ──────────────────────────────────────────────────────────────── */
const RAW_DIR = path.join(ROOT, 'data_sources/gse_ct/raw', SNAPSHOT);
const gse = loadJson(path.join(ROOT, 'data_sources/gse_ct/parsed', SNAPSHOT, 'gse-normalized.json'));
const canonical = [
  ...loadJson(path.join(ROOT, 'public/data/products.json')).items,
  ...loadJson(path.join(ROOT, 'public/data/products-commercial.json')).items,
];
const itPublic = [
  ...loadJson(path.join(ROOT, 'public/data/products-it.json')).items,
  ...loadJson(path.join(ROOT, 'public/data/products-commercial-it.json')).items,
];

/* ── 1. Baseline provenance ──────────────────────────────────────────────── */
const baseline = {
  snapshot: SNAPSHOT,
  generated_at: new Date().toISOString(),
  source_files: Object.fromEntries(['IIIA', 'IIIB', 'IIIE'].map(k => {
    const p = path.join(RAW_DIR, `${k}.pdf`);
    return [k, { sha256: sha(p), bytes: fs.statSync(p).size }];
  })),
  fetched_at: gse.meta.fetched_at,
  gse_last_modified: gse.meta.files?.IIIA?.last_modified ?? null,
  iiia_source_rows: gse.meta.iiia_rows,
  iiia_rejected: gse.meta.iiia_rejected,
  iiia_identities: gse.entries.length,
  canonical_products: canonical.length,
  it_public_products: itPublic.length,
  it_public_status: itPublic.reduce((a, p) => { a[p.gse_match_status] = (a[p.gse_match_status] ?? 0) + 1; return a; }, {}),
};

/* ── 2. Canonical matching-readiness (component-field coverage) ──────────── */
function canonicalCoverage() {
  const n = canonical.length;
  const has = f => canonical.filter(c => {
    const v = c[f];
    return v != null && String(v).trim() !== '';
  }).length;
  const odu = c => compact(c.outdoor_unit_model ?? '') || compact(c.outdoor_side_display_model ?? '');
  const idu = c => compact(c.idu_model ?? '');
  const packageModel = c => {
    const m = String(c.model ?? '');
    return (m.includes('+') || m.includes('/')) && identityKeys(m).size >= 2;
  };
  const embedded = c => !c.outdoor_unit_model && !c.idu_model && identityKeys(c.model ?? '').size >= 2;
  const counts = {
    total: n,
    manufacturer: has('manufacturer'),
    model: has('model'),
    canonical_id: canonical.filter(c => c.bafa_id != null).length,
    odu_code: canonical.filter(c => odu(c).length >= 6).length,
    idu_code: canonical.filter(c => idu(c).length >= 6).length,
    odu_and_idu: canonical.filter(c => odu(c).length >= 6 && idu(c).length >= 6).length,
    package_or_system_model: canonical.filter(packageModel).length,
    component_codes_embedded_in_model_only: canonical.filter(embedded).length,
    display_model_only: canonical.filter(c => odu(c).length < 6 && idu(c).length < 6 && identityKeys(c.model ?? '').size <= 1).length,
    no_component_identity: canonical.filter(c => odu(c).length < 6 && idu(c).length < 6 && !packageModel(c)).length,
    refrigerant: has('refrigerant'),
    rated_capacity: canonical.filter(c => ratedCapacityKw(c) != null).length,
    voltage_in_model: canonical.filter(c => voltageIn(c.model)).length,
    phase_in_model: canonical.filter(c => phaseIn(c.model)).length,
    type: has('type'),
    installation_type: has('installation_type'),
    outdoor_side_display_model: has('outdoor_side_display_model'),
    outdoor_side_identified: canonical.filter(c => c.outdoor_side_identified === true).length,
  };
  const out = {};
  for (const [k, v] of Object.entries(counts)) out[k] = k === 'total' ? v : { count: v, pct: pct(v, n) };
  return out;
}

/* ── 3. GSE scope classification ─────────────────────────────────────────── */
function classOf(z) {
  if (/gas/i.test(z.funzionamento ?? '')) return 'gas_driven';
  const fam = gseFamily(z.scambio);
  if (fam === 'air_air') {
    if (/vrf/i.test(z.model ?? '') || /vrf/i.test(z.denominazione ?? '')) return 'air_air_vrf';
    if (/fixed double duct|monoblocco/i.test(z.denominazione ?? '')) return 'air_air_packaged';
    return 'air_air_split';
  }
  if (fam === 'air_water') return z.idu_id ? 'air_water_split' : 'air_water_monobloc_or_odu_only';
  if (fam === 'ground') return 'ground_source';
  if (fam === 'water_water') return 'water_water';
  if (fam === 'water_air') return 'water_air';
  return 'unclassified';
}
// Canonical comparable pool per class (family-level).
const canonicalByFamily = canonical.reduce((a, c) => {
  const f = typeFamily(c.type);
  a[f] = (a[f] ?? 0) + 1; return a;
}, {});
const CLASS_TO_CANONICAL_FAMILY = {
  air_water_split: 'air_water', air_water_monobloc_or_odu_only: 'air_water',
  ground_source: 'ground', water_water: 'ground',
  air_air_split: 'air_air', air_air_vrf: 'air_air', air_air_packaged: 'air_air',
  water_air: 'other', gas_driven: 'n/a', unclassified: 'n/a',
};
// In-scope = classes whose canonical comparable pool is actually non-empty.
// 2026-07 finding: the canonical public catalogue is 100% 'Luft / Wasser'
// (air/water) — ground-source and water/water classes have a ZERO canonical
// pool and are therefore out of scope TODAY, exactly like air/air.
const IN_SCOPE_CLASSES = Object.entries(CLASS_TO_CANONICAL_FAMILY)
  .filter(([, fam]) => (canonicalByFamily[fam] ?? 0) > 0)
  .map(([cls]) => cls);

/* ── 4. Run the matcher in four rule modes ───────────────────────────────── */
const MODES = {
  baseline: {},
  brand: { brandCompactIdentity: true },
  plus: { plusAwareComponents: true },
  improved: { brandCompactIdentity: true, plusAwareComponents: true },
};
const results = {};
for (const [mode, opts] of Object.entries(MODES)) {
  const { classify } = createMatcher(canonical, [], opts);
  results[mode] = gse.entries.map(z => ({ z, r: classify(z) }));
}

/** Deduplicate confirmations exactly like the production runner (one canonical
 *  product keeps its strongest-evidence entry; the rest become
 *  second_confirmation review rows). */
const METHOD_RANK = ['manufacturer_official', 'component_identity',
  'component_identity_duplicate_representative', 'monobloc_identity',
  'monobloc_identity_duplicate_representative', 'exact_model',
  'exact_model_duplicate_representative', 'denomination_model', 'exact_model_code',
  'exact_model_spec_resolved', 'exact_model_capacity_resolved', 'monobloc_capacity_resolved'];
const rankOf = m => { const i = METHOD_RANK.indexOf(m); return i === -1 ? METHOD_RANK.length : i; };
function dedupe(classified) {
  const kept = new Map(); // bafa_id -> {z, r}
  const superseded = [];
  const confirmations = classified.filter(({ r }) => r.state === 'confirmed')
    .sort((a, b) => rankOf(a.r.method) - rankOf(b.r.method));
  for (const cr of confirmations) {
    const id = String(cr.r.target.bafa_id);
    if (kept.has(id)) superseded.push(cr); else kept.set(id, cr);
  }
  return { kept, superseded };
}

/* ── 5. Funnel (baseline mode, entry-level terminal reasons) ─────────────── */
// Per-brand canonical presence under both brand rules.
const canonicalBrands = canonical.map(c => mfrOf(c));
const brandPresence = new Map(); // gse brand -> {tokens: n, compact: n}
for (const z of gse.entries) {
  if (brandPresence.has(z.brand)) continue;
  brandPresence.set(z.brand, {
    tokens: canonicalBrands.filter(b => mfrConsistentTokens(z.brand, b)).length,
    compact: canonicalBrands.filter(b => mfrConsistentCompact(z.brand, b)).length,
  });
}

// Precomputed canonical identity list for ODU/IDU containment scans.
const canonList = canonical.map(c => ({
  c, hay: identityHaystack(c), mfr: mfrOf(c),
  hasIdu: compact(c.idu_model ?? '').length >= 6,
}));

function terminalReason(z, r) {
  if (r.state === 'confirmed') return `confirmed:${r.method}`;
  if (r.state === 'conflict') return `conflict:${(r.conflicts ?? []).map(x => x.split(':')[0]).join('+')}`;
  if (r.state === 'review') return `review:${r.method}`;
  const p = brandPresence.get(z.brand);
  if (!p.tokens) return p.compact ? 'unmatched:brand_blocked_by_legal_name_format' : 'unmatched:manufacturer_not_in_canonical';
  // manufacturer present, no candidate anywhere
  const odu = compact(z.odu_id ?? ''), idu = compact(z.idu_id ?? '');
  if (odu.length >= 6 && idu.length >= 6) return 'unmatched:mfr_present_combo_absent';
  if (odu.length >= 6) return 'unmatched:mfr_present_odu_absent';
  return 'unmatched:mfr_present_model_absent';
}

function funnelFor(mode) {
  const classified = results[mode];
  const { kept, superseded } = dedupe(classified);
  const keptKeys = new Set([...kept.values()].map(x => x.z.gse_entry_key));
  const supersededKeys = new Set(superseded.map(x => x.z.gse_entry_key));
  const reasons = {};
  const byClassReason = {};
  for (const { z, r } of classified) {
    let reason = terminalReason(z, r);
    if (r.state === 'confirmed' && supersededKeys.has(z.gse_entry_key)) reason = 'granularity:second_combination_same_product';
    reasons[reason] = (reasons[reason] ?? 0) + 1;
    const cls = classOf(z);
    (byClassReason[cls] ??= {})[reason.split(':')[0]] = ((byClassReason[cls] ??= {})[reason.split(':')[0]] ?? 0) + 1;
  }
  return { confirmedProducts: kept.size, supersededCombos: superseded.length, reasons, byClassReason, keptKeys };
}

/* ── 6. Manufacturer-level table (baseline + improved) ───────────────────── */
function manufacturerTable(mode) {
  const classified = results[mode];
  const { kept, superseded } = dedupe(classified);
  const supersededKeys = new Set(superseded.map(x => x.z.gse_entry_key));
  const rows = new Map();
  for (const { z, r } of classified) {
    const row = rows.get(z.brand) ?? { gse_identities: 0, confirmed: 0, second_combo: 0, candidates: 0, conflicts: 0, unmatched: 0 };
    row.gse_identities++;
    if (r.state === 'confirmed') { supersededKeys.has(z.gse_entry_key) ? row.second_combo++ : row.confirmed++; }
    else if (r.state === 'review') row.candidates++;
    else if (r.state === 'conflict') row.conflicts++;
    else row.unmatched++;
    rows.set(z.brand, row);
  }
  const table = [...rows.entries()].map(([brand, row]) => ({
    brand,
    canonical_products: canonList.filter(x => mfrConsistentTokens(brand, x.mfr)).length,
    canonical_products_compact_rule: canonList.filter(x => mfrConsistentCompact(brand, x.mfr)).length,
    ...row,
    match_rate_pct: pct(row.confirmed + row.second_combo, row.gse_identities),
  })).sort((a, b) => b.gse_identities - a.gse_identities);
  return table;
}

/* ── 7. ODU-only candidate audit (baseline rules) ────────────────────────── */
function oduOnlyAudit() {
  const { kept } = dedupe(results.baseline);
  const confirmedKeys = new Set([...kept.values()].map(x => x.z.gse_entry_key));
  const cats = {
    exact_component_system_unresolved: [], // odu found, entry has idu, some candidate lacks/differs idu
    likely_same_core_different_indoor: [],
    canonical_idu_missing: [],
    multiple_valid_indoor_combinations: [],
    technical_conflict: [],
    ambiguous_cross_family: [],
  };
  let entriesWithOdu = 0, oduFoundInCanonical = 0;
  for (const { z, r } of results.baseline) {
    if (r.state === 'confirmed') continue;
    const odu = compact(z.odu_id ?? '');
    if (odu.length < 6) continue;
    entriesWithOdu++;
    const cands = canonList.filter(x => x.hay.includes(odu) && mfrConsistentTokens(z.brand, x.mfr));
    if (!cands.length) continue;
    oduFoundInCanonical++;
    const clean = cands.filter(x => !conflicts(z, x.c).length);
    if (!clean.length) { cats.technical_conflict.push(z.gse_entry_key); continue; }
    const idu = compact(z.idu_id ?? '');
    if (idu.length >= 6) {
      const withIduField = clean.filter(x => x.hasIdu);
      if (!withIduField.length) cats.canonical_idu_missing.push(z.gse_entry_key);
      else if (withIduField.some(x => x.hay.includes(idu))) cats.exact_component_system_unresolved.push(z.gse_entry_key);
      else if (withIduField.length > 2) cats.multiple_valid_indoor_combinations.push(z.gse_entry_key);
      else cats.likely_same_core_different_indoor.push(z.gse_entry_key);
    } else {
      // entry is odu-only; candidates are packages (monobloc path already tried IDU-free ones)
      const packages = clean.filter(x => x.hasIdu);
      if (packages.length > 2) cats.multiple_valid_indoor_combinations.push(z.gse_entry_key);
      else if (packages.length) cats.likely_same_core_different_indoor.push(z.gse_entry_key);
      else cats.ambiguous_cross_family.push(z.gse_entry_key);
    }
  }
  return {
    entries_with_odu_unconfirmed: entriesWithOdu,
    odu_found_in_canonical_same_brand: oduFoundInCanonical,
    categories: Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, { count: v.length, sample: v.slice(0, 12) }])),
  };
}

/* ── 8. Granularity ──────────────────────────────────────────────────────── */
function granularity() {
  const odus = new Set(), idus = new Set(), combos = new Set();
  for (const z of gse.entries) {
    const o = compact(z.odu_id ?? ''), i = compact(z.idu_id ?? '');
    if (o.length >= 6) odus.add(o);
    if (i.length >= 6) idus.add(i);
    combos.add(`${o}|${i}`);
  }
  const { kept, superseded } = dedupe(results.baseline);
  // multiple canonical products sharing one GSE odu (component → many products)
  const byOdu = new Map();
  for (const [id, { z }] of kept) {
    const o = compact(z.odu_id ?? '');
    if (o.length >= 6) (byOdu.get(o) ?? byOdu.set(o, []).get(o)).push(id);
  }
  return {
    gse_unique_combinations: combos.size,
    gse_unique_odus: odus.size,
    gse_unique_idus: idus.size,
    gse_rows_per_identity: +(gse.meta.iiia_rows / gse.entries.length).toFixed(2),
    canonical_with_odu_field: canonList.filter(x => compact(x.c.outdoor_unit_model ?? '').length >= 6).length,
    canonical_with_idu_field: canonList.filter(x => x.hasIdu).length,
    one_product_multiple_gse_combos: dedupe(results.baseline).superseded.length,
    confirmed_odus_shared_by_products: [...byOdu.values()].filter(v => v.length > 1).length,
  };
}

/* ── 9. Conflict guard audit (all modes) ─────────────────────────────────── */
function conflictAudit(mode) {
  const rows = results[mode].filter(({ r }) => r.state === 'conflict');
  const byGuard = {};
  for (const { z, r } of rows) {
    for (const c of r.conflicts) {
      const g = c.split(':')[0];
      (byGuard[g] ??= []).push({ key: z.gse_entry_key, gse: z.model, canonical: r.target.model, detail: c });
    }
  }
  return Object.fromEntries(Object.entries(byGuard).map(([g, v]) => [g, { count: v.length, rows: v }]));
}

/* ── 10. Improvement delta: what do the new rules change, exactly? ───────── */
function delta(fromMode, toMode) {
  const fromKept = new Set([...dedupe(results[fromMode]).kept.values()].map(x => x.z.gse_entry_key));
  const toDedup = dedupe(results[toMode]);
  const added = [...toDedup.kept.values()].filter(x => !fromKept.has(x.z.gse_entry_key));
  const toKeys = new Set([...toDedup.kept.values()].map(x => x.z.gse_entry_key));
  const removed = [...dedupe(results[fromMode]).kept.values()].filter(x => !toKeys.has(x.z.gse_entry_key));
  const fmt = x => ({
    gse_entry_key: x.z.gse_entry_key, brand: x.z.brand, gse_model: x.z.model,
    odu: x.z.odu_id, idu: x.z.idu_id, kw: gseKws(x.z),
    method: x.r.method, canonical_id: String(x.r.target.bafa_id),
    canonical_mfr: x.r.target.manufacturer, canonical_model: x.r.target.model,
    canonical_kw: ratedCapacityKw(x.r.target),
  });
  return { added: added.map(fmt), removed: removed.map(fmt) };
}

/* ── Write everything ────────────────────────────────────────────────────── */
const write = (name, obj) => {
  fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(obj, null, 1));
  console.log(`wrote audit/${SNAPSHOT}/${name}`);
};

write('baseline.json', baseline);
write('canonical-coverage.json', canonicalCoverage());

const scopeTable = {};
for (const { z, r } of results.baseline) {
  const cls = classOf(z);
  const t = (scopeTable[cls] ??= { gse_identities: 0, confirmed: 0, candidates: 0, conflicts: 0, unmatched: 0 });
  t.gse_identities++;
  if (r.state === 'confirmed') t.confirmed++;
  else if (r.state === 'review') t.candidates++;
  else if (r.state === 'conflict') t.conflicts++;
  else t.unmatched++;
}
for (const [cls, t] of Object.entries(scopeTable)) {
  t.canonical_family = CLASS_TO_CANONICAL_FAMILY[cls];
  t.canonical_comparable = canonicalByFamily[CLASS_TO_CANONICAL_FAMILY[cls]] ?? 0;
  t.in_current_scope = IN_SCOPE_CLASSES.includes(cls);
}
const inScope = gse.entries.filter(z => IN_SCOPE_CLASSES.includes(classOf(z)));
write('scope.json', {
  classes: scopeTable,
  canonical_by_family: canonicalByFamily,
  in_scope_identities: inScope.length,
  out_of_scope_identities: gse.entries.length - inScope.length,
});

const funnels = Object.fromEntries(Object.entries(MODES).map(([m]) => {
  const f = funnelFor(m);
  return [m, { confirmedProducts: f.confirmedProducts, supersededCombos: f.supersededCombos, reasons: f.reasons }];
}));
write('funnel.json', funnels);
write('funnel-by-class.json', funnelFor('baseline').byClassReason);
write('manufacturers-baseline.json', manufacturerTable('baseline').slice(0, 60));
write('manufacturers-improved.json', manufacturerTable('improved').slice(0, 60));
write('odu-only.json', oduOnlyAudit());

/* Component-tier candidate detail (NOT public status — future evidence/xref
   work: an exact same-brand ODU relationship whose complete system is
   unresolved). Every row carries the canonical candidates so a human or an
   official manufacturer cross-reference can settle it. */
{
  const { kept } = dedupe(results.baseline);
  const confirmedKeys = new Set([...kept.values()].map(x => x.z.gse_entry_key));
  const rows = [];
  for (const z of gse.entries) {
    if (confirmedKeys.has(z.gse_entry_key)) continue;
    const odu = compact(z.odu_id ?? '');
    if (odu.length < 6) continue;
    const cands = canonList.filter(x => x.hay.includes(odu) && mfrConsistentTokens(z.brand, x.mfr));
    if (!cands.length) continue;
    rows.push({
      gse_entry_key: z.gse_entry_key, brand: z.brand, gse_model: z.model,
      odu: z.odu_id, idu: z.idu_id, kw: gseKws(z),
      candidates: cands.slice(0, 6).map(x => ({
        canonical_id: String(x.c.bafa_id), model: x.c.model,
        odu: x.c.outdoor_unit_model ?? x.c.outdoor_side_display_model ?? null,
        idu: x.c.idu_model ?? null, kw: ratedCapacityKw(x.c),
        conflicts: conflicts(z, x.c),
      })),
    });
  }
  write('component-candidates.json', { count: rows.length, rows });
}
write('granularity.json', granularity());
write('conflicts.json', Object.fromEntries(Object.entries(MODES).map(([m]) => [m, conflictAudit(m)])));
write('delta-brand.json', delta('baseline', 'brand'));
write('delta-plus.json', delta('baseline', 'plus'));
write('delta-improved.json', delta('baseline', 'improved'));

/* Scope-adjusted rates */
const inScopeKeys = new Set(inScope.map(z => z.gse_entry_key));
const rates = {};
for (const [m] of Object.entries(MODES)) {
  const { kept, superseded } = dedupe(results[m]);
  const confirmedEntryKeys = new Set([...[...kept.values()].map(x => x.z.gse_entry_key), ...superseded.map(x => x.z.gse_entry_key)]);
  const inScopeConfirmed = [...confirmedEntryKeys].filter(k => inScopeKeys.has(k)).length;
  rates[m] = {
    confirmed_products: kept.size,
    confirmed_gse_combinations: confirmedEntryKeys.size,
    raw_rate_vs_identities_pct: pct(confirmedEntryKeys.size, gse.entries.length),
    raw_rate_vs_canonical_pct: pct(kept.size, canonical.length),
    scope_adjusted_rate_pct: pct(inScopeConfirmed, inScope.length),
  };
}
write('rates.json', rates);

console.log('\n── Headline ──');
console.log(JSON.stringify({ scope: { in: inScope.length, out: gse.entries.length - inScope.length }, rates }, null, 1));
