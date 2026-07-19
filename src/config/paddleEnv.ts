/**
 * paddleEnv — the ONE place that decides which Paddle environment this build talks to.
 *
 * Paddle sandbox and live are completely separate systems: separate catalogues
 * (a `pri_…` from one does not exist in the other), separate customers, separate
 * webhook secrets. Picking the environment for Paddle.js and picking the price
 * catalogue are therefore the SAME decision, and it is made exactly once, here —
 * so the two can never disagree (a live token driving sandbox price ids fails at
 * checkout with an opaque Paddle error, which is precisely what this prevents).
 *
 * The signal is the client token's own prefix, which Paddle guarantees:
 *   `test_…`  → sandbox
 *   anything else, non-empty → live
 *   empty     → unconfigured; no checkout can open at all
 *
 * Deliberately NOT hostname-based: the same bundle is served from several
 * domains per market (apex, www, *.web.app, preview channels), and a hostname
 * rule silently turns a preview deploy into a live-charging page. The token is
 * the thing that actually authorizes the charge, so the token decides.
 *
 * There is NO fallback in either direction. A missing live id does not quietly
 * resolve to the sandbox id (that would take real money against a test price,
 * or worse, appear to work in review and fail in production), and a missing
 * sandbox id does not reach for live. Missing → checkout is blocked, visibly.
 */
import { PUBLIC_ENV } from './env';
import { environmentForToken } from './paddleEnvPolicy.js';

export type PaddleEnvironment = 'sandbox' | 'live';

/**
 * The active Paddle environment, or null when no client token is configured.
 * null is a real state, not an error: it is how every market ships before its
 * billing is switched on, and it renders the "coming soon" notice.
 */
export const PADDLE_ENV: PaddleEnvironment | null =
  environmentForToken(PUBLIC_ENV.PADDLE_CLIENT_TOKEN) as PaddleEnvironment | null;

/** True when this build talks to Paddle sandbox (test money only). */
export const isPaddleSandbox = PADDLE_ENV === 'sandbox';

/** True when this build talks to Paddle live (real money). */
export const isPaddleLive = PADDLE_ENV === 'live';
