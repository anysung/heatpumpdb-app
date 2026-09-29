/**
 * The comparison's rows — ONE definition for the on-screen compare modal
 * (ProductsPage) and the generated comparison PDF (pdf/comparisonPdf.ts), so
 * the paper can never show different rows or a different BEST than the screen.
 */
import { HpVM } from './model';
import type { HpStrings } from './i18n';

export interface CompareRow {
  label: string;
  value: (c: HpVM) => string;
  metric?: (c: HpVM) => number | null;
  /** 1 = higher is better, -1 = lower is better. */
  dir?: 1 | -1;
  strong?: boolean;
  dim?: boolean;
}

const num = (s: string) => { const n = parseFloat(String(s).replace(',', '.')); return Number.isFinite(n) ? n : null; };

export function compareRows(t: HpStrings): CompareRow[] {
  const L = t.products.cmpRows;
  return [
    { label: L[0], value: c => `${c.kw} kW`, strong: true },
    { label: L[1], value: c => c.cop7, metric: c => num(c.cop7), dir: 1 },
    { label: L[2], value: c => c.cop2, metric: c => num(c.cop2), dir: 1 },
    { label: L[3], value: c => c.scop, metric: c => num(c.scop), dir: 1 },
    { label: L[4], value: c => ((/^\d/.test(c.noise) ? `${c.noise} dB(A)` : c.noise)), metric: c => num(c.noise), dir: -1 },
    { label: L[5], value: c => (/^\d/.test(c.refKg) ? `${c.ref} · ${c.refKg} kg` : c.ref) },
    { label: L[6], value: c => c.label },
    { label: L[7], value: c => c.sourceId, dim: true },
  ];
}

/** The winning metric value of a row, or null when there is no meaningful winner
 *  (non-metric row, fewer than two values, or all values equal). */
export function bestOf(row: CompareRow, items: HpVM[]): number | null {
  if (!row.metric) return null;
  const usable = items.map(row.metric).filter((v): v is number => v != null);
  if (usable.length < 2 || new Set(usable).size <= 1) return null;
  return row.dir === -1 ? Math.min(...usable) : Math.max(...usable);
}
