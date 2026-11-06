/**
 * Pictures for the generated PDFs. Rasterized ahead of time, because the PDF builders must stay
 * synchronous for the iOS share sheet (same reason as pdf/brandArtwork.ts).
 */
import { unitFile } from '../../../shared/outdoorUnit.mjs';
import type { HpVM } from '../../model';
import { UNIT_GRAPHIC_URL, visualOf } from './UnitVisual';

const PX = 400;
const cache = new Map<string, string>();
const keyOf = (v: HpVM): string | null => {
  const visual = visualOf(v);
  return !visual ? null : visual.kind === 'photo' ? visual.id : 'graphic';
};

export function preloadUnitRaster(v: HpVM | null | undefined): void {
  const visual = v ? visualOf(v) : null;
  const key = v ? keyOf(v) : null;
  if (!visual || !key || cache.has(key)) return;
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, PX, PX);
    ctx.drawImage(img, 0, 0, PX, PX);
    cache.set(key, canvas.toDataURL('image/jpeg', 0.86));
  };
  img.src = visual.kind === 'photo' ? unitFile(visual.id, 400) : UNIT_GRAPHIC_URL;
}

/** The JPEG data URL for this model, or null if it has no picture or it has not loaded yet. */
export function unitRaster(v: HpVM): string | null {
  const key = keyOf(v);
  return key ? cache.get(key) ?? null : null;
}
