/**
 * Legal identity, policy versions and the public policy routes.
 *
 * The four policy pages are reachable WITHOUT a login on the same customer-facing
 * domain (hosting rewrites every path to index.html; App.tsx renders the policy
 * before the auth gate). One shared set of routes for every country edition.
 *
 * IDENTITY: the policies address customers as the SERVICE, with support email as
 * the single contact. Registered address, register number, VAT/tax number and a
 * responsible-person name are deliberately NOT shown — and not hinted at either:
 * there are no "missing information" placeholders anywhere in the documents.
 * (`RIGHTS_HOLDER` stays where it always was, in the database Disclaimer — see
 * hpiq/i18n.ts. It is not used on the policy pages.)
 */

/** Customer-facing service identity used across all four policy pages. */
export const SERVICE_NAME = 'HeatPump DataBase (Europe)';

/** The single customer-facing support address (policies, Imprint, Account). */
export const SUPPORT_EMAIL = 'support@heatpumpdb.eu';

/** Bump when the wording changes materially; stamped on the profile at signup. */
export const TERMS_VERSION = '2026-07-14';
export const PRIVACY_VERSION = '2026-07-14';

export const LEGAL_ROUTES = {
  privacy: '/privacy',
  terms: '/terms',
  refund: '/refund-policy',
  imprint: '/imprint',
} as const;

export type LegalDoc = keyof typeof LEGAL_ROUTES;

export const LEGAL_DOCS = Object.keys(LEGAL_ROUTES) as LegalDoc[];

/** Resolve a pathname to a policy page (null = not a policy route). */
export function legalDocForPath(pathname: string): LegalDoc | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  const hit = LEGAL_DOCS.find(doc => LEGAL_ROUTES[doc] === path);
  return hit ?? null;
}
