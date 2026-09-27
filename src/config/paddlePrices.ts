/**
 * Paddle recurring-price ids — the single place they live.
 *
 * Keyed by CURRENCY, not by country. Every EUR market (DE, FR, and any future
 * euro country) bills against the same nine prices, so onboarding a country adds
 * nothing here: countryProfiles already says which currency it bills in, and the
 * lookup below follows that. Never put a price id in a country profile, a market
 * file or a UI component — this module is the only source.
 *
 * ENVIRONMENT: Paddle sandbox and live are completely separate catalogues — a
 * `pri_…` from one does not exist in the other — so BOTH id sets live here and
 * the environment is chosen by the CLIENT TOKEN's prefix (`test_…` = sandbox,
 * `live_…` = production). That is the same signal paddleService uses to call
 * `Paddle.Environment.set('sandbox')`, so the token is the single switch: set
 * VITE_PADDLE_CLIENT_TOKEN and the whole build follows it. No id is ever
 * hard-coded outside this file.
 *
 * The live catalogue (created 2026-07) intentionally carries NO Paddle trial:
 * the free period is the in-app 15-day signup trial, so live checkout charges
 * immediately (see subscriptionPlans.ts). Sandbox prices still carry the old
 * 7-day Paddle trial — that difference is expected and harmless for testing.
 *
 * ADDING A CURRENCY (e.g. GBP for the UK):
 *   1. create the GBP prices in Paddle (a currency override on the existing
 *      prices, or separate prices — either way you get nine ids);
 *   2. add 'GBP' to BillingCurrency;
 *   3. add a GBP block to BOTH catalogues with those ids.
 * The UK build then picks it up automatically, because COUNTRY_PROFILES.GB
 * already declares `currency: 'GBP'`. Until then, GB resolves to no price id and
 * its plans stay "coming soon" — which is the intended, safe default.
 */
import type { BillingTerm, SubPlanCode } from './subscriptionPlans';
import { ACTIVE_COUNTRY } from './countryProfiles';
import { PUBLIC_ENV } from './env';

/** Currencies we hold a Paddle catalogue for. Add a code, then add its block. */
export type BillingCurrency = 'EUR';

type PriceMatrix = Record<SubPlanCode, Record<BillingTerm, string>>;

/**
 * 2026-10 program (owner, 2026-09-27): monthly + annual only — the 6-month
 * term is retired, so `six_months` resolves to '' (not offered). The previous
 * catalogue (EUR 24.90/139/249 · 59/329/590 · 99/549/990) stays in Paddle
 * only so historical webhooks still resolve in the billing function; archive
 * it once this build is live.
 */
/** LIVE catalogue (production Paddle account) — no Paddle-side trial. */
const LIVE_PRICE_IDS: Record<BillingCurrency, PriceMatrix> = {
  EUR: {
    professional: {
      monthly:    'pri_01m3h46e1q42yg7rt4rq0fn004',   // EUR 9.90 / month
      six_months: '',
      annual:     'pri_01m3h46e2xsenv086wg3h2k04t',   // EUR 99.00 / year
    },
    team_3: {
      monthly:    'pri_01m3h46e42h9b3077z9j63tgrq',   // EUR 24.90 / month
      six_months: '',
      annual:     'pri_01m3h46e58n1e935wb88vnwcwz',   // EUR 249.00 / year
    },
    team_5: {
      monthly:    'pri_01m3h46e6jg424g9txe6m5ta8w',   // EUR 39.00 / month
      six_months: '',
      annual:     'pri_01m3h46e84mkaxbxkcvqgdg7qm',   // EUR 390.00 / year
    },
  },
};

/** SANDBOX catalogue — used only when the client token is a `test_…` token. */
const SANDBOX_PRICE_IDS: Record<BillingCurrency, PriceMatrix> = {
  EUR: {
    professional: {
      monthly:    'pri_01m3h4754c2s68w460vnd7cpz4',   // EUR 9.90 / month
      six_months: '',
      annual:     'pri_01m3h475d9r9kt9sv4cwfwt5ff',   // EUR 99.00 / year
    },
    team_3: {
      monthly:    'pri_01m3h475q5q01jrzrw8xjj4hza',   // EUR 24.90 / month
      six_months: '',
      annual:     'pri_01m3h475zgd1fnznkxb97en0xr',   // EUR 249.00 / year
    },
    team_5: {
      monthly:    'pri_01m3h4767dnyesd7aqhx94e9kq',   // EUR 39.00 / month
      six_months: '',
      annual:     'pri_01m3h476fvzz7m22wfja8ypets',   // EUR 390.00 / year
    },
  },
};

/** True when this build talks to the Paddle SANDBOX (token prefix decides). */
export const IS_PADDLE_SANDBOX = PUBLIC_ENV.PADDLE_CLIENT_TOKEN.startsWith('test_');

/** The catalogue this build bills against — live unless a sandbox token is set. */
export const PADDLE_PRICE_IDS: Record<BillingCurrency, PriceMatrix> =
  IS_PADDLE_SANDBOX ? SANDBOX_PRICE_IDS : LIVE_PRICE_IDS;

/** The currency this build bills in, from the active country profile. */
export function activeBillingCurrency(): string {
  return ACTIVE_COUNTRY.currency;
}

function hasCatalogue(currency: string): currency is BillingCurrency {
  return currency in PADDLE_PRICE_IDS;
}

/**
 * Price id for a plan/term in the active market's currency.
 * '' when we hold no catalogue for that currency yet (e.g. GBP) — callers treat
 * an empty id as "not configured" and show the coming-soon notice.
 */
export function priceIdFor(plan: SubPlanCode, term: BillingTerm): string {
  const currency = activeBillingCurrency();
  if (!hasCatalogue(currency)) return '';
  return PADDLE_PRICE_IDS[currency][plan][term] ?? '';
}

/** True when this build has any price catalogue at all (its currency is covered). */
export const hasPriceCatalogue = hasCatalogue(ACTIVE_COUNTRY.currency);
