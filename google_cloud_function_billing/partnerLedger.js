/**
 * partnerLedger — the creator-partner programme's books (2026-10-18).
 *
 * Firestore side of partnerRules.js. Everything here is called AFTER the
 * webhook's own work (entitlements) and inside its own try/catch: a failure in
 * partner accounting is recorded for review and never touches a member's
 * access — the fail-open principle of the billing function.
 *
 * Collections (all Admin-SDK-written; firestore.rules: admin read, no client
 * writes):
 *   paddleTransactions/{txnId}       every completed transaction, with money
 *   partners/{pid}                   one creator partner (pid = tracker id)
 *   partnerCodes/{discountId}        Paddle discount → partner
 *   partnerAttributions/{subId}      subscription → partner (first discounted txn)
 *   partnerLedger/{entryId}          signed EUR cents; ids are deterministic
 *                                    (c_<txn>, a_<adj>, …) so a replayed
 *                                    webhook can never book twice
 *   partnerStatements/{pid}_{YYYY-MM} monthly statement (draft → approved → sent)
 *   partnerReview/{id}               items the owner must look at
 */

const R = require('./partnerRules');

module.exports = function partnerLedger({ db, FieldValue, paddleApi, nowIso, log = console }) {

  const review = async (id, data) => {
    await db.collection('partnerReview').doc(id).set({
      ...data, status: 'open', createdAt: nowIso(),
    }, { merge: true });
  };

  /** Ledger write that books at most once per id. Returns true when written. */
  async function bookOnce(tx, entryId, entry) {
    const ref = db.collection('partnerLedger').doc(entryId);
    const snap = await tx.get(ref);
    if (snap.exists) return { ref, written: false };
    return { ref, written: true, write: () => tx.set(ref, { ...entry, id: entryId, createdAt: nowIso() }) };
  }

  /**
   * Record a completed transaction's money. Called for EVERY completed
   * transaction (not only partner ones): it is also the "has this customer
   * ever paid" record the new-customer rule needs.
   */
  async function recordTransaction(txn, { uid = '', planCode = '', billingTerm = '' } = {}) {
    if (!txn || !txn.id) return;
    const t = (txn.details && txn.details.totals) || {};
    const pt = (txn.details && txn.details.payout_totals) || {};
    const { earnings, pending } = R.transactionEarnings(txn);
    await db.collection('paddleTransactions').doc(txn.id).set({
      id: txn.id,
      origin: txn.origin || '',
      subscriptionId: txn.subscription_id || '',
      customerId: txn.customer_id || '',
      uid,
      discountId: txn.discount_id || '',
      planCode, billingTerm,
      priceIds: (txn.items || []).map(i => i.price && i.price.id).filter(Boolean),
      currency: txn.currency_code || '',
      billedAt: txn.billed_at || txn.updated_at || nowIso(),
      subtotalCents: R.cents(t.subtotal),
      discountCents: R.cents(t.discount),
      taxCents: R.cents(t.tax),
      paidCents: R.transactionPaidCents(txn),
      payoutCurrency: pt.currency_code || '',
      payoutFeeCents: R.cents(pt.fee),
      earningsCents: earnings,
      earningsPending: pending,
      recordedAt: nowIso(),
    }, { merge: true });
  }

  /** Has this customer (Paddle customer id or our uid) paid before this txn? */
  async function hasEarlierPaid(txn, uid) {
    const billedAt = txn.billed_at || nowIso();
    const checks = [];
    if (txn.customer_id) checks.push(db.collection('paddleTransactions').where('customerId', '==', txn.customer_id).get());
    if (uid) checks.push(db.collection('paddleTransactions').where('uid', '==', uid).get());
    const snaps = await Promise.all(checks);
    for (const s of snaps) {
      for (const d of s.docs) {
        const x = d.data();
        if (d.id !== txn.id && (x.paidCents || 0) > 0 && String(x.billedAt) <= String(billedAt)) return true;
      }
    }
    // A subscription the profile carried before the ledger existed (pre
    // 2026-10-18) is also a paid history — the profile's paddleSubscriptionId
    // pointing at a DIFFERENT subscription.
    if (uid) {
      const u = await db.collection('users').doc(uid).get();
      const sid = u.exists ? u.data().paddleSubscriptionId : '';
      if (sid && sid !== txn.subscription_id) {
        const earlier = await db.collection('paddleTransactions').where('subscriptionId', '==', sid).get();
        if (earlier.docs.some(d => (d.data().paidCents || 0) > 0)) return true;
      }
    }
    return false;
  }

  /**
   * The partner side of transaction.completed: create the attribution on the
   * first discounted transaction, then book commission on every paid one.
   */
  async function onTransaction(txn, { uid = '', planCode = '', billingTerm = '' } = {}) {
    if (!txn || !txn.id || !txn.subscription_id) return { skipped: 'no-subscription' };
    const subId = txn.subscription_id;
    const attrRef = db.collection('partnerAttributions').doc(subId);
    let attrSnap = await attrRef.get();

    if (!attrSnap.exists) {
      if (!txn.discount_id) return { skipped: 'no-discount' };
      const codeSnap = await db.collection('partnerCodes').doc(txn.discount_id).get();
      if (!codeSnap.exists) return { skipped: 'not-a-partner-code' };
      const { pid, code } = codeSnap.data();

      const earlier = await hasEarlierPaid(txn, uid);
      const userSnap = uid ? await db.collection('users').doc(uid).get() : null;
      const customerEmail = userSnap && userSnap.exists ? (userSnap.data().email || '') : '';

      const created = await db.runTransaction(async (tx) => {
        const again = await tx.get(attrRef);
        if (again.exists) return false;                       // a concurrent delivery won
        const pRef = db.collection('partners').doc(pid);
        const p = await tx.get(pRef);
        const partner = p.exists ? p.data() : {};
        const seq = (partner.attributionSeq || 0) + 1;
        const flags = R.selfReferralFlags({
          partnerEmails: [partner.email, ...(partner.otherEmails || [])].filter(Boolean),
          partnerUid: partner.uid || '', customerEmail, customerUid: uid,
        });
        const paid = R.transactionPaidCents(txn) > 0;
        const billedAt = txn.billed_at || nowIso();
        tx.set(attrRef, {
          id: subId, pid, code: code || '', discountId: txn.discount_id,
          subscriptionId: subId, customerId: txn.customer_id || '', uid,
          customerRef: R.customerRef(seq),
          planCode, billingTerm,
          createdAt: nowIso(), firstTxnId: txn.id,
          firstPaidAt: paid ? billedAt : null,
          commissionEndsAt: paid ? R.commissionEndsAt(billedAt) : null,
          // A returning customer keeps the discount (Paddle applies it) but
          // earns no commission — terms §2. Recorded, not hidden.
          qualifying: !earlier,
          notQualifyingReason: earlier ? 'returning-customer' : '',
          reviewFlags: flags,
          subStatus: 'active', canceledAt: null, firstPaymentReversed: false,
        });
        tx.set(pRef, { attributionSeq: seq, updatedAt: nowIso() }, { merge: true });
        return { flags, earlier };
      });
      if (created && (created.flags.length || created.earlier)) {
        await review(`attr_${subId}`, {
          kind: created.earlier ? 'returning-customer' : 'self-referral',
          pid, subscriptionId: subId, flags: created.flags,
          note: created.earlier
            ? 'Partner code used by a customer with an earlier paid transaction — no commission (terms §2).'
            : 'Possible self-referral — commission is booked; confirm or void it.',
        });
      }
      attrSnap = await attrRef.get();
    }

    const attr = attrSnap.data();
    if (!attr.qualifying || attr.voided) return { skipped: 'not-qualifying' };

    const paidCents = R.transactionPaidCents(txn);
    if (paidCents <= 0) return { skipped: 'free-transaction' };

    const billedAt = txn.billed_at || nowIso();
    // First PAID payment may come after a free first checkout (100% code, or a
    // Paddle trial): the commission window starts at the first money.
    if (!attr.firstPaidAt) {
      await attrRef.update({ firstPaidAt: billedAt, commissionEndsAt: R.commissionEndsAt(billedAt) });
      attr.firstPaidAt = billedAt;
    }
    if (!R.inCommissionWindow(attr.firstPaidAt, billedAt)) return { skipped: 'window-ended' };

    const partnerSnap = await db.collection('partners').doc(attr.pid).get();
    // Ended for fraud / serious breach (terms §12): no further commission.
    if (partnerSnap.exists && partnerSnap.data().commissionStopped) return { skipped: 'commission-stopped' };
    const rate = partnerSnap.exists && Number.isFinite(partnerSnap.data().commissionRate)
      ? partnerSnap.data().commissionRate : R.PROGRAMME.commissionRate;
    const { earnings, pending, reason } = R.transactionEarnings(txn);
    const entryId = `c_${txn.id}`;
    const booked = await db.runTransaction(async (tx) => {
      const b = await bookOnce(tx, entryId, {
        pid: attr.pid, type: 'commission', attributionId: attr.id, customerRef: attr.customerRef,
        transactionId: txn.id, subscriptionId: attr.id,
        planCode: planCode || attr.planCode || '', billingTerm: billingTerm || attr.billingTerm || '',
        at: billedAt, month: R.berlinMonth(billedAt),
        netCents: earnings, rate,
        amountCents: pending ? 0 : R.commissionCents(earnings, rate),
        pending, pendingReason: reason,
        first: txn.id === attr.firstTxnId || billedAt === attr.firstPaidAt,
      });
      if (b.written) b.write();
      return b.written;
    });
    if (booked && pending) {
      await review(`pending_${txn.id}`, {
        kind: 'earnings-pending', pid: attr.pid, transactionId: txn.id, reason,
        note: 'Net receipts not settled yet — the monthly close re-reads the transaction from Paddle.',
      });
    }
    return { booked, pending };
  }

  /** Re-read a pending commission's transaction from Paddle and settle it. */
  async function settlePending(entryId) {
    const ref = db.collection('partnerLedger').doc(entryId);
    const snap = await ref.get();
    if (!snap.exists || !snap.data().pending) return false;
    const e = snap.data();
    const txn = await paddleApi('GET', `/transactions/${e.transactionId}`);
    const { earnings, pending, reason } = R.transactionEarnings(txn);
    if (pending) { await ref.update({ pendingReason: reason, lastCheckedAt: nowIso() }); return false; }
    await ref.update({
      netCents: earnings, amountCents: R.commissionCents(earnings, e.rate),
      pending: false, pendingReason: '', settledAt: nowIso(),
    });
    await db.collection('paddleTransactions').doc(e.transactionId)
      .set({ earningsCents: earnings, earningsPending: false }, { merge: true });
    await db.collection('partnerReview').doc(`pending_${e.transactionId}`)
      .set({ status: 'resolved', resolvedAt: nowIso(), resolvedBy: 'monthly-close' }, { merge: true });
    return true;
  }

  /** Refund / chargeback / credit (and their reversals) against a commissioned payment. */
  async function onAdjustment(adj) {
    if (!adj || !adj.id || !adj.transaction_id) return { skipped: 'no-transaction' };
    const effect = R.adjustmentEffect(adj);
    if (!effect.sign) return { skipped: 'ignored-action' };
    const cRef = db.collection('partnerLedger').doc(`c_${adj.transaction_id}`);
    const cSnap = await cRef.get();
    if (!cSnap.exists) return { skipped: 'no-commission-on-transaction' };
    if (!effect.book) return { skipped: `status-${adj.status}` };
    const c = cSnap.data();
    const at = adj.updated_at || adj.created_at || nowIso();
    const amount = effect.sign * Math.abs(R.commissionCents(effect.earnings, c.rate));
    const written = await db.runTransaction(async (tx) => {
      const b = await bookOnce(tx, `a_${adj.id}`, {
        pid: c.pid, type: 'clawback', attributionId: c.attributionId, customerRef: c.customerRef,
        transactionId: adj.transaction_id, adjustmentId: adj.id, action: adj.action,
        planCode: c.planCode, billingTerm: c.billingTerm,
        at, month: R.berlinMonth(at),
        netCents: effect.sign * effect.earnings, rate: c.rate, amountCents: amount,
        // Clawback of a commission that is itself still pending: both settle at close.
        pending: !!c.pending,
      });
      if (b.written) b.write();
      return b.written;
    });
    // A full refund / chargeback of the FIRST payment means the account never
    // really paid — it leaves the cumulative count (the 50-account threshold).
    if (written && c.first && adj.type === 'full') {
      await db.collection('partnerAttributions').doc(c.attributionId)
        .update({ firstPaymentReversed: effect.sign < 0 });
    }
    if (written && String(adj.action).startsWith('chargeback')) {
      await review(`adj_${adj.id}`, {
        kind: 'chargeback', pid: c.pid, transactionId: adj.transaction_id, adjustmentId: adj.id,
        note: `${adj.action} on a commissioned payment — commission adjusted automatically.`,
      });
    }
    return { booked: written };
  }

  /** Keep the attribution's subscription state for active/cancelled counts. */
  async function onSubscription(sub, eventType) {
    if (!sub || !sub.id) return;
    const ref = db.collection('partnerAttributions').doc(sub.id);
    const snap = await ref.get();
    if (!snap.exists) return;
    const canceled = sub.status === 'canceled' || eventType === 'subscription.canceled';
    await ref.update({
      subStatus: sub.status || '',
      canceledAt: canceled ? (sub.canceled_at || sub.updated_at || nowIso()) : null,
      subUpdatedAt: nowIso(),
    });
  }

  /** All of one partner's ledger + attributions, in the shapes buildStatement wants. */
  async function partnerBooks(pid) {
    const [l, a] = await Promise.all([
      db.collection('partnerLedger').where('pid', '==', pid).get(),
      db.collection('partnerAttributions').where('pid', '==', pid).get(),
    ]);
    return {
      ledger: l.docs.map(d => d.data()),
      attributions: a.docs.map(d => d.data()).map(x => ({ ...x, qualifying: x.qualifying && !x.voided })),
    };
  }

  /**
   * Build (or rebuild) the draft statements for month `ym`. Sent or approved
   * statements are never overwritten — a correction after sending is a
   * `manual` ledger entry that shows on the next statement.
   */
  async function closeMonth(ym) {
    const out = { month: ym, drafts: 0, skippedFinal: 0, settled: 0, stillPending: 0, partners: [] };
    const pend = await db.collection('partnerLedger').where('pending', '==', true).get();
    for (const d of pend.docs) {
      try { if (await settlePending(d.id)) out.settled++; else out.stillPending++; }
      catch (e) { out.stillPending++; log.error('settlePending failed', d.id, e.message); }
    }
    const partners = await db.collection('partners').get();
    for (const p of partners.docs) {
      const partner = p.data();
      if (partner.status === 'prospect') continue;      // paused/ended partners still earn (terms §12)
      const stRef = db.collection('partnerStatements').doc(`${p.id}_${ym}`);
      const existing = await stRef.get();
      if (existing.exists && ['approved', 'sent'].includes(existing.data().status)) { out.skippedFinal++; continue; }
      const books = await partnerBooks(p.id);
      const st = R.buildStatement({ ym, ...books });
      const firstMonth = partner.createdAt ? R.berlinMonth(partner.createdAt) : null;
      const history = R.buildHistory({ ym, firstMonth, ...books });
      // External serial: CP-YYYYMM-010, -011 … across all partners of the month.
      const monthCount = existing.exists ? 0 : (await db.collection('partnerStatements').where('month', '==', ym).get()).size;
      await stRef.set({
        id: stRef.id, pid: p.id, ...st, history,
        statementNo: existing.exists && existing.data().statementNo ? existing.data().statementNo : R.externalSerial('CP', ym, monthCount),
        partnerName: partner.name || '', code: partner.code || '', lang: partner.lang || 'en',
        contractNo: partner.contractNo || '', partnerSince: partner.contractSignedAt || (partner.createdAt || '').slice(0, 10),
        premiumUntil: partner.premiumUntil || '', payoutMethod: partner.payoutMethod ? 'on-file' : '',
        status: 'draft', generatedAt: nowIso(),
      });
      out.drafts++;
      out.partners.push({ pid: p.id, closingCents: st.closingCents, payoutDue: st.payoutDue, pendingCount: st.pendingCount });
    }
    return out;
  }

  return { recordTransaction, onTransaction, onAdjustment, onSubscription, settlePending, partnerBooks, closeMonth, review };
};
