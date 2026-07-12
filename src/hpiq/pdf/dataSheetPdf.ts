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
 * Text is drawn with the standard PDF font (Helvetica, WinAnsi), which covers
 * EN/DE/FR. Typographic characters outside Latin-1 are folded to ASCII by
 * `ascii()` — never remove that or German/French sheets get mojibake.
 */
import { jsPDF } from 'jspdf';
import { HpVM } from '../model';
import { HpStrings } from '../i18n';
import { DsSectionKey } from '../appState';

/* ── Page geometry (mm) ──────────────────────────────────────────────────── */
const PW = 210;          // A4 width
const PH = 297;          // A4 height
const M_X = 14;          // left/right margin
const M_TOP = 14;
const M_BOT = 16;        // leaves room for the footer line
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
    .filter(ch => ch.codePointAt(0) <= 0xFF || WINANSI_EXTRA.includes(ch))
    .join('');

/* ── Brand artwork, redrawn as PDF vectors ───────────────────────────────────
   The app's logo and flag are SVGs (src/components/BrandLogo.tsx). Rasterising
   them would blur in print, so they are reproduced here with PDF vector
   primitives — same geometry, same brand colours, crisp at any zoom. ───────── */

const LOGO_RED: [number, number, number] = [224, 69, 44];    // #e0452c (light theme)
const LOGO_BLUE: [number, number, number] = [0, 102, 204];   // #0066cc

/** Polyline arc of `r` around (cx,cy), from a0 to a1 degrees (y-down, as in the SVG). */
function arc(
  doc: jsPDF, cx: number, cy: number, r: number,
  a0: number, a1: number, color: [number, number, number], lw: number,
): void {
  const steps = 40;
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(lw);
  doc.setLineCap('round');
  doc.setLineJoin('round');
  let px = cx + r * Math.cos((a0 * Math.PI) / 180);
  let py = cy + r * Math.sin((a0 * Math.PI) / 180);
  for (let i = 1; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const nx = cx + r * Math.cos((a * Math.PI) / 180);
    const ny = cy + r * Math.sin((a * Math.PI) / 180);
    doc.line(px, py, nx, ny);
    px = nx; py = ny;
  }
}

/**
 * The circular HeatPump DB mark (BrandLogo symbol, viewBox 0 0 64 64):
 * a red top arc and a blue bottom arc with the two chevrons, and the white hub.
 * `size` is the drawn box in mm; (ox,oy) is its top-left corner.
 */
function drawLogoMark(doc: jsPDF, ox: number, oy: number, size: number): void {
  const s = size / 64;                       // SVG unit -> mm
  const X = (u: number) => ox + u * s;
  const Y = (u: number) => oy + u * s;
  const lw = 5.5 * s;

  // Rotating ring: red over the top (theta 180 -> 360), blue under (0 -> 180).
  arc(doc, X(32), Y(32), 22 * s, 180, 360, LOGO_RED, lw);
  arc(doc, X(32), Y(32), 22 * s, 0, 180, LOGO_BLUE, lw);

  // Arrow heads that make the ring read as a cycle.
  doc.setLineCap('round');
  doc.setLineJoin('round');
  doc.setLineWidth(lw);
  doc.setDrawColor(LOGO_RED[0], LOGO_RED[1], LOGO_RED[2]);
  doc.line(X(49), Y(31), X(54), Y(38));
  doc.line(X(54), Y(38), X(59), Y(31));
  doc.setDrawColor(LOGO_BLUE[0], LOGO_BLUE[1], LOGO_BLUE[2]);
  doc.line(X(5), Y(33), X(10), Y(26));
  doc.line(X(10), Y(26), X(15), Y(33));

  // White hub punched through the middle.
  doc.setFillColor(255, 255, 255);
  doc.circle(X(32), Y(32), 6.5 * s, 'F');

  doc.setLineCap('butt');
  doc.setLineJoin('miter');
}

/**
 * Clip everything drawn by `paint` to the rect. jsPDF has no public clip API, so
 * we emit the PDF operators directly: `re W n` = build the rect path, intersect
 * the clip with it, paint nothing. PDF space is y-up, hence the flip.
 * (`internal.out` exists at runtime but isn't in jsPDF's typings.)
 */
function clipped(doc: jsPDF, x: number, y: number, w: number, h: number, paint: () => void): void {
  const internal = doc.internal as unknown as { scaleFactor: number; out: (s: string) => void };
  const k = internal.scaleFactor;
  const pageH = doc.internal.pageSize.getHeight();
  doc.saveGraphicsState();
  internal.out(
    `${(x * k).toFixed(2)} ${((pageH - y - h) * k).toFixed(2)} ${(w * k).toFixed(2)} ${(h * k).toFixed(2)} re W n`,
  );
  paint();
  doc.restoreGraphicsState();
}

/** Market flag (flat face + hairline), `h` mm tall, at (x,y). Aspect 96:66. */
function drawFlag(doc: jsPDF, x: number, y: number, h: number, country: string): void {
  const w = h * (96 / 66);
  if (country === 'DE') {
    const band = h / 3;
    doc.setFillColor(26, 26, 26);   doc.rect(x, y, w, band, 'F');
    doc.setFillColor(221, 0, 0);    doc.rect(x, y + band, w, band, 'F');
    doc.setFillColor(255, 204, 0);  doc.rect(x, y + 2 * band, w, band, 'F');
  } else if (country === 'FR') {
    const band = w / 3;
    doc.setFillColor(0, 0, 145);    doc.rect(x, y, band, h, 'F');
    doc.setFillColor(255, 255, 255); doc.rect(x + band, y, band, h, 'F');
    doc.setFillColor(225, 0, 15);   doc.rect(x + 2 * band, y, band, h, 'F');
  } else if (country === 'GB') {
    const u = h / 66;   // SVG unit -> mm
    doc.setFillColor(1, 33, 105);
    doc.rect(x, y, w, h, 'F');
    clipped(doc, x, y, w, h, () => {
      doc.setLineCap('butt');
      // white saltire, then the red saltire on top
      doc.setDrawColor(255, 255, 255); doc.setLineWidth(13 * u);
      doc.line(x, y, x + w, y + h);
      doc.line(x + w, y, x, y + h);
      doc.setDrawColor(200, 16, 46); doc.setLineWidth(5 * u);
      doc.line(x, y, x + w, y + h);
      doc.line(x + w, y, x, y + h);
      // white cross, then the red cross on top
      doc.setDrawColor(255, 255, 255); doc.setLineWidth(20 * u);
      doc.line(x + w / 2, y, x + w / 2, y + h);
      doc.line(x, y + h / 2, x + w, y + h / 2);
      doc.setDrawColor(200, 16, 46); doc.setLineWidth(11 * u);
      doc.line(x + w / 2, y, x + w / 2, y + h);
      doc.line(x, y + h / 2, x + w, y + h / 2);
    });
  } else {
    doc.setFillColor(122, 122, 122);
    doc.rect(x, y, w, h, 'F');
  }
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h, 'S');
}

export interface DataSheetPdfInput {
  v: HpVM;
  t: HpStrings;
  sections: Record<DsSectionKey, boolean>;
  isLabelMode: boolean;
  /** Registry abbreviation for this market (BAFA / MCS). */
  sourceAbbr: string;
  isGb: boolean;
  /** ISO country code of the active market — selects the flag. */
  country: string;
}

export function buildDataSheetPdf({ v, t, sections, isLabelMode, sourceAbbr, isGb, country }: DataSheetPdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
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
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
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

  /* ── Header: circular mark + enlarged wordmark + market flag ───────────── */
  const MARK = 11;                      // logo mark box (mm)
  const FLAG_H = 7.4;                   // flag height (mm)
  const baseline = y + MARK * 0.72;     // wordmark sits optically centred on the mark

  drawLogoMark(doc, M_X, y, MARK);

  setFont(18, true, INK);
  const textX = M_X + MARK + 3.5;
  doc.text('HeatPump', textX, baseline);
  const wHp = doc.getTextWidth('HeatPump ');
  setFont(18, true, BLUE);
  doc.text('DB', textX + wHp, baseline);
  const wDb = doc.getTextWidth('DB');

  drawFlag(doc, textX + wHp + wDb + 3.5, y + (MARK - FLAG_H) / 2, FLAG_H, country);

  setFont(8, false, MUTED);
  doc.text(ascii(isLabelMode ? t.ds.docKindLabel : t.ds.docKindProduct), M_X, y + MARK + 4);

  setFont(8, false, MUTED);
  doc.text(ascii(`${t.ds.generated} ${new Date().toLocaleDateString(t.locale, { day: 'numeric', month: 'long', year: 'numeric' })}`), PW - M_X, y + 4, { align: 'right' });
  doc.text(ascii(`${isLabelMode ? t.ds.bafaRef : sourceAbbr} ${v.sourceId}${v.eprel ? ` · ${v.eprelId}` : ''}`), PW - M_X, y + 8.5, { align: 'right' });
  y += MARK + 8;

  /* ── Title card (dark) ────────────────────────────────────────────────── */
  setFont(15, true, [255, 255, 255]);   // measure at the size it is drawn in
  const titleLines = doc.splitTextToSize(ascii(v.model), CW - 12) as string[];
  const cardH = 11 + titleLines.length * 6.4;
  need(cardH + 2);
  doc.setFillColor(INK[0], INK[1], INK[2]);
  doc.roundedRect(M_X, y, CW, cardH, 2, 2, 'F');
  setFont(15, true, [255, 255, 255]);
  titleLines.forEach((ln, i) => doc.text(ln, M_X + 6, y + 8.5 + i * 6.4));
  setFont(9, false, [205, 205, 205]);
  const typeStr = isGb ? (v.raw.type ?? '—').toLowerCase() : t.ds.airWater;
  doc.text(
    ascii(`${v.mfr} · ${typeStr}${v.installType !== '—' ? ` · ${v.installType.toLowerCase()}` : ''}`),
    M_X + 6, y + cardH - 4,
  );
  y += cardH + 5;

  /* ── Key stats (4 tiles) ──────────────────────────────────────────────── */
  const stats: [string, string][] = [
    [v.kw, t.ds.stat.kw],
    [v.scop, t.ds.stat.scop],
    [v.cop7, t.ds.stat.cop],
    [v.label, t.ds.stat.cls],
  ];
  const tileW = (CW - 3 * 4) / 4;
  const tileH = 15;
  need(tileH + 4);
  stats.forEach(([val, lbl], i) => {
    const x = M_X + i * (tileW + 4);
    doc.setFillColor(TILE[0], TILE[1], TILE[2]);
    doc.roundedRect(x, y, tileW, tileH, 1.6, 1.6, 'F');
    setFont(13, true, INK);
    doc.text(ascii(val), x + 4, y + 7);
    setFont(6.5, false, MUTED);
    doc.text(ascii(lbl.toUpperCase()), x + 4, y + 11.8);
  });
  y += tileH + 7;

  /* ── Section primitives ───────────────────────────────────────────────── */
  const sectionHead = (title: string, muted = false) => {
    need(11);
    setFont(8, true, muted ? MUTED : BLUE);
    doc.text(ascii(title), M_X, y);
    doc.setDrawColor(INK[0], INK[1], INK[2]);
    doc.setLineWidth(0.5);
    doc.line(M_X, y + 2.2, M_X + CW, y + 2.2);
    y += 7;
  };

  /** Two-column field grid. Each cell: [n] LABEL (small caps) over the value. */
  const fieldGrid = (cells: [string, string, number | null][]) => {
    for (let i = 0; i < cells.length; i += 2) {
      const row = cells.slice(i, i + 2);
      // measure the tallest cell in this row (values can wrap)
      setFont(10, true, INK);   // measure with the font the values are drawn in
      const wrapped = row.map(([, val]) => doc.splitTextToSize(ascii(val), COL_W - 2) as string[]);
      const rowH = 5 + Math.max(...wrapped.map(w => w.length)) * 5 + 3;
      need(rowH);
      row.forEach(([label, , note], c) => {
        const x = M_X + c * (COL_W + COL_GAP);
        setFont(6.5, false, MUTED);
        const prefix = note != null ? `[${note}] ` : '';
        doc.text(ascii(prefix + label.toUpperCase()), x, y + 3);
        setFont(10, true, INK);
        wrapped[c].forEach((ln, li) => doc.text(ln, x, y + 8 + li * 5));
        doc.setDrawColor(HAIR[0], HAIR[1], HAIR[2]);
        doc.setLineWidth(0.2);
        doc.line(x, y + rowH - 1, x + COL_W, y + rowH - 1);
      });
      y += rowH + 1.5;
    }
    y += 3;
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
    y += 3;
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
    if (v.raw.performance_source === 'BAFA_REFERENCE') {
      paragraph(t.ds.perfCrossRefNote(v.raw.bafa_reference_id ?? '—'));
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
    fieldGrid([
      [
        t.ds.f.bafaStatus,
        (v.raw.bafa_listing_status ?? 'listed_in_snapshot') === 'listed_in_snapshot' ? t.ds.f.listed : t.ds.f.notListed,
        n('bafaStatus'),
      ],
      [t.ds.f.begRel, t.ds.f.begVerify, n('begRel')],
    ]);
  }

  // (SOURCE & VERIFICATION removed 2026-07-12 — the disclaimer below already
  //  covers provenance; it was duplicate wording.)

  /* ── Technical explanations (footnotes, in the order they were used) ───── */
  if (noteOrder.length) {
    need(12);
    y += 2;
    doc.setDrawColor(HAIR[0], HAIR[1], HAIR[2]);
    doc.setLineWidth(0.3);
    doc.line(M_X, y, M_X + CW, y);
    y += 5;
    setFont(7.5, true, MUTED);
    doc.text(ascii(t.ds.techExplanations), M_X, y);
    y += 4.5;
    noteOrder.forEach((key, i) => {
      const note = (t.ds.notes as Record<string, string>)[key] ?? '';
      setFont(6.5, false, MUTED);
      const lines = doc.splitTextToSize(ascii(note), CW - 7) as string[];
      need(lines.length * 3.4 + 1.5);
      setFont(6.5, false, FAINT);
      doc.text(`[${i + 1}]`, M_X, y);
      setFont(6.5, false, MUTED);
      lines.forEach((ln, li) => doc.text(ln, M_X + 6, y + li * 3.4));
      y += lines.length * 3.4 + 1.2;
    });
    y += 2;
  }

  /* ── Legal disclaimer ─────────────────────────────────────────────────── */
  need(14);
  doc.setDrawColor(HAIR[0], HAIR[1], HAIR[2]);
  doc.setLineWidth(0.3);
  doc.line(M_X, y, M_X + CW, y);
  y += 5;
  setFont(7.5, true, MUTED);
  doc.text(ascii(t.ds.disclaimerTitle), M_X, y);
  y += 4;
  paragraph(t.ds.disclaimer, 6.2, FAINT);

  footer();
  return doc;
}

/** `HeatPumpDB_<model>_<sourceId>.pdf`, filesystem-safe. */
export const pdfFileName = (v: HpVM): string =>
  `HeatPumpDB_${`${v.model}_${v.sourceId}`.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80)}.pdf`;
