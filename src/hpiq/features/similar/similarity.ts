/**
 * Alternatives finder — the PURE scoring module (no React, no app state, no
 * country config), so tests/similarity.unit.mjs runs the real source.
 *
 * Rules (owner decision 2026-09-29):
 *  · candidates come from the SAME segment pool the caller hands in (the app's
 *    residential/commercial split — config/segmentation.ts; never re-split here)
 *  · same heat-source family (air / brine-ground / water), read from `type`
 *  · rated capacity (HpVM.ratedKwNum — the number the split uses) within ±10 %;
 *    widened to ±15 % when fewer than 3 base hits, and the result SAYS so
 *  · the model itself and exact duplicates (same manufacturer + model string,
 *    e.g. GB '#n' rows) are excluded; duplicates among candidates collapse
 *  · chips: R290 only (contains-match — values like 'R290 (propan)' must
 *    match), quieter (sound power strictly lower than the reference), listed
 *    only (predicate supplied by the caller from listing.ts)
 *  · rank: SCOP desc, then sound power asc (nulls last on both), then
 *    closeness in capacity, then model name — fully deterministic
 */
import type { HpVM } from '../../model';

export type SourceFamily = 'air' | 'ground' | 'water';

/**
 * Heat-source family from the record's type string (e.g. 'Luft / Wasser',
 * 'Air / Eau', 'Solanka / Woda', 'Salamoia / Acqua', 'Eau glycolée / Eau').
 * Only the SOURCE side (before the slash) decides. Brine and direct ground
 * ('Sol / Eau') share the ground family. Unknown → null (caller then falls
 * back to an identical type string).
 */
export function sourceFamily(type: string | null | undefined): SourceFamily | null {
  if (!type) return null;
  const src = type.split('/')[0].trim().toLowerCase();
  if (!src) return null;
  // Brine / ground first: 'eau glycolée' contains 'eau'.
  if (/(sole|brine|solanka|salamoia|glycol|erd|ground|geo|^sol$|grunt)/.test(src)) return 'ground';
  if (/(luft|air|powietrze|aria|aire)/.test(src)) return 'air';
  if (/(wasser|water|^eau|woda|acqua|agua)/.test(src)) return 'water';
  return null;
}

export type SimItem = Pick<HpVM, 'id' | 'mfr' | 'model' | 'ratedKwNum' | 'ref'> & {
  raw: { scop?: number | null; noise_outdoor_dB?: number | null; type?: string | null };
};

export interface SimFilters {
  r290?: boolean;
  quieter?: boolean;
  listedOnly?: boolean;
}

export interface SimResult<T extends SimItem> {
  /** Ranked, filtered alternatives (all of them — the UI shows the first 5). */
  items: T[];
  /** Base hits at the tolerance used, BEFORE the chip filters (teaser count). */
  baseCount: number;
  /** The capacity tolerance actually used: 0.10, or 0.15 when widened. */
  tolerance: number;
  widened: boolean;
  /** Reference has no rated capacity — no comparison is possible. */
  noCapacity: boolean;
  /** Reference has no sound power — the "quieter" chip cannot apply. */
  noNoise: boolean;
}

export const BASE_TOLERANCE = 0.10;
export const WIDE_TOLERANCE = 0.15;
export const MIN_HITS = 3;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const dupKey = (v: SimItem) => `${norm(v.mfr)}|${norm(v.model)}`;

export function isR290(ref: string | null | undefined): boolean {
  return (ref ?? '').toUpperCase().includes('R290');
}

function inBand(ref: number, kw: number | null, tol: number): boolean {
  if (kw == null) return false;
  // Small epsilon so 11.0 × 1.10 = 12.100000000000001 still admits 12.1.
  return kw >= ref * (1 - tol) - 1e-9 && kw <= ref * (1 + tol) + 1e-9;
}

export function rankAlternatives<T extends SimItem>(
  ref: SimItem,
  pool: readonly T[],
  filters: SimFilters = {},
  isListed: (v: T) => boolean = () => true,
): SimResult<T> {
  const refKw = num(ref.ratedKwNum);
  const refNoise = num(ref.raw.noise_outdoor_dB);
  const empty = (noCapacity: boolean): SimResult<T> => ({
    items: [], baseCount: 0, tolerance: BASE_TOLERANCE, widened: false, noCapacity, noNoise: refNoise == null,
  });
  if (refKw == null || refKw <= 0) return empty(true);

  const fam = sourceFamily(ref.raw.type);
  const refType = norm(ref.raw.type);
  const refDup = dupKey(ref);
  const sameFamily = (v: T) =>
    fam != null ? sourceFamily(v.raw.type) === fam : norm(v.raw.type) === refType;

  // Family + identity pass once; the capacity band is applied per tolerance.
  const eligible = pool.filter(v => v.id !== ref.id && dupKey(v) !== refDup && sameFamily(v));

  const band = (tol: number) => eligible.filter(v => inBand(refKw, num(v.ratedKwNum), tol));
  let tolerance = BASE_TOLERANCE;
  let base = band(BASE_TOLERANCE);
  if (dedupe(base).length < MIN_HITS) {
    tolerance = WIDE_TOLERANCE;
    base = band(WIDE_TOLERANCE);
  }

  const sorted = [...base].sort((a, b) => compare(a, b, refKw));
  const unique = dedupe(sorted);

  let items = unique;
  if (filters.r290) items = items.filter(v => isR290(v.ref));
  if (filters.quieter && refNoise != null) {
    items = items.filter(v => { const n = num(v.raw.noise_outdoor_dB); return n != null && n < refNoise; });
  }
  if (filters.listedOnly) items = items.filter(isListed);

  return {
    items,
    baseCount: unique.length,
    tolerance,
    widened: tolerance !== BASE_TOLERANCE,
    noCapacity: false,
    noNoise: refNoise == null,
  };
}

/** Keep the first (best-ranked) row per manufacturer + model. */
function dedupe<T extends SimItem>(list: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const v of list) {
    const k = dupKey(v);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function compare(a: SimItem, b: SimItem, refKw: number): number {
  const sa = num(a.raw.scop), sb = num(b.raw.scop);
  if (sa !== sb) {
    if (sa == null) return 1;
    if (sb == null) return -1;
    if (sb !== sa) return sb - sa;
  }
  const na = num(a.raw.noise_outdoor_dB), nb = num(b.raw.noise_outdoor_dB);
  if (na !== nb) {
    if (na == null) return 1;
    if (nb == null) return -1;
    if (na !== nb) return na - nb;
  }
  const da = Math.abs((num(a.ratedKwNum) ?? Infinity) - refKw);
  const db = Math.abs((num(b.ratedKwNum) ?? Infinity) - refKw);
  if (da !== db) return da - db;
  return a.model.localeCompare(b.model) || a.id.localeCompare(b.id);
}
