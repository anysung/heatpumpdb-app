/**
 * Logo intake: PNG / JPG / SVG / WebP → a PNG data URL that fits 600×200 px and
 * stays ≤ LOGO_MAX_CHARS, done entirely on a canvas in the browser (nothing is
 * uploaded anywhere but the user's own Firestore doc).
 */
import { LOGO_MAX_CHARS, LOGO_MAX_H, LOGO_MAX_W } from './brandingState';

export type LogoError = 'type' | 'large' | 'read';

const ACCEPT = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
export const LOGO_ACCEPT = '.png,.jpg,.jpeg,.svg,.webp,' + ACCEPT.join(',');

const isSvg = (f: File) => f.type === 'image/svg+xml' || /\.svg$/i.test(f.name);
const accepted = (f: File) => ACCEPT.includes(f.type) || /\.(png|jpe?g|svg|webp)$/i.test(f.name);

/** Intrinsic aspect of an SVG from its viewBox / width+height (some browsers
 *  report 0×0 for SVGs without explicit dimensions). */
function svgAspect(text: string): number | null {
  const vb = text.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (vb) { const w = parseFloat(vb[1]), h = parseFloat(vb[2]); if (w > 0 && h > 0) return w / h; }
  const w = text.match(/<svg[^>]*\swidth\s*=\s*["']([\d.]+)/i), h = text.match(/<svg[^>]*\sheight\s*=\s*["']([\d.]+)/i);
  if (w && h) { const a = parseFloat(w[1]) / parseFloat(h[1]); if (a > 0 && Number.isFinite(a)) return a; }
  return null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('read'));
    img.src = src;
  });
}

export async function processLogo(file: File): Promise<string> {
  if (!accepted(file)) throw new Error('type' satisfies LogoError);
  if (file.size > 10 * 1024 * 1024) throw new Error('large' satisfies LogoError);
  const svg = isSvg(file);
  let src: string;
  let aspect: number | null = null;
  if (svg) {
    const text = await file.text();
    aspect = svgAspect(text);
    src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
  } else {
    src = URL.createObjectURL(file);
  }
  let img: HTMLImageElement;
  try { img = await loadImage(src); }
  catch { throw new Error('read' satisfies LogoError); }
  finally { if (!svg) URL.revokeObjectURL(src); }

  // Target size: vector art fills the 600×200 box by its aspect; raster art
  // is fitted into it but never upscaled.
  const a = aspect ?? ((img.naturalWidth || 3) / (img.naturalHeight || 1));
  let tw: number, th: number;
  if (svg) {
    tw = Math.min(LOGO_MAX_W, LOGO_MAX_H * a);
    th = tw / a;
  } else {
    const k = Math.min(1, LOGO_MAX_W / img.naturalWidth, LOGO_MAX_H / img.naturalHeight);
    tw = img.naturalWidth * k;
    th = img.naturalHeight * k;
  }
  let scale = 1;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('read' satisfies LogoError);
  // Shrink until the PNG fits the storage cap (detailed photos can need a few passes).
  for (let i = 0; i < 12; i++) {
    const w = Math.max(1, Math.round(tw * scale));
    const h = Math.max(1, Math.round(th * scale));
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    const url = canvas.toDataURL('image/png');
    if (url.length <= LOGO_MAX_CHARS) return url;
    if (w < 80) break;
    scale *= 0.8;
  }
  throw new Error('large' satisfies LogoError);
}
