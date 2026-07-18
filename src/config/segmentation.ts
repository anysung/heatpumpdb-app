/**
 * The ONE residential/commercial rule for every country edition.
 *
 * HeatPump DB defines the split itself, at a single capacity threshold. National
 * sources do not agree with each other — the German registry's own labels put
 * some sub-23 kW units in "commercial", and the Ofgem PEL has no segment concept
 * at all (its records run to 177 kW) — so a source's own label MUST NOT decide
 * what this site calls residential or commercial. Only rated capacity does.
 *
 *   residential:  rated capacity ≤ 23 kW
 *   commercial:   rated capacity  > 23 kW
 *   unclassified: no usable rated capacity
 *
 * 23.00 kW is residential; only ABOVE 23 kW is commercial (never `>=`).
 *
 * A record with no published capacity is NOT quietly filed as residential — it
 * is unclassified, counted, and disclosed. Guessing would be a data-honesty
 * breach: we would be asserting a capacity class the source never published.
 *
 * New countries inherit this automatically: there is no per-country threshold
 * and no country branch in this file.
 */
import { HeatPump } from '../types';

/** The site's own threshold. Not a legal or industry-wide definition. */
export const SEGMENT_THRESHOLD_KW = 23;

export type ProductSegment = 'residential' | 'commercial';
export type SegmentClass = ProductSegment | 'unclassified';

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/**
 * Canonical rated capacity (kW), in preference order:
 *   power_35C_kw        — rated heat output (registry-measured)
 *   power_design_35C_kw — design load at 35 °C (EPREL label data)
 *   power_55C_kw / power_design_55C_kw — the 55 °C equivalents
 *
 * Returns null when the record publishes no usable capacity at all — which is
 * the case for Ofgem PEL entries that matched neither a registry nor an EPREL
 * record (the PEL itself publishes no performance data).
 */
export function ratedCapacityKw(p: HeatPump): number | null {
  const raw = p as unknown as Record<string, unknown>;
  return (
    num(raw.power_35C_kw) ??
    num(raw.power_design_35C_kw) ??
    num(raw.power_55C_kw) ??
    num(raw.power_design_55C_kw) ??
    // Registry-declared rated output whose measurement basis the source does
    // not state (IT GSE-native records only; null everywhere else). Mirrors
    // scripts/lib/data-sheet-eligibility.mjs CAPACITY_CHAIN.
    num(raw.declared_capacity_kw)
  );
}

/** The site's segment for a capacity. Exported for direct unit testing. */
export function classifyProductSegment(capacityKw: number | null | undefined): SegmentClass {
  if (typeof capacityKw !== 'number' || !Number.isFinite(capacityKw)) return 'unclassified';
  return capacityKw > SEGMENT_THRESHOLD_KW ? 'commercial' : 'residential';
}

/** The site's segment for a product record. */
export const segmentOfProduct = (p: HeatPump): SegmentClass =>
  classifyProductSegment(ratedCapacityKw(p));

/**
 * Split a catalogue into the site's segments.
 *
 * Takes the WHOLE pool (every dataset file for the market): which file a record
 * arrived in says nothing about its segment — for GB the files are split by
 * source, not by capacity, which is precisely why UK Commercial was empty.
 */
export function splitBySegment(pool: HeatPump[]): {
  residential: HeatPump[];
  commercial: HeatPump[];
  unclassified: HeatPump[];
} {
  const out = { residential: [] as HeatPump[], commercial: [] as HeatPump[], unclassified: [] as HeatPump[] };
  for (const p of pool) out[segmentOfProduct(p)].push(p);
  return out;
}
