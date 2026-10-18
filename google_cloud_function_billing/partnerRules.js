/**
 * partnerRules — the creator-partner programme's money rules (2026-10-18).
 *
 * Pure functions, no I/O, no clock of their own: the webhook, the monthly
 * close and the admin console all compute through this file, so a commission
 * is calculated the same way whether it is booked live, re-derived at month
 * end or shown on a statement. Tested by tests/partner-ledger.unit.mjs.
 *
 * THE RULES (src/legal/partnerTerms.ts §2–§6; numbers in partnerProgramme.json)
 *   - A subscription is attributed by the DISCOUNT CODE used at checkout
 *     (Paddle discount id on the first paid transaction). Links are statistics.
 *   - Only a NEW customer qualifies: no earlier paid transaction.
 *   - Commission = rate × Net Receipts, where Net Receipts = Paddle's
 *     payout_totals.earnings (after VAT, discount and the Paddle fee), in EUR.
 *   - Every completed payment on a qualifying subscription earns, for payments
 *     billed before firstPaidAt + commissionMonths (calendar months).
 *   - Approved refunds / chargebacks / credits reverse the commission share of
 *     the reversed earnings; chargeback/credit reversals restore it.
 *   - All amounts are integer EUR cents. A balance is the SUM of ledger entries;
 *     nothing stores a balance that could drift from its entries.
 */

const PROGRAMME = require('./partnerProgramme.json');

/** Paddle money string ("690") / number → integer cents, or null. */
function cents(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** rate × amount, rounded half away from zero (so a refund mirrors its charge). */
function commissionCents(amountCents, rate = PROGRAMME.commissionRate) {
  if (!Number.isFinite(amountCents)) return 0;
  const sign = amountCents < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(amountCents) * rate);
}

/** ISO + n calendar months (UTC), day clamped to the target month's length. */
function addMonthsIso(iso, n) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + n, day = d.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const out = new Date(Date.UTC(y, m, Math.min(day, last),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()));
  return out.toISOString();
}

/** End of the commission window for a subscription first paid at `firstPaidAt`. */
function commissionEndsAt(firstPaidAt, months = PROGRAMME.commissionMonths) {
  return addMonthsIso(firstPaidAt, months);
}

/** Does a payment billed at `billedAt` still earn? (strictly before the end) */
function inCommissionWindow(firstPaidAt, billedAt, months = PROGRAMME.commissionMonths) {
  const end = commissionEndsAt(firstPaidAt, months);
  const t = Date.parse(billedAt);
  return !!end && Number.isFinite(t) && t >= Date.parse(firstPaidAt) && t < Date.parse(end);
}

/** Calendar month (YYYY-MM) of an instant in Europe/Berlin — the owner's books. */
function berlinMonth(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit' })
    .formatToParts(d);
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  return `${y}-${m}`;
}

/** First instant of the month AFTER `ym` in Berlin, as a UTC ISO string. */
function berlinMonthEndIso(ym) {
  const [y, m] = ym.split('-').map(Number);
  const next = nextMonth(ym);
  // Midnight Berlin on the 1st of the next month. Berlin is UTC+1 or UTC+2;
  // try both offsets and keep the one that lands exactly on that local midnight.
  for (const off of [1, 2]) {
    const guess = new Date(Date.UTC(y, m, 1, -off, 0, 0));   // JS month m = the NEXT month
    if (berlinMonth(guess.toISOString()) === next &&
        berlinMonth(new Date(guess.getTime() - 1).toISOString()) === ym) return guess.toISOString();
  }
  return new Date(Date.UTC(y, m, 1)).toISOString();
}

function nextMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** The payout deadline for a statement month: the Nth of the next month. */
function payoutDueDate(ym, day = PROGRAMME.payoutByDayOfMonth) {
  return `${nextMonth(ym)}-${String(day).padStart(2, '0')}`;
}

/**
 * Net Receipts of a completed transaction, in EUR cents.
 * Returns { earnings, pending, reason }: `pending` when Paddle has not settled
 * the payout figures yet, or when the payout currency is not EUR (the terms
 * fix commission in euros — a non-EUR payout needs the owner's eye).
 */
function transactionEarnings(txn) {
  const pt = txn && txn.details && txn.details.payout_totals;
  if (!pt) return { earnings: null, pending: true, reason: 'no-payout-totals' };
  if (pt.currency_code && pt.currency_code !== 'EUR') return { earnings: null, pending: true, reason: `payout-currency-${pt.currency_code}` };
  const e = cents(pt.earnings);
  if (e == null) return { earnings: null, pending: true, reason: 'earnings-null' };
  return { earnings: e, pending: false, reason: '' };
}

/** What the customer actually paid (grand total, cents) — 0 means a free checkout. */
function transactionPaidCents(txn) {
  const t = txn && txn.details && txn.details.totals;
  return cents(t && t.grand_total) ?? 0;
}

/** How an adjustment moves commission: -1 reverses, +1 restores, 0 ignores. */
const ADJ_SIGN = {
  refund: -1,
  chargeback: -1,
  credit: -1,
  chargeback_reverse: 1,
  credit_reverse: 1,
  // chargeback_warning(_reverse): a warning is not money moving — ignored.
};

/**
 * Should this adjustment event book a ledger entry now?
 * Refunds and credits book when APPROVED (a pending or rejected refund moved no
 * money). Chargebacks and reversals are facts Paddle records after the money
 * moved, so they book unless explicitly rejected.
 */
function adjustmentEffect(adj) {
  const sign = ADJ_SIGN[adj && adj.action] || 0;
  if (!sign) return { book: false, sign: 0, earnings: 0 };
  const status = (adj.status || '').toLowerCase();
  const isChargebackFamily = String(adj.action).startsWith('chargeback');
  const book = isChargebackFamily ? status !== 'rejected' && status !== 'pending_approval' : status === 'approved';
  const pt = adj.payout_totals || adj.totals || {};
  const earnings = Math.abs(cents(pt.earnings) ?? 0);
  return { book, sign, earnings };
}

// ── Self-referral heuristics (terms §2) — flags for review, never a verdict ──

const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.it', 'yahoo.fr', 'yahoo.de', 'yahoo.co.uk',
  'hotmail.com', 'hotmail.it', 'hotmail.fr', 'hotmail.de', 'hotmail.co.uk', 'outlook.com', 'outlook.de',
  'live.com', 'live.it', 'live.fr', 'msn.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com',
  'gmx.de', 'gmx.net', 'gmx.at', 'gmx.ch', 'web.de', 't-online.de', 'freenet.de', 'posteo.de',
  'mail.de', 'libero.it', 'virgilio.it', 'tiscali.it', 'alice.it', 'orange.fr', 'wanadoo.fr',
  'free.fr', 'laposte.net', 'sfr.fr', 'wp.pl', 'o2.pl', 'onet.pl', 'interia.pl', 'op.pl',
  'proton.me', 'protonmail.com', 'yandex.com', 'mail.ru', 'btinternet.com', 'sky.com',
  'privaterelay.appleid.com',
]);

const emailKey = (e) => String(e || '').trim().toLowerCase();
const domainOf = (e) => { const k = emailKey(e); const i = k.lastIndexOf('@'); return i > 0 ? k.slice(i + 1) : ''; };

/**
 * Flags that put an attribution in the review queue. The owner decides —
 * a shared company domain is often innocent (a colleague of an installer
 * subscribing), so nothing here blocks or reverses commission by itself.
 */
function selfReferralFlags({ partnerEmails = [], partnerUid = '', customerEmail = '', customerUid = '' }) {
  const flags = [];
  const ce = emailKey(customerEmail);
  const pes = partnerEmails.map(emailKey).filter(Boolean);
  if (partnerUid && customerUid && partnerUid === customerUid) flags.push('partner-own-account');
  if (ce && pes.includes(ce)) flags.push('partner-email');
  const cd = domainOf(ce);
  if (cd && !FREE_MAIL.has(cd) && pes.some(pe => domainOf(pe) === cd)) flags.push('partner-company-domain');
  return flags;
}

// ── Statements ─────────────────────────────────────────────────────────────

/** Ledger entry types and whether they count as "commission" on a statement. */
const ENTRY_TYPES = ['commission', 'clawback', 'video_support', 'payout', 'payout_fee', 'manual'];

const sum = (xs) => xs.reduce((a, b) => a + b, 0);

/**
 * Build one partner's statement for month `ym` from ALL of that partner's
 * ledger entries and attributions. Deterministic: the same inputs always give
 * the same statement, so a draft can be rebuilt any number of times.
 *
 * ledger: [{ id, type, amountCents, month, at, attributionId?, customerRef?,
 *            planCode?, billingTerm?, netCents?, pending? }]
 * attributions: [{ id, customerRef, firstPaidAt, canceledAt?, qualifying,
 *                  firstPaymentReversed? }]
 */
function buildStatement({ ym, ledger = [], attributions = [], programme = PROGRAMME }) {
  const monthEnd = berlinMonthEndIso(ym);
  const before = ledger.filter(e => e.month < ym);
  const inMonth = ledger.filter(e => e.month === ym);
  const ofType = (t) => sum(inMonth.filter(e => e.type === t).map(e => e.amountCents || 0));

  const opening = sum(before.map(e => e.amountCents || 0));
  const commission = ofType('commission');
  const clawback = ofType('clawback');
  const videoSupport = ofType('video_support');
  const payouts = ofType('payout');
  const payoutFees = ofType('payout_fee');
  const manual = ofType('manual');
  const closing = opening + commission + clawback + videoSupport + payouts + payoutFees + manual;

  const q = attributions.filter(a => a.qualifying && a.firstPaidAt);
  const paidBy = (iso) => q.filter(a => a.firstPaidAt < iso);
  const newPaying = q.filter(a => berlinMonth(a.firstPaidAt) === ym).length;
  const activePaying = paidBy(monthEnd).filter(a => !a.canceledAt || a.canceledAt >= monthEnd).length;
  const cancellations = q.filter(a => a.canceledAt && berlinMonth(a.canceledAt) === ym).length;
  const cumulativePaying = paidBy(monthEnd).filter(a => !a.firstPaymentReversed).length;

  const threshold = programme.payoutThresholdEur * 100;
  const pendingCount = inMonth.filter(e => e.pending).length;

  const lines = inMonth
    .slice()
    .sort((a, b) => String(a.at).localeCompare(String(b.at)) || String(a.id).localeCompare(String(b.id)))
    .map(e => ({
      date: String(e.at || '').slice(0, 10),
      type: e.type,
      customerRef: e.customerRef || '',
      planCode: e.planCode || '',
      billingTerm: e.billingTerm || '',
      first: !!e.first,
      netCents: Number.isFinite(e.netCents) ? e.netCents : null,
      amountCents: e.amountCents || 0,
      pending: !!e.pending,
      note: e.note || '',
      action: e.action || '',
    }));

  // The commission table of the statement: one row per plan × term × first/renewal.
  const groupMap = new Map();
  for (const l of lines.filter(x => x.type === 'commission')) {
    const k = `${l.planCode}|${l.billingTerm}|${l.first ? 'first' : 'renewal'}`;
    const g = groupMap.get(k) || { planCode: l.planCode, billingTerm: l.billingTerm, kind: l.first ? 'first' : 'renewal', payments: 0, netCents: 0, amountCents: 0, pending: 0 };
    g.payments++; g.netCents += l.netCents || 0; g.amountCents += l.amountCents; if (l.pending) g.pending++;
    groupMap.set(k, g);
  }
  const PLAN_ORDER = { professional: 1, team_3: 2, team_5: 3 };
  const groups = [...groupMap.values()].sort((a, b) =>
    (PLAN_ORDER[a.planCode] || 9) - (PLAN_ORDER[b.planCode] || 9) || a.billingTerm.localeCompare(b.billingTerm)
    || (a.kind === 'renewal' ? -1 : 1));

  const newOnes = q.filter(a => berlinMonth(a.firstPaidAt) === ym);
  const active = paidBy(monthEnd).filter(a => !a.canceledAt || a.canceledAt >= monthEnd);
  const audience = {
    newPaying,
    newAnnual: newOnes.filter(a => a.billingTerm === 'annual').length,
    newTeam: newOnes.filter(a => String(a.planCode).startsWith('team')).length,
    cancellations,
    refunds: inMonth.filter(e => e.type === 'clawback' && e.amountCents < 0).length,
    activeMonthly: active.filter(a => a.billingTerm !== 'annual').length,
    activeAnnual: active.filter(a => a.billingTerm === 'annual').length,
  };
  const paidToDateCents = -sum(ledger.filter(e => e.month <= ym && (e.type === 'payout' || e.type === 'payout_fee')).map(e => e.amountCents || 0));

  return {
    month: ym,
    openingCents: opening,
    commissionCents: commission,
    clawbackCents: clawback,
    videoSupportCents: videoSupport,
    payoutCents: payouts,
    payoutFeeCents: payoutFees,
    manualCents: manual,
    closingCents: closing,
    newPaying, activePaying, cancellations, cumulativePaying,
    videoSupportEligible: cumulativePaying >= programme.videoSupportMinPaidAccounts,
    payoutDue: closing >= threshold,
    payoutDueBy: payoutDueDate(ym, programme.payoutByDayOfMonth),
    pendingCount,
    groups, audience, paidToDateCents,
    lines,
  };
}

/** The statement's "months with HeatPump DB" table: up to `n` months ending at ym. */
function buildHistory({ ym, firstMonth, ledger = [], attributions = [], n = 6, programme = PROGRAMME }) {
  const months = [];
  let m = ym;
  while (months.length < n && (!firstMonth || m >= firstMonth)) {
    months.unshift(m);
    const [y, mo] = m.split('-').map(Number);
    m = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`;
  }
  return months.map(mm => {
    const st = buildStatement({ ym: mm, ledger, attributions, programme });
    return {
      month: mm, newPaying: st.newPaying, cumulativePaying: st.cumulativePaying,
      commissionCents: st.commissionCents + st.clawbackCents,
      videoSupportCents: st.videoSupportCents,
      paidOutCents: -(st.payoutCents + st.payoutFeeCents),
      closingCents: st.closingCents, payoutDue: st.payoutDue,
    };
  });
}

/** Customer reference shown to partners: anonymous, stable per attribution. */
const customerRef = (seq) => `C-${String(seq).padStart(4, '0')}`;

/** Line-by-line CSV for the statement attachment — no personal data. */
function statementCsv(st) {
  const eur = (c) => (c == null ? '' : (c / 100).toFixed(2));
  const rows = [['date', 'type', 'customer', 'plan', 'term', 'net_receipts_eur', 'amount_eur', 'pending', 'note']];
  for (const l of st.lines) {
    rows.push([l.date, l.type, l.customerRef, l.planCode, l.billingTerm, eur(l.netCents), eur(l.amountCents),
      l.pending ? 'yes' : '', l.note]);
  }
  return rows.map(r => r.map(v => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n') + '\n';
}

/** Partner ids (pid) are the outreach tracker's ids: lowercase slug. */
const PID_RE = /^[a-z0-9][a-z0-9-]{1,59}$/;
/** Paddle discount codes: letters + digits, ≤32 (stored uppercase). */
const CODE_RE = /^[A-Z0-9]{3,32}$/;

module.exports = {
  PROGRAMME, ENTRY_TYPES, PID_RE, CODE_RE,
  cents, commissionCents, addMonthsIso, commissionEndsAt, inCommissionWindow,
  berlinMonth, berlinMonthEndIso, nextMonth, payoutDueDate,
  transactionEarnings, transactionPaidCents, adjustmentEffect,
  selfReferralFlags, emailKey, domainOf,
  buildStatement, buildHistory, customerRef, statementCsv,
};
