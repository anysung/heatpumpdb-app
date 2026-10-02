/**
 * projectPdf — the customer shortlist as a REAL A4 PDF (jsPDF), same
 * conventions as pdf/dataSheetPdf.ts: own geometry + pagination, per-page
 * watermark, the app's rasterized brand artwork (brandArtwork.ts — never
 * redrawn), embedded Noto Sans (pdfFonts.ts) with the Helvetica fallback, and
 * the same `ascii()` symbol folds so no sheet ever shows mojibake.
 * Delivered through pdf/deliverPdf.ts — never window.print().
 *
 * Synchronous on purpose (iOS share sheet must be reached inside the click).
 */
import { jsPDF } from 'jspdf';
import { HpVM } from '../../model';
import { HpStrings } from '../../i18n';
import { localListingStatus, LOCAL_LISTING_SOURCE } from '../../listing';
import { FLAG_ASPECT, LOGO_ASPECT } from '../../../components/brandSvg';
import { getBrandArtwork } from '../../pdf/brandArtwork';
import { registerPdfFonts, PDF_FONT_FAMILY } from '../../pdf/pdfFonts';
import { Project, DetailChoiceKey, sortTasks, MAX_CANDIDATES } from './projectModel';
import { ProjectStrings } from './strings';
import { ProjectFormStrings } from './formStrings';

const PW = 210, PH = 297, M_X = 14, M_TOP = 10, M_BOT = 16;
const CW = PW - M_X * 2;

const INK: [number, number, number] = [29, 29, 31];
const MUTED: [number, number, number] = [122, 122, 122];
const HAIR: [number, number, number] = [228, 228, 232];
const TILE: [number, number, number] = [245, 245, 247];
const FAINT: [number, number, number] = [154, 154, 160];
const BLUE: [number, number, number] = [0, 102, 204];
const AMBER: [number, number, number] = [138, 106, 31];

/* Same keep-set + folds as dataSheetPdf.ts ascii() — keep in sync. */
const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
function makeAscii(latinExt: boolean) {
  const keep = (ch: string) => {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp <= 0xFF) return true;
    if (latinExt && cp >= 0x100 && cp <= 0x17F) return true;
    return WINANSI_EXTRA.includes(ch);
  };
  return (s: string): string =>
    (s ?? '').toString()
      .normalize('NFC')
      .replace(/ηs/g, 'eta-s')
      .replace(/η/g, 'eta')
      .replace(/−/g, '-')
      .replace(/≈/g, '~')
      .replace(/≠/g, '!=')
      .replace(/…/g, '...')
      .replace(/[›»]/g, '>')
      .replace(/[‹«]/g, '<')
      .replace(/ /g, ' ')
      .split('')
      .filter(keep)
      .join('');
}

export interface ProjectPdfRow { id: string; note?: string; v: HpVM | null }

export interface ProjectPdfInput {
  project: Project;
  rows: ProjectPdfRow[];
  s: ProjectStrings;
  f: ProjectFormStrings;
  t: HpStrings;
  sourceAbbr: string;
}

export function buildProjectPdf({ project, rows, s, f, t, sourceAbbr }: ProjectPdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const fontFamily = registerPdfFonts(doc);
  const ascii = makeAscii(fontFamily === PDF_FONT_FAMILY);
  let y = M_TOP;

  const setFont = (size: number, bold = false, color = INK) => {
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
    doc.text(ascii(project.name).slice(0, 60), PW / 2, PH - 8, { align: 'center' });
    doc.text(`${doc.getCurrentPageInfo().pageNumber}`, PW - M_X, PH - 8, { align: 'right' });
  };
  const newPage = () => { footer(); doc.addPage(); watermark(); y = M_TOP; };
  const need = (h: number) => { if (y + h > PH - M_BOT) { newPage(); return true; } return false; };

  watermark();

  /* ── Header: the real brand lockup + flag (brandSvg.ts via brandArtwork) ── */
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
  doc.text(ascii(s.models(Math.min(project.items.length, MAX_CANDIDATES))), PW - M_X, y + 8.5, { align: 'right' });
  y += LOGO_H + 7;

  /* ── Title card ───────────────────────────────────────────────────────── */
  setFont(14, true, [255, 255, 255]);
  const titleLines = doc.splitTextToSize(ascii(project.name), CW - 12) as string[];
  const sub = project.customer ? `${s.pdfCustomer}: ${project.customer}` : '';
  const cardH = 8 + titleLines.length * 6.2 + (sub ? 5 : 0);
  doc.setFillColor(INK[0], INK[1], INK[2]);
  doc.roundedRect(M_X, y, CW, cardH, 2, 2, 'F');
  setFont(14, true, [255, 255, 255]);
  titleLines.forEach((ln, i) => doc.text(ln, M_X + 6, y + 8 + i * 6.2));
  if (sub) { setFont(9, false, [205, 205, 205]); doc.text(ascii(sub), M_X + 6, y + cardH - 3.6); }
  y += cardH + 5;

  /* ── Job details (v2): status, dates, contact, site, building ───────────── */
  {
    const d = project.details;
    const opt = (k: DetailChoiceKey) => (d[k] ? f.opt[k][d[k]] ?? '' : '');
    const day = (iso: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString(t.locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '');
    const chosen = rows.find(r => r.id === project.selectedId)?.v;
    const building = [
      opt('buildingType'), opt('projectType'),
      d.buildYear && `${f.fBuildYear} ${d.buildYear}`,
      d.area && `${d.area} m²`,
      d.heatLoad && `${f.fHeatLoad.replace(/\s*\(kW\)/, '')} ${d.heatLoad} kW`,
      opt('existing') && `${f.fExisting}: ${opt('existing')}`,
      opt('distribution'), opt('dhw') && `${f.fDhw}: ${opt('dhw')}`, opt('supply'),
    ].filter(Boolean).join(' · ');
    const pairs: [string, string][] = ([
      [f.pdfStatus, f.status[project.status]],
      [f.pdfTarget, day(project.targetDate)],
      [f.pdfContact, [d.phone, d.email].filter(Boolean).join(' · ')],
      [f.pdfSite, [d.address, [d.postcode, d.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')],
      [f.pdfBuilding, building],
      [f.fFunding, opt('funding')],
      [f.pdfChosen, chosen ? `${chosen.mfr} ${chosen.model}` : ''],
    ] as [string, string][]).filter(([, v]) => v);
    if (pairs.length) {
      const LABEL_W = 34;
      setFont(8.5, false, INK);
      const blocks = pairs.map(([k, v]) => ({ k, lines: doc.splitTextToSize(ascii(v), CW - LABEL_W - 8) as string[] }));
      const h = 4 + blocks.reduce((n, b) => n + b.lines.length * 4.1 + 1.2, 0);
      need(h + 3);
      doc.setFillColor(TILE[0], TILE[1], TILE[2]);
      doc.roundedRect(M_X, y, CW, h, 1.6, 1.6, 'F');
      let yy = y + 5.6;
      blocks.forEach(b => {
        setFont(6.8, true, MUTED);
        doc.text(ascii(b.k.toUpperCase()), M_X + 4, yy);
        setFont(8.5, false, INK);
        b.lines.forEach((ln, i) => doc.text(ln, M_X + 4 + LABEL_W, yy + i * 4.1));
        yy += b.lines.length * 4.1 + 1.2;
      });
      y += h + 5;
    }
  }

  /* ── Notes ────────────────────────────────────────────────────────────── */
  if (project.notes.trim()) {
    setFont(8.5, false, INK);
    const lines = doc.splitTextToSize(ascii(project.notes), CW - 8) as string[];
    const h = 7 + lines.length * 4.1;
    need(h + 3);
    doc.setFillColor(TILE[0], TILE[1], TILE[2]);
    doc.roundedRect(M_X, y, CW, h, 1.6, 1.6, 'F');
    setFont(6.8, true, MUTED);
    doc.text(ascii(s.pdfNotes.toUpperCase()), M_X + 4, y + 4.6);
    setFont(8.5, false, INK);
    lines.forEach((ln, i) => doc.text(ln, M_X + 4, y + 9 + i * 4.1));
    y += h + 5;
  }

  /* ── Items table ──────────────────────────────────────────────────────── */
  const showListing = !!LOCAL_LISTING_SOURCE;
  type Col = { key: string; label: string; w: number; align?: 'right' };
  const cols: Col[] = [
    { key: 'model', label: s.colModel, w: showListing ? 58 : 86 },
    { key: 'mfr', label: s.colMfr, w: 28 },
    { key: 'kw', label: s.pdfColKw, w: 17, align: 'right' },
    { key: 'scop', label: s.colScop, w: 13, align: 'right' },
    { key: 'sound', label: s.pdfColSound, w: 18, align: 'right' },
    { key: 'ref', label: s.colRef, w: 20 },
    ...(showListing ? [{ key: 'listing', label: s.colListing, w: 28 } as Col] : []),
  ];
  const PAD = 1.6;
  const header = () => {
    // Up to two lines per label, so long words (e.g. "Schallleistung") wrap
    // instead of being cut.
    setFont(6.8, true, MUTED);
    const labs = cols.map(c => (doc.splitTextToSize(ascii(c.label), c.w - PAD * 2) as string[]).slice(0, 2));
    const lines = Math.max(...labs.map(l => l.length));
    const h = 4 + lines * 3;
    doc.setFillColor(TILE[0], TILE[1], TILE[2]);
    doc.rect(M_X, y, CW, h, 'F');
    setFont(6.8, true, MUTED);
    let x = M_X;
    cols.forEach((c, i) => {
      labs[i].forEach((lab, li) => {
        const yy = y + 4.4 + li * 3;
        if (c.align === 'right') doc.text(lab, x + c.w - PAD, yy, { align: 'right' });
        else doc.text(lab, x + PAD, yy);
      });
      x += c.w;
    });
    y += h;
  };
  const listingText = (v: HpVM): string => {
    const st = localListingStatus(v.raw);
    return st === 'listed' ? t.ds.f.listed : st === 'not_listed' ? t.ds.f.notListed : t.ds.f.verifyRequired;
  };

  need(7 + 10);
  header();
  rows.forEach((r, idx) => {
    const v = r.v;
    const cells: Record<string, string> = v
      ? {
        model: `${v.model}\n${sourceAbbr} ${v.sourceId}${r.id === project.selectedId ? ` · ${f.chosen}` : ''}`,
        mfr: v.mfr,
        kw: v.ratedKw,
        scop: v.scop,
        sound: /^\d/.test(v.noise) ? `${v.noise} dB(A)` : v.noise,
        ref: v.ref,
        listing: listingText(v),
      }
      : { model: `${r.id}\n${s.gone}`, mfr: '—', kw: '—', scop: '—', sound: '—', ref: '—', listing: '—' };

    setFont(8, false, INK);
    const wrapped = cols.map(c => {
      const parts = cells[c.key].split('\n');
      const main = doc.splitTextToSize(ascii(parts[0]), c.w - PAD * 2) as string[];
      return { main: main.slice(0, 3), extra: parts[1] ? ascii(parts[1]) : '' };
    });
    const mainLines = Math.max(...wrapped.map(w => w.main.length));
    const hasExtra = wrapped.some(w => w.extra);
    setFont(7, false, MUTED);
    const noteLines = r.note ? (doc.splitTextToSize(ascii(`${s.colNote}: ${r.note}`), CW - PAD * 2) as string[]).slice(0, 4) : [];
    const rowH = 3 + mainLines * 3.8 + (hasExtra ? 3.4 : 0) + noteLines.length * 3.3 + 1.4;

    if (need(rowH)) header();
    if (idx % 2 === 1) { doc.setFillColor(251, 251, 252); doc.rect(M_X, y, CW, rowH, 'F'); }

    let x = M_X;
    cols.forEach((c, ci) => {
      const w = wrapped[ci];
      const listed = c.key === 'listing' && v && localListingStatus(v.raw) === 'listed';
      const color = c.key === 'listing' && v && !listed ? AMBER : INK;
      setFont(8, c.key === 'model', v ? color : MUTED);
      w.main.forEach((ln, li) => {
        const yy = y + 4.6 + li * 3.8;
        if (c.align === 'right') doc.text(ln, x + c.w - PAD, yy, { align: 'right' });
        else doc.text(ln, x + PAD, yy);
      });
      if (w.extra) {
        setFont(6.6, false, v ? FAINT : AMBER);
        doc.text(doc.splitTextToSize(w.extra, c.w - PAD * 2)[0] as string, x + PAD, y + 4.6 + mainLines * 3.8);
      }
      x += c.w;
    });
    if (noteLines.length) {
      setFont(7, false, MUTED);
      const ny = y + 4.6 + mainLines * 3.8 + (hasExtra ? 3.4 : 0);
      noteLines.forEach((ln, i) => doc.text(ln, M_X + PAD, ny + i * 3.3));
    }
    y += rowH;
    doc.setDrawColor(HAIR[0], HAIR[1], HAIR[2]);
    doc.setLineWidth(0.2);
    doc.line(M_X, y, M_X + CW, y);
  });

  /* ── Open to-dos ──────────────────────────────────────────────────────── */
  {
    const open = sortTasks(project.tasks).filter(x => !x.done);
    if (open.length) {
      y += 6;
      need(10 + Math.min(open.length, 3) * 4.4);
      setFont(6.8, true, MUTED);
      doc.text(ascii(f.pdfTasks.toUpperCase()), M_X, y);
      y += 4.6;
      open.forEach(x => {
        setFont(8.2, false, INK);
        const lines = doc.splitTextToSize(ascii(x.text), CW - 40) as string[];
        need(lines.length * 4 + 1.4);
        doc.setDrawColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.setLineWidth(0.25);
        doc.rect(M_X + 0.4, y - 2.6, 2.6, 2.6);
        lines.forEach((ln, i) => doc.text(ln, M_X + 5.5, y + i * 4));
        if (x.due) {
          setFont(7.6, false, MUTED);
          doc.text(ascii(new Date(`${x.due}T12:00:00`).toLocaleDateString(t.locale, { day: 'numeric', month: 'short', year: 'numeric' })), PW - M_X, y, { align: 'right' });
        }
        y += lines.length * 4 + 1.4;
      });
    }
  }

  /* ── Disclaimer ───────────────────────────────────────────────────────── */
  setFont(6.4, false, FAINT);
  const disc = doc.splitTextToSize(ascii(s.pdfDisclaimer), CW) as string[];
  need(6 + disc.length * 3.1);
  y += 5;
  disc.forEach((ln, i) => doc.text(ln, M_X, y + i * 3.1));

  footer();
  return doc;
}

/** `HeatPumpDB_Project_<name>.pdf`, filesystem-safe. */
export const projectPdfFileName = (p: Project): string =>
  `HeatPumpDB_Project_${p.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60) || 'shortlist'}.pdf`;
