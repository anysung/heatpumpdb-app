/**
 * env.ts — Public build-time environment values.
 *
 * POLICY (enforced):
 *   - Only VITE_-prefixed variables belong here. Vite exposes these to the
 *     browser bundle at build time; they are not secret.
 *   - Secret keys (EPREL_API_KEY, Gemini API key, Firebase service account, etc.)
 *     must NEVER appear in this file, in any src/ file, or in vite.config.ts.
 *   - Local secrets: .env.local (gitignored).
 *   - Production secrets: Google Secret Manager → Cloud Function env at runtime.
 *   - If you are tempted to add a non-VITE_ key here: don't. It belongs in a
 *     server-side script or Cloud Function instead.
 *
 * Adding a new public config value:
 *   1. Add VITE_MY_VAR=value to .env.local.
 *   2. Add MY_VAR: import.meta.env.VITE_MY_VAR to PUBLIC_ENV below.
 *   3. Document the allowed values in a comment.
 */

export const PUBLIC_ENV = {
  /**
   * ISO 3166-1 alpha-2 country code for this build.
   * Controls which CountryProfile is active. Defaults to 'DE'.
   * Set VITE_COUNTRY_CODE=GB for a UK build.
   */
  COUNTRY_CODE: (import.meta.env.VITE_COUNTRY_CODE as string | undefined) ?? 'DE',

  /**
   * 'admin' builds the unified operations console (all markets, admin-only,
   * served on its own hosting site). Anything else = the normal country app.
   */
  APP_MODE: (import.meta.env.VITE_APP_MODE as string | undefined) ?? 'app',

  /**
   * Paddle Billing (web checkout — the app is NOT distributed via app stores).
   * Client tokens are publishable by design; 'test_…' selects the sandbox.
   * Unset = billing UI shows a "coming soon" notice instead of a checkout.
   */
  PADDLE_CLIENT_TOKEN: (import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined) ?? '',

  /**
   * Paddle recurring-price ids for the subscription catalogue
   * (3 products × 3 terms, each configured in Paddle with a 7-day €0 trial).
   * Key format '<planCode>:<term>'; an unset id keeps that option "coming soon".
   */
  PADDLE_PRICES: {
    'professional:monthly':    (import.meta.env.VITE_PADDLE_PRICE_PRO_MONTHLY as string | undefined) ?? '',
    'professional:six_months': (import.meta.env.VITE_PADDLE_PRICE_PRO_6M as string | undefined) ?? '',
    'professional:annual':     (import.meta.env.VITE_PADDLE_PRICE_PRO_ANNUAL as string | undefined) ?? '',
    'team_3:monthly':          (import.meta.env.VITE_PADDLE_PRICE_TEAM3_MONTHLY as string | undefined) ?? '',
    'team_3:six_months':       (import.meta.env.VITE_PADDLE_PRICE_TEAM3_6M as string | undefined) ?? '',
    'team_3:annual':           (import.meta.env.VITE_PADDLE_PRICE_TEAM3_ANNUAL as string | undefined) ?? '',
    'team_5:monthly':          (import.meta.env.VITE_PADDLE_PRICE_TEAM5_MONTHLY as string | undefined) ?? '',
    'team_5:six_months':       (import.meta.env.VITE_PADDLE_PRICE_TEAM5_6M as string | undefined) ?? '',
    'team_5:annual':           (import.meta.env.VITE_PADDLE_PRICE_TEAM5_ANNUAL as string | undefined) ?? '',
  } as Record<string, string>,
} as const;
