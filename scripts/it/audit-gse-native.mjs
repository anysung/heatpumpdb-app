/**
 * audit-gse-native.mjs — pre-implementation profile of the Italy GSE-primary
 * product layer (2026-07 owner decision: the Italian edition adds an
 * Italy-only catalogue layer built FROM the in-scope GSE entries that have no
 * canonical counterpart, alongside the European reference catalogue).
 *
 * Answers, before any builder code is written:
 *   - how many in-scope GSE identities are candidates (not confirmed, not in
 *     the review queue, not conflicted)?
 *   - how do they split across component shapes (split combo / monobloc /
 *     model-only) and families?
 *   - how many pass each publication tier?
 *   - residential/commercial split and 23 kW boundary ambiguity;
 *   - trade-name duplicate (rebadge) inflation risk;
 *   - brand-new brands the Italian site would gain.
 *
 * Output: data_sources/gse_ct/audit/YYYY-MM/gse-native-profile.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compact, gseFamily, gseKws, mfrConsistentTokens } from './gse-match-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SNAPSHOT = (process.argv.find(a => a.startsWith('--snapshot=')) ?? '').split('=')[1]
  || fs.readdirSync(path.join(ROOT, 'data_sources/gse_ct/parsed')).filter(d => /^\d{4}-\d{2}$/.test(d)).sort().pop();
const OUT_DIR = path.join(ROOT, 'data_sources/gse_ct/audit', SNAPSHOT);

const loadJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const gse = loadJson(path.join(ROOT, 'data_sources/gse_ct/parsed', SNAPSHOT, 'gse-normalized.json'));
const overlayF = loadJson(path.join(ROOT, 'data_sources/gse_ct/matching', SNAPSHOT, 'canonical-gse-overlay.json'));
const reviewF = loadJson(path.join(ROOT, 'data_sources/gse_ct/matching', SNAPSHOT, 'canonical-gse-review.json'));
const canonical = [
  ...loadJson(path.join(ROOT, 'public/data/products.json')).items,
  ...loadJson(path.join(ROOT, 'public/data/products-commercial.json')).items,
];

/* Keys that already have a canonical relationship (must NOT become native
   products — they are either published canonical products or ambiguity rows). */
const confirmedKeys = new Set(Object.values(overlayF.overlay).map(o => o.gse_entry_key).filter(Boolean));
const reviewKeys = new Set(reviewF.review.map(r => r.gse_entry_key).filter(Boolean));

/* Scope: families the German taxonomy supports (air/water, ground incl.
   water/water); electric drive only. */
const IN_FAMILIES = new Set(['air_water', 'ground', 'water_water']);
const inScope = z => IN_FAMILIES.has(gseFamily(z.scambio)) && !/gas/i.test(z.funzionamento ?? '');

const shapeOf = z => {
  const odu = compact(z.odu_id ?? ''), idu = compact(z.idu_id ?? '');
  if (odu.length >= 6 && idu.length >= 6) return 'split_combo';
  if (odu.length >= 6) return 'monobloc_or_odu';
  if (idu.length >= 6) return 'idu_only';
  return 'model_only';
};

/* Publication-tier rule candidate (Italy GSE tier):
   identity (brand+model) + supported type + declared capacity + at least one
   of ηs/SCOP. Tiers grade the performance completeness. */
function tierOf(z) {
  if (!z.brand || !z.model) return 'excluded_no_identity';
  const kws = gseKws(z);
  const etas = z.ratings.some(r => r.etas != null);
  const scop = z.ratings.some(r => r.scop != null);
  if (!kws.length) return 'excluded_no_capacity';
  if (etas && scop) return 'T1_full';
  if (etas || scop) return 'T2_partial';
  return 'excluded_capacity_only';
}

const candidates = [];
const stats = {
  totals: { entries: gse.entries.length, in_scope: 0, confirmed_or_second: 0, review_blocked: 0, candidates: 0 },
  by_family: {}, by_shape: {}, by_tier: {},
  segment: { residential: 0, commercial: 0, boundary_ambiguous: 0 },
  rebadge_same_components_diff_model: 0,
  multi_rating_entries: 0,
};
const canonicalMfrs = new Set(canonical.map(c => c.manufacturer_normalized ?? c.manufacturer));
const newBrands = new Map();
const byComponents = new Map();

for (const z of gse.entries) {
  if (!inScope(z)) continue;
  stats.totals.in_scope++;
  if (confirmedKeys.has(z.gse_entry_key)) { stats.totals.confirmed_or_second++; continue; }
  if (reviewKeys.has(z.gse_entry_key)) { stats.totals.review_blocked++; continue; }
  const tier = tierOf(z);
  stats.by_tier[tier] = (stats.by_tier[tier] ?? 0) + 1;
  if (!tier.startsWith('T')) continue;
  stats.totals.candidates++;
  const fam = gseFamily(z.scambio);
  stats.by_family[fam] = (stats.by_family[fam] ?? 0) + 1;
  const shape = shapeOf(z);
  stats.by_shape[shape] = (stats.by_shape[shape] ?? 0) + 1;
  const kws = gseKws(z);
  const maxKw = Math.max(...kws), minKw = Math.min(...kws);
  if (maxKw > 23 && minKw <= 23) stats.segment.boundary_ambiguous++;
  (maxKw > 23 ? stats.segment.commercial++ : stats.segment.residential++);
  if (z.ratings.length > 1) stats.multi_rating_entries++;
  const brandHasCanonical = [...canonicalMfrs].some(m => mfrConsistentTokens(z.brand, m));
  if (!brandHasCanonical) newBrands.set(z.brand, (newBrands.get(z.brand) ?? 0) + 1);
  const compKey = `${compact(z.brand)}|${compact(z.odu_id)}|${compact(z.idu_id)}`;
  if (z.odu_id || z.idu_id) {
    if (byComponents.has(compKey)) stats.rebadge_same_components_diff_model++;
    else byComponents.set(compKey, z.gse_entry_key);
  }
  candidates.push(z.gse_entry_key);
}

const report = {
  snapshot: SNAPSHOT,
  generated_at: new Date().toISOString(),
  stats,
  unique_in_scope_candidate_odus: new Set(gse.entries.filter(z => candidates.includes(z.gse_entry_key)).map(z => compact(z.odu_id ?? '')).values()).size,
  new_brands_count: newBrands.size,
  new_brands_top: [...newBrands.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25),
};
fs.writeFileSync(path.join(OUT_DIR, 'gse-native-profile.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
