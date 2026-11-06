/**
 * Pure rules for the Heatpump Finder export (owner decisions 2026-11-06).
 * No file access here, so tests/finder-export.unit.mjs can pin every rule.
 */
import { impossibleFields, inconsistentFields } from '../../src/shared/plausibility.mjs';
import ALIASES from './brand-aliases.json' with { type: 'json' };
import RECOGNITION from './brand-recognition.json' with { type: 'json' };
import SAME_PRODUCTS from './same-products.json' with { type: 'json' };

export const num = (v) => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const positive = (v) => { const n = num(v); return n != null && n > 0 ? n : null; };

/** EU relation, the same one src/shared/plausibility.mjs checks. One decimal so eta cannot be read back. */
export const scopFromEta = (eta) => (eta == null ? null : Math.round(25 * (eta + 3) / 100) / 10);

const LOW_TEMP = [[175, 'A+++'], [150, 'A++'], [123, 'A+'], [115, 'A'], [107, 'B'], [100, 'C'], [61, 'D']];
const MED_TEMP = [[150, 'A+++'], [125, 'A++'], [98, 'A+'], [90, 'A'], [82, 'B'], [75, 'C'], [36, 'D']];
const classOf = (table, eta) => (eta == null ? null : (table.find(([min]) => eta >= min)?.[1] ?? null));
export const energyClass35 = (eta) => classOf(LOW_TEMP, eta);
export const energyClass55 = (eta) => classOf(MED_TEMP, eta);

// Same bands the Finder used on dB values. The public file carries only the grade.
const NOISE_CEILINGS = [52, 56, 60, 64];
export function noiseStarsFromDb(db) {
  const v = positive(db);
  if (v == null || v < 30) return null;
  const i = NOISE_CEILINGS.findIndex((c) => v <= c);
  return i === -1 ? 1 : 5 - i;
}

export const normModel = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
/** A supplier sometimes repeats its brand in the model name ("KWB EasyAir Plus 24"). The record is still the same model. */
export const modelWithoutBrand = (model, brand) => {
  const m = normModel(model), b = normBrand(stripForBrand(brand)).toUpperCase();
  return b.length >= 3 && m.startsWith(b) && m.length > b.length ? m.slice(b.length) : m;
};
const stripForBrand = (s) => String(s ?? '').trim().split(/\s+/)[0];

const LEGAL = /\b(gmbh|co|kg|ag|se|spa|s\.p\.a|ltd|limited|sas|bv|srl|sa|inc|llc|corporation|corp|group|brand|climate|solutions|werke|deutschland|france|europe|heating|hvac|products|electronics|electric)\b/g;
export const normBrand = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(LEGAL, ' ').replace(/[^a-z0-9]/g, '');

// Legal forms say nothing about the brand and never belong on a consumer screen.
const COMPANY_FORM = /[\s,.]*\b(gmbh(\s*&\s*co\.?\s*kg)?|ug|kg|d\.o\.o\.?|s\.r\.o\.?|a\.s\.?|sp\.?\s*z\s*o\.?\s*o\.?(\s*sp\.?\s*k\.?)?|s\.?p\.?a\.?|s\.?a\.?s?|ab|a\/s|b\.?v\.?|s\.?r\.?l\.?|ltd\.?|limited|inc\.?|llc|co\.?,?\s*ltd\.?|corp\.?|corporation)\b\.?[\s,.]*$/i;
export const stripCompanyForm = (s) => {
  let out = String(s ?? '').trim();
  for (let prev = ''; prev !== out; ) { prev = out; out = out.replace(COMPANY_FORM, '').trim(); }
  return out || String(s ?? '').trim();
};

const aliasTo = new Map();
for (const [name, variants] of Object.entries(ALIASES.aliases)) for (const v of [name, ...variants]) aliasTo.set(normBrand(stripCompanyForm(v)), name);
/** The identity a brand is counted under. Same value means the same company on screen. */
export const brandId = (s) => {
  const k = normBrand(stripCompanyForm(s));
  if (aliasTo.has(k)) return normBrand(aliasTo.get(k));
  // normBrand drops generic words, so a name made only of them keeps its own spelling.
  return k || String(s ?? '').trim().toLowerCase();
};

/**
 * One display name per brand: the alias table's name, or else the commonest spelling without a legal form.
 * Spellings from the catalogue win over EPREL's supplier names. Returns a function from any spelling to the display name.
 */
export function brandNamer(entries) {
  const counts = new Map();
  for (const { brand, catalogue } of entries) {
    const id = brandId(brand);
    const g = counts.get(id) ?? counts.set(id, new Map()).get(id);
    const name = stripCompanyForm(brand);
    const c = g.get(name) ?? { catalogue: 0, all: 0 };
    c.all++;
    if (catalogue) c.catalogue++;
    g.set(name, c);
  }
  const names = new Map();
  for (const [id, g] of counts) {
    const best = [...g].sort(([a, x], [b, y]) => y.catalogue - x.catalogue || y.all - x.all || a.localeCompare(b, 'en'))[0][0];
    const k = normBrand(stripCompanyForm(best));
    names.set(id, aliasTo.get(k) ?? best);
  }
  return (brand) => names.get(brandId(brand)) ?? stripCompanyForm(brand);
}

/** The name people know in this country, where it differs from the catalogue's. */
export const displayBrand = (cc, brand) => ALIASES.displayNames?.[cc]?.[brand] ?? brand;

/** Stars 1-5 for how well a brand is known in this country. Null where no map exists, so the brand mix stays neutral there. */
export function brandStarsFor(cc, brand) {
  const m = RECOGNITION.markets[cc];
  if (!m) return null;
  const known = RECOGNITION.alsoKnownAs?.[cc]?.[brand] ?? brand;
  const id = brandId(known);
  for (const [tier, stars] of [['A', 5], ['B', 4], ['C', 3], ['D', 2]]) if (m[tier].some((b) => brandId(b.brand) === id)) return stars;
  return 1;
}

// EPREL has no heat-source field and ground-source units also declare outdoor noise, so model names are the only signal.
const GROUND_SOURCE = /SOL\s*\/\s*EAU|EAU\s*\/\s*EAU|\bGEO\b|GEO[ -]|BRINE|\bWW\b|\bW\/W\b|\bS\/W\b|WASSER\/WASSER|TERRA SW|GLYCOL|\bWPF\b|N\dWP|N\dGP|GEOTHERM/i;
export const looksGroundSource = (model) => GROUND_SOURCE.test(String(model ?? ''));

/** A bare article number tells a household nothing, and an installer cannot be asked about it. */
export const numberOnlyModel = (model) => /^[\d\s.\-]+$/.test(String(model ?? '').trim());

/** The group a card belongs to, read from its name or any model it folds in. Null when it has none. */
export function sameProductGroup(card) {
  const id = brandId(card.manufacturer);
  const names = [card.model, ...(card.variantModels ?? [])].map(normModel);
  const matches = (m, how) => names.some((n) => (how === 'outdoor' ? n.includes(normModel(m)) : n === normModel(m)));
  return SAME_PRODUCTS.groups.find((g) => g.members.some(([b, m, how]) => brandId(b) === id && matches(m, how)))?.id ?? null;
}

/** Suppliers often append an article number ("Cosy 6 / 0101200004060"). Either form names the model. */
export const modelNameForms = (model) => [normModel(model), normModel(String(model ?? '').split(' / ')[0])].filter((m) => m.length >= 5);

export const sameBrand = (a, b) => {
  const x = normBrand(a), y = normBrand(b);
  if (!x || !y) return false;
  return x === y || brandId(a) === brandId(b) || (x.length >= 4 && y.includes(x)) || (y.length >= 4 && x.includes(y));
};

/** Only an explicit exclusion removes a model. No signal keeps it: 93% of EPREL says "all countries", which proves little. */
export function excludedFromMarket(eprel, eprelCode) {
  if (!eprel || !eprelCode) return false;
  const a = eprel.availabilityInEUEEACountries;
  if (a === 'NONE') return true;
  if (a !== 'AS_SPECIFIED') return false;
  return !(eprel.modelAvailabilityInEUEEACountries ?? []).includes(eprelCode === 'GR' ? 'EL' : eprelCode);
}

const CLIMATE_FIELDS = {
  cold: { eta35: 'seasonalSpaceHeatingEnergyEfficiencyCold35', eta55: 'seasonalSpaceHeatingEnergyEfficiencyCold55', kw35: 'ratedHeatOutputCold35', kw55: 'ratedHeatOutputCold55' },
  warm: { eta35: 'seasonalSpaceHeatingEnergyEfficiencyWarm35', eta55: 'seasonalSpaceHeatingEnergyEfficiencyWarm55', kw35: 'ratedHeatOutputWarm35', kw55: 'ratedHeatOutputWarm55' },
  average: { eta35: 'seasonalSpaceHeatingEnergyEfficiencyAverage35', eta55: 'seasonalSpaceHeatingEnergyEfficiencyAverage55', kw35: 'ratedHeatOutputAverage35', kw55: 'ratedHeatOutputAverage55' },
};
const ETA_MIN = 36, ETA_MAX = 400;
const saneEta = (v) => { const n = positive(v); return n != null && n >= ETA_MIN && n <= ETA_MAX ? n : null; };

/** Canonical values are never overwritten at the average climate. EPREL supplies only the cold/warm columns. */
export function climateValues(base, eprel, climate) {
  if (climate !== 'average' && eprel) {
    const f = CLIMATE_FIELDS[climate];
    const eta35 = saneEta(eprel[f.eta35]), eta55 = saneEta(eprel[f.eta55]);
    if (eta35 != null || eta55 != null) {
      return { eta35, eta55, kw35: positive(eprel[f.kw35]) ?? base.kw35, kw55: positive(eprel[f.kw55]) ?? base.kw55, basis: climate };
    }
  }
  return { ...base, basis: 'average' };
}

export function canonicalBase(p) {
  return {
    eta35: saneEta(p.efficiency_35C_percent),
    eta55: saneEta(p.efficiency_55C_percent),
    kw35: positive(p.power_35C_kw) ?? positive(p.power_design_35C_kw),
    kw55: positive(p.power_55C_kw) ?? positive(p.power_design_55C_kw),
  };
}
export function eprelBase(x) {
  const f = CLIMATE_FIELDS.average;
  return { eta35: saneEta(x[f.eta35]), eta55: saneEta(x[f.eta55]), kw35: positive(x[f.kw35]), kw55: positive(x[f.kw55]) };
}

/** A model in the catalogue must have an identity, a seasonal efficiency and a capacity at or below the residential limit. */
export function publishable({ manufacturer, model, values }) {
  if (!String(manufacturer ?? '').trim() || !String(model ?? '').trim()) return false;
  if (values.eta35 == null && values.eta55 == null) return false;
  const kw = values.kw35 ?? values.kw55;
  return kw != null && kw <= 23;
}

/** Owner decision 2026-11-06: a SCOP this high is not credible for an air-to-water unit. The source value is not corrected; the model is left out. */
export const MAX_CREDIBLE_SCOP = 6.5;
export const incredibleScop = ({ eta35, eta55 }) => [eta35, eta55].some((eta) => eta != null && scopFromEta(eta) >= MAX_CREDIBLE_SCOP);

export function failsPlausibility(p) {
  return impossibleFields(p).some((f) => f.startsWith('cop_')) || inconsistentFields(p).length > 0;
}

/**
 * Funding state. A failed match is never "not listed": only the market that owns
 * its list (DE) can report a model as off the list, and only for a model it once carried.
 */
export function fundingState({ list, status, listedDe, onLocalListRecord }) {
  if (list === 'owned') {
    if (listedDe === 'listed_in_snapshot') return 'listed';
    if (listedDe === 'delisted') return 'delisted';
    return 'verify';
  }
  if (list === 'overlay') {
    if (status === 'confirmed' || onLocalListRecord) return 'listed';
    return 'verify';
  }
  return null;
}
/** A market without a usable list shows "listed" where confirmed and says nothing otherwise. */
export const displayFunding = (state, inRanking) => (inRanking ? state : state === 'listed' ? 'listed' : null);

const FUNDING_ORDER = { listed: 3, verify: 2, delisted: 1 };
const SOURCE_ORDER = { reference: 3, registry: 2, eprel: 1 };

export const seriesKey = (m) => [normBrand(m.manufacturer), m.ratedKw35, m.ratedKw55, m.scop35, m.scop55, m.noiseStars, m.refrigerant].join('|');

/** Same brand and same performance becomes one card. This also folds 1-phase/3-phase twins and indoor-unit combinations. */
export function groupSeries(models, maxNames = 12) {
  const groups = new Map();
  for (const m of models) {
    const k = seriesKey(m);
    const g = groups.get(k);
    if (!g) { groups.set(k, { ...m, _names: new Set([m.model]) }); continue; }
    g._names.add(m.model);
    if ((SOURCE_ORDER[m.source] ?? 0) > (SOURCE_ORDER[g.source] ?? 0)) {
      Object.assign(g, { model: m.model, source: m.source, sourceName: m.sourceName, sourceSnapshotDate: m.sourceSnapshotDate, id: m.id, manufacturer: m.manufacturer });
    }
    if ((FUNDING_ORDER[m.funding] ?? 0) > (FUNDING_ORDER[g.funding] ?? 0)) g.funding = m.funding;
    if (!g.manufacturerUrl && m.manufacturerUrl) g.manufacturerUrl = m.manufacturerUrl;
    if (m.climateBasis !== 'average') g.climateBasis = m.climateBasis;
  }
  return [...groups.values()].map(({ _names, ...g }) => {
    const names = [..._names].sort((a, b) => a.length - b.length || a.localeCompare(b, 'en'));
    return { ...g, variantCount: names.length, variantModels: names.slice(0, maxNames) };
  });
}
