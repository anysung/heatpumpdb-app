/**
 * Registration availability — the ONE switch for every country edition.
 *
 * New-user registration is PAUSED (Jul 2026) while the European market
 * expansion / system review runs. This module is shared by DE, GB and FR: the
 * builds differ only by VITE_COUNTRY_CODE, so there is deliberately no
 * per-country flag to keep in sync.
 *
 * HOW TO REOPEN — an explicit change by an admin/developer is required in BOTH
 * places; nothing reopens on a date, and REOPEN_DATE below is display copy only:
 *   1. Set REGISTRATION_OPEN = true here, rebuild and deploy the four sites.
 *   2. Set registrationOpen() = true in firestore.rules and deploy the rules
 *      (`firebase deploy --only firestore:rules`) — the rules are the server-side
 *      half and cannot import this file.
 *   3. Re-enable "Enable create (sign-up)" in Firebase Auth → Settings → User
 *      actions (this is what actually blocks Firebase Auth account creation for
 *      callers who bypass our UI).
 * Flipping only one of the three leaves registration blocked — that is the safe
 * failure direction and is intentional.
 */

/** Master switch. false = no new accounts, anywhere. */
export const REGISTRATION_OPEN = false;

/**
 * Expected reopening date, shown to visitors. PURELY INFORMATIONAL — no code
 * compares it against the clock, so registration will NOT reopen by itself when
 * this date passes.
 */
export const REGISTRATION_REOPEN_DATE = '2026-07-24';

/** Thrown/checked identifier so callers can show the localized notice. */
export const REGISTRATION_CLOSED_ERROR = 'registration-closed';
