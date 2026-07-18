/**
 * dataSheetPdf — generates the product data sheet as a REAL PDF file.
 *
 * Why we don't print the DOM: browser print engines disagree on the two things
 * that matter. WebKit (iOS Safari, iPhone + iPad) lays print out against the
 * meta-viewport width instead of the paper, and IGNORES `@page { margin }` —
 * so the sheet came out edge-to-edge and clipped, while Chrome/macOS were fine.
 * A web page cannot force the print dialog's margins or scale (and iOS exposes
 * no margin controls at all), so DOM printing can never be made device-proof.
 *
 * Here we own the geometry instead: exact A4 (210×297mm), explicit margins,
 * our own pagination and per-page watermark. Identical bytes on every device,
 * and it doubles as the "PDF download" users asked for (iOS has no
 * "Save as PDF" print destination).
 *
 * Text is drawn with embedded Noto Sans (Latin + Latin-Extended-A subset,
 * pdfFonts.ts) so EN/DE/FR/PL all render real glyphs; if the font preload has
 * not finished the build falls back to standard Helvetica (WinAnsi). Symbol
 * folds in `ascii()` (η→eta, − →-, …) apply either way — never remove them or
 * sheets get mojibake on the fallback path.
 */
import { jsPDF } from 'jspdf';
import { HpVM, crossRefId } from '../model';
import { HpStrings } from '../i18n';
import { DsSectionKey } from '../appState';
import { localListingStatus, localListingId, LOCAL_LISTING_SOURCE } from '../listing';
import { FLAG_ASPECT, LOGO_ASPECT } from '../../components/brandSvg';
import { getBrandArtwork } from './brandArtwork';
import { registerPdfFonts, PDF_FONT_FAMILY } from './pdfFonts';

/* ── Page geometry (mm) ──────────────────────────────────────────────────── */
const PW = 210;          // A4 width
const PH = 297;          // A4 height
const M_X = 14;          // left/right margin
const M_TOP = 10;        // matches the DOM print density (owner, 2026-07-18)
const M_BOT = 13;        // leaves room for the footer line
const CW = PW - M_X * 2; // content width = 182mm
const COL_GAP = 8;
const COL_W = (CW - COL_GAP) / 2;

/* ── Palette (mirrors the on-screen sheet) ───────────────────────────────── */
const INK: [number, number, number] = [29, 29, 31];
const MUTED: [number, number, number] = [122, 122, 122];
const BLUE: [number, number, number] = [0, 102, 204];
const HAIR: [number, number, number] = [236, 236, 240];
const TILE: [number, number, number] = [245, 245, 247];
const FAINT: [number, number, number] = [154, 154, 160];

/**
 * Make a string safe for the PDF standard font (Helvetica / WinAnsi).
 *
 * WinAnsi covers Latin-1 (German umlauts, French accents are fine) plus a small
 * extras set, but NOT: eta (U+03B7, used in the "ηs" efficiency notes),
 * U+2212 MINUS (used in "COP (A−7/W35)"), ≈, ≠. Left unmapped these come out as
 * mojibake ("A^7/W35"). NFC first so combining marks compose into real letters,
 * then fold the known symbols, then drop anything still unsupported (a
 * belt-and-braces guard for strings added later).
 */
const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';

/**
 * True when the embedded Noto Sans registered on the current document — then
 * Latin-Extended-A letters (Polish ą ć ę ł ń ó ś ź ż, Czech, etc.) are kept
 * instead of dropped. Set per-build in buildDataSheetPdf.
 */
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
    .replace(/ηs/g, 'eta-s')     // seasonal space-heating efficiency
    .replace(/η/g, 'eta')
    .replace(/−/g, '-')          // MINUS SIGN
    .replace(/≈/g, '~')
    .replace(/≠/g, '!=')
    .replace(/…/g, '...')
    .replace(/[›»]/g, '>')
    .replace(/[‹«]/g, '<')
    .replace(/ /g, ' ')          // non-breaking space
    .split('')
    .filter(keepChar)
    .join('');

export interface DataSheetPdfInput {
  v: HpVM;
  t: HpStrings;
  sections: Record<DsSectionKey, boolean>;
  isLabelMode: boolean;
  /** Registry abbreviation for this market (BAFA / MCS). */
  sourceAbbr: string;
  isGb: boolean;
}

export function buildDataSheetPdf({ v, t, sections, isLabelMode, sourceAbbr, isGb }: DataSheetPdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  // Embedded Noto Sans (Latin-Extended) when preloaded; Helvetica fallback keeps
  // exports working offline. LATIN_EXT_OK widens ascii()'s keep-set to match.
  const fontFamily = registerPdfFonts(doc);
  LATIN_EXT_OK = fontFamily === PDF_FONT_FAMILY;
  let y = M_TOP;

  /* ── Footnote numbering: assigned in draw order, exactly like the on-screen
        sheet, so the [n] markers match the TECHNICAL EXPLANATIONS list. ──── */
  const noteOrder: string[] = [];
  const n = (key: string): number => {
    let i = noteOrder.indexOf(key);
    if (i === -1) { noteOrder.push(key); i = noteOrder.length - 1; }
    return i + 1;
  };

  const setFont = (size: number, bold = false, color: [number, number, number] = INK) => {
    doc.setFont(fontFamily, bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
  };

  /** Faint centred brand mark — drawn on EVERY page, like the print watermark. */
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

  const newPage = () => {
    footer();
    doc.addPage();
    watermark();
    y = M_TOP;
  };

  /** Ensure `h` mm fits on the current page; start a new one if not. */
  const need = (h: number) => { if (y + h > PH - M_BOT) newPage(); };

  watermark();

  /* ── Header: the real brand lockup + the real waving flag ────────────────
     Both are the app's own SVG artwork (src/components/brandSvg.ts), rasterized
     at print resolution by brandArtwork.ts — NOT redrawn here. Redrawing them is
     what once put a different circle and a square flag on the sheet. ───────── */
  const LOGO_H = 10;                          // lockup height (mm)
  const LOGO_W = LOGO_H * LOGO_ASPECT;        // 348:64
  const FLAG_H = 8.4;
  const FLAG_W = FLAG_H * FLAG_ASPECT;        // 96:66
  const art = getBrandArtwork();

  if (art) {
    doc.addImage(art.logo.dataUrl, 'PNG', M_X, y, LOGO_W, LOGO_H, undefined, 'MEDIUM');
    doc.addImage(art.flag.dataUrl, 'PNG', M_X + LOGO_W + 4, y + (LOGO_H - FLAG_H) / 2, FLAG_W, FLAG_H, undefined, 'MEDIUM');
  } else {
    // Preload not finished (a click within the first frames) — keep the sheet usable.
    setFont(18, true, INK);
    doc.text('HeatPump', M_X, y + LOGO_H * 0.75);
    setFont(18, true, BLUE);
    doc.text('DB', M_X + doc.getTextWidth('HeatPump '), y + LOGO_H * 0.75);
  }

  setFont(8, false, MUTED);
  doc.text(ascii(isLabelMode ? t.ds.docKindLabel : t.ds.docKindProduct), M_X, y + LOGO_H + 4);
  doc.text(ascii(`${t.ds.generated} ${new Date().toLocaleDateString(t.locale, { day: 'numeric', month: 'long', year: 'numeric' })}`), PW - M_X, y + 4, { align: 'right' });
  doc.text(ascii(`${isLabelMode ? t.ds.bafaRef : sourceAbbr} ${v.sourceId}${v.eprel ? ` · ${v.eprelId}` : ''}`), PW - M_X, y + 8.5, { align: 'right' });
  y += LOGO_H + 6;

  /* ── Title card (dark) ────────────────────────────────────────────────── */
  setFont(13.5, true, [255, 255, 255]);   // measure at the size it is drawn in
  const titleLines = doc.splitTextToSize(ascii(v.model), CW - 12) as string[];
  const cardH = 9 + titleLines.length * 6;
  need(cardH + 2);
  doc.setFillColor(INK[0], INK[1], INK[2]);
  doc.roundedRect(M_X, y, CW, cardH, 2, 2, 'F');
  setFont(13.5, true, [255, 255, 255]);
  titleLines.forEach((ln, i) => doc.text(ln, M_X + 6, y + 7.6 + i * 6));
  setFont(8.5, false, [205, 205, 205]);
  const typeStr = isGb ? (v.raw.type ?? '—').toLowerCase() : t.ds.airWater;
  doc.text(
    ascii(`${v.mfr} · ${typeStr}${v.installType !== '—' ? ` · ${v.installType.toLowerCase()}` : ''}`),
    M_X + 6, y + cardH - 3.4,
  );
  y += cardH + 4;

  /* ── Key stats (4 tiles) ──────────────────────────────────────────────── */
  const stats: [string, string][] = [
    [v.kw, t.ds.stat.kw],
    [v.scop, t.ds.stat.scop],
    [v.cop7, t.ds.stat.cop],
    [v.label, t.ds.stat.cls],
  ];
  const tileW = (CW - 3 * 4) / 4;
  const tileH = 12;
  need(tileH + 4);
  stats.forEach(([val, lbl], i) => {
    const x = M_X + i * (tileW + 4);
    doc.setFillColor(TILE[0], TILE[1], TILE[2]);
    doc.roundedRect(x, y, tileW, tileH, 1.6, 1.6, 'F');
    setFont(11.5, true, INK);
    doc.text(ascii(val), x + 4, y + 6);
    setFont(6, false, MUTED);
    doc.text(ascii(lbl.toUpperCase()), x + 4, y + 9.7);
  });
  y += tileH + 5.5;

  /* ── Section primitives ───────────────────────────────────────────────── */
  const sectionHead = (title: string, muted = false) => {
    need(9);
    setFont(8, true, muted ? MUTED : BLUE);
    doc.text(ascii(title), M_X, y);
    doc.setDrawColor(INK[0], INK[1], INK[2]);
    doc.setLineWidth(0.5);
    doc.line(M_X, y + 2.2, M_X + CW, y + 2.2);
    y += 5.5;
  };

  /** Two-column field grid. Each cell: [n] LABEL (small caps) over the value. */
  const fieldGrid = (cells: [string, string, number | null][]) => {
    for (let i = 0; i < cells.length; i += 2) {
      const row = cells.slice(i, i + 2);
      // measure the tallest cell in this row (values can wrap)
      setFont(9.5, true, INK);   // measure with the font the values are drawn in
      const wrapped = row.map(([, val]) => doc.splitTextToSize(ascii(val), COL_W - 2) as string[]);
      const rowH = 4 + Math.max(...wrapped.map(w => w.length)) * 4.6 + 2;
      need(rowH);
      row.forEach(([label, , note], c) => {
        const x = M_X + c * (COL_W + COL_GAP);
        setFont(6, false, MUTED);
        const prefix = note != null ? `[${note}] ` : '';
        doc.text(ascii(prefix + label.toUpperCase()), x, y + 2.8);
        setFont(9.5, true, INK);
        wrapped[c].forEach((ln, li) => doc.text(ln, x, y + 7 + li * 4.6));
        doc.setDrawColor(HAIR[0], HAIR[1], HAIR[2]);
        doc.setLineWidth(0.2);
        doc.line(x, y + rowH - 1, x + COL_W, y + rowH - 1);
      });
      y += rowH + 1;
    }
    y += 2;
  };

  const paragraph = (text: string, size = 7.5, color: [number, number, number] = MUTED) => {
    // setFont FIRST: splitTextToSize measures with the CURRENT font, so measuring
    // before setting it wraps the text against the previous (larger) size and the
    // paragraph never reaches the right margin.
    setFont(size, false, color);
    const lines = doc.splitTextToSize(ascii(text), CW) as string[];
    const lh = size * 0.48;
    need(lines.length * lh + 3);
    lines.forEach(ln => {
      if (y + lh > PH - M_BOT) { newPage(); setFont(size, false, color); }
      doc.text(ln, M_X, y);
      y += lh;
    });
    y += 2;
  };

  /* ── Sections (same order + toggles as the on-screen document) ─────────── */
  if (sections.identity) {
    sectionHead(t.ds.headIdentity);
    const cells: [string, string, number | null][] = [
      [t.ds.f.manufacturer, v.mfr, n('manufacturer')],
      [t.ds.f.odu, v.odu, n('odu')],
      [t.ds.f.type, `${v.raw.type ?? 'Luft / Wasser'}${v.installType !== '—' ? ` · ${v.installType}` : ''}`, n('type')],
      [t.ds.f.bafaId, v.sourceId, n('bafaId')],
    ];
    if (v.raw.nf_pac_reference) cells.push([t.ds.f.nfPac, v.raw.nf_pac_reference, n('nfPac')]);
    fieldGrid(cells);
  }

  if (isLabelMode) {
    sectionHead(t.ds.headEuLabel);
    fieldGrid([
      [t.ds.f.clsW35, v.label, n('classW35')],
      [t.ds.f.clsW55, v.labelMed, n('classW55')],
      [t.ds.f.eprelReg, v.eprel ? v.eprelId : t.ds.f.eprelNone, n('eprelReg')],
      [t.ds.f.infoSheet, v.eprel ? t.ds.f.available : '—', null],
    ]);
    paragraph(t.ds.labelDerivation);
  }

  if (sections.performance) {
    sectionHead(t.ds.headPerf);
    fieldGrid([
      [t.ds.f.kw55, v.kw === '—' ? '—' : `${v.kw} kW`, n('kw55')],
      [t.ds.f.scop, v.scop, n('scop')],
      [t.ds.f.cop7, v.cop7, n('cop7')],
      [t.ds.f.cop2, v.cop2, n('cop2')],
      [t.ds.f.copm7, v.copm7, n('copm7')],
    ]);
    if (crossRefId(v.raw) != null) {
      paragraph(t.ds.perfCrossRefNote(crossRefId(v.raw) ?? '—'));
    }
  }

  if (sections.env) {
    sectionHead(t.ds.headEnv);
    fieldGrid([
      [t.ds.f.ref, v.ref, n('ref')],
      [t.ds.f.refKg, v.refKg === '—' ? '—' : `${v.refKg} kg`, n('refKg')],
      [t.ds.f.noise, v.noise === '—' ? '—' : `${v.noise} dB(A)`, n('noise')],
      [t.ds.f.grid, isGb ? '—' : v.raw.grid_ready ? t.ds.f.yes : t.ds.f.no, n('grid')],
    ]);
  }

  if (sections.bafa && !isLabelMode) {
    sectionHead(t.ds.headBafa);
    // Listing status only where this market has a national list of its own — a
    // foreign registry's listing is never printed as a local one.
    const rows: [string, string, number][] = [];
    if (LOCAL_LISTING_SOURCE) {
      const st = localListingStatus(v.raw);
      rows.push([
        t.ds.f.bafaStatus,
        st === 'listed' ? t.ds.f.listed
          : st === 'not_listed' ? t.ds.f.notListed
            : t.ds.f.verifyRequired,
        n('bafaStatus'),
      ]);
      const id = localListingId(v.raw);
      if (id) rows.push([t.ds.f.localListingId, id, n('localListingId')]);
    }
    rows.push([t.ds.f.begRel, t.ds.f.begVerify, n('begRel')]);
    fieldGrid(rows);
  }

  // (SOURCE & VERIFICATION removed 2026-07-12 — the disclaimer below already
  //  covers provenance; it was duplicate wording.)

  /* ── Technical explanations (footnotes, in the order they were used) ───── */
  if (noteOrder.length) {
    need(10);
    y += 2;
    doc.setDrawColor(HAIR[0], HAIR[1], HAIR[2]);
    doc.setLineWidth(0.3);
    doc.line(M_X, y, M_X + CW, y);
    y += 4;
    setFont(7.5, true, MUTED);
    doc.text(ascii(t.ds.techExplanations), M_X, y);
    y += 3.8;
    noteOrder.forEach((key, i) => {
      const note = (t.ds.notes as Record<string, string>)[key] ?? '';
      setFont(6.5, false, MUTED);
      const lines = doc.splitTextToSize(ascii(note), CW - 7) as string[];
      need(lines.length * 3.2 + 1.2);
      setFont(6.5, false, FAINT);
      doc.text(`[${i + 1}]`, M_X, y);
      setFont(6.5, false, MUTED);
      lines.forEach((ln, li) => doc.text(ln, M_X + 6, y + li * 3.2));
      y += lines.length * 3.2 + 1;
    });
    y += 2;
  }

  /* ── Legal disclaimer ─────────────────────────────────────────────────── */
  need(12);
  doc.setDrawColor(HAIR[0], HAIR[1], HAIR[2]);
  doc.setLineWidth(0.3);
  doc.line(M_X, y, M_X + CW, y);
  y += 4;
  setFont(7.5, true, MUTED);
  doc.text(ascii(t.ds.disclaimerTitle), M_X, y);
  y += 3.5;
  paragraph(t.ds.disclaimer, 6.2, FAINT);

  footer();
  return doc;
}

/** `HeatPumpDB_<model>_<sourceId>.pdf`, filesystem-safe. */
export const pdfFileName = (v: HpVM): string =>
  `HeatPumpDB_${`${v.model}_${v.sourceId}`.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80)}.pdf`;
