/**
 * partnerPdf — the creator-partner documents as REAL PDFs (2026-10-18):
 *   · the monthly statement (layout of the approved sample, marketing folder
 *     influencer-marketing/06-sample-monthly-statement.pdf),
 *   · the payment receipt the partner signs and returns (terms §6),
 *   · the annual statement of amounts paid (terms §7, on request).
 *
 * Rendered in the admin console and posted to the billing function, which
 * mails it (with the CSV it builds itself) from marketing@. Same doctrine as
 * every generated document here: jsPDF with our own A4 geometry, the embedded
 * Noto Sans (pdfFonts.ts — Polish diacritics render), and the brand logo from
 * brandArtwork.ts, which rasterizes src/components/brandSvg.ts. The mark is
 * NEVER redrawn here (CLAUDE.md, one-source rule).
 *
 * Numbers come only from the stored statement / ledger documents, which the
 * function computed through partnerRules.js. This file formats; it does not
 * calculate money (sums of already-booked entries aside).
 */
import { jsPDF } from 'jspdf';
import { LOGO_ASPECT } from '../../brandSvg';
import { getBrandArtwork, preloadBrandArtwork } from '../../../hpiq/pdf/brandArtwork';
import { preloadPdfFonts, registerPdfFonts } from '../../../hpiq/pdf/pdfFonts';
import { OPERATOR_NAME, OPERATOR_OWNER, BUSINESS_REG_NUMBER, BUSINESS_ADDRESS_LINES, MARKETING_EMAIL } from '../../../config/legal';
import programme from '../../../legal/partnerProgramme.json';
import { PL, PdfLang, pdfLang } from './partnerPdfCopy';

export type Rgb = [number, number, number];
const INK: Rgb = [29, 29, 31];
const MUTED: Rgb = [110, 110, 115];
const FAINT: Rgb = [154, 154, 160];
const HAIR: Rgb = [226, 226, 230];
const GREEN: Rgb = [10, 104, 71];
const TINT: Rgb = [244, 247, 245];
const RED: Rgb = [176, 32, 32];

const PW = 210, PH = 297, MX = 16, MTOP = 14, MBOT = 16, CW = PW - MX * 2;

/** Call before building (admin page mount): fonts + logo raster. */
export async function preloadPartnerPdf(): Promise<void> {
  await Promise.all([preloadPdfFonts(), preloadBrandArtwork('DE')]);
}

const LOCALE: Record<PdfLang, string> = { en: 'en-GB', de: 'de-DE', fr: 'fr-FR', pl: 'pl-PL', it: 'it-IT' };

/** Keep what the embedded font can draw (Latin-1 + Latin-Extended-A + WinAnsi extras). */
const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
let EXT_OK = false;
const safe = (s: string): string => String(s ?? '').normalize('NFC')
  .replace(/−/g, '-').replace(/ /g, ' ').replace(/ /g, ' ').replace(/•/g, '·')
  .split('').filter(ch => {
    const cp = ch.codePointAt(0) ?? 0;
    return cp <= 0xFF || (EXT_OK && cp >= 0x100 && cp <= 0x17F) || WINANSI_EXTRA.includes(ch);
  }).join('');

class Doc {
  d: jsPDF; y = MTOP; font = 'helvetica'; lang: PdfLang; footer: string;
  constructor(lang: PdfLang, footer: string) {
    this.d = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    this.font = registerPdfFonts(this.d);
    EXT_OK = this.font !== 'helvetica';
    this.lang = lang; this.footer = footer;
  }
  eur(c: number | null | undefined, signed = false): string {
    const v = (c ?? 0) / 100;
    const s = new Intl.NumberFormat(LOCALE[this.lang], { style: 'currency', currency: 'EUR' }).format(Math.abs(v));
    return signed ? `${v < 0 ? '−' : v > 0 ? '+' : ''}${s}` : (v < 0 ? `−${s}` : s);
  }
  date(iso: string): string {
    if (!iso) return '—';
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00Z` : iso);
    return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat(LOCALE[this.lang], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' }).format(d);
  }
  month(ym: string): string {
    const [y, m] = ym.split('-').map(Number);
    return new Intl.DateTimeFormat(LOCALE[this.lang], { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 15)));
  }
  set(size: number, bold = false, color: Rgb = INK) {
    this.d.setFont(this.font, bold ? 'bold' : 'normal'); this.d.setFontSize(size); this.d.setTextColor(...color);
  }
  text(s: string, x: number, y: number, opts: any = {}) { this.d.text(safe(s), x, y, opts); }
  wrap(s: string, w: number): string[] { return this.d.splitTextToSize(safe(s), w) as string[]; }
  need(h: number) { if (this.y + h > PH - MBOT) { this.d.addPage(); this.y = MTOP + 4; } }
  hair(y = this.y) { this.d.setDrawColor(...HAIR); this.d.setLineWidth(0.25); this.d.line(MX, y, PW - MX, y); }
  header(title: string, sub: string, badge?: string) {
    const art = getBrandArtwork();
    if (art) {
      const h = 8.5, w = h * LOGO_ASPECT;
      this.d.addImage(art.logo.dataUrl, 'PNG', MX, this.y, w, h);
    } else {
      this.set(15, true); this.text('HeatPump DB', MX, this.y + 6.5);
    }
    this.set(13, true); this.text(title, PW - MX, this.y + 3.6, { align: 'right' });
    this.set(10, false, MUTED); this.text(sub, PW - MX, this.y + 8.6, { align: 'right' });
    if (badge) { this.set(7.5, true, GREEN); this.text(badge, PW - MX, this.y + 12.8, { align: 'right' }); }
    this.y += 16; this.hair(); this.y += 6;
  }
  section(title: string) {
    this.need(14);
    this.set(10.5, true); this.text(title, MX, this.y); this.y += 2.2; this.hair(); this.y += 5;
  }
  para(s: string, size = 8.6, color: Rgb = MUTED) {
    this.set(size, false, color);
    for (const line of this.wrap(s, CW)) { this.need(4.4); this.text(line, MX, this.y); this.y += size * 0.45; }
    this.y += 1.5;
  }
  /** Two-column key/value grid. */
  meta(rows: [string, string][]) {
    const colW = CW / 2;
    rows.forEach(([k, v], i) => {
      const x = MX + (i % 2) * colW;
      if (i % 2 === 0 && i) this.y += 9.5;
      this.set(7.6, false, MUTED); this.text(k, x, this.y);
      this.set(9.6, true); this.text(v || '—', x, this.y + 4.4);
    });
    this.y += 13;
  }
  tiles(items: { label: string; value: string; sub?: string; accent?: boolean }[]) {
    this.need(24);
    const gap = 3, w = (CW - gap * (items.length - 1)) / items.length, h = 20;
    items.forEach((it, i) => {
      const x = MX + i * (w + gap);
      this.d.setFillColor(...(it.accent ? TINT : ([250, 250, 251] as Rgb)));
      this.d.setDrawColor(...(it.accent ? ([190, 220, 205] as Rgb) : HAIR));
      this.d.roundedRect(x, this.y, w, h, 2, 2, 'FD');
      this.set(7.2, false, MUTED); this.text(it.label, x + 3, this.y + 5);
      this.set(13, true, it.accent ? GREEN : INK); this.text(it.value, x + 3, this.y + 12);
      if (it.sub) { this.set(7, false, FAINT); this.text(it.sub, x + 3, this.y + 16.8); }
    });
    this.y += h + 7;
  }
  /** Table: widths in mm, right-aligned columns by index. */
  table(head: string[], rows: string[][], widths: number[], right: number[], foot?: string[]) {
    const rowH = 6;
    const draw = (cells: string[], bold: boolean, color: Rgb, fill?: Rgb) => {
      this.need(rowH + 1);
      if (fill) { this.d.setFillColor(...fill); this.d.rect(MX, this.y - 4.2, CW, rowH, 'F'); }
      let x = MX;
      cells.forEach((c, i) => {
        this.set(bold ? 7.8 : 8.3, bold, color);
        const w = widths[i];
        const txt = (this.wrap(c, w - 2)[0] ?? '');
        if (right.includes(i)) this.text(txt, x + w - 1, this.y, { align: 'right' });
        else this.text(txt, x + 1, this.y);
        x += w;
      });
      this.y += rowH;
    };
    draw(head, true, MUTED, [245, 245, 247]);
    rows.forEach(r => { draw(r, false, INK); this.d.setDrawColor(...HAIR); this.d.setLineWidth(0.15); this.d.line(MX, this.y - 4.4, PW - MX, this.y - 4.4); });
    if (foot) draw(foot, true, INK, TINT);
    this.y += 3;
  }
  kv(rows: [string, string, Rgb?][], boldLast = true) {
    rows.forEach(([k, v, col], i) => {
      this.need(6);
      const last = boldLast && i === rows.length - 1;
      this.set(last ? 9.6 : 8.8, last, INK); this.text(k, MX + 1, this.y);
      this.set(last ? 9.6 : 8.8, last, col || INK); this.text(v, PW - MX - 1, this.y, { align: 'right' });
      if (last) { this.d.setDrawColor(...HAIR); this.d.line(MX, this.y - 4.6, PW - MX, this.y - 4.6); }
      this.y += 5.6;
    });
    this.y += 2;
  }
  finish(): jsPDF {
    const n = this.d.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      this.d.setPage(i);
      this.set(7, false, FAINT);
      this.text(this.footer, MX, PH - 8);
      this.text(`${i} / ${n}`, PW - MX, PH - 8, { align: 'right' });
    }
    return this.d;
  }
}

export interface PartnerLite {
  pid: string; name: string; code: string; lang?: string; contractNo?: string;
  premiumUntil?: string; payoutMethod?: string; createdAt?: string; contractSignedAt?: string;
}

/** Monthly statement. `st` is a partnerStatements document. */
export function buildStatementPdf(st: any, partner: PartnerLite): jsPDF {
  const lang = pdfLang(partner.lang);
  const L = PL[lang];
  const doc = new Doc(lang, `${L.footer} · ${MARKETING_EMAIL}`);
  const month = doc.month(st.month);
  doc.header(L.stTitle, month, st.status === 'draft' ? L.draftBadge : undefined);

  doc.meta([
    [L.partner, partner.name], [L.statementNo, st.statementNo || st.id],
    [L.code, partner.code], [L.issued, doc.date(new Date().toISOString())],
    [L.contractNo, partner.contractNo || '—'], [L.partnerSince, doc.date(st.partnerSince || '')],
  ]);

  doc.tiles([
    st.payoutDue
      ? { label: L.tilePayout, value: doc.eur(st.closingCents), sub: L.tileBy(doc.date(st.payoutDueBy)), accent: true }
      : { label: L.tileBalance, value: doc.eur(st.closingCents), sub: L.tileCarried(doc.eur(programme.payoutThresholdEur * 100)), accent: true },
    { label: L.tilePaying, value: String(st.cumulativePaying), sub: L.tileNew(st.newPaying) },
    { label: L.tileActive, value: String(st.activePaying), sub: L.tileEarning },
    { label: L.tilePaid, value: doc.eur(st.paidToDateCents), sub: L.tilePaidSub },
  ]);

  // Commission table
  doc.section(L.secCommission(month));
  const groups: any[] = st.groups || [];
  if (groups.length) {
    const rate = Math.round(programme.commissionRate * 100);
    doc.table(
      [L.colPlan, L.colBilling, L.colPayment, L.colPayments, L.colNet, L.colYours(rate), L.colTotal],
      groups.map(g => [
        L.plan[g.planCode] ?? g.planCode, L.term[g.billingTerm] ?? g.billingTerm,
        g.kind === 'first' ? L.firstPayment(programme.firstPaymentDiscountPct) : L.renewal,
        String(g.payments), doc.eur(Math.round(g.netCents / g.payments)),
        doc.eur(Math.round(g.amountCents / g.payments)), doc.eur(g.amountCents) + (g.pending ? ' *' : ''),
      ]),
      [30, 22, 34, 18, 26, 24, 24], [3, 4, 5, 6],
      [L.commissionRow, '', '', String(groups.reduce((a, g) => a + g.payments, 0)), '', '', doc.eur(st.commissionCents)],
    );
    if (st.pendingCount) doc.para(L.pendingNote(st.pendingCount));
  } else {
    doc.para(L.noPayments, 9, INK);
  }
  doc.para(L.netNote);

  // Balance
  doc.section(L.secBalance);
  const bal: [string, string, Rgb?][] = [[L.opening, doc.eur(st.openingCents)]];
  bal.push([L.commissionOf(month), doc.eur(st.commissionCents, true), GREEN]);
  if (st.clawbackCents) bal.push([L.refunds, doc.eur(st.clawbackCents, true), RED]);
  if (st.videoSupportCents) bal.push([L.videoSupport, doc.eur(st.videoSupportCents, true), GREEN]);
  if (st.manualCents) bal.push([L.corrections, doc.eur(st.manualCents, true)]);
  if (st.payoutCents) bal.push([L.paidOut, doc.eur(st.payoutCents, true)]);
  if (st.payoutFeeCents) bal.push([L.transferCost, doc.eur(st.payoutFeeCents, true)]);
  bal.push([st.payoutDue ? L.payoutRow : L.balanceRow, doc.eur(st.closingCents)]);
  doc.kv(bal);
  doc.para(st.payoutDue ? L.payoutNote(doc.date(st.payoutDueBy)) : L.carryNote(doc.eur(programme.payoutThresholdEur * 100)));

  // Audience
  const a = st.audience || {};
  doc.section(L.secAudience(month));
  doc.kv([
    [L.newPaying, String(a.newPaying ?? st.newPaying)],
    [`   ${L.ofWhichAnnual}`, String(a.newAnnual ?? 0)],
    [`   ${L.ofWhichTeam}`, String(a.newTeam ?? 0)],
    [L.cancellations, String(a.cancellations ?? st.cancellations)],
    [L.refundsCount, String(a.refunds ?? 0)],
    [L.activeEnd, `${st.activePaying}  (${a.activeMonthly ?? 0} / ${a.activeAnnual ?? 0} ${L.monthlyAnnual})`],
  ], false);

  // History
  const hist: any[] = st.history || [];
  if (hist.length > 1) {
    doc.section(L.secHistory);
    doc.table(
      [L.colMonth, L.colNew, L.colTotalPaying, L.colCommission, L.colVideo, L.colPaidOut],
      hist.map(h => [doc.month(h.month), String(h.newPaying), String(h.cumulativePaying), doc.eur(h.commissionCents),
        h.videoSupportCents ? doc.eur(h.videoSupportCents) : '—', h.paidOutCents ? doc.eur(h.paidOutCents) : '—']),
      [38, 22, 26, 32, 30, 30], [1, 2, 3, 4, 5],
    );
    doc.para(L.windowNote(programme.commissionMonths));
  }

  // Video support + Premium
  doc.section(L.secVideo);
  doc.para(st.videoSupportEligible
    ? L.videoEligible(doc.eur(programme.videoSupportEur * 100))
    : L.videoProgress(st.cumulativePaying, programme.videoSupportMinPaidAccounts, doc.eur(programme.videoSupportEur * 100)), 8.8, INK);
  if (partner.premiumUntil) {
    doc.section(L.secPremium);
    doc.para(L.premiumNote(doc.date(partner.premiumUntil)), 8.8, INK);
  }
  doc.section(L.secPayment);
  doc.para(L.paymentNote, 8.8, INK);
  doc.para(L.privacy);
  return doc.finish();
}

export interface PayoutEntry { id: string; amountCents: number; at: string; reference?: string; note?: string; month?: string }

/** Payment receipt for one payout (terms §6): the partner signs and returns it. */
export function buildReceiptPdf(entry: PayoutEntry, partner: PartnerLite): jsPDF {
  const lang = pdfLang(partner.lang);
  const L = PL[lang];
  const doc = new Doc(lang, `${L.footer} · ${MARKETING_EMAIL}`);
  const amount = -entry.amountCents;
  doc.header(L.rcTitle, `R-${entry.id}`);
  doc.meta([
    [L.payer, `${OPERATOR_NAME} (${OPERATOR_OWNER})`], [L.regNo, BUSINESS_REG_NUMBER],
    [L.recipient, partner.name], [L.code, partner.code],
    [L.contractNo, partner.contractNo || '—'], [L.transferDate, doc.date(entry.at)],
  ]);
  doc.set(8.6, false, MUTED);
  doc.text(BUSINESS_ADDRESS_LINES.join(', '), MX, doc.y - 4);
  doc.y += 4;
  doc.tiles([
    { label: L.amountPaid, value: doc.eur(amount), sub: L.inEur, accent: true },
    { label: L.reference, value: entry.reference || '—' },
  ]);
  doc.section(L.rcConfirmTitle);
  doc.para(L.rcConfirm(doc.eur(amount), doc.date(entry.at)), 9.4, INK);
  doc.para(L.rcTax, 8.6);
  doc.y += 14;
  const line = (label: string, x: number, w: number) => {
    doc.d.setDrawColor(...INK); doc.d.setLineWidth(0.3); doc.d.line(x, doc.y, x + w, doc.y);
    doc.set(7.6, false, MUTED); doc.text(label, x, doc.y + 4.2);
  };
  line(L.placeDate, MX, 70); line(L.signature, MX + 90, CW - 90);
  doc.y += 20;
  line(L.nameInPrint, MX, 70);
  doc.y += 14;
  doc.para(L.rcReturn(MARKETING_EMAIL));
  return doc.finish();
}

/** Annual statement of amounts paid (terms §7, on request). */
export function buildAnnualPdf(year: string, payouts: PayoutEntry[], fees: PayoutEntry[], partner: PartnerLite): jsPDF {
  const lang = pdfLang(partner.lang);
  const L = PL[lang];
  const doc = new Doc(lang, `${L.footer} · ${MARKETING_EMAIL}`);
  doc.header(L.anTitle, year);
  doc.meta([
    [L.recipient, partner.name], [L.code, partner.code],
    [L.payer, `${OPERATOR_NAME} (${OPERATOR_OWNER})`], [L.regNo, BUSINESS_REG_NUMBER],
  ]);
  const total = -payouts.reduce((s, p) => s + p.amountCents, 0);
  const feeTotal = -fees.reduce((s, p) => s + p.amountCents, 0);
  doc.tiles([
    { label: L.anTotal(year), value: doc.eur(total), accent: true },
    { label: L.anCount, value: String(payouts.length) },
    ...(feeTotal ? [{ label: L.transferCost, value: doc.eur(feeTotal) }] : []),
  ]);
  doc.section(L.anPayments);
  doc.table([L.transferDate, L.reference, L.amountPaid],
    payouts.slice().sort((a, b) => a.at.localeCompare(b.at)).map(p => [doc.date(p.at), p.reference || '—', doc.eur(-p.amountCents)]),
    [60, 72, 46], [2], [L.total, '', doc.eur(total)]);
  doc.para(L.anNote);
  doc.para(L.rcTax);
  return doc.finish();
}

/** jsPDF → base64 (no data: prefix) for the function call. */
export const pdfBase64 = (d: jsPDF): string => (d.output('datauristring') as string).split(',')[1];
