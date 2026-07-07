/**
 * match-bafa-to-eprel.mjs  v1.0  (DE EPREL registration matching)
 *
 * Matches BAFA master-seed products against the EPREL space-heater heat pump
 * registry to attach official EPREL registration numbers.
 *
 * DE policy: BAFA is the authoritative performance source for the German
 * market — EPREL matching provides the LABEL REGISTRATION LINK ONLY
 * (eprel_registration_number). No performance values are copied or
 * overwritten; energy-label classes stay derived from BAFA ηs per EU 811/2013
 * (the data sheet's honesty note is unchanged).
 *
 * Inputs (newest snapshots auto-selected; --seed= / --eprel= override):
 *   data_sources/bafa/master_seed/YYYY-MM/bafa-master-seed.json
 *   data_sources/eprel_raw/raw/YYYY-MM/spaceheaters-heatpump/page-*.json
 *   scraper/pricing/manufacturer-short-names.json  (brand gate)
 *
 * Output: data_sources/bafa/matching/<seed-snapshot>/bafa-eprel-matches.json
 *   (gitignored, like all snapshot data)
 *
 * Matching policy — conservative, unambiguous-only (same family as the GB
 * matchers in scripts/ofgem/): brand-gated token-sequence matching only
 * (exact or contiguous subsequence), never plain substring; multi-candidate
 * accepted only with identical label values (latest registration kept).
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

const seedArg = process.argv.find(a => a.startsWith('--seed='))?.split('=')[1] ?? null;
const eprelArg = process.argv.find(a => a.startsWith('--eprel='))?.split('=')[1] ?? null;
const SEED_SNAPSHOT = seedArg ?? newestSnapshot('data_sources/bafa/master_seed');
const EPREL_SNAPSHOT = eprelArg ?? newestSnapshot('data_sources/eprel_raw/raw');
if (!SEED_SNAPSHOT || !EPREL_SNAPSHOT) { console.error('Missing seed or EPREL snapshot.'); process.exit(1); }
console.log(`BAFA seed snapshot: ${SEED_SNAPSHOT} | EPREL snapshot: ${EPREL_SNAPSHOT}`);

const seed = loadJSON(`data_sources/bafa/master_seed/${SEED_SNAPSHOT}/bafa-master-seed.json`);
const deShort = new Map(Object.entries(loadJSON('scraper/pricing/manufacturer-short-names.json').mapping));

const tokens = s => (s ?? '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
const tokenKey = s => tokens(s).join(' ');

/** Label-value signature used only for the multi-candidate identity rule. */
function valueSig(r) {
  return JSON.stringify([
    r.seasonalSpaceHeatingEnergyEfficiency ?? null,
    r.seasonalSpaceHeatingEnergyEfficiencyAverage55 ?? null,
    r.ratedHeatOutputAverage35 ?? null,
    r.outdoorNoise ?? null,
  ]);
}

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
      sig: valueSig(r),
    });
  }
}
console.log(`EPREL heat pump registrations loaded: ${eprel.length}`);

// ── Brand gate: index EPREL records per DE short name ────────────────────────

const shorts = [...new Set([...deShort.values()])];
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

function accept(p, hits, matchType) {
  if (hits.length > 1 && new Set(hits.map(h => h.sig)).size > 1) return false;
  const c = hits.reduce((a, b) => (Number(b.reg) > Number(a.reg) ? b : a));
  stats[matchType]++;
  const brandKey = (deShort.get(p.manufacturer_normalized) ?? '').toUpperCase();
  byBrandMatched[brandKey] = (byBrandMatched[brandKey] ?? 0) + 1;
  matches.push({
    bafa_id: String(p.bafa_id),
    bafa_model: p.model,
    bafa_manufacturer: p.manufacturer,
    brand_key: brandKey,
    eprel_registration_number: String(c.reg),
    eprel_model: c.model,
    eprel_supplier: c.supplier,
    match_type: matchType,
    candidates: hits.length,
  });
  return true;
}

for (const p of seed.items) {
  const brandKey = (deShort.get(p.manufacturer_normalized) ?? '').toUpperCase();
  const cands = brandIndex.get(brandKey) ?? [];
  if (cands.length === 0) { stats.brand_not_in_eprel++; continue; }

  const gtk = tokens(p.model);
  const gkey = tokenKey(p.model);

  let hits = cands.filter(c => c.key === gkey);
  if (hits.length > 0) {
    if (accept(p, hits, 'exact_model')) continue;
    stats.ambiguous++; continue;
  }

  hits = cands.filter(c =>
    (containable(gtk) && isContiguousSubseq(gtk, c.tk)) ||
    (containable(c.tk) && isContiguousSubseq(c.tk, gtk))
  );
  if (hits.length > 0) {
    if (accept(p, hits, 'token_subsequence')) continue;
    stats.ambiguous++; continue;
  }

  stats.no_model_match++;
}

const byId = new Map(matches.map(m => [m.bafa_id, m]));

// ── Write output ──────────────────────────────────────────────────────────────

const outDir = resolve(ROOT, `data_sources/bafa/matching/${SEED_SNAPSHOT}`);
mkdirSync(outDir, { recursive: true });
const payload = {
  _meta: {
    generated: new Date().toISOString(),
    generator: 'match-bafa-to-eprel.mjs v1.0',
    bafa_seed_snapshot: SEED_SNAPSHOT,
    eprel_snapshot: EPREL_SNAPSHOT,
    policy: 'Brand-gated (DE short-name token sequence in EPREL supplier/organisation tokens) + exact token '
      + 'sequence or contiguous token subsequence. Multi-candidate accepted only with identical label values '
      + '(latest registration kept). No plain substring matching.',
    semantics: 'Registration link ONLY — no performance values are copied; BAFA stays the authoritative DE '
      + 'performance source and label classes stay derived from BAFA ηs per EU 811/2013.',
    eprel_records_total: eprel.length,
    bafa_seed_products: seed.items.length,
    unique_matches: byId.size,
    stats,
    matched_by_brand: Object.fromEntries(Object.entries(byBrandMatched).sort((a, b) => b[1] - a[1])),
  },
  matches: [...byId.values()],
};
writeFileSync(resolve(outDir, 'bafa-eprel-matches.json'), JSON.stringify(payload, null, 2));

console.log('');
console.log('── Match summary (BAFA ↔ EPREL) ───────────────────────────');
console.log(`BAFA seed products:      ${seed.items.length}`);
console.log(`Matched (unique):        ${byId.size}  (exact: ${stats.exact_model}, token_subsequence: ${stats.token_subsequence})`);
console.log(`Ambiguous (rejected):    ${stats.ambiguous}`);
console.log(`No model match:          ${stats.no_model_match}`);
console.log(`Brand not on EPREL:      ${stats.brand_not_in_eprel}`);
console.log(`Top matched brands:      ${Object.entries(byBrandMatched).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([b, n]) => `${b}:${n}`).join(', ')}`);
console.log(`→ data_sources/bafa/matching/${SEED_SNAPSHOT}/bafa-eprel-matches.json`);
console.log('──────────────────────────────────────────────────────────');
