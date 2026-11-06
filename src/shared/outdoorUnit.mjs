/**
 * Which picture a model gets (owner decision 2026-11-06).
 * Residential air/water models show their brand's image, or the simple line graphic when the brand
 * has none. Commercial and unclassified models show nothing, and neither do ground or water source
 * models, which have no outdoor unit. Pictures are brand level: nothing here maps an exact model.
 */
import CONFIG from '../config/outdoorUnits.json' with { type: 'json' };
import { brandId } from './brandId.mjs';

const BY_BRAND = new Map();
for (const u of CONFIG.units) for (const name of [u.brand, ...(u.names ?? [])]) BY_BRAND.set(brandId(name), u);

const AIR_WATER = /^(luft|air|aria|powietrze)\s*\/\s*(wasser|water|eau|acqua|woda)/i;

export const unitFile = (id, width) => `/assets/outdoor-units/${CONFIG.version}/${id}__w${width}.webp`;
export const unitWidths = CONFIG.widths;

/** @returns {{kind:'photo',id:string}|{kind:'graphic'}|null} */
export function outdoorVisual(brand, type, segment) {
  if (segment !== 'residential' || !AIR_WATER.test(String(type ?? '').trim())) return null;
  const u = BY_BRAND.get(brandId(brand));
  return u ? { kind: 'photo', id: u.id } : { kind: 'graphic' };
}
