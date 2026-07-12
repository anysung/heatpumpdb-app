/**
 * brandArtwork — the brand SVG, rasterized once for the PDF data sheet.
 *
 * The PDF must show the SAME logo and the SAME waving flag as the app. Redrawing
 * them with PDF primitives is how they drifted apart (a thin circle and a square
 * flag, Jul 2026), so instead we render the real artwork from brandSvg.ts —
 * identical markup to the on-screen components — into a canvas at print
 * resolution and embed that.
 *
 * It is preloaded at app start and cached, because buildDataSheetPdf() must stay
 * SYNCHRONOUS: on iOS, navigator.share() has to be reached inside the click
 * gesture, and an await in between loses it.
 */
import { CountryCode } from '../../config/countryProfiles';
import { FLAG_ASPECT, LOGO_ASPECT, flagSvgDoc, logoSvgDoc } from '../../components/brandSvg';

export type RasterImage = { dataUrl: string; aspect: number };
export type BrandArtwork = { logo: RasterImage; flag: RasterImage };

/** Wide enough that both stay >300 dpi at the sizes the header uses. */
const LOGO_PX = 1400;
const FLAG_PX = 800;

let cache: BrandArtwork | null = null;
let inFlight: Promise<BrandArtwork | null> | null = null;

function rasterize(svg: string, aspect: number, widthPx: number): Promise<RasterImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = widthPx;
      canvas.height = Math.round(widthPx / aspect);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('no 2d context'));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve({ dataUrl: canvas.toDataURL('image/png'), aspect });
    };
    img.onerror = () => reject(new Error('brand svg failed to rasterize'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** Kick off rasterization; safe to call repeatedly. */
export function preloadBrandArtwork(country: CountryCode): Promise<BrandArtwork | null> {
  if (cache) return Promise.resolve(cache);
  if (inFlight) return inFlight;
  inFlight = Promise.all([
    // The sheet is white paper — always the light face.
    rasterize(logoSvgDoc('light'), LOGO_ASPECT, LOGO_PX),
    rasterize(flagSvgDoc(country, true), FLAG_ASPECT, FLAG_PX),
  ])
    .then(([logo, flag]) => {
      cache = { logo, flag };
      return cache;
    })
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Cached artwork, or null if the preload has not finished (header falls back to text). */
export function getBrandArtwork(): BrandArtwork | null {
  return cache;
}
