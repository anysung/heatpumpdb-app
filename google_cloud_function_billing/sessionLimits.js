/**
 * sessionLimits — how many concurrently ACTIVE sessions an account may keep.
 *
 * Free + Premium program (2026-09-27, docs/CONCURRENT_SESSIONS.md):
 *   Premium (open window: trial, paid, grant or the team's window) → 2
 *   Free    (window present AND closed)                            → 1
 *
 * Mirrors firestore.rules windowOpen(): an account WITHOUT accessUntilTs is
 * a legacy account and is NOT window-gated → Premium. Fail-open everywhere:
 * an unreadable window counts as open, so a data problem can only ever give
 * someone the larger limit, never cut a paying user down to one device.
 *
 * Pure, no I/O, no clock of its own — the caller passes `nowMs`.
 */

/** Timestamp-ish → epoch ms. Accepts Firestore Timestamp, ISO string, number. */
function tsMillis(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') { const t = Date.parse(v); return Number.isFinite(t) ? t : null; }
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return null;
}

/**
 * Is this window doc (user or organization) Premium right now?
 *   field absent            → true  (legacy / not gated)
 *   field unreadable        → true  (fail-open)
 *   field in the future     → true
 *   field in the past / now → false (Free)
 */
function windowOpen(data, nowMs) {
  if (!data || typeof data !== 'object') return true;
  if (!('accessUntilTs' in data) || data.accessUntilTs == null) return true;
  const ms = tsMillis(data.accessUntilTs);
  if (ms == null) return true;
  return nowMs < ms;
}

/**
 * Premium = own window open, OR the team's window open, OR a live free-access
 * grant (belt and braces: redemption also writes accessUntilTs).
 * `org` is the organization doc, `undefined` when there is none, or `null`
 * when it could not be read (→ fail-open Premium for a user in a team).
 */
function isPremium(user, org, nowMs) {
  const u = user || {};
  if (windowOpen(u, nowMs)) return true;
  if (u.grant && !u.grant.revokedAt) {
    const g = tsMillis(u.grant.endsAt);
    if (g != null && nowMs < g) return true;
  }
  if (u.orgId) {
    if (org === null) return true;                 // unreadable → fail-open
    if (org && windowOpen(org, nowMs)) return true;
  }
  return false;
}

/** The active-session limit for this account given the ops config. */
function activeLimitFor(user, org, nowMs, cfg) {
  const premium = Number.isFinite(cfg && cfg.activeLimit) ? cfg.activeLimit : 2;
  const free = Number.isFinite(cfg && cfg.freeActiveLimit) ? cfg.freeActiveLimit : 1;
  let p = true;
  try { p = isPremium(user, org, nowMs); } catch { p = true; }
  // A misconfigured free limit is clamped to [1, premium limit]: Free never
  // gets more than Premium, and never zero (that would evict every device).
  return p ? premium : Math.max(1, Math.min(free, premium));
}

module.exports = { windowOpen, isPremium, activeLimitFor, tsMillis };
