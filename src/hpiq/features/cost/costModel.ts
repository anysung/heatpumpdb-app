/**
 * Running cost & CO₂ — the PURE model (Premium feature 6, owner-approved
 * 2026-09-29). No React, no app state, no country config: the page hands in the
 * record's numbers and the market defaults (src/config/energyDefaults.json), so
 * tests/cost-model.unit.mjs runs the real source.
 *
 *  · Heat-pump electricity = annual heat demand / SCOP.
 *  · SCOP by flow temperature, from the record:
 *      35 °C → `scop`; if it is missing or plausibility-flagged
 *              (src/shared/plausibility.mjs, category B: it contradicts ηs,35),
 *              SCOP = 2.5·(ηs,35 + 3)/100 (EU 811/2013 relation — 94 % of our
 *              records reproduce their published SCOP from ηs,35 exactly).
 *      55 °C → 2.5·(ηs,55 + 3)/100 from efficiency_55C_percent.
 *    Neither available → the user must enter a SCOP. Nothing is guessed.
 *  · Gas boiler comparison: gas = demand / boiler seasonal efficiency.
 *  · Cost = kWh × unit price (+ an optional annual standing-charge difference
 *    on the gas side); CO₂ = kWh × emission factor.
 *  · Uncertainty: ±20 % on the heat-pump electricity (average-climate SCOP;
 *    colder regions run lower; domestic hot water is excluded).
 */

export type FlowTemp = 35 | 55;
export type ScopBasis = 'scop' | 'eta35' | 'eta55' | 'none';

export interface ScopSource {
  scop?: number | null;
  eta35?: number | null;
  eta55?: number | null;
  /** HpVM.qaFlags — 'scop' there means the published SCOP contradicts ηs,35. */
  qaFlags?: readonly string[] | null;
}

export interface ScopResult {
  value: number | null;
  basis: ScopBasis;
  /** True when a published SCOP existed but was flagged and therefore not used. */
  scopFlagged: boolean;
}

export const UNCERTAINTY = 0.2;
export const DEFAULT_BOILER_EFFICIENCY = 0.9;

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/** EU 811/2013: ηs = SCOP/CC·100 − 3 % with CC = 2.5  →  SCOP = 2.5·(ηs + 3)/100. */
export function scopFromEta(eta: number | null | undefined): number | null {
  const e = num(eta);
  if (e == null || e <= 0) return null;
  return round2((2.5 * (e + 3)) / 100);
}

/** The SCOP the estimate runs on, and where it came from. */
export function scopFor(src: ScopSource, flow: FlowTemp): ScopResult {
  if (flow === 55) {
    const v = scopFromEta(src.eta55);
    return { value: v, basis: v == null ? 'none' : 'eta55', scopFlagged: false };
  }
  const published = num(src.scop);
  const flagged = published != null && !!src.qaFlags?.includes('scop');
  if (published != null && published > 1 && !flagged) return { value: published, basis: 'scop', scopFlagged: false };
  const derived = scopFromEta(src.eta35);
  if (derived != null) return { value: derived, basis: 'eta35', scopFlagged: flagged };
  return { value: null, basis: 'none', scopFlagged: flagged };
}

/* ── Heat demand helper ───────────────────────────────────────────────────── */

export type BuildingStandard = 'new' | 'renovated' | 'partly' | 'unrenovated';
export const BUILDING_STANDARDS: BuildingStandard[] = ['new', 'renovated', 'partly', 'unrenovated'];

/** Space-heating demand from floor area × specific demand (kWh/m²·a). */
export function demandFromArea(areaM2: number | null | undefined, kwhPerM2: number | null | undefined): number | null {
  const a = num(areaM2), k = num(kwhPerM2);
  if (a == null || k == null || a <= 0 || k <= 0) return null;
  return Math.round(a * k);
}

/* ── Estimate ─────────────────────────────────────────────────────────────── */

export interface CostInputs {
  /** Annual space-heating demand, kWh (useful heat). */
  demandKwh: number;
  scop: number;
  /** Seasonal efficiency of the gas boiler compared against (0–1.1). */
  boilerEfficiency: number;
  /** Price per kWh in the market currency. */
  electricityPrice: number;
  gasPrice: number;
  /** Annual standing-charge difference: the gas side's extra fixed cost minus
   *  any extra fixed cost of the heat-pump tariff/meter. Default 0. */
  standingDiff?: number;
  /** kg CO₂ per kWh. */
  gridCo2: number;
  gasCo2: number;
}

export interface Range { low: number; high: number }

export interface CostResult {
  hpKwh: number;
  gasKwh: number;
  hpCost: number;
  gasCost: number;
  saving: number;
  hpCo2Kg: number;
  gasCo2Kg: number;
  co2SavingKg: number;
  /** ±UNCERTAINTY on the heat-pump electricity. */
  band: { hpKwh: Range; hpCost: Range; saving: Range; hpCo2Kg: Range; co2SavingKg: Range };
}

export type InputKey = keyof CostInputs;

/** Which inputs are missing or out of range (empty = computable). */
export function invalidInputs(i: Partial<Record<InputKey, number | null>>): InputKey[] {
  const bad: InputKey[] = [];
  const pos = (k: InputKey, min = 0, max = Infinity, allowZero = false) => {
    const v = num(i[k]);
    if (v == null || v < min || v > max || (!allowZero && v === 0)) bad.push(k);
  };
  pos('demandKwh', 0, 10_000_000);
  pos('scop', 1, 10);
  pos('boilerEfficiency', 0.3, 1.1);
  pos('electricityPrice', 0, 100);
  pos('gasPrice', 0, 100);
  pos('gridCo2', 0, 2, true);
  pos('gasCo2', 0, 2, true);
  if (i.standingDiff != null && num(i.standingDiff) == null) bad.push('standingDiff');
  return bad;
}

export function estimate(i: CostInputs): CostResult | null {
  if (invalidInputs(i).length) return null;
  const standing = num(i.standingDiff) ?? 0;
  const hpKwh = i.demandKwh / i.scop;
  const gasKwh = i.demandKwh / i.boilerEfficiency;
  const hpCost = hpKwh * i.electricityPrice;
  const gasCost = gasKwh * i.gasPrice + standing;
  const hpCo2Kg = hpKwh * i.gridCo2;
  const gasCo2Kg = gasKwh * i.gasCo2;
  const lo = 1 - UNCERTAINTY, hi = 1 + UNCERTAINTY;
  return {
    hpKwh, gasKwh, hpCost, gasCost,
    saving: gasCost - hpCost,
    hpCo2Kg, gasCo2Kg,
    co2SavingKg: gasCo2Kg - hpCo2Kg,
    band: {
      hpKwh: { low: hpKwh * lo, high: hpKwh * hi },
      hpCost: { low: hpCost * lo, high: hpCost * hi },
      saving: { low: gasCost - hpCost * hi, high: gasCost - hpCost * lo },
      hpCo2Kg: { low: hpCo2Kg * lo, high: hpCo2Kg * hi },
      co2SavingKg: { low: gasCo2Kg - hpCo2Kg * hi, high: gasCo2Kg - hpCo2Kg * lo },
    },
  };
}

/* ── Market defaults (src/config/energyDefaults.json) ─────────────────────── */

export interface SourcedValue {
  value: number | null;
  unit: string;
  source: string;
  url: string;
  asOf: string;
  note?: string;
}

export interface MarketEnergyDefaults {
  currency: 'EUR' | 'GBP' | 'PLN';
  asOf: string;
  electricity: SourcedValue;
  heatPumpTariff: SourcedValue | null;
  gas: SourcedValue;
  gasStandingCharge?: SourcedValue | null;
  gridCo2: SourcedValue;
  gasCo2: SourcedValue;
}

export interface EnergyDefaultsFile {
  version: string;
  buildingStandards: { source: string; url: string; asOf: string; note?: string; values: Record<BuildingStandard, number> };
  boilerEfficiency: { value: number; source: string; url: string; note?: string };
  markets: Record<string, MarketEnergyDefaults>;
}

/** The market's defaults; unknown codes fall back to DE (EUR). */
export function marketDefaults(file: EnergyDefaultsFile, code: string): MarketEnergyDefaults {
  return file.markets[code] ?? file.markets.DE;
}

/** Money in the market's currency (display only — this is not billing). */
export function formatMoney(amount: number, currency: string, locale: string, digits = 0): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: digits, minimumFractionDigits: digits }).format(amount);
}

/** Round to a "presentable" figure for an estimate (nearest 10). */
export const roundTo = (n: number, step = 10) => Math.round(n / step) * step;
