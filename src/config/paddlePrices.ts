/**
 * Paddle recurring-price ids — the single place they live.
 *
 * Keyed by CURRENCY, not by country. Every EUR market (DE, FR, and any future
 * euro country) bills against the same nine prices, so onboarding a country adds
 * nothing here: countryProfiles already says which currency it bills in, and the
 * lookup below follows that. Never put a price id in a country profile, a market
 * file or a UI component — this module is the only source.
 *
 * ENVIRONMENT: the ids themselves live in `paddleCatalogue.json`, split into
 * `sandbox` and `live` blocks, because Paddle's two environments are separate
 * catalogues — a `pri_…` created in one does not exist in the other. Which block
 * is read is decided by `paddleEnv.ts` from the client token, the same decision
 * that configures Paddle.js, so the SDK and the ids can never disagree.
 *
 * A missing id (empty string) is "not configured yet" and blocks checkout for
 * that plan/term. It NEVER falls back to the other environment: a live build
 * silently charging against a sandbox price would fail at Paddle, and a sandbox
 * build reaching for a live price would take real money in a test.
 *
 * ADDING A CURRENCY (e.g. GBP for the UK):
 *   1. create the GBP prices in Paddle — in BOTH environments (a currency
 *      override on the existing prices, or separate prices; either way you get
 *      nine sandbox ids and nine live ids);
 *   2. add 'GBP' to BillingCurrency;
 *   3. add a GBP block under BOTH `sandbox` and `live` in paddleCatalogue.json;
 *   4. mirror the file into google_cloud_function/paddle-catalogue.json
 *      (tests/paddle-catalogue.unit.mjs fails if you forget).
 * The UK build then picks it up automatically, because COUNTRY_PROFILES.GB
 * already declares `currency: 'GBP'`. Until then, GB resolves to no price id and
 * its plans stay "coming soon" — which is the intended, safe default.
 */
import type { BillingTerm, SubPlanCode } from './subscriptionPlans';
import { ACTIVE_COUNTRY } from './countryProfiles';
import { PADDLE_ENV } from './paddleEnv';
import { priceIdFrom } from './paddleEnvPolicy.js';
import catalogue from './paddleCatalogue.json';

/** Currencies we hold a Paddle catalogue for. Add a code, then add its block. */
export type BillingCurrency = 'EUR';

type PriceMatrix = Record<SubPlanCode, Record<BillingTerm, string>>;
type EnvCatalogue = Record<string, PriceMatrix>;

const CATALOGUE: Record<'sandbox' | 'live', EnvCatalogue> = {
  sandbox: catalogue.sandbox as EnvCatalogue,
  live: catalogue.live as EnvCatalogue,
};

/**
 * The price matrix for the ACTIVE Paddle environment, by currency.
 * Empty when no client token is configured — nothing can be bought, by design.
 */
export const PADDLE_PRICE_IDS: EnvCatalogue = PADDLE_ENV ? CATALOGUE[PADDLE_ENV] : {};

/** The currency this build bills in, from the active country profile. */
export function activeBillingCurrency(): string {
  return ACTIVE_COUNTRY.currency;
}

/**
 * Price id for a plan/term in the active market's currency and the active Paddle
 * environment. '' when it is not configured — callers treat an empty id as
 * "not available" and show the coming-soon notice instead of opening checkout.
 */
export function priceIdFor(plan: SubPlanCode, term: BillingTerm): string {
  return priceIdFrom(catalogue, PADDLE_ENV, activeBillingCurrency(), plan, term);
}

/**
 * True when this build has a usable catalogue: a Paddle environment is selected
 * AND this market's currency has at least one non-empty price id in it. A
 * currency block that exists but is entirely blank (the live block before the
 * live ids are entered) is correctly reported as no catalogue.
 */
export const hasPriceCatalogue: boolean = (() => {
  const matrix = PADDLE_PRICE_IDS[ACTIVE_COUNTRY.currency];
  if (!matrix) return false;
  return Object.values(matrix).some(terms => Object.values(terms).some(id => !!id));
})();

/**
 * Plan/term combinations with no price id in the active environment — the exact
 * list of what still has to be created in (or copied from) Paddle. Surfaced in
 * the dev console rather than failing the build, because "not configured yet"
 * is a legitimate shipping state for a market whose billing is not switched on.
 */
export function missingPriceIds(): Array<{ plan: SubPlanCode; term: BillingTerm }> {
  const matrix = PADDLE_PRICE_IDS[ACTIVE_COUNTRY.currency];
  if (!matrix) return [];
  const missing: Array<{ plan: SubPlanCode; term: BillingTerm }> = [];
  for (const [plan, terms] of Object.entries(matrix)) {
    for (const [term, id] of Object.entries(terms)) {
      if (!id) missing.push({ plan: plan as SubPlanCode, term: term as BillingTerm });
    }
  }
  return missing;
}
