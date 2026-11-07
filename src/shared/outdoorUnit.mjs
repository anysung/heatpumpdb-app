/**
 * Which picture a model gets (owner decision 2026-11-06).
 * Residential air/water models show their brand's image, or the simple line graphic when the brand
 * has none. Commercial and unclassified models show nothing, and neither do ground or water source
 * models, which have no outdoor unit. A model with its own image shows that image (owner 2026-11-07,
 * `match` in the config); every other model shows the brand's image.
 */
import CONFIG from '../config/outdoorUnits.json' with { type: 'json' };
import { brandId } from './brandId.mjs';

const BY_BRAND = new Map();
const MODEL_RULES = new Map();
for (const u of CONFIG.units) {
  for (const name of [u.brand, ...(u.names ?? [])]) {
    const k = brandId(name);
    if (u.match) MODEL_RULES.set(k, [...(MODEL_RULES.get(k) ?? []), { id: u.id, rule: new RegExp(u.match, 'i') }]);
    else BY_BRAND.set(k, u);
  }
}

const AIR_WATER = /^(luft|air|aria|powietrze)\s*\/\s*(wasser|water|eau|acqua|woda)/i;

export const unitFile = (id, width) => `/assets/outdoor-units/${CONFIG.version}/${id}__w${width}.webp`;
export const unitWidths = CONFIG.widths;

/** @returns {{kind:'photo',id:string}|{kind:'graphic'}|null} */
export function outdoorVisual(brand, type, segment, model = '') {
  if (segment !== 'residential' || !AIR_WATER.test(String(type ?? '').trim())) return null;
  const key = brandId(brand);
  const own = MODEL_RULES.get(key)?.find((r) => r.rule.test(model));
  if (own) return { kind: 'photo', id: own.id };
  const u = BY_BRAND.get(key);
  return u ? { kind: 'photo', id: u.id } : { kind: 'graphic' };
}
