/**
 * match-pel-to-eprel.mjs  v1.0  (GB EPREL enrichment matching)
 *
 * Matches Ofgem PEL heat pump records against the EPREL space-heater heat pump
 * registry (EU energy label database) to attach official EPREL registration
 * numbers and label data (ηs, design output, sound power).
 *
 * Inputs (newest snapshots auto-selected; --pel= / --eprel= override):
 *   data_sources/ofgem_pel/parsed/YYYY-MM/pel-normalized.json
 *   data_sources/eprel_raw/raw/YYYY-MM/spaceheaters-heatpump/page-*.json
 *   scripts/ofgem/manufacturer-short-names-gb.json  (brand gate)
 *
 * Output: data_sources/ofgem_pel/matching/<pel-snapshot>/pel-eprel-matches.json
 *   (gitignored, like all snapshot data)
 *
 * Matching policy — conservative, unambiguous-only (same family as
 * match-pel-to-bafa.mjs):
 *   Brand gate: the GB short name's token sequence must appear in the EPREL
 *   supplierOrTrademark OR organisation name token sequence.
 *   1. exact_model        — identical model token sequences.
 *   2. token_subsequence  — one model's full token sequence appears as a
 *      CONTIGUOUS subsequence of the other's (contained side needs ≥2 tokens,
 *      or 1 token of length ≥6).
 *   Multiple candidates are accepted ONLY if their copied label values are
 *   identical (re-registrations of the same model); the highest (latest)
 *   registration number is kept. Otherwise the record stays unmatched.
 *
 * Copied values are official EU energy label data (Regulation (EU) 811/2013):
 *   ηs low/medium temp (average climate), design heat output, sound power.
 *   SCOP/COP are NOT published per test point on EPREL and are not derived.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

function loadJSON(relPath) {
  const abs = resolve(ROOT, relPath);
  try {
    return JSON.parse(readFileSync(abs, 'utf8'));
  } catch (err) {
    console.error(`Failed to load ${relPath}: ${err.message}`);
    process.exit(1);
  }
}

function newestSnapshot(relDir) {
  return readdirSync(resolve(ROOT, relDir)).filter(d => /^\d{4}-\d{2}$/.test(d)).sort().reverse()[0] ?? null;
}

const pelArg = process.argv.find(a => a.startsWith('--pel='))?.split('=')[1] ?? null;
const eprelArg = process.argv.find(a => a.startsWith('--eprel='))?.split('=')[1] ?? null;
const PEL_SNAPSHOT = pelArg ?? newestSnapshot('data_sources/ofgem_pel/parsed');
const EPREL_SNAPSHOT = eprelArg ?? newestSnapshot('data_sources/eprel_raw/raw');
if (!PEL_SNAPSHOT || !EPREL_SNAPSHOT) { console.error('Missing PEL or EPREL snapshot.'); process.exit(1); }
console.log(`PEL snapshot: ${PEL_SNAPSHOT} | EPREL snapshot: ${EPREL_SNAPSHOT}`);

const pel = loadJSON(`data_sources/ofgem_pel/parsed/${PEL_SNAPSHOT}/pel-normalized.json`)
  .filter(r => ['ASHP', 'WSHP', 'EAHP'].includes(r.technology_type));
const gbShort = new Map(Object.entries(loadJSON('scripts/ofgem/manufacturer-short-names-gb.json').mapping));

const tokens = s => (s ?? '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
const tokenKey = s => tokens(s).join(' ');

/** Label values copied from a matched EPREL registration. */
function labelValuesOf(r) {
  const num = v => (typeof v === 'number' && isFinite(v) && v > 0 ? v : null);
  return {
    efficiency_35C_percent: num(r.seasonalSpaceHeatingEnergyEfficiency),
    efficiency_55C_percent: num(r.seasonalSpaceHeatingEnergyEfficiencyAverage55),
    power_design_35C_kw: num(r.ratedHeatOutputAverage35),
    power_design_55C_kw: num(r.mediumTempRatedHeatOutputAverage),
    noise_outdoor_dB: num(r.outdoorNoise),
    noise_indoor_dB: num(r.noise),
  };
}
const valueSig = r => JSON.stringify(labelValuesOf(r));

function isContiguousSubseq(short, long) {
  if (short.length === 0 || short.length > long.length) return false;
  outer: for (let i = 0; i <= long.length - short.length; i++) {
    for (let j = 0; j < short.length; j++) {
      if (long[i + j] !== short[j]) continue outer;
    }
    return true;
  }
  return false;
}

const containable = tk => tk.length >= 2 || (tk.length === 1 && tk[0].length >= 6);

// ── Load EPREL pages (slim projection) ───────────────────────────────────────

const eprelDir = resolve(ROOT, `data_sources/eprel_raw/raw/${EPREL_SNAPSHOT}/spaceheaters-heatpump`);
const eprel = [];
for (const f of readdirSync(eprelDir)) {
  if (!f.startsWith('page-') || !f.endsWith('.json')) continue;
  const d = JSON.parse(readFileSync(resolve(eprelDir, f), 'utf8'));
  for (const r of d.hits ?? []) {
    if (r.status && r.status !== 'PUBLISHED') continue;
    eprel.push({
      reg: r.eprelRegistrationNumber,
      model: r.modelIdentifier,
      supplier: r.supplierOrTrademark,
      org: r.organisation?.organisationName ?? null,
      values: labelValuesOf(r),
      sig: valueSig(r),
    });
  }
}
console.log(`EPREL heat pump registrations loaded: ${eprel.length}`);

// ── Brand gate: index EPREL records per GB short name ────────────────────────

const shorts = [...new Set([...gbShort.values()])];
const brandIndex = new Map(shorts.map(s => [s.toUpperCase(), []]));
for (const r of eprel) {
  const st = tokens(r.supplier), ot = tokens(r.org);
  for (const s of shorts) {
    const sk = tokens(s);
    if (isContiguousSubseq(sk, st) || isContiguousSubseq(sk, ot)) {
      brandIndex.get(s.toUpperCase()).push({ ...r, tk: tokens(r.model), key: tokenKey(r.model) });
    }
  }
}

// ── Match ─────────────────────────────────────────────────────────────────────

const matches = [];
const stats = { exact_model: 0, token_subsequence: 0, ambiguous: 0, no_model_match: 0, brand_not_in_eprel: 0 };
const byBrandMatched = {};

function accept(g, hits, matchType) {
  // Multiple candidates OK only when their copied label values are identical
  // (re-registrations); keep the highest (latest) registration number.
  if (hits.length > 1 && new Set(hits.map(h => h.sig)).size > 1) return false;
  const c = hits.reduce((a, b) => (Number(b.reg) > Number(a.reg) ? b : a));
  stats[matchType]++;
  const brandKey = (gbShort.get(g.brand) ?? '').toUpperCase();
  byBrandMatched[brandKey] = (byBrandMatched[brandKey] ?? 0) + 1;
  matches.push({
    match_key: `${g.mcs_number}||${g.model}`,
    mcs_number: g.mcs_number,
    pel_model: g.model,
    pel_brand: g.brand,
    brand_key: brandKey,
    eprel_registration_number: String(c.reg),
    eprel_model: c.model,
    eprel_supplier: c.supplier,
    match_type: matchType,
    candidates: hits.length,
    values: c.values,
  });
  return true;
}

for (const g of pel) {
  const brandKey = (gbShort.get(g.brand) ?? '').toUpperCase();
  const cands = brandIndex.get(brandKey) ?? [];
  if (cands.length === 0) { stats.brand_not_in_eprel++; continue; }

  const gtk = tokens(g.model);
  const gkey = tokenKey(g.model);

  let hits = cands.filter(c => c.key === gkey);
  if (hits.length > 0) {
    if (accept(g, hits, 'exact_model')) continue;
    stats.ambiguous++; continue;
  }

  hits = cands.filter(c =>
    (containable(gtk) && isContiguousSubseq(gtk, c.tk)) ||
    (containable(c.tk) && isContiguousSubseq(c.tk, gtk))
  );
  if (hits.length > 0) {
    if (accept(g, hits, 'token_subsequence')) continue;
    stats.ambiguous++; continue;
  }

  stats.no_model_match++;
}

const byKey = new Map(matches.map(m => [m.match_key, m]));

// ── Write output ──────────────────────────────────────────────────────────────

const outDir = resolve(ROOT, `data_sources/ofgem_pel/matching/${PEL_SNAPSHOT}`);
mkdirSync(outDir, { recursive: true });
const payload = {
  _meta: {
    generated: new Date().toISOString(),
    generator: 'match-pel-to-eprel.mjs v1.0',
    pel_snapshot: PEL_SNAPSHOT,
    eprel_snapshot: EPREL_SNAPSHOT,
    policy: 'Brand-gated (GB short-name token sequence in EPREL supplier/organisation tokens) + exact token '
      + 'sequence or contiguous token subsequence. Multi-candidate accepted only with identical label values '
      + '(latest registration kept). No plain substring matching.',
    semantics: 'Copied values are official EU energy label data per Regulation (EU) 811/2013 (ηs, design heat '
      + 'output, sound power). SCOP/COP test-point values are not published on EPREL and are not derived.',
    eprel_records_total: eprel.length,
    pel_heat_pump_records: pel.length,
    unique_match_keys: byKey.size,
    stats,
    matched_by_brand: Object.fromEntries(Object.entries(byBrandMatched).sort((a, b) => b[1] - a[1])),
  },
  matches: [...byKey.values()],
};
writeFileSync(resolve(outDir, 'pel-eprel-matches.json'), JSON.stringify(payload, null, 2));

console.log('');
console.log('── Match summary (PEL ↔ EPREL) ────────────────────────────');
console.log(`PEL heat pump records:   ${pel.length}`);
console.log(`Matched (records):       ${stats.exact_model + stats.token_subsequence}  (exact: ${stats.exact_model}, token_subsequence: ${stats.token_subsequence})`);
console.log(`Unique match keys:       ${byKey.size}`);
console.log(`Ambiguous (rejected):    ${stats.ambiguous}`);
console.log(`No model match:          ${stats.no_model_match}`);
console.log(`Brand not on EPREL:      ${stats.brand_not_in_eprel}`);
console.log(`Top matched brands:      ${Object.entries(byBrandMatched).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([b, n]) => `${b}:${n}`).join(', ')}`);
console.log(`→ data_sources/ofgem_pel/matching/${PEL_SNAPSHOT}/pel-eprel-matches.json`);
console.log('──────────────────────────────────────────────────────────');
