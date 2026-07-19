/**
 * paddleEnvPolicy — how a Paddle client token selects an environment, and how a
 * price id is looked up in that environment. Plain JS with no imports so the
 * tests can exercise the real rules rather than a re-typed copy of them.
 *
 * Both functions are deliberately total and fallback-free. There is no path
 * where a missing live id quietly resolves to the sandbox id of the same plan:
 * that substitution is the single most expensive mistake available here (a live
 * page charging against a test price, or a test charging real money), and it
 * would be invisible until a customer hit it.
 */

/**
 * @param {string|undefined|null} token - VITE_PADDLE_CLIENT_TOKEN.
 * @returns {'sandbox'|'live'|null} null when unconfigured — no checkout at all.
 */
export function environmentForToken(token) {
  if (!token) return null;
  return String(token).startsWith('test_') ? 'sandbox' : 'live';
}

/**
 * Look up one price id. Returns '' for every "not configured" case — unknown
 * environment, currency we hold no catalogue for, or a blank id — and callers
 * treat '' as "cannot check out", never as "use the other one".
 */
export function priceIdFrom(catalogue, environment, currency, plan, term) {
  if (!environment) return '';
  const block = catalogue && catalogue[environment];
  if (!block) return '';
  const byPlan = block[currency];
  if (!byPlan) return '';
  const terms = byPlan[plan];
  if (!terms) return '';
  return terms[term] || '';
}
