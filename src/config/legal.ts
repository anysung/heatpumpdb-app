/**
 * Legal identity, policy versions and the public policy routes.
 *
 * The four policy pages are reachable WITHOUT a login on the same customer-facing
 * domain (hosting rewrites every path to index.html; App.tsx renders the policy
 * before the auth gate). One shared set of routes for every country edition.
 *
 * NOTE — the business identity below is the only verified value in this
 * repository. Registered address, company register number, VAT ID and a support
 * email address do not exist anywhere in the project, so they are NOT invented
 * here: the Impressum renders a visible "to be completed" marker for them.
 */

/** Rights holder / operator. Placeholder already used across the app. */
export const RIGHTS_HOLDER = 'A Company';

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
