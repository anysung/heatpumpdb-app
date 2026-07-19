/**
 * entitlementPolicy — the ONE definition of "does this subscription currently
 * unlock the paid catalogue?".
 *
 * Deliberately plain ESM JavaScript with no imports, because the exact same file
 * has to run in three places that cannot share a TypeScript module:
 *   - the browser app  (via subscriptionUnlocked() in subscriptionPlans.ts, and
 *     the admin/free-grant writers in subscriptionService.ts)
 *   - the billing webhook (google_cloud_function/entitlementPolicy.js — a
 *     byte-identical copy; tests/paddle-catalogue.unit.mjs fails if they differ)
 *   - the tests
 * Any change here must be copied to the Cloud Function copy. The parity test is
 * what makes that a build failure rather than a silent production divergence.
 *
 * ── The policy ────────────────────────────────────────────────────────────────
 *   trialing   → ALLOW   (7-day trial, payment method already on file)
 *   active     → ALLOW
 *   canceled   → ALLOW until currentPeriodEndsAt, DENY after. Cancelling stops
 *                the next renewal; it never shortens a period already paid for.
 *   past_due   → ALLOW for PAST_DUE_GRACE_DAYS after the payment failed, then
 *                DENY. Paddle is still retrying the card during that window, and
 *                cutting a paying customer off over one failed charge is worse
 *                than a week of unpaid access.
 *   paused     → DENY    (no money is flowing and none is expected)
 *   expired    → DENY
 *   no subscription → DENY
 *
 * ── What this does NOT decide ─────────────────────────────────────────────────
 * Account approval. A denied entitlement means "no paid catalogue"; the account
 * still exists, still logs in, and still reaches the Account/Billing pages so it
 * can be renewed. Billing state is never expressed as `status`/`isActive` on the
 * user doc — those stay the admin approval axis. Keeping the two apart is why an
 * expiring card cannot lock someone out of their own account.
 */

/** Days of continued access after a failed payment, while Paddle retries. */
export const PAST_DUE_GRACE_DAYS = 7;

const DAY_MS = 86400000;

const future = (iso, nowMs) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t > nowMs;
};

const withinGrace = (iso, nowMs) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && nowMs < t + PAST_DUE_GRACE_DAYS * DAY_MS;
};

/**
 * Evaluate a subscription-shaped snapshot.
 *
 * @param {object|null|undefined} sub - `user.subscription`, or an organization
 *   doc mapped to the same shape ({ status, currentPeriodEndsAt, pastDueSince }).
 *   Organizations carry `subscriptionStatus`; both spellings are accepted so a
 *   caller never has to reshape the doc and risk reshaping it wrong.
 * @param {number} [nowMs] - injectable clock, so tests are not time-dependent.
 * @returns {{ allowed: boolean, reason: string, until: string|null }}
 */
export function paidAccessState(sub, nowMs = Date.now()) {
  if (!sub) return { allowed: false, reason: 'no-subscription', until: null };

  const status = sub.status || sub.subscriptionStatus || '';
  const periodEnd = sub.currentPeriodEndsAt || null;

  switch (status) {
    case 'trialing':
      return { allowed: true, reason: 'trialing', until: sub.trialEndsAt || periodEnd || null };

    case 'active':
      return { allowed: true, reason: 'active', until: periodEnd };

    case 'canceled':
      // Cancelling stops renewal only — the paid period is still theirs.
      return future(periodEnd, nowMs)
        ? { allowed: true, reason: 'canceled-until-period-end', until: periodEnd }
        : { allowed: false, reason: 'canceled-period-over', until: periodEnd };

    case 'past_due': {
      // Anchor the grace window on when the payment actually failed. If that
      // stamp is missing (an event we never saw, or a hand-edited doc), fall
      // back to the period end — a renewal charge fails exactly there. With
      // neither anchor we cannot show we are inside the window, so we deny
      // rather than grant indefinite free access on a missing field.
      const anchor = sub.pastDueSince || periodEnd || null;
      if (!anchor) return { allowed: false, reason: 'past-due-no-anchor', until: null };
      const graceEnds = new Date(new Date(anchor).getTime() + PAST_DUE_GRACE_DAYS * DAY_MS).toISOString();
      return withinGrace(anchor, nowMs)
        ? { allowed: true, reason: 'past-due-grace', until: graceEnds }
        : { allowed: false, reason: 'past-due-grace-over', until: graceEnds };
    }

    case 'paused':
      return { allowed: false, reason: 'paused', until: null };

    case 'expired':
      return { allowed: false, reason: 'expired', until: periodEnd };

    default:
      // Unknown status — deny. A status we do not recognize is not a licence.
      return { allowed: false, reason: 'unknown-status', until: null };
  }
}

/** Boolean shorthand for the common case. */
export function hasPaidAccess(sub, nowMs = Date.now()) {
  return paidAccessState(sub, nowMs).allowed;
}
