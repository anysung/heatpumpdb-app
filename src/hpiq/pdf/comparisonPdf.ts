/**
 * comparisonPdf — the open comparison as a REAL A4 landscape PDF (Premium,
 * 2026-09-29). Same rules as the data sheet (dataSheetPdf.ts): generated with
 * jsPDF, never a DOM print; our own brand artwork (brandArtwork.ts, one source
 * with the app), embedded Noto Sans (pdfFonts.ts) and the shared WinAnsi fold
 * (pdfText.ts). The rows and the BEST rule come from compareRows.ts — the very
 * definition the on-screen compare modal renders.
 *
 * The installer's branding is an optional "Prepared by … for …" band; the
 * HeatPump DB brand, watermark, source line and disclaimer always stay.
 */
import { jsPDF } from 'jspdf';
import { HpVM } from '../model';
import { HpStrings } from '../i18n';
import { compareRows, bestOf, CompareRow } from '../compareRows';
import { localListingStatus, localListingId, LOCAL_LISTING_SOURCE } from '../listing';
import { FLAG_ASPECT, LOGO_ASPECT } from '../../components/brandSvg';
import { getBrandArtwork } from './brandArtwork';
import { registerPdfFonts, PDF_FONT_FAMILY } from './pdfFonts';
import { foldPdfText } from './pdfText';
import { PdfBranding, drawBrandingBand, measureBrandingBand } from './brandingBand';
import type { BrandingStrings } from '../features/branding/strings';

/* ── Geometry (mm): A4 landscape ─────────────────────────────────────────── */
const PW = 297;
const PH = 210;
const M_X = 14;
const M_TOP = 10;
const M_BOT = 14;
const CW = PW - M_X * 2;
const LABEL_W = 50;

type Rgb = [number, number, number];
const INK: Rgb = [29, 29, 31];
const MUTED: Rgb = [122, 122, 122];
const BLUE: Rgb = [0, 102, 204];
const FAINT: Rgb = [154, 154, 160];
const TILE: Rgb = [245, 245, 247];
const ZEBRA: Rgb = [250, 250, 250];
const LINE: Rgb = [224, 224, 224];
const HAIR: Rgb = [236, 236, 236];
const GREEN: Rgb = [10, 122, 67];
const GREEN_BG: Rgb = [231, 246, 238];

export interface ComparisonPdfInput {
  items: HpVM[];
  t: HpStrings;
  s: BrandingStrings;
  branding: PdfBranding | null;
  /** App "data status" date (already formatted for the locale). */
  dataStatusDate: string;
}

export function buildComparisonPdf({ items, t, s, branding, dataStatusDate }: ComparisonPdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true });
  const font = registerPdfFonts(doc);
  const latinExt = font === PDF_FONT_FAMILY;
  const ascii = (x: string) => foldPdfText(x, latinExt);
  const set = (size: number, bold = false, c: Rgb = INK) => {
    doc.setFont(font, bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(c[0], c[1], c[2]);
  };
  const today = new Date().toLocaleDateString(t.locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const preparedByLine = branding && measureBrandingBand(branding) && branding.company?.trim()
    ? ascii(`${branding.labels.preparedBy} ${branding.company.trim()}`).slice(0, 60) : '';

  let y = M_TOP;

  const watermark = () => {
    doc.saveGraphicsState();
    // @ts-expect-error — GState is available at runtime in jsPDF 4.
    doc.setGState(new doc.GState({ opacity: 0.06 }));
    set(60, true, INK);
    doc.text('HeatPump DB', PW / 2, PH / 2 + 8, { align: 'center' });
    doc.restoreGraphicsState();
  };
  const pageFooters = () => {
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      set(7, false, FAINT);
      doc.text(ascii(t.footer.copyright(new Date().getFullYear())), M_X, PH - 7);
      if (preparedByLine) doc.text(preparedByLine, PW - M_X - 14, PH - 7, { align: 'right' });
      doc.text(`${p} / ${total}`, PW - M_X, PH - 7, { align: 'right' });
    }
  };

  /* ── Header: the real brand lockup + waving flag (never redrawn) ─────── */
  const LOGO_H = 9;
  const LOGO_W = LOGO_H * LOGO_ASPECT;
  const FLAG_H = 7.6;
  const FLAG_W = FLAG_H * FLAG_ASPECT;
  const art = getBrandArtwork();
  watermark();
  if (art) {
    doc.addImage(art.logo.dataUrl, 'PNG', M_X, y, LOGO_W, LOGO_H, undefined, 'MEDIUM');
    doc.addImage(art.flag.dataUrl, 'PNG', M_X + LOGO_W + 4, y + (LOGO_H - FLAG_H) / 2, FLAG_W, FLAG_H, undefined, 'MEDIUM');
  } else {
    set(17, true, INK);
    doc.text('HeatPump', M_X, y + LOGO_H * 0.75);
    set(17, true, BLUE);
    doc.text('DB', M_X + doc.getTextWidth('HeatPump '), y + LOGO_H * 0.75);
  }
  set(8, false, MUTED);
  doc.text(ascii(`${t.ds.generated} ${today}`), PW - M_X, y + 3.5, { align: 'right' });
  doc.text(ascii(s.cmpModels(items.length)), PW - M_X, y + 8, { align: 'right' });
  y += LOGO_H + 5;

  const bandH = drawBrandingBand(doc, M_X, y, CW, branding, font, ascii);
  if (bandH) y += bandH + 5;

  set(15, true, INK);
  doc.text(ascii(s.cmpTitle), M_X, y + 4);
  y += 9;

  /* ── Table ──────────────────────────────────────────────────────────── */
  const n = Math.max(1, items.length);
  const colW = (CW - LABEL_W) / n;
  const colX = (i: number) => M_X + LABEL_W + i * colW;

  const rows: CompareRow[] = compareRows(t);
  // Local listing status (the market's OWN list only — listing.ts). Not a
  // screen row: on paper it is the fact a customer quote hinges on.
  if (LOCAL_LISTING_SOURCE) {
    rows.push({
      label: t.ds.f.bafaStatus,
      value: c => {
        const st = localListingStatus(c.raw);
        const id = localListingId(c.raw);
        const txt = st === 'listed' ? t.ds.f.listed : st === 'not_listed' ? t.ds.f.notListed : t.ds.f.verifyRequired;
        return id ? `${txt} · ${id}` : txt;
      },
      dim: true,
    });
  }

  const headH = (() => {
    let max = 0;
    items.forEach(c => {
      set(10, true, INK);
      const ml = (doc.splitTextToSize(ascii(c.model), colW - 8) as string[]).slice(0, 3).length;
      max = Math.max(max, ml);
    });
    return 6 + max * 4.4 + 5;
  })();

  const drawHeadRow = () => {
    doc.setFillColor(TILE[0], TILE[1], TILE[2]);
    doc.rect(M_X, y, CW, headH, 'F');
    items.forEach((c, i) => {
      const x = colX(i) + 4;
      set(10, true, INK);
      const ml = (doc.splitTextToSize(ascii(c.model), colW - 8) as string[]).slice(0, 3);
      ml.forEach((ln, li) => doc.text(ln, x, y + 6 + li * 4.4));
      set(7.5, false, MUTED);
      doc.text((doc.splitTextToSize(ascii(c.mfr), colW - 8) as string[])[0] ?? '', x, y + 6 + ml.length * 4.4 + 0.6);
    });
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.5);
    doc.line(M_X, y + headH, M_X + CW, y + headH);
    y += headH;
  };

  let tableTop = y;
  const frame = (bottom: number) => {
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(M_X, tableTop, CW, bottom - tableTop, 2, 2, 'S');
    for (let i = 0; i < n; i++) doc.line(colX(i), tableTop, colX(i), bottom);
  };

  drawHeadRow();

  const bestLabel = ascii(t.products.bestBadge);
  rows.forEach((row, ri) => {
    const best = bestOf(row, items);
    const size = row.dim ? 8 : 9.5;
    set(size, !!row.strong, INK);
    const wrapped = items.map(c => doc.splitTextToSize(ascii(row.value(c)), colW - (best != null ? 22 : 8)) as string[]);
    set(8, true, MUTED);
    const labelLines = doc.splitTextToSize(ascii(row.label), LABEL_W - 8) as string[];
    const lines = Math.max(labelLines.length, ...wrapped.map(w => w.length));
    const rowH = Math.max(8.4, lines * 4 + 4.4);

    if (y + rowH > PH - M_BOT) {
      frame(y);
      doc.addPage();
      watermark();
      y = M_TOP;
      tableTop = y;
      drawHeadRow();
    }

    if (ri % 2) {
      doc.setFillColor(ZEBRA[0], ZEBRA[1], ZEBRA[2]);
      doc.rect(M_X, y, CW, rowH, 'F');
    }
    if (ri > 0) {
      doc.setDrawColor(HAIR[0], HAIR[1], HAIR[2]);
      doc.setLineWidth(0.2);
      doc.line(M_X, y, M_X + CW, y);
    }
    // label — bold, muted, vertically centred
    set(8, true, MUTED);
    const ly = y + rowH / 2 - ((labelLines.length - 1) * 4) / 2 + 1.1;
    labelLines.forEach((ln, li) => doc.text(ln, M_X + 5, ly + li * 4));

    items.forEach((c, i) => {
      const isBest = best != null && row.metric!(c) === best;
      const w = wrapped[i];
      const cx = colX(i) + colW / 2;
      const vy = y + rowH / 2 - ((w.length - 1) * 4) / 2 + 1.3;
      if (isBest) {
        set(size, true, GREEN);
        const tw = doc.getTextWidth(w[0] ?? '');
        doc.setFontSize(6);
        const pw = doc.getTextWidth(bestLabel) + 3.6;
        const total = tw + 2.2 + pw;
        const x0 = cx - total / 2;
        set(size, true, GREEN);
        doc.text(w[0] ?? '', x0, vy);
        doc.setFillColor(GREEN_BG[0], GREEN_BG[1], GREEN_BG[2]);
        doc.roundedRect(x0 + tw + 2.2, vy - 3.1, pw, 4, 2, 2, 'F');
        set(6, true, GREEN);
        doc.text(bestLabel, x0 + tw + 2.2 + pw / 2, vy - 0.25, { align: 'center' });
      } else {
        set(size, !!row.strong, row.dim ? MUTED : INK);
        w.forEach((ln, li) => doc.text(ln, cx, vy + li * 4, { align: 'center' }));
      }
    });
    y += rowH;
  });
  frame(y);
  y += 6;

  /* ── Source + disclaimer (kept together) ─────────────────────────────── */
  set(7, false, MUTED);
  const src = doc.splitTextToSize(ascii(s.cmpSource(dataStatusDate)), CW) as string[];
  set(6.4, false, FAINT);
  const disc = doc.splitTextToSize(ascii(s.cmpDisclaimer), CW) as string[];
  const blockH = src.length * 3.4 + 3 + 3.6 + disc.length * 3.1;
  if (y + blockH > PH - M_BOT) { doc.addPage(); watermark(); y = M_TOP + 4; }
  set(7, false, MUTED);
  src.forEach((ln, i) => doc.text(ln, M_X, y + i * 3.4));
  y += src.length * 3.4 + 3;
  set(7, true, MUTED);
  doc.text(ascii(s.cmpDisclaimerTitle.toUpperCase()), M_X, y);
  y += 3.6;
  set(6.4, false, FAINT);
  disc.forEach((ln, i) => doc.text(ln, M_X, y + i * 3.1));

  pageFooters();
  return doc;
}

/** `HeatPumpDB_comparison_<customer|date>.pdf`, filesystem-safe. */
export const comparisonFileName = (preparedFor?: string): string => {
  const tag = (preparedFor?.trim() || new Date().toISOString().slice(0, 10))
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
  return `HeatPumpDB_comparison_${tag || 'export'}.pdf`;
};
