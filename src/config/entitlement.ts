/**
 * entitlement.ts — client-side mirror of the server access rule.
 *
 * The AUTHORITATIVE gate lives in firestore.rules / storage.rules:
 *   admin → allowed; otherwise active AND request.time < accessUntilTs
 *   (own field, or the org's for team members); accounts WITHOUT the field
 *   are not window-gated (legacy accounts, e.g. the owner).
 *
 * This module only reproduces that decision for UX (blocked view, trial
 * banners) — bypassing it changes nothing server-side.
 *
 * SYSTEM PRINCIPLE (owner decision 2026-07-27): never wrongly block a paying
 * user. Anything ambiguous here resolves to ALLOWED — the failure mode of
 * this file must always be "extra access", never "false lockout".
 */
import { User, Organization, FirestoreTimestampLike } from '../types';
import { isAdminRole } from '../services/accountCountry';
import { subscriptionUnlocked, effectiveSubscription } from './subscriptionPlans';

/** Firestore Timestamp / ISO string / epoch-ms → epoch ms, or null if unreadable. */
export function tsToMillis(v: FirestoreTimestampLike | undefined): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const ms = new Date(v).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof (v as any).toMillis === 'function') {
    try { return (v as any).toMillis(); } catch { return null; }
  }
  if (typeof (v as any).seconds === 'number') return (v as any).seconds * 1000;
  return null;
}

export type AccessState =
  /** No window on the account (legacy/admin) — nothing to gate or announce. */
  | { state: 'unlimited' }
  /** In the free trial window (no unlocking subscription yet). */
  | { state: 'trial'; trialEndsMs: number; daysLeft: number }
  /** Window open via subscription/team — normal paid use. */
  | { state: 'active'; untilMs: number | null }
  /** Window closed: the account is on the FREE tier (basic data only). */
  | { state: 'expired' };

/** Whole days (ceil) from now until `ms`; never below 0. */
export const daysUntil = (ms: number, now = Date.now()): number =>
  Math.max(0, Math.ceil((ms - now) / 86_400_000));

/**
 * The one access decision for the signed-in user. `org` is the user's team
 * (pass null/undefined when there is none or it has not loaded yet — an
 * unloaded org can only widen access later, never shrink it, so rendering
 * before it arrives is safe).
 */
export function accessInfo(user: User, org?: Organization | null, now = Date.now()): AccessState {
  if (isAdminRole(user.role)) return { state: 'unlimited' };

  const own = tsToMillis(user.accessUntilTs);
  const team = org && org.members?.some(m => m.uid === user.id) ? tsToMillis(org.accessUntilTs) : null;

  // Neither the account nor its team carries a window → legacy, not gated.
  if (own === null && team === null) return { state: 'unlimited' };

  const until = Math.max(own ?? -Infinity, team ?? -Infinity);
  if (now >= until) return { state: 'expired' };

  // Window open. Distinguish "free trial" (for the countdown banner) from a
  // real subscription: a subscription that unlocks means we are in paid use.
  const eff = effectiveSubscription(user);
  const subOk = !!eff && subscriptionUnlocked(eff.status, eff.currentPeriodEndsAt);
  const orgPaid = !!org && (org.subscriptionStatus === 'active' || org.subscriptionStatus === 'past_due');
  const trialEnds = tsToMillis(user.trialEndsAt);
  if (!subOk && !orgPaid && trialEnds !== null && now < trialEnds) {
    return { state: 'trial', trialEndsMs: trialEnds, daysLeft: daysUntil(trialEnds, now) };
  }
  return { state: 'active', untilMs: until };
}

/**
 * Free + Premium program (owner, 2026-09-27): a closed window no longer locks
 * the account out — it drops to FREE. `accessUntilTs` therefore reads as
 * "Premium until". The server mirrors this: basic datasets and countries/**
 * need an approved account only; full datasets and Premium Special Reports
 * need the open window (storage.rules / firestore.rules `isEntitled()`).
 *
 * Fail-open as before: anything that is not a definite 'expired' is Premium.
 */
export type Tier = 'premium' | 'free';

export const tierOf = (user: User, org?: Organization | null, now = Date.now()): Tier =>
  accessInfo(user, org, now).state === 'expired' ? 'free' : 'premium';

/** @deprecated Since the Free tier there is no subscribe-required screen; kept
 *  for callers that only need the "window closed" fact. */
export const accessExpired = (user: User, org?: Organization | null): boolean =>
  accessInfo(user, org).state === 'expired';
