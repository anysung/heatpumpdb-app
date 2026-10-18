/**
 * Creator partner programme — the money rules and the books (2026-10-18).
 *
 * Two layers:
 *   1. partnerRules.js — pure arithmetic: commission, the 24-month window,
 *      refunds, Berlin months, statements, CSV.
 *   2. partnerLedger.js — webhook scenarios replayed against an in-memory
 *      Firestore: first discounted payment → attribution, renewals without a
 *      code, refunds, chargebacks and their reversal, returning customers,
 *      self-referral flags, idempotency on replay, pending earnings.
 *
 * The asymmetry that matters: a commission booked twice is money paid that was
 * never earned, and cannot be clawed back from a creator without a dispute —
 * so every replay case is asserted, not just the happy path.
 */
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const R = require(resolve(root, 'google_cloud_function_billing/partnerRules.js'));
const makeLedger = require(resolve(root, 'google_cloud_function_billing/partnerLedger.js'));
const { statementMail, LANGS } = require(resolve(root, 'google_cloud_function_billing/partnerMailCopy.js'));

let passed = 0, failed = 0;
const is = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}  — expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`); }
};

// ── 0. One source for the numbers ─────────────────────────────────────────
console.log('\nProgramme numbers — one source\n');
const a = readFileSync(resolve(root, 'src/legal/partnerProgramme.json'), 'utf8');
const b = readFileSync(resolve(root, 'google_cloud_function_billing/partnerProgramme.json'), 'utf8');
is('function copy of partnerProgramme.json is identical to src/legal', JSON.parse(b), JSON.parse(a));
is('commission rate 30%', R.PROGRAMME.commissionRate, 0.3);
is('24 months', R.PROGRAMME.commissionMonths, 24);
is('video support threshold 50 accounts (not 100)', R.PROGRAMME.videoSupportMinPaidAccounts, 50);

// ── 1. Pure rules ─────────────────────────────────────────────────────────
console.log('\nCommission arithmetic\n');
is('30% of €6.07 net = 182 cents', R.commissionCents(607), 182);
is('half-up rounding (0.5 → 1)', R.commissionCents(5, 0.3), 2);          // 1.5 → 2
is('refund mirrors charge', R.commissionCents(-607), -182);
is('cents("690")', R.cents('690'), 690);
is('cents(null)', R.cents(null), null);

console.log('\nCommission window (24 calendar months)\n');
const first = '2026-11-20T10:00:00.000Z';
is('window end', R.commissionEndsAt(first), '2028-11-20T10:00:00.000Z');
is('first payment earns', R.inCommissionWindow(first, first), true);
is('month 24 renewal (23 months later) earns', R.inCommissionWindow(first, '2028-10-20T10:00:00.000Z'), true);
is('payment exactly at the end does not', R.inCommissionWindow(first, '2028-11-20T10:00:00.000Z'), false);
is('annual: 2nd renewal (month 24) does not earn', R.inCommissionWindow(first, '2028-11-20T10:00:01.000Z'), false);
is('annual: 1st renewal (month 12) earns', R.inCommissionWindow(first, '2027-11-20T10:00:00.000Z'), true);
is('31 Jan + 1 month clamps to 28 Feb', R.addMonthsIso('2027-01-31T00:00:00.000Z', 1), '2027-02-28T00:00:00.000Z');

console.log('\nBerlin months\n');
is('23:30 UTC on 31 Oct is November in Berlin (CET)', R.berlinMonth('2026-10-31T23:30:00Z'), '2026-11');
is('21:59 UTC on 31 Jul is still July (CEST)', R.berlinMonth('2026-07-31T21:59:00Z'), '2026-07');
is('22:00 UTC on 31 Jul is August (CEST)', R.berlinMonth('2026-07-31T22:00:00Z'), '2026-08');
is('month end of 2026-10 = 1 Nov 00:00 CET', R.berlinMonthEndIso('2026-10'), '2026-10-31T23:00:00.000Z');
is('month end of 2026-07 = 1 Aug 00:00 CEST', R.berlinMonthEndIso('2026-07'), '2026-07-31T22:00:00.000Z');
is('December rolls the year', R.payoutDueDate('2026-12'), '2027-01-15');

console.log('\nEarnings + adjustments\n');
const txnMoney = (earnings, cur = 'EUR', grand = 693) => ({ details: {
  totals: { grand_total: String(grand) }, payout_totals: { earnings: earnings == null ? null : String(earnings), currency_code: cur } } });
is('EUR earnings read', R.transactionEarnings(txnMoney(607)), { earnings: 607, pending: false, reason: '' });
is('null earnings → pending', R.transactionEarnings(txnMoney(null)).pending, true);
is('non-EUR payout → pending (terms fix EUR)', R.transactionEarnings(txnMoney(607, 'USD')).reason, 'payout-currency-USD');
is('pending refund does not book', R.adjustmentEffect({ action: 'refund', status: 'pending_approval', payout_totals: { earnings: '607' } }).book, false);
is('approved refund books −', R.adjustmentEffect({ action: 'refund', status: 'approved', payout_totals: { earnings: '607' } }), { book: true, sign: -1, earnings: 607 });
is('chargeback books −', R.adjustmentEffect({ action: 'chargeback', status: 'approved', payout_totals: { earnings: '607' } }).sign, -1);
is('chargeback reverse books +', R.adjustmentEffect({ action: 'chargeback_reverse', status: 'approved', payout_totals: { earnings: '607' } }).sign, 1);
is('chargeback warning ignored', R.adjustmentEffect({ action: 'chargeback_warning', status: 'approved' }).book, false);

console.log('\nSelf-referral flags\n');
is('same address', R.selfReferralFlags({ partnerEmails: ['a@studio.de'], customerEmail: 'A@Studio.de' }), ['partner-email', 'partner-company-domain']);
is('colleague on company domain', R.selfReferralFlags({ partnerEmails: ['a@studio.de'], customerEmail: 'b@studio.de' }), ['partner-company-domain']);
is('two gmail users are not related', R.selfReferralFlags({ partnerEmails: ['a@gmail.com'], customerEmail: 'b@gmail.com' }), []);
is('partner\'s own account', R.selfReferralFlags({ partnerUid: 'u1', customerUid: 'u1' }), ['partner-own-account']);

// ── 2. Books, against an in-memory Firestore ──────────────────────────────
function fakeDb() {
  const store = new Map();                                // path → data
  const docRef = (col, id) => ({
    id, path: `${col}/${id}`,
    async get() { const d = store.get(`${col}/${id}`); return { exists: !!d, id, data: () => d && JSON.parse(JSON.stringify(d)), ref: docRef(col, id) }; },
    async set(v, opt) { const k = `${col}/${id}`; store.set(k, opt && opt.merge ? { ...(store.get(k) || {}), ...v } : { ...v }); },
    async update(v) { const k = `${col}/${id}`; if (!store.has(k)) throw new Error(`no doc ${k}`); store.set(k, { ...store.get(k), ...v }); },
  });
  const query = (col, filters) => ({
    where(f, op, v) { return query(col, [...filters, [f, op, v]]); },
    limit() { return this; },
    async get() {
      const docs = [...store.entries()].filter(([k]) => k.startsWith(`${col}/`) && !k.slice(col.length + 1).includes('/'))
        .map(([k, d]) => ({ id: k.slice(col.length + 1), data: () => JSON.parse(JSON.stringify(d)), ref: docRef(col, k.slice(col.length + 1)) }))
        .filter(d => filters.every(([f, , v]) => d.data()[f] === v));
      return { docs, empty: !docs.length, size: docs.length };
    },
  });
  let auto = 0;
  const db = {
    collection: (col) => ({
      doc: (id) => docRef(col, id),
      where: (f, op, v) => query(col, [[f, op, v]]),
      get: () => query(col, []).get(),
      add: async (v) => { const id = `auto${++auto}`; store.set(`${col}/${id}`, v); return docRef(col, id); },
    }),
    async runTransaction(fn) {
      const writes = [];
      const tx = {
        get: (ref) => ref.get(),
        set: (ref, v, opt) => writes.push(() => ref.set(v, opt)),
        update: (ref, v) => writes.push(() => ref.update(v)),
      };
      const out = await fn(tx);
      for (const w of writes) await w();
      return out;
    },
  };
  return { db, store };
}

let clock = Date.parse('2026-11-20T10:00:00Z');
const nowIso = () => new Date(clock).toISOString();
const { db, store } = fakeDb();
const paddleCalls = [];
const paddleTxns = {};
const L = makeLedger({ db, FieldValue: {}, paddleApi: async (m, p) => { paddleCalls.push(p); return paddleTxns[p.split('/').pop()]; }, nowIso, log: { error() {} } });
const get = (path) => store.get(path);
const ledgerOf = (pid) => [...store.entries()].filter(([k, v]) => k.startsWith('partnerLedger/') && v.pid === pid).map(([, v]) => v);
const balance = (pid) => ledgerOf(pid).reduce((s, e) => s + e.amountCents, 0);

await db.collection('partners').doc('gb-rhh').set({ pid: 'gb-rhh', name: 'RHH', email: 'editor@renewableheatinghub.co.uk', status: 'active', code: 'RHH30', commissionRate: 0.3, attributionSeq: 0 });
await db.collection('partnerCodes').doc('dsc_rhh').set({ pid: 'gb-rhh', code: 'RHH30' });
await db.collection('users').doc('u1').set({ email: 'buyer@installer.co.uk' });

const txn = (id, billed, { discount = null, grand = 693, earnings = 545, sub = 'sub_1', customer = 'ctm_1' } = {}) => ({
  id, subscription_id: sub, customer_id: customer, discount_id: discount, billed_at: billed, origin: 'web',
  items: [{ price: { id: 'pri_x' } }],
  details: { totals: { grand_total: String(grand), subtotal: '990', discount: '297', tax: '0' },
             payout_totals: { earnings: earnings == null ? null : String(earnings), currency_code: 'EUR', fee: '148' } },
});
const pay = async (t, uid = 'u1') => { await L.recordTransaction(t, { uid, planCode: 'professional', billingTerm: 'monthly' }); return L.onTransaction(t, { uid, planCode: 'professional', billingTerm: 'monthly' }); };

console.log('\nBooks — first payment with the code\n');
const t1 = txn('txn_1', '2026-11-20T10:00:00Z', { discount: 'dsc_rhh' });
is('first payment books', await pay(t1), { booked: true, pending: false });
const at1 = get('partnerAttributions/sub_1');
is('attribution created, qualifying', [at1.pid, at1.qualifying, at1.customerRef], ['gb-rhh', true, 'C-0001']);
is('window set from first payment', at1.commissionEndsAt, '2028-11-20T10:00:00.000Z');
is('commission = 30% of net €5.45 = 164 cents', get('partnerLedger/c_txn_1').amountCents, 164);
is('ledger month is Berlin month', get('partnerLedger/c_txn_1').month, '2026-11');

console.log('\nBooks — replay is harmless\n');
is('same transaction again books nothing', await pay(t1), { booked: false, pending: false });
is('still one commission', ledgerOf('gb-rhh').length, 1);

console.log('\nBooks — renewals carry no code but stay attributed\n');
await pay(txn('txn_2', '2026-12-20T10:00:00Z'));
is('renewal booked', get('partnerLedger/c_txn_2').amountCents, 164);
await pay(txn('txn_late', '2028-11-20T10:00:00Z'));
is('payment at month 24 not booked (window over)', get('partnerLedger/c_txn_late'), undefined);

console.log('\nBooks — refunds and chargebacks\n');
const adj = (id, action, status, earnings, transaction = 'txn_2', type = 'full') =>
  ({ id, action, status, type, transaction_id: transaction, payout_totals: { earnings: String(earnings) }, updated_at: '2026-12-28T09:00:00Z' });
is('pending refund books nothing', await L.onAdjustment(adj('adj_1', 'refund', 'pending_approval', 545)), { skipped: 'status-pending_approval' });
await L.onAdjustment(adj('adj_1', 'refund', 'approved', 545));
is('approved refund claws back the same 164', get('partnerLedger/a_adj_1').amountCents, -164);
await L.onAdjustment(adj('adj_1', 'refund', 'approved', 545));
is('refund replay books once', ledgerOf('gb-rhh').filter(e => e.type === 'clawback').length, 1);
await L.onAdjustment(adj('adj_2', 'chargeback', 'approved', 545, 'txn_1'));
await L.onAdjustment(adj('adj_3', 'chargeback_reverse', 'approved', 545, 'txn_1'));
is('chargeback + reversal net to zero', get('partnerLedger/a_adj_2').amountCents + get('partnerLedger/a_adj_3').amountCents, 0);
is('first payment back to counted after reversal', get('partnerAttributions/sub_1').firstPaymentReversed, false);
is('a refund on a payment without commission is ignored', await L.onAdjustment(adj('adj_9', 'refund', 'approved', 100, 'txn_unknown')), { skipped: 'no-commission-on-transaction' });
is('balance = 164 + 164 − 164 − 164 + 164', balance('gb-rhh'), 164);

console.log('\nBooks — returning customer, self-referral, free checkout\n');
await db.collection('users').doc('u2').set({ email: 'old@installer.de' });
await pay(txn('txn_old', '2026-09-01T10:00:00Z', { sub: 'sub_old', customer: 'ctm_2' }), 'u2');   // paid before, no code
const r2 = await pay(txn('txn_3', '2026-11-25T10:00:00Z', { discount: 'dsc_rhh', sub: 'sub_2', customer: 'ctm_2' }), 'u2');
is('returning customer: discount yes, commission no', [r2.skipped, get('partnerAttributions/sub_2').notQualifyingReason], ['not-qualifying', 'returning-customer']);
is('returning customer goes to review', get('partnerReview/attr_sub_2').kind, 'returning-customer');

await db.collection('users').doc('u3').set({ email: 'colleague@renewableheatinghub.co.uk' });
await pay(txn('txn_4', '2026-11-26T10:00:00Z', { discount: 'dsc_rhh', sub: 'sub_3', customer: 'ctm_3' }), 'u3');
is('company-domain match flagged, still booked', [get('partnerReview/attr_sub_3').flags, !!get('partnerLedger/c_txn_4')], [['partner-company-domain'], true]);

await db.collection('users').doc('u4').set({ email: 'x@y.fr' });
const free = await pay(txn('txn_5', '2026-11-27T10:00:00Z', { discount: 'dsc_rhh', sub: 'sub_4', customer: 'ctm_4', grand: 0, earnings: 0 }), 'u4');
is('100% checkout: attributed, nothing booked', [free.skipped, get('partnerAttributions/sub_4').firstPaidAt], ['free-transaction', null]);
await pay(txn('txn_6', '2026-12-27T10:00:00Z', { sub: 'sub_4', customer: 'ctm_4' }), 'u4');
is('first real payment after a free one opens the window', get('partnerAttributions/sub_4').commissionEndsAt, '2028-12-27T10:00:00.000Z');
is('…and earns', get('partnerLedger/c_txn_6').amountCents, 164);

console.log('\nBooks — pending earnings settle at month close\n');
await db.collection('users').doc('u5').set({ email: 'p@q.it' });
await pay(txn('txn_7', '2026-11-28T10:00:00Z', { discount: 'dsc_rhh', sub: 'sub_5', customer: 'ctm_5', earnings: null }), 'u5');
is('null earnings → pending entry with 0', [get('partnerLedger/c_txn_7').pending, get('partnerLedger/c_txn_7').amountCents], [true, 0]);
paddleTxns.txn_7 = txn('txn_7', '2026-11-28T10:00:00Z', { earnings: 600 });
clock = Date.parse('2026-12-03T08:00:00Z');
const close = await L.closeMonth('2026-11');
is('close settles it from Paddle (600 × 30% = 180)', [close.settled, get('partnerLedger/c_txn_7').amountCents, get('partnerLedger/c_txn_7').pending], [1, 180, false]);

console.log('\nStatement for November\n');
const st = get('partnerStatements/gb-rhh_2026-11');
is('draft created', st.status, 'draft');
is('new paying in Nov (sub_1, sub_3, sub_5 — not the returning one, not the free one)', st.newPaying, 3);
is('commission Nov = 164 + 164 + 180 (+ chargeback pair is in Dec)', st.commissionCents, 508);
is('opening 0', st.openingCents, 0);
is('below €50 → carried', st.payoutDue, false);
is('payout due date', st.payoutDueBy, '2026-12-15');
is('lines carry anonymous refs only', st.lines.map(l => l.customerRef).every(r => /^C-\d{4}$/.test(r)), true);
const csv = R.statementCsv(st);
is('CSV has no email address', /@/.test(csv), false);
is('CSV header', csv.split('\n')[0], 'date,type,customer,plan,term,net_receipts_eur,amount_eur,pending,note');

console.log('\nStatement — approved/sent is never overwritten\n');
await db.collection('partnerStatements').doc('gb-rhh_2026-11').update({ status: 'sent' });
const again = await L.closeMonth('2026-11');
is('sent statement skipped on re-close', [again.skippedFinal, get('partnerStatements/gb-rhh_2026-11').status], [1, 'sent']);

console.log('\nStatement — groups, audience, history (the 06 report layout)\n');
is('commission groups: professional monthly first ×3', st.groups.map(g => [g.planCode, g.billingTerm, g.kind, g.payments]), [['professional', 'monthly', 'first', 3]]);
is('group total = commission', st.groups.reduce((s2, g) => s2 + g.amountCents, 0), st.commissionCents);
is('audience counts', [st.audience.newPaying, st.audience.newAnnual, st.audience.activeMonthly], [3, 0, 3]);
is('statement number assigned', /^CP-2026-11-\d{4}$/.test(st.statementNo), true);
is('history ends at the statement month', st.history[st.history.length - 1].month, '2026-11');
const hist = R.buildHistory({ ym: '2027-02', firstMonth: '2026-11', ledger: [], attributions: [] });
is('history starts at the first partner month', hist.map(h => h.month), ['2026-11', '2026-12', '2027-01', '2027-02']);
is('history capped at 6 months', R.buildHistory({ ym: '2027-12', ledger: [], attributions: [] }).length, 6);

console.log('\nThreshold + 50-account count\n');
const many = Array.from({ length: 50 }, (_, i) => ({ id: `s${i}`, customerRef: R.customerRef(i + 1), qualifying: true, firstPaidAt: '2027-01-10T10:00:00Z' }));
const st50 = R.buildStatement({ ym: '2027-01', attributions: many, ledger: [{ type: 'commission', amountCents: 5000, month: '2027-01', at: '2027-01-10T10:00:00Z' }] });
is('50 accounts → video support eligible', [st50.cumulativePaying, st50.videoSupportEligible], [50, true]);
is('exactly €50 → payout due', st50.payoutDue, true);
const reversedOne = many.map((x, i) => (i === 0 ? { ...x, firstPaymentReversed: true } : x));
is('a fully refunded first payment leaves the count', R.buildStatement({ ym: '2027-01', attributions: reversedOne }).videoSupportEligible, false);

console.log('\nStatement mail in every language\n');
for (const lang of LANGS) {
  const m = statementMail({ ...st, closingCents: 7000, payoutDue: true, payoutDueBy: '2026-12-15' }, { name: 'Ann', code: 'RHH30', lang, programme: R.PROGRAMME });
  is(`${lang}: subject carries the code`, m.subject.includes('RHH30'), true);
  is(`${lang}: never says "plumber" (Installer rule)`, /plumb|plomb|idraul|hydraulik|klempner/i.test(m.text), false);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
