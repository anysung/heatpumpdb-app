#!/usr/bin/env node
/**
 * Builds the Heatpump Finder datasets (DB repo -> Finder, one way).
 *
 *   node scripts/finder/export-consumer-dataset.mjs [--eprel-dir DIR] [--out DIR] [--markets de,it]
 *
 * Three layers: product (canonical, plus EPREL for models it does not have),
 * market + climate (EPREL), funding (the market's own list). The output is
 * refused unless every field is in scripts/finder/consumer-allowlist.json.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  canonicalBase, climateValues, displayFunding, energyClass35, energyClass55, eprelBase, excludedFromMarket,
  brandNamer, failsPlausibility, fundingState, groupSeries, noiseStarsFromDb, normBrand, normModel, publishable, sameBrand, scopFromEta,
} from './consumer-rules.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const arg = (name) => { const i = process.argv.indexOf(name); return i === -1 ? null : process.argv[i + 1]; };
const J = (f) => JSON.parse(readFileSync(f, 'utf8'));

const CONFIG = J(join(ROOT, 'scripts/finder/countries.json'));
const ALLOW = J(join(ROOT, 'scripts/finder/consumer-allowlist.json'));
const OUT = resolve(arg('--out') ?? join(ROOT, 'data_sources/finder_export'));
const wanted = arg('--markets')?.split(',') ?? Object.keys(CONFIG.markets);

function newestCompleteEprelDir() {
  const base = join(ROOT, 'data_sources/eprel_raw/raw');
  for (const s of readdirSync(base).filter((d) => /^\d{4}-\d{2}$/.test(d)).sort().reverse()) {
    const dir = join(base, s, 'spaceheaters-heatpump');
    if (!existsSync(join(dir, '_meta.json'))) continue;
    const m = J(join(dir, '_meta.json'));
    // Older snapshots wrote complete=true on row counts, so only uniqueRecords is proof.
    if (m.complete && Number.isFinite(m.uniqueRecords)) return dir;
  }
  throw new Error('No EPREL snapshot with verified distinct products. Pass --eprel-dir or wait for the next monthly crawl.');
}
const eprelDir = resolve(arg('--eprel-dir') ?? newestCompleteEprelDir());
const eprelAll = new Map();
for (const f of readdirSync(eprelDir).filter((n) => /^page-/.test(n))) for (const x of J(join(eprelDir, f)).hits ?? []) eprelAll.set(String(x.eprelRegistrationNumber), x);
const eprelDate = statSync(eprelDir).mtime.toISOString().slice(0, 10);
const eprelByName = new Map();
for (const x of eprelAll.values()) { const k = normModel(x.modelIdentifier); if (k.length >= 5) (eprelByName.get(k) ?? eprelByName.set(k, []).get(k)).push(x); }

const read = (file) => {
  const out = [];
  for (const f of [`${file}.json`, file.replace('products', 'products-commercial') + '.json']) out.push(...J(join(ROOT, 'public/data', f)).items);
  return out;
};
const isAirWater = (t) => /(luft\s*\/\s*wasser|air\s*\/\s*eau|air\s*\/\s*water|aria\s*\/\s*acqua|powietrze\s*\/\s*woda)/i.test(String(t ?? ''));
const https = (u) => (/^https?:\/\/[^\s]+\.[a-z]{2,}/i.test(String(u ?? '')) ? String(u).trim() : undefined);
const idOf = (brand, model) => createHash('sha1').update(`${normBrand(brand)}|${normModel(model)}`).digest('hex').slice(0, 14);
const refrigerantOf = (p) => { const m = String(p.refrigerant ?? '').toUpperCase().match(/R[\s-]?(\d{2,4}[A-Z]{0,2})/); return m ? `R${m[1]}` : null; };

/** The share of a local list's air/water entries that the Finder really carries as "listed". */
function registryCoverage(cc, rows, listedRows) {
  if (cc === 'it') {
    const entries = J(join(ROOT, `data_sources/gse_ct/parsed/${latest('gse_ct')}/gse-normalized.json`)).entries.filter((e) => /aria\s*\/\s*acqua/i.test(e.scambio ?? ''));
    const hit = new Set(listedRows.map((p) => p.gse_entry_key).filter(Boolean));
    return entries.filter((e) => hit.has(e.gse_entry_key)).length / entries.length;
  }
  if (cc === 'pl') {
    const entries = J(join(ROOT, `data_sources/lista_zum/parsed/${latest('lista_zum')}/zum-normalized.json`)).entries.filter((e) => e.category === 'PW');
    const hit = new Set(listedRows.map((p) => p.zum_id).filter(Boolean));
    return entries.filter((e) => hit.has(e.zum_id)).length / entries.length;
  }
  if (cc === 'gb') {
    const dir = latest('ofgem_pel');
    const entries = J(join(ROOT, `data_sources/ofgem_pel/parsed/${dir}/pel-normalized.json`)).filter((r) => r.technology_type === 'ASHP');
    const ov = J(join(ROOT, `data_sources/ofgem_pel/matching/${dir}/canonical-pel-overlay.json`)).overlay.filter((r) => r.status === 'confirmed');
    const ids = new Set(ov.flatMap((r) => [r.pel_source_id, ...(r.all_mcs_numbers ?? [])]));
    return entries.filter((r) => ids.has(r.source_id) || ids.has(r.mcs_number) || ids.has(r.mcs_number_base)).length / entries.length;
  }
  return cc === 'de' ? 1 : null;
}
function latest(src) { return readdirSync(join(ROOT, 'data_sources', src, 'parsed')).filter((d) => /^\d{4}-\d{2}$/.test(d)).sort().pop(); }

function assertAllowed(ds) {
  for (const k of Object.keys(ds)) if (!ALLOW.dataset.includes(k)) throw new Error(`dataset field not allowed: ${k}`);
  for (const m of ds.models) for (const k of Object.keys(m)) if (!ALLOW.model.includes(k)) throw new Error(`model field not allowed: ${k}`);
  const text = JSON.stringify(ds.models);
  if (ds.market !== 'de' && /BAFA/.test(text)) throw new Error(`"BAFA" outside the German market (${ds.market})`);
}

mkdirSync(OUT, { recursive: true });
const report = {};
for (const cc of wanted) {
  const mk = CONFIG.markets[cc];
  const rows = read(mk.file);
  const refName = cc === 'de' ? 'BAFA list' : 'European reference data';
  const dropped = { plausibility: 0, notPublishable: 0, notAirWater: 0, marketExclusion: 0 };
  const candidates = [];
  const usedRegs = new Set();
  const canonicalNames = new Map();
  const listedRows = [];

  for (const p of rows) {
    const native = ['GSE_CATALOGUE', 'ZUM_REGISTRY', 'ZUM_EPREL', 'EPREL'].includes(p.performance_source);
    if (!isAirWater(p.type)) { dropped.notAirWater++; continue; }
    if (failsPlausibility(p)) { dropped.plausibility++; continue; }
    let eprel = p.eprel_registration_number ? eprelAll.get(String(p.eprel_registration_number)) : null;
    if (eprel) usedRegs.add(String(eprel.eprelRegistrationNumber));
    const brand = p.manufacturer_short || p.manufacturer;
    if (!eprel) {
      // A unique exact name in the same brand is the same product. Anything looser stays unlinked.
      const same = (eprelByName.get(normModel(p.model)) ?? []).filter((x) => sameBrand(x.supplierOrTrademark, brand));
      if (new Set(same.map((x) => x.eprelRegistrationNumber)).size === 1) { eprel = same[0]; usedRegs.add(String(eprel.eprelRegistrationNumber)); }
    }
    (canonicalNames.get(normModel(p.model)) ?? canonicalNames.set(normModel(p.model), []).get(normModel(p.model))).push(brand);
    if (excludedFromMarket(eprel, mk.eprelCode)) { dropped.marketExclusion++; continue; }
    const values = climateValues(canonicalBase(p), eprel, mk.climate);
    // Coverage must count what the Finder can really show, so eta is needed but the capacity limit is not.
    const state = fundingState({ list: mk.fundingList, status: mk.statusField ? p[mk.statusField] : null, listedDe: p.bafa_listing_status });
    if (state === 'listed' && (values.eta35 != null || values.eta55 != null)) listedRows.push(p);
    if (!publishable({ manufacturer: brand, model: p.model, values })) { dropped.notPublishable++; continue; }
    candidates.push({ brand, model: p.model, values, noiseDb: p.noise_outdoor_dB, refrigerant: refrigerantOf(p), state, url: https(p.website) ?? https(eprel?.organisation?.website),
      source: native ? (p.performance_source === 'EPREL' || p.performance_source === 'ZUM_EPREL' ? 'eprel' : 'registry') : 'reference',
      sourceName: native ? (p.performance_source.includes('EPREL') ? 'EPREL (European Commission)' : cc === 'it' ? 'GSE catalogue' : 'Lista ZUM') : refName,
      sourceSnapshotDate: String(p.source_snapshot_generated_at ?? p.bafa_snapshot_fetched_at ?? p.zum_snapshot_fetched_at ?? p.gse_snapshot_fetched_at ?? eprelDate).slice(0, 10) });
  }

  // EPREL adds models the catalogue lacks. Without any market signal (GB) it adds nothing.
  if (mk.eprelCode) {
    for (const [reg, x] of eprelAll) {
      if (usedRegs.has(reg) || x.blocked || !(num0(x.outdoorNoise) > 0)) continue;
      if ((canonicalNames.get(normModel(x.modelIdentifier)) ?? []).some((b) => sameBrand(b, x.supplierOrTrademark))) continue;
      if (excludedFromMarket(x, mk.eprelCode)) { dropped.marketExclusion++; continue; }
      const values = climateValues(eprelBase(x), x, mk.climate);
      if (!publishable({ manufacturer: x.supplierOrTrademark, model: x.modelIdentifier, values })) { dropped.notPublishable++; continue; }
      candidates.push({ brand: x.supplierOrTrademark, model: x.modelIdentifier, values, noiseDb: x.outdoorNoise, refrigerant: null,
        state: fundingState({ list: mk.fundingList, status: null, listedDe: null }), url: https(x.organisation?.website), source: 'eprel', sourceName: 'EPREL (European Commission)', sourceSnapshotDate: eprelDate });
    }
  }

  // One spelling per brand on screen, preferring the catalogue's own short name.
  const nameOf = brandNamer(candidates.map((c) => ({ brand: c.brand, catalogue: c.source !== 'eprel' })));
  for (const c of candidates) c.brand = nameOf(c.brand);

  const coverage = mk.fundingList ? registryCoverage(cc, rows, listedRows) : null;
  const inRanking = mk.fundingRanking === true && coverage != null && coverage >= CONFIG.minFundingCoverage;
  const models = groupSeries(candidates.map((c) => ({
    id: idOf(c.brand, c.model), market: cc, manufacturer: c.brand, model: c.model, type: 'air-water',
    ratedKw35: c.values.kw35, ratedKw55: c.values.kw55 ?? null,
    scop35: scopFromEta(c.values.eta35), scop55: scopFromEta(c.values.eta55),
    energyClass35: energyClass35(c.values.eta35), energyClass55: energyClass55(c.values.eta55),
    refrigerant: c.refrigerant, noiseStars: noiseStarsFromDb(c.noiseDb), funding: displayFunding(c.state, inRanking),
    climateBasis: c.values.basis, source: c.source, sourceName: c.sourceName, sourceSnapshotDate: c.sourceSnapshotDate,
    ...(c.url ? { manufacturerUrl: c.url } : {}),
  })));
  const ds = { fixture: false, market: cc, fundingInRanking: inRanking, fundingCoverage: coverage == null ? null : Math.round(coverage * 1000) / 10, climate: mk.climate,
    generatedAt: new Date().toISOString(), attribution: 'Energy label data: EPREL, European Commission. Supplier-declared values.', models };
  assertAllowed(ds);
  writeFileSync(join(OUT, `models-${cc}.json`), JSON.stringify(ds));
  const by = (k) => models.reduce((c, m) => ((c[m[k]] = (c[m[k]] ?? 0) + 1), c), {});
  report[cc] = { candidates: candidates.length, cards: models.length, sizeMB: +(JSON.stringify(ds).length / 1e6).toFixed(1), coverage: ds.fundingCoverage, inRanking, funding: by('funding'), source: by('source'), basis: by('climateBasis'), dropped };
  console.log(cc, JSON.stringify(report[cc]));
}
writeFileSync(join(OUT, '_report.json'), JSON.stringify({ eprelDir, eprelProducts: eprelAll.size, report }, null, 2));

function num0(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
