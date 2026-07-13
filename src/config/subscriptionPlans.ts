/**
 * subscriptionPlans.ts — the HeatPump DB subscription program (single source of truth).
 *
 * Program (decided 2026-07-12):
 *   Professional (1 user) / Team 3 (admin + 2) / Team 5 (admin + 4)
 *   Terms: monthly / 6 months (~7% off) / annual (~17% off, "12 for the price of 10")
 *   Every new subscription starts with a 7-day free trial (payment method up front,
 *   first charge on day 8). Team trials are ONE per organization, anchored to the
 *   moment the team admin subscribed — member join dates never extend it.
 *
 * Operating principles (enforced in UI + admin, not Paddle proration):
 *   - Plan and term are FIXED during a paid period. No mid-term upgrades,
 *     downgrades, seat changes or pro-rated charges.
 *   - Upgrades/downgrades are SCHEDULED and apply at the next renewal
 *     (subscriptionChangeRequests collection; ops/webhook applies them).
 *   - Team member replacement (remove + invite into the freed seat) is always
 *     allowed and never touches the Paddle subscription.
 *   - Downgrading Team 5 → Team 3 requires choosing the members to keep at
 *     scheduling time; the rest lose access at renewal.
 *   - Cancelling stops the next renewal only; access runs to period end.
 *
 * Prices are VAT-exclusive; Paddle computes VAT at checkout per country.
 * Paddle catalogue: 3 products × 3 recurring prices, each with a 7-day trial.
 * The price ids live in paddlePrices.ts, keyed by currency (EUR today); a market
 * whose currency has no catalogue stays in "coming soon" mode.
 */
import { PUBLIC_ENV } from './env';
import { priceIdFor } from './paddlePrices';

export type SubPlanCode = 'professional' | 'team_3' | 'team_5';
export type BillingTerm = 'monthly' | 'six_months' | 'annual';
export type SubStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';

export const TRIAL_DAYS = 7;

export interface SubPlanDef {
  code: SubPlanCode;
  /** Seats INCLUDING the team admin (1 for Professional). */
  seatLimit: number;
  /** VAT-exclusive EUR prices per term. */
  prices: Record<BillingTerm, number>;
  sortOrder: number;
}

export const SUB_PLANS: Record<SubPlanCode, SubPlanDef> = {
  professional: {
    code: 'professional', seatLimit: 1, sortOrder: 1,
    prices: { monthly: 24.90, six_months: 139, annual: 249 },
  },
  team_3: {
    code: 'team_3', seatLimit: 3, sortOrder: 2,
    prices: { monthly: 59, six_months: 329, annual: 590 },
  },
  team_5: {
    code: 'team_5', seatLimit: 5, sortOrder: 3,
    prices: { monthly: 99, six_months: 549, annual: 990 },
  },
};

export const SUB_PLAN_CODES: SubPlanCode[] = ['professional', 'team_3', 'team_5'];
export const BILLING_TERMS: BillingTerm[] = ['monthly', 'six_months', 'annual'];

/** English display names (admin console + fallbacks; app UI uses i18n keys). */
export const SUB_PLAN_NAMES: Record<SubPlanCode, string> = {
  professional: 'Professional',
  team_3: 'Team 3',
  team_5: 'Team 5',
};

export const TERM_NAMES: Record<BillingTerm, string> = {
  monthly: 'Monthly',
  six_months: '6 Months',
  annual: 'Annual',
};

/** Months covered by a term (for per-month equivalents and period math). */
export const TERM_MONTHS: Record<BillingTerm, number> = {
  monthly: 1, six_months: 6, annual: 12,
};

export const isTeamPlan = (code: SubPlanCode | undefined | null): boolean =>
  code === 'team_3' || code === 'team_5';

export const formatEur = (v: number): string =>
  `€${v % 1 === 0 ? v.toLocaleString('en-IE') : v.toFixed(2)}`;

/** Effective monthly cost of a term, e.g. annual €249 → €20.75/month. */
export const perMonth = (plan: SubPlanCode, term: BillingTerm): number =>
  SUB_PLANS[plan].prices[term] / TERM_MONTHS[term];

/** Per-user per-month when the team is fully used (team plans only). */
export const perUserMonth = (plan: SubPlanCode, term: BillingTerm): number =>
  perMonth(plan, term) / SUB_PLANS[plan].seatLimit;

/**
 * Paddle recurring-price id for a plan/term ('' = not configured yet).
 * The ids live in paddlePrices.ts, keyed by currency — DE and FR share the EUR
 * catalogue, and a market whose currency has no catalogue yet resolves to ''.
 */
export function paddlePriceId(plan: SubPlanCode, term: BillingTerm): string {
  return priceIdFor(plan, term);
}

/** True when checkout can actually open for this plan/term. */
export function checkoutConfigured(plan: SubPlanCode, term: BillingTerm): boolean {
  return !!(PUBLIC_ENV.PADDLE_CLIENT_TOKEN && paddlePriceId(plan, term));
}

/** A subscription (or grant) that currently unlocks the product. */
export function subscriptionUnlocked(status: SubStatus | undefined | null, periodEndsAt?: string | null): boolean {
  if (status === 'trialing' || status === 'active' || status === 'past_due') return true;
  // Cancelled-but-paid: access runs to the end of the paid period.
  if (status === 'canceled' && periodEndsAt) return new Date(periodEndsAt).getTime() > Date.now();
  return false;
}
