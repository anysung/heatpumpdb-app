/**
 * Noise check — the pure acoustic model (Premium, 2026-09-29). No imports, no
 * UI: tests/noise-model.unit.mjs transpiles and exercises this very file.
 *
 * Free-field point source over reflecting surfaces (the formula MCS 020 a)
 * Step 7 prints, and the textbook basis of the LAI-Leitfaden tables):
 *
 *   Lp = Lw + 10·log10(Q / (4·π·r²)) − A_B  (+ K_T tonality surcharge, DE)
 *   r_min = sqrt( Q/(4π) · 10^((Lw + K_T − A_B − target)/10) )
 *
 * Q = 2 free-standing on the ground · 4 against one wall · 8 in a corner/recess.
 * A_B = 0 / 5 / 10 dB for no / partial / full screening (MCS 020 a) Type-1
 * barrier matrix: full view 0, partial view −5, no view −10 dB).
 * An estimate for pre-planning — never an acoustic report.
 *
 * Limit values and their sources (each cited where it is used):
 *  · DE — TA Lärm Nr. 6.1 (Immissionsrichtwerte außerhalb von Gebäuden; Nacht
 *    22–6 Uhr, Nr. 6.4). The LAI-Leitfaden "Lärm bei stationären Geräten"
 *    (3. Aktualisierung, Stand 28.08.2023, UMK-Umlaufbeschluss 47/2023) plans
 *    heat pumps against the NIGHT value minus 6 dB (irrelevance, TA Lärm
 *    Nr. 3.2.1) and asks for a 3 dB tonality surcharge when nothing is known
 *    (Tab. 4) — hence pass ≤ night−6, tight ≤ night, over > night.
 *  · GB — MCS 020 a) Issue 1.0 (20/03/2025, mandatory for permitted
 *    development from 20/09/2025): 37.0 dB(A) at every assessment position
 *    (1 m outside the centre of a neighbour's habitable-room window/door),
 *    result rounded to 0.1 dB, NO background-noise term (the 40 dB background
 *    + 42 dB limit belonged to the withdrawn MCS 020).
 *  · FR / PL / IT — no pass/fail: the rules there depend on on-site background
 *    noise (FR émergence, IT differential criterion) or local acoustic zoning.
 */

export type Placement = 'free' | 'wall' | 'corner';
export type Screening = 'none' | 'partial' | 'full';
/** Per-market behaviour; the edition picks one in hpiq/market.ts (NOISE_REGIME). */
export type NoiseRegime = 'de-ta-laerm' | 'gb-mcs020a' | 'fr-emergence' | 'pl-zoning' | 'it-zoning';

export const PLACEMENT_Q: Record<Placement, number> = { free: 2, wall: 4, corner: 8 };
export const SCREENING_DB: Record<Screening, number> = { none: 0, partial: 5, full: 10 };
/** LAI-Leitfaden Tab. 4: tonal components audible → 3 dB (the default when unknown). */
export const TONALITY_DB = 3;
/** TA Lärm Nr. 3.2.1 / LAI 4.1.1: a contribution ≥ 6 dB below the IRW is irrelevant. */
export const IRRELEVANCE_DB = 6;
/** MCS 020 a) Step 8 — permitted-development limit, dB(A). */
export const MCS_LIMIT = 37.0;
/** Distances for the reference table (m). */
export const TABLE_DISTANCES = [1, 3, 5, 10];

/** TA Lärm Nr. 6.1 a)–g) — Immissionsrichtwerte außerhalb von Gebäuden, dB(A). */
export type DeArea = 'industrial' | 'commercial' | 'urban' | 'mixed' | 'general' | 'pure' | 'spa';
export const TA_LAERM: Record<DeArea, { day: number; night: number }> = {
  industrial: { day: 70, night: 70 },   // a) Industriegebiete: 70 dB(A), no day/night split
  commercial: { day: 65, night: 50 },   // b) Gewerbegebiete
  urban:      { day: 63, night: 45 },   // c) urbane Gebiete
  mixed:      { day: 60, night: 45 },   // d) Kern-, Dorf- und Mischgebiete
  general:    { day: 55, night: 40 },   // e) allgemeine Wohngebiete, Kleinsiedlungsgebiete
  pure:       { day: 50, night: 35 },   // f) reine Wohngebiete
  spa:        { day: 45, night: 35 },   // g) Kurgebiete, Krankenhäuser, Pflegeanstalten
};
export const DE_AREAS: DeArea[] = ['pure', 'general', 'mixed', 'urban', 'commercial', 'industrial', 'spa'];

/** Sound pressure level (dB(A)) at distance r (m). */
export function soundPressure(lw: number, r: number, q: number, barrierDb = 0, surchargeDb = 0): number {
  return lw + surchargeDb + 10 * Math.log10(q / (4 * Math.PI * r * r)) - barrierDb;
}

/** Distance (m) at which the level falls to `target` dB(A). */
export function minDistance(lw: number, q: number, barrierDb: number, target: number, surchargeDb = 0): number {
  return Math.sqrt((q / (4 * Math.PI)) * Math.pow(10, (lw + surchargeDb - barrierDb - target) / 10));
}

export const round1 = (x: number): number => Math.round(x * 10) / 10;

/** Whether a regime yields a verdict at all (FR/PL/IT: distance table only). */
export const hasVerdict = (regime: NoiseRegime): boolean => regime === 'de-ta-laerm' || regime === 'gb-mcs020a';
/** Tonality surcharge is a TA Lärm / LAI concept — offered in DE only. */
export const offersTonality = (regime: NoiseRegime): boolean => regime === 'de-ta-laerm';
/** Decimals a limit value is quoted with (MCS 020 a) states "37.0"; TA Lärm whole dB). */
export const limitDecimals = (regime: NoiseRegime): number => (regime === 'gb-mcs020a' ? 1 : 0);
/** The TA Lärm area-type selector (DE only). */
export const usesAreaType = (regime: NoiseRegime): boolean => regime === 'de-ta-laerm';

export type Verdict = 'pass' | 'tight' | 'over';

export interface NoiseInput {
  lw: number;
  distance: number;
  placement: Placement;
  screening: Screening;
  /** DE only. */
  area?: DeArea;
  /** DE only: add the 3 dB tonality surcharge. */
  tonal?: boolean;
}

export interface NoiseResult {
  q: number;
  barrierDb: number;
  surchargeDb: number;
  /** Level at the user's distance, rounded to 0.1 dB. */
  lp: number;
  /** Lp at TABLE_DISTANCES (rounded 0.1). */
  table: { r: number; lp: number }[];
  verdict: Verdict | null;
  /** The value the verdict is judged against (DE: night IRW; GB: 37.0). */
  limit: number | null;
  /** DE: the LAI planning target (night − 6). */
  target: number | null;
  /** Distance at which `limit` is met (m). */
  rLimit: number | null;
  /** DE: distance at which the LAI target is met (m). */
  rTarget: number | null;
}

export function evaluateNoise(regime: NoiseRegime, i: NoiseInput): NoiseResult {
  const q = PLACEMENT_Q[i.placement];
  const barrierDb = SCREENING_DB[i.screening];
  const surchargeDb = offersTonality(regime) && i.tonal ? TONALITY_DB : 0;
  const at = (r: number) => round1(soundPressure(i.lw, r, q, barrierDb, surchargeDb));
  const lp = at(i.distance);
  const table = TABLE_DISTANCES.map(r => ({ r, lp: at(r) }));
  const base: NoiseResult = { q, barrierDb, surchargeDb, lp, table, verdict: null, limit: null, target: null, rLimit: null, rTarget: null };

  if (regime === 'de-ta-laerm') {
    const night = TA_LAERM[i.area ?? 'general'].night;
    const target = night - IRRELEVANCE_DB;
    return {
      ...base,
      limit: night,
      target,
      verdict: lp <= target ? 'pass' : lp <= night ? 'tight' : 'over',
      rLimit: minDistance(i.lw, q, barrierDb, night, surchargeDb),
      rTarget: minDistance(i.lw, q, barrierDb, target, surchargeDb),
    };
  }
  if (regime === 'gb-mcs020a') {
    return {
      ...base,
      limit: MCS_LIMIT,
      // Step 8: "equal to or lower than 37.0 dB(A)" on the value rounded to 0.1.
      verdict: lp <= MCS_LIMIT ? 'pass' : 'over',
      rLimit: minDistance(i.lw, q, barrierDb, MCS_LIMIT, surchargeDb),
    };
  }
  return base;
}

/** Plausible range for a user-entered outdoor sound power level, dB(A). */
export const LW_MIN = 30;
export const LW_MAX = 100;
export const validLw = (x: number | null | undefined): x is number =>
  typeof x === 'number' && isFinite(x) && x >= LW_MIN && x <= LW_MAX;
export const validDistance = (x: number | null | undefined): x is number =>
  typeof x === 'number' && isFinite(x) && x >= 0.5 && x <= 500;
