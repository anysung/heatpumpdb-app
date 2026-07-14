/**
 * HeatPump DB view model — adapts the real HeatPump records (BAFA dataset +
 * EPREL enrichment fields) to the display shape used by the approved design.
 */
import { ratedCapacityKw } from '../config/segmentation';
import { HeatPump } from '../types';

export interface HpVM {
  id: string;
  mfr: string;
  model: string;
  odu: string;
  /** Heating capacity at 55°C, formatted with one decimal, or '—'. Only ever shown under a 55°C label. */
  kw: string;
  /**
   * The canonical rated capacity (kW) — THE number the residential/commercial
   * split is made on (config/segmentation.ts). Anywhere the UI shows a headline
   * capacity, sorts by capacity, or filters a capacity range, it must use this
   * one: showing a 55°C figure next to a segment derived from a different number
   * is how a 24 kW commercial record ends up displaying "—" or "21.8".
   */
  ratedKw: string;
  ratedKwNum: number | null;
  cop7: string;
  cop2: string;
  copm7: string;
  /** Numeric sort key (COP A2/W35), nulls sort last. */
  cop2Num: number | null;
  scop: string;
  noise: string;
  /** Seasonal space-heating class at W35 / W55, derived per EU 811/2013. */
  label: string;
  labelMed: string;
  ref: string;
  refKg: string;
  bafaId: string;
  /** Registry id for display: MCS number (GB) or BAFA id (DE). */
  sourceId: string;
  installType: string;
  eprel: boolean;
  eprelId: string;
  eprelText: string;
  completeness: string;
  shortName: string;
  raw: HeatPump;
}

/** EU Regulation 811/2013 seasonal space-heating efficiency classes (ηs %). */
export function energyClass(eta: number | null | undefined): string {
  if (eta == null || !isFinite(eta)) return '—';
  if (eta >= 150) return 'A+++';
  if (eta >= 125) return 'A++';
  if (eta >= 98) return 'A+';
  if (eta >= 90) return 'A';
  if (eta >= 82) return 'B';
  if (eta >= 75) return 'C';
  if (eta >= 36) return 'D';
  return 'E';
}

const fmt = (v: number | null | undefined, digits: number): string =>
  v == null || !isFinite(v) ? '—' : v.toFixed(digits);

function completenessOf(p: HeatPump): string {
  const fields: (number | string | null | undefined)[] = [
    p.power_55C_kw, p.power_35C_kw, p.cop_A7W35, p.cop_A2W35, p.cop_AMinus7W35,
    p.scop, p.noise_outdoor_dB, p.refrigerant, p.refrigerant_amount_kg,
    p.installation_type, (p as any).efficiency_35C_percent, (p as any).efficiency_55C_percent,
  ];
  const present = fields.filter(f => f != null && f !== '').length;
  return `${Math.round((present / fields.length) * 100)}%`;
}

export function toVM(p: HeatPump): HpVM {
  const id = p.source_id || p.bafa_id;
  const mfr = p.manufacturer_short || p.manufacturer;
  const eprel = !!p.eprel_registration_number;
  const eta35 = (p as any).efficiency_35C_percent as number | null;
  const eta55 = (p as any).efficiency_55C_percent as number | null;
  return {
    id,
    mfr,
    model: p.model,
    odu: p.outdoor_side_display_model || p.outdoor_unit_model || '—',
    kw: fmt(p.power_55C_kw, 1),
    ratedKw: fmt(ratedCapacityKw(p), 1),
    ratedKwNum: ratedCapacityKw(p),
    cop7: fmt(p.cop_A7W35, 2),
    cop2: fmt(p.cop_A2W35, 2),
    copm7: fmt(p.cop_AMinus7W35, 2),
    cop2Num: p.cop_A2W35 ?? null,
    scop: fmt(p.scop, 2),
    noise: p.noise_outdoor_dB == null ? '—' : String(Math.round(p.noise_outdoor_dB)),
    label: energyClass(eta35),
    labelMed: energyClass(eta55),
    ref: p.refrigerant || '—',
    refKg: fmt(p.refrigerant_amount_kg, 1),
    bafaId: p.bafa_id,
    // Prefer the raw MCS number (GB duplicates carry a '#n' suffix on source_id
    // for key uniqueness — the suffix must not print on sheets).
    sourceId: p.mcs_number ?? p.source_id ?? p.bafa_id ?? '—',
    installType: p.installation_type || '—',
    eprel,
    eprelId: eprel ? `EPREL-${p.eprel_registration_number}` : '—',
    eprelText: eprel ? 'Matched' : 'Not matched',
    completeness: completenessOf(p),
    shortName: p.model.split(' ').slice(0, 3).join(' '),
    raw: p,
  };
}

/** Format an ISO date as the design's "5 Jul 2026" style (locale-aware, e.g. "5. Juli 2026" for de-DE). */
export function shortDate(iso: string | null | undefined, locale = 'en-GB'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Format an ISO date as "6 July 2026" (data-sheet header style, locale-aware). */
export function longDate(iso: string | null | undefined, locale = 'en-GB'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}
