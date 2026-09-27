/**
 * priceCatalogue - Paddle price ids <-> [planCode, billingTerm].
 *
 * Separate from index.js so it can be tested without Firestore. Two tables:
 * CURRENT prices are the only ones a new purchase / plan change / discount
 * restriction may resolve to; LEGACY prices stay mapped forever so webhooks
 * and history for old subscriptions still resolve. Pure, no I/O.
 */

// CURRENT prices (Free + Premium program, 2026-10-free-tier): monthly +
// annual only, EUR, VAT-exclusive, no Paddle trial. These are the ONLY ids a
// new checkout / plan change / discount restriction resolves to.
const CURRENT_PRICES = {
  live: {
    professional: { monthly: 'pri_01m3h46e1q42yg7rt4rq0fn004', annual: 'pri_01m3h46e2xsenv086wg3h2k04t' },
    team_3: { monthly: 'pri_01m3h46e42h9b3077z9j63tgrq', annual: 'pri_01m3h46e58n1e935wb88vnwcwz' },
    team_5: { monthly: 'pri_01m3h46e6jg424g9txe6m5ta8w', annual: 'pri_01m3h46e84mkaxbxkcvqgdg7qm' },
  },
  sandbox: {
    professional: { monthly: 'pri_01m3h4754c2s68w460vnd7cpz4', annual: 'pri_01m3h475d9r9kt9sv4cwfwt5ff' },
    team_3: { monthly: 'pri_01m3h475q5q01jrzrw8xjj4hza', annual: 'pri_01m3h475zgd1fnznkxb97en0xr' },
    team_5: { monthly: 'pri_01m3h4767dnyesd7aqhx94e9kq', annual: 'pri_01m3h476fvzz7m22wfja8ypets' },
  },
};
// Terms a NEW checkout or change request may use. 'six_months' is retired
// (2026-09-27) but stays a KNOWN term: existing records carrying it must keep
// resolving and ranking (TERM_RANK) without crashing anything.
const OFFERED_TERMS = ['monthly', 'annual'];

// LEGACY prices (2026-08-03 program, incl. the retired six-month term). Never
// offered again, but kept mapped FOREVER so webhooks, history and any
// subscription still carrying one of these ids resolve to plan/term.
const LEGACY_PRICES = {
  live: {
    pri_01kxxw08bvfz6fe8ke0x4zgnt7: ['professional', 'monthly'],
    pri_01kxxw3yy10aw2qdy7y64xa0yn: ['professional', 'six_months'],
    pri_01kxxw5qbvmfx75rc7f42p5d50: ['professional', 'annual'],
    pri_01kxxw8xtvk8dvpa60c0dzxyvn: ['team_3', 'monthly'],
    pri_01kxxwbgmpnj9jvcp218evxqfc: ['team_3', 'six_months'],
    pri_01kxxwde1bwd4x7tgn6sypkb4g: ['team_3', 'annual'],
    pri_01kxxwfm97ve7nfgnggtshfs49: ['team_5', 'monthly'],
    pri_01kxxwhr4xyeq9gwd567j2x7me: ['team_5', 'six_months'],
    pri_01kxxwkhfjj3wsy5k7jekt2acn: ['team_5', 'annual'],
  },
  sandbox: {
    pri_01kxchdg26azdq1przy3hnezff: ['professional', 'monthly'],
    pri_01kxchdgawhejbptxtdgm6j5wq: ['professional', 'six_months'],
    pri_01kxchdgj2w4gpdmdfbqkhtsqn: ['professional', 'annual'],
    pri_01kxchdh34vrxtxth8bkpzmh8n: ['team_3', 'monthly'],
    pri_01kxchdh7r99cm3fwk1bz1gz0k: ['team_3', 'six_months'],
    pri_01kxchdhcm7efjmkh7s1673j82: ['team_3', 'annual'],
    pri_01kxchdhrmrtqmhataynyqdcdm: ['team_5', 'monthly'],
    pri_01kxchdj04dzbf9j5s92tkwvvz: ['team_5', 'six_months'],
    pri_01kxchdj4rtpj7ndzj30sawddw: ['team_5', 'annual'],
  },
};

/** price_id → [planCode, billingTerm] for one environment: current + legacy. */
function catalogueFor(env) {
  const out = { ...(LEGACY_PRICES[env] || {}) };
  for (const [plan, terms] of Object.entries(CURRENT_PRICES[env] || {})) {
    for (const [term, id] of Object.entries(terms)) out[id] = [plan, term];
  }
  return out;
}
const PRICE_CATALOGUE = { live: catalogueFor('live'), sandbox: catalogueFor('sandbox') };

/** price_id → [planCode, billingTerm], searching both environments (webhooks
 *  from either environment must resolve; ids are globally unique). */
function planFromPriceId(priceId) {
  return PRICE_CATALOGUE.live[priceId] || PRICE_CATALOGUE.sandbox[priceId] || null;
}
/** plan/term → the CURRENT price id for this environment; null for a retired
 *  term (six_months) or an unknown plan. Never returns a legacy id. */
function priceIdFor(planCode, billingTerm, env = 'live') {
  if (!OFFERED_TERMS.includes(billingTerm)) return null;
  const cat = CURRENT_PRICES[env] || CURRENT_PRICES.live;
  return (cat[planCode] && cat[planCode][billingTerm]) || null;
}

module.exports = {
  CURRENT_PRICES, LEGACY_PRICES, OFFERED_TERMS, PRICE_CATALOGUE, planFromPriceId, priceIdFor,
};
