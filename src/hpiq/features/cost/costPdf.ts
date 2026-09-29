/**
 * costPdf — the customer "Running cost & CO₂ estimate" as a REAL A4 PDF
 * (jsPDF), same conventions as pdf/dataSheetPdf.ts and projects/projectPdf.ts:
 * own geometry + pagination, per-page watermark, the app's rasterized brand
 * artwork (brandArtwork.ts — never redrawn), embedded Noto Sans (pdfFonts.ts)
 * with the Helvetica fallback, the same `ascii()` symbol folds, and the
 * optional installer band (pdf/brandingBand.ts). Delivered through
 * pdf/deliverPdf.ts — never window.print(). Synchronous on purpose (the iOS
 * share sheet must be reached inside the click).
 */
import { jsPDF } from 'jspdf';
import type { HpStrings } from '../../i18n';
import { FLAG_ASPECT, LOGO_ASPECT } from '../../../components/brandSvg';
import { getBrandArtwork } from '../../pdf/brandArtwork';
import { registerPdfFonts, PDF_FONT_FAMILY } from '../../pdf/pdfFonts';
import { PdfBranding, drawBrandingBand, measureBrandingBand } from '../../pdf/brandingBand';
import type { CostResult } from './costModel';
import type { CostStrings } from './strings';

const PW = 210, PH = 297, M_X = 14, M_TOP = 10, M_BOT = 16;
const CW = PW - M_X * 2;

type Rgb = [number, number, number];
const INK: Rgb = [29, 29, 31];
const MUTED: Rgb = [122, 122, 122];
const HAIR: Rgb = [228, 228, 232];
const TILE: Rgb = [245, 245, 247];
const FAINT: Rgb = [154, 154, 160];
const BLUE: Rgb = [0, 102, 204];
const GREEN: Rgb = [10, 104, 71];
const GAS: Rgb = [176, 120, 40];
const AMBER_BG: Rgb = [253, 246, 231];
const AMBER: Rgb = [138, 106, 31];

/* Same keep-set + folds as dataSheetPdf.ts ascii() — keep in sync — plus the
 * subscript ₂ of "CO₂" and a base-letter fold for the Helvetica fallback (so
 * a PL sheet reads "zl", never "z", when Noto Sans is not loaded yet). */
const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
function makeAscii(latinExt: boolean) {
  const keep = (ch: string) => {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp <= 0xFF) return true;
    if (latinExt && cp >= 0x100 && cp <= 0x17F) return true;
    return WINANSI_EXTRA.includes(ch);
  };
  const fold = (ch: string) => {
    if (keep(ch)) return ch;
    if (ch === 'ł') return 'l';
    if (ch === 'Ł') return 'L';
    const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return base !== ch && [...base].every(keep) ? base : '';
  };
  return (s: string): string =>
    (s ?? '').toString()
      .normalize('NFC')
      .replace(/ηs/g, 'eta-s')
      .replace(/η/g, 'eta')
      .replace(/₂/g, '2')
      .replace(/−/g, '-')
      .replace(/≈/g, '~')
      .replace(/≠/g, '!=')
      .replace(/÷/g, '/')
      .replace(/…/g, '...')
      .replace(/[›»]/g, '>')
      .replace(/[‹«]/g, '<')
      .replace(/[\u00a0\u202f\u2009]/g, ' ')
      .split('')
      .map(fold)
      .join('');
}

export interface CostPdfRow { label: string; value: string }
export interface CostPdfSource { label: string; source: string; asOf: string; url: string }

export interface CostPdfInput {
  s: CostStrings;
  t: HpStrings;
  model: { name: string; mfr: string; id: string };
  inputs: CostPdfRow[];
  result: CostResult;
  money: (n: number) => string;
  kg: (n: number) => string;
  scopBasis: string;
  sources: CostPdfSource[];
  defaultsAsOf: string;
  branding: PdfBranding | null;
}

export function buildCostPdf(p: CostPdfInput): jsPDF {
  const { s, t, result: r } = p;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const fontFamily = registerPdfFonts(doc);
  const ascii = makeAscii(fontFamily === PDF_FONT_FAMILY);
  let y = M_TOP;

  const setFont = (size: number, bold = false, color: Rgb = INK) => {
    doc.setFont(fontFamily, bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
  };
  const watermark = () => {
    doc.saveGraphicsState();
    // @ts-expect-error — GState is available at runtime in jsPDF 4.
    doc.setGState(new doc.GState({ opacity: 0.06 }));
    setFont(46, true, INK);
    doc.text('HeatPump DB', PW / 2, PH / 2, { align: 'center' });
    doc.restoreGraphicsState();
  };
  const footer = () => {
    setFont(7, false, FAINT);
    doc.text(ascii(t.footer.copyright(new Date().getFullYear())), M_X, PH - 8);
    doc.text(`${doc.getCurrentPageInfo().pageNumber}`, PW - M_X, PH - 8, { align: 'right' });
  };
  const newPage = () => { footer(); doc.addPage(); watermark(); y = M_TOP; };
  const need = (h: number) => { if (y + h > PH - M_BOT) newPage(); };
  const heading = (txt: string) => {
    need(12);
    setFont(7.2, true, MUTED);
    doc.text(ascii(txt.toUpperCase()), M_X, y + 3, { charSpace: 0.3 });
    y += 6;
  };

  watermark();

  /* ── Header: brand lockup + flag (brandSvg.ts via brandArtwork) ─────────── */
  const LOGO_H = 10, LOGO_W = LOGO_H * LOGO_ASPECT, FLAG_H = 8.4, FLAG_W = FLAG_H * FLAG_ASPECT;
  const art = getBrandArtwork();
  if (art) {
    doc.addImage(art.logo.dataUrl, 'PNG', M_X, y, LOGO_W, LOGO_H, undefined, 'MEDIUM');
    doc.addImage(art.flag.dataUrl, 'PNG', M_X + LOGO_W + 4, y + (LOGO_H - FLAG_H) / 2, FLAG_W, FLAG_H, undefined, 'MEDIUM');
  } else {
    setFont(18, true, INK);
    doc.text('HeatPump', M_X, y + LOGO_H * 0.75);
    setFont(18, true, BLUE);
    doc.text('DB', M_X + doc.getTextWidth('HeatPump '), y + LOGO_H * 0.75);
  }
  const dateStr = new Date().toLocaleDateString(t.locale, { day: 'numeric', month: 'long', year: 'numeric' });
  setFont(8, false, MUTED);
  doc.text(ascii(s.pdfTitle), M_X, y + LOGO_H + 4);
  doc.text(ascii(`${s.pdfGenerated} ${dateStr}`), PW - M_X, y + 4, { align: 'right' });
  y += LOGO_H + 7;

  /* ── Installer band (optional) ─────────────────────────────────────────── */
  if (measureBrandingBand(p.branding)) {
    y += drawBrandingBand(doc, M_X, y, CW, p.branding, fontFamily, ascii) + 4;
  }

  /* ── Title card ────────────────────────────────────────────────────────── */
  setFont(15, true, [255, 255, 255]);
  const titleLines = doc.splitTextToSize(ascii(s.pdfTitle), CW - 40) as string[];
  setFont(9.5, false, [215, 215, 220]);
  const subLines = (doc.splitTextToSize(ascii(`${s.pdfModel}: ${p.model.mfr} · ${p.model.name}`), CW - 12) as string[]).slice(0, 2);
  const cardH = 8 + titleLines.length * 6.4 + subLines.length * 4.4 + 2;
  doc.setFillColor(INK[0], INK[1], INK[2]);
  doc.roundedRect(M_X, y, CW, cardH, 2, 2, 'F');
  setFont(15, true, [255, 255, 255]);
  titleLines.forEach((ln, i) => doc.text(ln, M_X + 6, y + 8.5 + i * 6.4));
  setFont(9.5, false, [215, 215, 220]);
  subLines.forEach((ln, i) => doc.text(ln, M_X + 6, y + 8.5 + titleLines.length * 6.4 + i * 4.4));
  // "Estimate" pill
  setFont(7.5, true, INK);
  const pill = ascii(s.estimate.toUpperCase());
  const pw = doc.getTextWidth(pill) + 7;
  doc.setFillColor(255, 214, 102);
  doc.roundedRect(M_X + CW - pw - 5, y + 4.5, pw, 6, 3, 3, 'F');
  doc.text(pill, M_X + CW - pw / 2 - 5, y + 8.6, { align: 'center' });
  y += cardH + 6;

  /* ── Results: three tiles ─────────────────────────────────────────────── */
  heading(s.pdfResults);
  const tileW = (CW - 8) / 3, tileH = 28;
  const savingPos = r.saving >= 0, co2Pos = r.co2SavingKg >= 0;
  const tiles: { label: string; big: string; lines: string[]; color: Rgb }[] = [
    {
      label: s.annualCost,
      big: p.money(r.hpCost),
      lines: [`${s.hp} · ${s.range} ${p.money(r.band.hpCost.low)} – ${p.money(r.band.hpCost.high)}`, `${s.gas}: ${p.money(r.gasCost)}`],
      color: INK,
    },
    {
      label: savingPos ? s.saving : s.extraCost,
      big: p.money(Math.abs(r.saving)),
      lines: [`${s.range} ${p.money(r.band.saving.low)} – ${p.money(r.band.saving.high)}`],
      color: savingPos ? GREEN : AMBER,
    },
    {
      label: co2Pos ? s.co2Saving : s.co2Extra,
      big: p.kg(Math.abs(r.co2SavingKg)),
      lines: [`${s.hp}: ${p.kg(r.hpCo2Kg)} · ${s.gas}: ${p.kg(r.gasCo2Kg)}`],
      color: co2Pos ? GREEN : AMBER,
    },
  ];
  need(tileH + 4);
  tiles.forEach((tl, i) => {
    const x = M_X + i * (tileW + 4);
    doc.setFillColor(TILE[0], TILE[1], TILE[2]);
    doc.roundedRect(x, y, tileW, tileH, 2, 2, 'F');
    setFont(6.8, true, MUTED);
    doc.text((doc.splitTextToSize(ascii(tl.label.toUpperCase()), tileW - 8) as string[])[0], x + 4, y + 5.5);
    setFont(17, true, tl.color);
    doc.text(ascii(tl.big), x + 4, y + 14.5);
    setFont(7, false, MUTED);
    const ls = tl.lines.flatMap(l => doc.splitTextToSize(ascii(l), tileW - 8) as string[]).slice(0, 3);
    ls.forEach((ln, li) => doc.text(ln, x + 4, y + 20 + li * 3.4));
  });
  y += tileH + 5;

  /* ── Bar comparison (cost + CO₂) ──────────────────────────────────────── */
  const barBlock = (title: string, hp: number, gas: number, fmt: (n: number) => string, hpRange: { low: number; high: number }) => {
    const rowH = 6.4, labelW = 34, valW = 30, barW = CW - labelW - valW - 4;
    need(6 + rowH * 2 + 3);
    setFont(7.5, true, INK);
    doc.text(ascii(title), M_X, y + 3);
    y += 5;
    const max = Math.max(gas, hpRange.high, 1e-9);
    const rows: [string, number, Rgb, { low: number; high: number } | null][] = [[s.hp, hp, BLUE, hpRange], [s.gas, gas, GAS, null]];
    rows.forEach(([lab, v, c, band]) => {
      setFont(8, false, INK);
      doc.text(ascii(lab), M_X, y + 4.6);
      doc.setFillColor(TILE[0], TILE[1], TILE[2]);
      doc.rect(M_X + labelW, y + 1, barW, rowH - 2, 'F');
      doc.setFillColor(c[0], c[1], c[2]);
      doc.rect(M_X + labelW, y + 1, Math.max(0.4, (v / max) * barW), rowH - 2, 'F');
      if (band) {
        // Range whisker
        const x1 = M_X + labelW + (band.low / max) * barW, x2 = M_X + labelW + (band.high / max) * barW;
        doc.setDrawColor(INK[0], INK[1], INK[2]);
        doc.setLineWidth(0.3);
        doc.line(x1, y + rowH / 2, x2, y + rowH / 2);
        doc.line(x1, y + 2, x1, y + rowH - 2);
        doc.line(x2, y + 2, x2, y + rowH - 2);
      }
      setFont(8, true, INK);
      doc.text(ascii(fmt(v)), PW - M_X, y + 4.6, { align: 'right' });
      y += rowH;
    });
    y += 3;
  };
  barBlock(s.annualCost, r.hpCost, r.gasCost, p.money, r.band.hpCost);
  barBlock(s.co2, r.hpCo2Kg, r.gasCo2Kg, p.kg, r.band.hpCo2Kg);
  setFont(7, false, MUTED);
  const why = doc.splitTextToSize(ascii(s.bandWhy), CW) as string[];
  need(why.length * 3.3 + 3);
  why.forEach((ln, i) => doc.text(ln, M_X, y + 2 + i * 3.3));
  y += why.length * 3.3 + 5;

  /* ── Disclaimer ───────────────────────────────────────────────────────── */
  setFont(8, false, AMBER);
  const disc = doc.splitTextToSize(ascii(s.disclaimer), CW - 10) as string[];
  const dh = disc.length * 3.8 + 6;
  need(dh);
  doc.setFillColor(AMBER_BG[0], AMBER_BG[1], AMBER_BG[2]);
  doc.roundedRect(M_X, y, CW, dh, 1.6, 1.6, 'F');
  setFont(8, false, AMBER);
  disc.forEach((ln, i) => doc.text(ln, M_X + 5, y + 5 + i * 3.8));
  y += dh + 6;

  /* ── Inputs table (two columns of label/value) ────────────────────────── */
  heading(s.pdfInputs);
  const colW = (CW - 6) / 2;
  const half = Math.ceil(p.inputs.length / 2);
  const cols = [p.inputs.slice(0, half), p.inputs.slice(half)];
  const lineH = 3.6;
  const cellLines = (row: CostPdfRow) => {
    setFont(7.8, false, MUTED);
    const l = doc.splitTextToSize(ascii(row.label), colW * 0.52) as string[];
    setFont(7.8, true, INK);
    const v = doc.splitTextToSize(ascii(row.value), colW * 0.46) as string[];
    return { l, v, h: Math.max(l.length, v.length) * lineH + 2.4 };
  };
  for (let i = 0; i < half; i++) {
    const cells = cols.map(c => (c[i] ? cellLines(c[i]) : null));
    const h = Math.max(...cells.map(c => c?.h ?? 0));
    need(h);
    cells.forEach((c, ci) => {
      if (!c) return;
      const x = M_X + ci * (colW + 6);
      setFont(7.8, false, MUTED);
      c.l.forEach((ln, li) => doc.text(ln, x, y + 3.4 + li * lineH));
      setFont(7.8, true, INK);
      c.v.forEach((ln, li) => doc.text(ln, x + colW, y + 3.4 + li * lineH, { align: 'right' }));
      doc.setDrawColor(HAIR[0], HAIR[1], HAIR[2]);
      doc.setLineWidth(0.2);
      doc.line(x, y + h, x + colW, y + h);
    });
    y += h;
  }
  y += 5;

  /* ── Assumptions ──────────────────────────────────────────────────────── */
  heading(s.pdfAssumptions);
  setFont(7.8, false, INK);
  for (const a of s.assumptions(p.scopBasis)) {
    const ls = doc.splitTextToSize(ascii(a), CW - 5) as string[];
    need(ls.length * 3.6 + 1);
    setFont(7.8, false, INK); // a page break (footer) changes the font colour
    doc.text('•', M_X + 1, y + 3);
    ls.forEach((ln, i) => doc.text(ln, M_X + 5, y + 3 + i * 3.6));
    y += ls.length * 3.6 + 1;
  }
  y += 4;

  /* ── Sources ──────────────────────────────────────────────────────────── */
  heading(`${s.pdfSources} · ${s.defaultsAsOf(p.defaultsAsOf)}`);
  for (const src of p.sources) {
    setFont(6.6, true, INK);
    const head = ascii(`${src.label}: `);
    const hw = doc.getTextWidth(head);
    setFont(6.6, false, MUTED);
    const body = doc.splitTextToSize(ascii(`${src.source} (${src.asOf}) — ${src.url}`), CW - hw) as string[];
    need(body.length * 3 + 1);
    setFont(6.6, true, INK);
    doc.text(head, M_X, y + 3);
    setFont(6.6, false, MUTED);
    body.forEach((ln, i) => doc.text(ln, M_X + hw, y + 3 + i * 3));
    y += body.length * 3 + 1;
  }
  y += 4;

  footer();
  return doc;
}

export const costPdfFileName = (preparedFor: string, model: string): string => {
  const base = (preparedFor.trim() || model)
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60);
  return `HeatPumpDB_RunningCost_${base || 'estimate'}.pdf`;
};
