/**
 * brandingBand — the Premium "Prepared by <logo> <company> · <contact> — for
 * <customer>" band shared by the generated data sheet and comparison PDFs
 * (2026-09-29).
 *
 * The document stays OURS: HeatPump DB brand, watermark, source and disclaimer
 * are untouched — the installer appears as the PREPARER of the document, never
 * as its author or as the source of the data. The logo is the user's own PNG
 * data URL (Account → Branding, pre-scaled to ≤ 600×200 px), drawn as-is.
 */
import type { jsPDF } from 'jspdf';

export interface PdfBranding {
  /** PNG data URL (already downscaled client-side). */
  logo?: string;
  company?: string;
  contact?: string;
  /** Optional customer / project the document was prepared for. */
  preparedFor?: string;
  labels: { preparedBy: string; preparedFor: string };
}

type Rgb = [number, number, number];
const INK: Rgb = [29, 29, 31];
const MUTED: Rgb = [122, 122, 122];
const TILE: Rgb = [245, 245, 247];
const RULE: Rgb = [214, 214, 220];

export const BAND_H = 17;          // mm — fixed, so pagination can reserve it up front
const PAD = 4;
const LOGO_MAX_W = 40;
const LOGO_MAX_H = BAND_H - 7;
const FOR_W = 60;                  // max width of the right-hand "prepared for" column

/** True when there is anything to print (a band with nothing in it is noise). */
export const hasBrandingContent = (b: PdfBranding | null | undefined): b is PdfBranding =>
  !!b && !!(b.logo || b.company?.trim() || b.contact?.trim() || b.preparedFor?.trim());

export const measureBrandingBand = (b: PdfBranding | null | undefined): number =>
  hasBrandingContent(b) ? BAND_H : 0;

/**
 * Draw the band at (x, y) across `w` mm. Returns the height used (0 if the
 * branding is empty). `ascii` is the caller's WinAnsi-safe fold and `font` the
 * family it registered, so the band renders with the document's own fonts.
 */
export function drawBrandingBand(
  doc: jsPDF, x: number, y: number, w: number,
  b: PdfBranding | null | undefined, font: string, ascii: (s: string) => string,
): number {
  if (!hasBrandingContent(b)) return 0;
  const set = (size: number, bold: boolean, c: Rgb) => {
    doc.setFont(font, bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(c[0], c[1], c[2]);
  };

  doc.setFillColor(TILE[0], TILE[1], TILE[2]);
  doc.roundedRect(x, y, w, BAND_H, 2, 2, 'F');

  // Logo — fitted into the box by its own aspect ratio; a broken image never
  // breaks the export (the band just prints without it).
  let tx = x + PAD;
  if (b.logo) {
    try {
      const p = doc.getImageProperties(b.logo);
      const aspect = p.width / Math.max(1, p.height);
      let lw = LOGO_MAX_W, lh = lw / aspect;
      if (lh > LOGO_MAX_H) { lh = LOGO_MAX_H; lw = lh * aspect; }
      doc.addImage(b.logo, 'PNG', tx, y + (BAND_H - lh) / 2, lw, lh, undefined, 'MEDIUM');
      tx += lw + 5;
    } catch { /* unreadable logo — text only */ }
  }

  const forText = b.preparedFor?.trim() ?? '';
  // The customer column is only as wide as its text needs (a short name leaves
  // the room to the contact line); long names wrap to two lines at FOR_W.
  let forW = 0;
  if (forText) {
    set(9.5, true, INK);
    const nameW = doc.getTextWidth(ascii(forText));
    set(5.8, true, MUTED);
    const labelW = doc.getTextWidth(ascii(b.labels.preparedFor.toUpperCase())) + 3;
    forW = Math.min(FOR_W, Math.max(40, nameW + PAD + 4, labelW + PAD + 4));
  }
  const textRight = forText ? x + w - forW - 4 : x + w - PAD;
  const textW = Math.max(20, textRight - tx);
  /** One line that fits textW: step the size down to `minSize`, then cut with "...". */
  const fit = (s: string, size: number, minSize: number, bold: boolean): [string, number] => {
    const full = ascii(s);
    for (let sz = size; sz >= minSize - 1e-6; sz -= 0.25) {
      set(sz, bold, INK);
      if (doc.getTextWidth(full) <= textW) return [full, sz];
    }
    set(minSize, bold, INK);
    let cut = full;
    while (cut.length > 1 && doc.getTextWidth(`${cut}...`) > textW) cut = cut.slice(0, -1);
    return [`${cut.trimEnd()}...`, minSize];
  };

  // Left: PREPARED BY / company / contact (skipped when only a customer is set)
  const company = b.company?.trim() ?? '';
  const contact = b.contact?.trim() ?? '';
  const hasLeft = !!(b.logo || company || contact);
  if (hasLeft) {
    set(5.8, true, MUTED);
    doc.text(ascii(b.labels.preparedBy.toUpperCase()), tx, y + 5, { charSpace: 0.25 });
  }
  if (company) {
    const [line, sz] = fit(company, 10.5, 8.5, true);
    set(sz, true, INK);
    doc.text(line, tx, y + 10);
  }
  if (contact) {
    const [line, sz] = fit(contact, 7.5, 6.2, false);
    set(sz, false, MUTED);
    doc.text(line, tx, company ? y + 14 : y + 10);
  }

  // Right: PREPARED FOR / customer (max two lines)
  if (forText) {
    // Customer only (no saved branding): the label takes the band's left edge.
    const fx = hasLeft ? x + w - forW : x + PAD - 2;
    if (hasLeft) {
      doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
      doc.setLineWidth(0.25);
      doc.line(fx - 2, y + 3.2, fx - 2, y + BAND_H - 3.2);
    }
    set(5.8, true, MUTED);
    doc.text(ascii(b.labels.preparedFor.toUpperCase()), fx + 2, y + 5, { charSpace: 0.25 });
    set(9.5, true, INK);
    const lines = (doc.splitTextToSize(ascii(forText), hasLeft ? forW - PAD - 2 : w - 2 * PAD) as string[]).slice(0, 2);
    lines.forEach((ln, i) => doc.text(ln, fx + 2, y + 10 + i * 4));
  }
  return BAND_H;
}
