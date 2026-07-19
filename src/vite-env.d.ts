/// <reference types="vite/client" />

/**
 * Build-time public environment. Only VITE_-prefixed values reach the browser
 * bundle; every one of them is public by definition, so nothing secret belongs
 * here (see config/env.ts for the policy). Read them through PUBLIC_ENV rather
 * than import.meta.env directly.
 */
interface ImportMetaEnv {
  /** ISO 3166-1 alpha-2 code for this build. Unset → 'DE'. */
  readonly VITE_COUNTRY_CODE?: string;
  /** 'admin' builds the operations console; anything else is the country app. */
  readonly VITE_APP_MODE?: string;
  /** Firebase App Check — reCAPTCHA Enterprise site key (public by design). */
  readonly VITE_RECAPTCHA_SITE_KEY?: string;
  /**
   * Paddle Billing client-side token. Publishable by design — it authorizes
   * opening a checkout, not charging. Its prefix selects the environment:
   * 'test_…' = sandbox, anything else = live (config/paddleEnv.ts). Unset =
   * billing UI shows "coming soon" and no checkout can open.
   * Paddle price ids are NOT env vars — they live in config/paddleCatalogue.json.
   */
  readonly VITE_PADDLE_CLIENT_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** TTF font assets imported as URLs (jsPDF embedded fonts). */
declare module '*.ttf?url' {
  const url: string;
  export default url;
}

/** Build-time market catalogue stats (vite.config define) — shown on the auth landing. */
declare const __MARKET_STATS__: { res: number; com: number; mfr: number };

/** Build-time stats for every market (vite.config define) — unified admin console. */
declare const __ALL_MARKET_STATS__: Record<string, { res: number; com: number; mfr: number }>;
