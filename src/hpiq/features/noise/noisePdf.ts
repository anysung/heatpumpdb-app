/**
 * noisePdf — the customer "Noise estimate" as a REAL A4 PDF (Premium,
 * 2026-09-29). Same conventions as the data sheet / comparison: jsPDF (never a
 * DOM print), our rasterized brand artwork (brandArtwork.ts — one source with
 * the app, never redrawn), embedded Noto Sans with the Helvetica fallback, the
 * shared WinAnsi fold (pdfText.ts), and the optional installer "Prepared by …
 * for …" band (brandingBand.ts). The disclaimer is always printed.
 *
 * Synchronous on purpose (iOS share sheet must be reached inside the click).
 */
import { jsPDF } from 'jspdf';
import type { HpStrings } from '../../i18n';
import { FLAG_ASPECT, LOGO_ASPECT } from '../../../components/brandSvg';
import { getBrandArtwork } from '../../pdf/brandArtwork';
import { registerPdfFonts, PDF_FONT_FAMILY } from '../../pdf/pdfFonts';
import { foldPdfText } from '../../pdf/pdfText';
import { PdfBranding, drawBrandingBand } from '../../pdf/brandingBand';
import type { NoiseResult, NoiseRegime } from './noiseModel';
import type { NoiseStrings, RegimeStrings } from './strings';

const PW = 210, PH = 297, M_X = 16, M_TOP = 12, M_BOT = 18;
const CW = PW - M_X * 2;

type Rgb = [number, number, number];
const INK: Rgb = [29, 29, 31];
const MUTED: Rgb = [110, 110, 115];
const FAINT: Rgb = [154, 154, 160];
const TILE: Rgb = [245, 245, 247];
const HAIR: Rgb = [228, 228, 232];
const BLUE: Rgb = [0, 102, 204];
export const VERDICT_RGB: Record<'pass' | 'tight' | 'over' | 'none', { fg: Rgb; bg: Rgb }> = {
  pass: { fg: [10, 104, 71], bg: [232, 245, 238] },
  tight: { fg: [161, 92, 0], bg: [255, 244, 229] },
  over: { fg: [179, 38, 30], bg: [253, 236, 234] },
  none: { fg: INK, bg: TILE },
};

export interface NoisePdfInput {
  t: HpStrings;
  s: NoiseStrings;
  rs: RegimeStrings;
  regime: NoiseRegime;
  result: NoiseResult;
  /** Product line (manufacturer + model), or null for a manual entry. */
  product: { mfr: string; model: string; qaCheck?: boolean } | null;
  /** Formatted input rows [label, value]. */
  inputs: [string, string][];
  /** The user's distance (m). */
  distance: number;
  formula: string;
  /** Locale number formatter (1 decimal). */
  f1: (x: number) => string;
  /** Formatter for limit values (whole dB for TA Lärm, 0.1 for MCS). */
  fLim: (x: number) => string;
  branding: PdfBranding | null;
}

export function buildNoisePdf(p: NoisePdfInput): jsPDF {
  const { t, s, rs, result, f1 } = p;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const font = registerPdfFonts(doc);
  const ascii = (x: string) => foldPdfText(x, font === PDF_FONT_FAMILY);
  const set = (size: number, bold = false, c: Rgb = INK) => {
    doc.setFont(font, bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(c[0], c[1], c[2]);
  };
  const wrap = (text: string, w: number): string[] => doc.splitTextToSize(ascii(text), w) as string[];
  let y = M_TOP;

  const watermark = () => {
    doc.saveGraphicsState();
    // @ts-expect-error — GState is available at runtime in jsPDF 4.
    doc.setGState(new doc.GState({ opacity: 0.06 }));
    set(46, true, INK);
    doc.text('HeatPump DB', PW / 2, PH / 2, { align: 'center' });
    doc.restoreGraphicsState();
  };
  const footer = () => {
    set(7.2, true, MUTED);
    doc.text(ascii(s.disclaimer), M_X, PH - 12);
    set(7, false, FAINT);
    doc.text(ascii(t.footer.copyright(new Date().getFullYear())), M_X, PH - 8);
    doc.text(`${doc.getCurrentPageInfo().pageNumber}`, PW - M_X, PH - 8, { align: 'right' });
  };
  const need = (h: number) => {
    if (y + h > PH - M_BOT) { footer(); doc.addPage(); watermark(); y = M_TOP; }
  };
  const sectionHead = (label: string) => {
    need(10);
    set(7, true, MUTED);
    doc.text(ascii(label.toUpperCase()), M_X, y + 3, { charSpace: 0.3 });
    y += 5.5;
  };

  watermark();

  /* ── Header: brand lockup + flag (brandSvg.ts via brandArtwork) ─────────── */
  const LOGO_H = 10, LOGO_W = LOGO_H * LOGO_ASPECT, FLAG_H = 8.4, FLAG_W = FLAG_H * FLAG_ASPECT;
  const art = getBrandArtwork();
  if (art) {
    doc.addImage(art.logo.dataUrl, 'PNG', M_X, y, LOGO_W, LOGO_H, undefined, 'MEDIUM');
    doc.addImage(art.flag.dataUrl, 'PNG', M_X + LOGO_W + 4, y + (LOGO_H - FLAG_H) / 2, FLAG_W, FLAG_H, undefined, 'MEDIUM');
  } else {
    set(18, true, INK);
    doc.text('HeatPump', M_X, y + LOGO_H * 0.75);
    set(18, true, BLUE);
    doc.text('DB', M_X + doc.getTextWidth('HeatPump '), y + LOGO_H * 0.75);
  }
  const today = new Date().toLocaleDateString(t.locale, { day: 'numeric', month: 'long', year: 'numeric' });
  set(8, false, MUTED);
  doc.text(ascii(`${s.generated} ${today}`), PW - M_X, y + 4, { align: 'right' });
  doc.text(ascii(rs.rule), PW - M_X, y + 8.5, { align: 'right' });
  y += LOGO_H + 6;

  /* ── Installer branding band (optional) ────────────────────────────────── */
  const bandH = drawBrandingBand(doc, M_X, y, CW, p.branding, font, ascii);
  if (bandH) y += bandH + 5;

  /* ── Title card ────────────────────────────────────────────────────────── */
  const productLine = p.product ? `${p.product.mfr} · ${p.product.model}` : s.pdfManual;
  set(10, false, [205, 205, 205]);
  const prodLines = wrap(productLine, CW - 22).slice(0, 2);
  const cardH = 14 + prodLines.length * 4.6;
  doc.setFillColor(INK[0], INK[1], INK[2]);
  doc.roundedRect(M_X, y, CW, cardH, 2, 2, 'F');
  set(16, true, [255, 255, 255]);
  doc.text(ascii(s.pdfTitle), M_X + 6, y + 9);
  set(10, false, [205, 205, 205]);
  prodLines.forEach((ln, i) => doc.text(ln, M_X + 6, y + 15 + i * 4.6));
  if (p.product?.qaCheck) {   // plausibility mark: red "(!)" — manufacturer check needed
    const lastW = doc.getTextWidth(prodLines[prodLines.length - 1] ?? '');   // still at the product-line font
    set(10, true, [255, 120, 120]);
    doc.text('(!)', M_X + 6 + lastW + 1.5, y + 15 + (prodLines.length - 1) * 4.6);
  }
  y += cardH + 3;

  /* ── Disclaimer (always, up front) ─────────────────────────────────────── */
  set(9, true, INK);
  const dl = wrap(s.disclaimer, CW - 12);
  const dh = 3.6 + dl.length * 4.2;
  doc.setDrawColor(HAIR[0], HAIR[1], HAIR[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(M_X, y, CW, dh, 2, 2, 'S');
  set(9, true, INK);
  dl.forEach((ln, i) => doc.text(ln, M_X + 6, y + 5.4 + i * 4.2));
  y += dh + 5;

  /* ── Result ────────────────────────────────────────────────────────────── */
  const vc = VERDICT_RGB[result.verdict ?? 'none'];
  const bodyText = result.verdict && rs.verdictBody ? rs.verdictBody[result.verdict] : (rs.noVerdict ?? '');
  const extra: string[] = [];
  if (result.limit != null && rs.limitLine) extra.push(rs.limitLine(p.fLim(result.limit)));
  if (result.target != null && rs.targetLine) extra.push(rs.targetLine(p.fLim(result.target)));
  if (result.rLimit != null && rs.rLimitLine) extra.push(rs.rLimitLine(f1(result.rLimit)));
  if (result.rTarget != null && rs.rTargetLine) extra.push(rs.rTargetLine(f1(result.rTarget)));
  const RX = M_X + 58;
  const RW = CW - 58 - 6;
  set(8.5, false, INK);
  const bodyLines = wrap(bodyText, RW);
  const extraLines = extra.flatMap(e => wrap(e, RW));
  const headLines = result.verdict && rs.verdict ? wrap(rs.verdict[result.verdict], RW) : [];
  const resH = Math.max(34, 8 + headLines.length * 5.4 + bodyLines.length * 3.9 + (extraLines.length ? 2 + extraLines.length * 3.9 : 0) + 4);
  need(resH + 4);
  doc.setFillColor(vc.bg[0], vc.bg[1], vc.bg[2]);
  doc.roundedRect(M_X, y, CW, resH, 2, 2, 'F');
  set(7, true, MUTED);
  doc.text(ascii(s.atDistance(f1(p.distance)).toUpperCase()), M_X + 6, y + 7, { charSpace: 0.2, maxWidth: 48 });
  set(30, true, vc.fg);
  doc.text(f1(result.lp), M_X + 6, y + 22);
  set(10, true, vc.fg);
  doc.text('dB(A)', M_X + 6, y + 28);
  let ry = y + 8;
  set(11, true, vc.fg);
  headLines.forEach(ln => { doc.text(ln, RX, ry); ry += 5.4; });
  set(8.5, false, INK);
  bodyLines.forEach(ln => { doc.text(ln, RX, ry); ry += 3.9; });
  if (extraLines.length) {
    ry += 2;
    set(8.5, true, INK);
    extraLines.forEach(ln => { doc.text(ln, RX, ry); ry += 3.9; });
  }
  y += resH + 6;

  /* ── Inputs ────────────────────────────────────────────────────────────── */
  sectionHead(s.pdfInputs);
  p.inputs.forEach(([k, v], i) => {
    set(8.5, false, INK);
    const vl = wrap(v, CW - 72);
    const h = 1.6 + vl.length * 3.8;
    need(h);
    if (i % 2 === 0) { doc.setFillColor(TILE[0], TILE[1], TILE[2]); doc.rect(M_X, y, CW, h, 'F'); }
    set(8.2, false, MUTED);
    doc.text(ascii(k), M_X + 2, y + 3.7);
    set(8.2, true, INK);
    vl.forEach((ln, li) => doc.text(ln, M_X + 70, y + 3.7 + li * 3.8));
    y += h;
  });
  y += 4;

  /* ── Distance table ────────────────────────────────────────────────────── */
  sectionHead(s.tableTitle);
  const colW = CW / (result.table.length + 1);
  need(14);
  doc.setFillColor(TILE[0], TILE[1], TILE[2]);
  doc.rect(M_X, y, CW, 12, 'F');
  set(7.5, true, MUTED);
  doc.text(ascii(s.colDist), M_X + 2, y + 4.6);
  set(8.5, true, INK);
  doc.text(ascii(s.colLp), M_X + 2, y + 9.6);
  result.table.forEach((row, i) => {
    const cx = M_X + colW * (i + 1) + colW / 2;
    set(7.5, true, MUTED);
    doc.text(`${f1(row.r)} m`, cx, y + 4.6, { align: 'center' });
    set(9, true, INK);
    doc.text(`${f1(row.lp)} dB(A)`, cx, y + 9.6, { align: 'center' });
  });
  y += 15;

  /* ── Formula, assumptions, sources, disclaimer ─────────────────────────── */
  const para = (head: string, lines: string[], size = 7.6) => {
    sectionHead(head);
    const lh = size * 0.46;
    lines.forEach(txt => {
      set(size, false, INK);
      const w = wrap(txt, CW);
      need(w.length * lh + 1);
      set(size, false, INK);
      w.forEach(ln => { doc.text(ln, M_X, y + 3); y += lh; });
      y += 0.8;
    });
    y += 2.5;
  };
  para(s.formulaTitle, [`${p.formula} = ${f1(result.lp)} dB(A)`, s.formulaBody]);
  para(s.assumptionsTitle, s.assumptions.map(a => `• ${a}`));
  if (rs.reference) para(rs.rule, [rs.reference]);
  para(s.sources, [rs.source], 7);

  footer();
  return doc;
}

export const noisePdfFileName = (model?: string): string =>
  `HeatPumpDB_Noise_${(model ?? 'estimate').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60) || 'estimate'}.pdf`;
