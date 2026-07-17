/**
 * pdfFonts — embeds Noto Sans (Latin + Latin-Extended-A subset, OFL) into the
 * data-sheet PDF so every edition's language renders with real glyphs.
 *
 * Why: the PDF standard font (Helvetica) is WinAnsi-only. `ascii()` used to
 * DELETE any character above Latin-1 — Polish loses ą ć ę ł ń ś ź ż entirely
 * ("Gdańsk" → "Gdask"), which is unshippable for the PL edition. With Noto Sans
 * embedded, Latin-Extended letters render properly on every edition; the
 * `ascii()` symbol folds (η→eta, − →-, …) stay, because they are content
 * decisions, not font gaps.
 *
 * Pattern mirrors brandArtwork.ts: preload once (async fetch of the TTF assets),
 * then register synchronously on each jsPDF document. If the preload has not
 * finished, the sheet falls back to Helvetica — same text, degraded glyph set —
 * rather than failing the export.
 *
 * The TTFs are 43 KB subsets (Basic Latin, Latin-1, Latin-Extended-A, η, the
 * typographic punctuation the sheet folds/uses, €). Regenerate with pyftsubset
 * if coverage must grow (e.g. a future non-Latin market needs a different plan).
 */
import { jsPDF } from 'jspdf';
import regularUrl from './fonts/NotoSans-Regular.ttf?url';
import boldUrl from './fonts/NotoSans-Bold.ttf?url';

interface PdfFonts { regular: string; bold: string } // base64 TTFs

let cache: PdfFonts | null = null;
let inFlight: Promise<PdfFonts | null> | null = null;

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  let bin = '';
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/** Kick off the font fetch; safe to call repeatedly. */
export function preloadPdfFonts(): Promise<PdfFonts | null> {
  if (cache) return Promise.resolve(cache);
  if (inFlight) return inFlight;
  inFlight = Promise.all([fetchAsBase64(regularUrl), fetchAsBase64(boldUrl)])
    .then(([regular, bold]) => {
      cache = { regular, bold };
      return cache;
    })
    .catch(() => null)
    .finally(() => { inFlight = null; });
  return inFlight;
}

export const PDF_FONT_FAMILY = 'NotoSans';

/**
 * Register the embedded font on a document. Returns the font family to use —
 * 'NotoSans' when the preload finished, 'helvetica' as the fallback.
 */
export function registerPdfFonts(doc: jsPDF): string {
  if (!cache) return 'helvetica';
  doc.addFileToVFS('NotoSans-Regular.ttf', cache.regular);
  doc.addFont('NotoSans-Regular.ttf', PDF_FONT_FAMILY, 'normal');
  doc.addFileToVFS('NotoSans-Bold.ttf', cache.bold);
  doc.addFont('NotoSans-Bold.ttf', PDF_FONT_FAMILY, 'bold');
  return PDF_FONT_FAMILY;
}
