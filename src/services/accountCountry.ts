/**
 * accountCountry.ts — the one-email-one-country policy decision, as a PURE
 * module with no Firebase imports so it is unit-testable in Node
 * (tests/account-country.unit.mjs) and shared by authService.
 */
import { User } from '../types';

export const OWNER_EMAIL = 'sungyongsoo1976@gmail.com';

/** Roles allowed into the admin console — mirrors isAdmin() in firestore.rules. */
export const ADMIN_ROLES = ['owner', 'admin', 'support', 'ops'];
export const isAdminRole = (role?: string): boolean =>
  !!role && ADMIN_ROLES.includes(role);

/** Error-message sentinels (survive the login wrapper's `throw new Error(msg)`). */
export const WRONG_COUNTRY_PREFIX = 'account-country-mismatch:';
export const EMAIL_ELSEWHERE = 'email-registered-elsewhere';

/**
 * One-email-one-country policy (2026-07-19). Every account belongs permanently
 * to the market it registered on (User.country, stamped once at creation and
 * never overwritten). Given the site the user is on, decide access:
 *   - owner/admin roles      → allowed everywhere        → null
 *   - a doc with no country  → allowed (fail-open)       → null   (+ admin alert)
 *   - country === this site  → allowed                   → null
 *   - country !== this site  → BLOCKED → returns the registered country code
 * The stored country is only ever READ here, never modified.
 */
export const crossCountryBlock = (
  u: Pick<User, 'role' | 'country' | 'email'>,
  siteCountry: string,
): string | null => {
  if (u.email === OWNER_EMAIL || isAdminRole(u.role)) return null;
  if (!u.country) return null;                       // fail-open (legacy/exception)
  return u.country === siteCountry ? null : u.country;
};
