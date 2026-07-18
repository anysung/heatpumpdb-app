/**
 * newsArticlePdf — generates a news article as a REAL PDF file.
 *
 * Same doctrine as dataSheetPdf.ts: we never print the DOM (WebKit lays print
 * out against the meta-viewport and ignores @page margins), we own the A4
 * geometry, pagination and per-page watermark instead. The masthead uses the
 * app's OWN brand artwork (brandArtwork.ts rasterizes src/components/brandSvg.ts
 * — never redrawn here), text uses the embedded Noto Sans (pdfFonts.ts) so
 * PL/IT diacritics render, with the same Helvetica/WinAnsi fallback and
 * symbol folds as the data sheet.
 *
 * Text-only by design: the hero image (webp) is not embedded.
 */
import { jsPDF } from 'jspdf';
import { FLAG_ASPECT, LOGO_ASPECT } from '../../components/brandSvg';
import { getBrandArtwork } from './brandArtwork';
import { registerPdfFonts, PDF_FONT_FAMILY } from './pdfFonts';

/* ── Page geometry (mm) ──────────────────────────────────────────────────── */
const PW = 210;          // A4 width
const PH = 297;          // A4 height
const M_X = 20;          // generous article margins
const M_TOP = 16;
const M_BOT = 20;        // room for the two-line footer
const CW = PW - M_X * 2; // content width = 170mm

/* ── Palette (mirrors the on-screen article) ─────────────────────────────── */
const INK: [number, number, number] = [29, 29, 31];
const MUTED: [number, number, number] = [122, 122, 122];
const BLUE: [number, number, number] = [0, 102, 204];
const HAIR: [number, number, number] = [224, 224, 224];
const FAINT: [number, number, number] = [154, 154, 160];

/* ── WinAnsi safety (mirrors dataSheetPdf.ts — keep the folds in sync) ───── */
const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';

/** True when the embedded Noto Sans registered on the current document. */
let LATIN_EXT_OK = false;

const keepChar = (ch: string): boolean => {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp <= 0xFF) return true;
  if (LATIN_EXT_OK && cp >= 0x100 && cp <= 0x17F) return true;
  return WINANSI_EXTRA.includes(ch);
};

const ascii = (s: string): string =>
  (s ?? '').toString()
    .normalize('NFC')
    .replace(/ηs/g, 'eta-s')
    .replace(/η/g, 'eta')
    .replace(/−/g, '-')          // MINUS SIGN
    .replace(/≈/g, '~')
    .replace(/≠/g, '!=')
    .replace(/…/g, '...')
    .replace(/•/g, '·')          // bullet → middle dot (guaranteed in the font subset)
    .replace(/[›»]/g, '>')
    .replace(/[‹«]/g, '<')
    .replace(/ /g, ' ')          // non-breaking space
    .split('')
    .filter(keepChar)
    .join('');

export interface NewsArticlePdfInput {
  /** "MARKET • GERMANY" eyebrow (already localized). */
  eyebrow: string;
  title: string;
  /** Dek / article summary. */
  dek: string;
  /** Full body — paragraphs separated by blank lines. */
  body: string;
  /** "By HeatPump DB Germany Editorial Team" (already localized). */
  byline: string;
  /** "Updated 5 Jul 2026" (already localized). */
  dateLine: string;
  sources: { title: string; url: string }[];
  sourcesLabel: string;
  editorialNote: string;
  /** Canonical article deep link — printed in the footer of every page. */
  link: string;
  copyright: string;
}

export function buildNewsArticlePdf(input: NewsArticlePdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const fontFamily = registerPdfFonts(doc);
  LATIN_EXT_OK = fontFamily === PDF_FONT_FAMILY;
  let y = M_TOP;

  const setFont = (size: number, bold = false, color: [number, number, number] = INK) => {
    doc.setFont(fontFamily, bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
  };

  /** Faint centred brand mark — on EVERY page, like the data-sheet watermark. */
  const watermark = () => {
    doc.saveGraphicsState();
    // @ts-expect-error — GState is available at runtime in jsPDF 4.
    doc.setGState(new doc.GState({ opacity: 0.06 }));
    setFont(46, true, INK);
    doc.text('HeatPump DB', PW / 2, PH / 2, { align: 'center' });
    doc.restoreGraphicsState();
  };

  /** Two-line footer: article deep link, then copyright · page number. */
  const footer = () => {
    doc.setDrawColor(HAIR[0], HAIR[1], HAIR[2]);
    doc.setLineWidth(0.2);
    doc.line(M_X, PH - 14, PW - M_X, PH - 14);
    setFont(7, false, MUTED);
    doc.text(ascii(input.link), M_X, PH - 10);
    setFont(6.5, false, FAINT);
    doc.text(ascii(input.copyright), M_X, PH - 6.5);
    setFont(7, false, FAINT);
    doc.text(`${doc.getCurrentPageInfo().pageNumber}`, PW - M_X, PH - 10, { align: 'right' });
  };

  const newPage = () => {
    footer();
    doc.addPage();
    watermark();
    y = M_TOP;
  };

  /** Ensure `h` mm fits on the current page; start a new one if not. */
  const need = (h: number) => { if (y + h > PH - M_BOT) newPage(); };

  /** Wrapped text block with per-line pagination. Returns nothing; advances y. */
  const block = (text: string, size: number, bold: boolean, color: [number, number, number], lh: number, gapAfter: number, maxW = CW) => {
    setFont(size, bold, color);
    const lines = doc.splitTextToSize(ascii(text), maxW) as string[];
    lines.forEach(ln => {
      if (y + lh > PH - M_BOT) { newPage(); setFont(size, bold, color); }
      doc.text(ln, M_X, y + lh * 0.8);
      y += lh;
    });
    y += gapAfter;
  };

  watermark();

  /* ── Masthead: the real brand lockup + the real waving flag, centred like a
     newspaper nameplate, over a classic double rule. Artwork comes from
     brandArtwork.ts (rasterized brandSvg.ts) — NEVER redrawn here. ─────────── */
  const LOGO_H = 9.5;
  const LOGO_W = LOGO_H * LOGO_ASPECT;
  const FLAG_H = 7.6;
  const FLAG_W = FLAG_H * FLAG_ASPECT;
  const GAP = 4;
  const art = getBrandArtwork();
  if (art) {
    const total = LOGO_W + GAP + FLAG_W;
    const x0 = (PW - total) / 2;
    doc.addImage(art.logo.dataUrl, 'PNG', x0, y, LOGO_W, LOGO_H, undefined, 'MEDIUM');
    doc.addImage(art.flag.dataUrl, 'PNG', x0 + LOGO_W + GAP, y + (LOGO_H - FLAG_H) / 2, FLAG_W, FLAG_H, undefined, 'MEDIUM');
  } else {
    // Preload not finished (a click within the first frames) — text lockup.
    setFont(17, true, INK);
    const w = doc.getTextWidth('HeatPump DB');
    doc.text('HeatPump', (PW - w) / 2, y + LOGO_H * 0.75);
    setFont(17, true, BLUE);
    doc.text('DB', (PW - w) / 2 + doc.getTextWidth('HeatPump '), y + LOGO_H * 0.75);
  }
  y += LOGO_H + 4;
  doc.setDrawColor(INK[0], INK[1], INK[2]);
  doc.setLineWidth(0.7);
  doc.line(M_X, y, PW - M_X, y);
  doc.setLineWidth(0.2);
  doc.line(M_X, y + 1.1, PW - M_X, y + 1.1);
  y += 9;

  /* ── Eyebrow · headline · dek ─────────────────────────────────────────── */
  block(input.eyebrow.toUpperCase(), 8.5, true, BLUE, 4.2, 3.5);
  block(input.title, 20, true, INK, 8.2, 3.5);
  block(input.dek, 11, false, MUTED, 5.6, 5);

  /* ── Byline row between hairlines ─────────────────────────────────────── */
  need(14);
  doc.setDrawColor(HAIR[0], HAIR[1], HAIR[2]);
  doc.setLineWidth(0.2);
  doc.line(M_X, y, PW - M_X, y);
  y += 5.2;
  setFont(8.5, true, INK);
  const bl = ascii(input.byline);
  doc.text(bl, M_X, y);
  setFont(8.5, false, MUTED);
  doc.text(ascii(`  ·  ${input.dateLine}`), M_X + doc.getTextWidth(bl), y);
  y += 3.6;
  doc.line(M_X, y, PW - M_X, y);
  y += 8;

  /* ── Body paragraphs ──────────────────────────────────────────────────── */
  input.body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).forEach(para => {
    block(para, 10, false, INK, 5.2, 3.2);
  });

  /* ── Sources ──────────────────────────────────────────────────────────── */
  if (input.sources.length) {
    need(16);
    y += 3;
    doc.setDrawColor(HAIR[0], HAIR[1], HAIR[2]);
    doc.setLineWidth(0.2);
    doc.line(M_X, y, PW - M_X, y);
    y += 6;
    block(input.sourcesLabel.toUpperCase(), 7.5, true, MUTED, 3.8, 1.5);
    input.sources.forEach(s => {
      block(s.title, 8.5, false, INK, 4.2, 0);
      block(s.url, 7.5, false, BLUE, 3.8, 2);
    });
  }

  /* ── Editorial note ───────────────────────────────────────────────────── */
  need(12);
  y += 2;
  doc.setDrawColor(HAIR[0], HAIR[1], HAIR[2]);
  doc.setLineWidth(0.2);
  doc.line(M_X, y, PW - M_X, y);
  y += 4;
  block(input.editorialNote, 6.5, false, FAINT, 3.4, 0);

  footer();
  return doc;
}

/** `HeatPumpDB_News_<headline>.pdf`, filesystem-safe (diacritics folded, not dropped). */
export const newsPdfFileName = (title: string): string =>
  `HeatPumpDB_News_${title
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // é→e, ą→a, ż→z …
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')              // ł does not decompose
    .replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 70)}.pdf`;
