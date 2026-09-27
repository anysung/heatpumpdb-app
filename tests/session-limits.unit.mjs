/**
 * Free + Premium (2026-09-27) — server-side pieces of google_cloud_function_billing
 * that can be tested without Firestore:
 *   1. concurrent-session limit by tier (Premium 2, Free 1, fail-open → Premium)
 *   2. price catalogue: new checkouts/changes resolve to the NEW monthly/annual
 *      ids only; every legacy id (incl. the retired six-month term) still
 *      resolves for webhooks/history.
 */
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fn = (f) => require(resolve(root, 'google_cloud_function_billing', f));
const { activeLimitFor, isPremium, windowOpen } = fn('sessionLimits.js');
const { priceIdFor, planFromPriceId, LEGACY_PRICES, CURRENT_PRICES } = fn('priceCatalogue.js');

let passed = 0, failed = 0;
const is = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}  — expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`); }
};

const NOW = Date.parse('2026-10-02T12:00:00Z');
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString();
const ts = (ms) => ({ toMillis: () => ms });          // Firestore Timestamp shape
const CFG = { activeLimit: 2, freeActiveLimit: 1 };

console.log('\nSession limit — tier\n');
is('legacy account (no accessUntilTs) → Premium 2', activeLimitFor({}, undefined, NOW, CFG), 2);
is('trial running → Premium 2', activeLimitFor({ accessUntilTs: ts(NOW + 5 * DAY) }, undefined, NOW, CFG), 2);
is('trial expired → Free 1', activeLimitFor({ accessUntilTs: ts(NOW - DAY) }, undefined, NOW, CFG), 1);
is('re-registration (window closed at activation) → Free 1',
  activeLimitFor({ accessUntilTs: ts(NOW - 1000) }, undefined, NOW, CFG), 1);
is('window closes exactly now → Free', activeLimitFor({ accessUntilTs: ts(NOW) }, undefined, NOW, CFG), 1);
is('ISO-string window in the future → Premium', activeLimitFor({ accessUntilTs: iso(NOW + DAY) }, undefined, NOW, CFG), 2);
is('live grant with closed own window → Premium',
  activeLimitFor({ accessUntilTs: ts(NOW - DAY), grant: { endsAt: iso(NOW + 30 * DAY) } }, undefined, NOW, CFG), 2);
is('revoked grant does not count',
  activeLimitFor({ accessUntilTs: ts(NOW - DAY), grant: { endsAt: iso(NOW + 30 * DAY), revokedAt: iso(NOW - DAY) } }, undefined, NOW, CFG), 1);
is('expired grant does not count',
  activeLimitFor({ accessUntilTs: ts(NOW - DAY), grant: { endsAt: iso(NOW - DAY) } }, undefined, NOW, CFG), 1);
is('team window open → Premium',
  activeLimitFor({ accessUntilTs: ts(NOW - DAY), orgId: 'o1' }, { accessUntilTs: ts(NOW + DAY) }, NOW, CFG), 2);
is('team window closed → Free',
  activeLimitFor({ accessUntilTs: ts(NOW - DAY), orgId: 'o1' }, { accessUntilTs: ts(NOW - DAY) }, NOW, CFG), 1);
is('team member without personal window → Premium (as firestore.rules)',
  activeLimitFor({ orgId: 'o1', orgRole: 'member' }, undefined, NOW, CFG), 2);

console.log('\nSession limit — fail-open\n');
is('unparseable window → Premium', activeLimitFor({ accessUntilTs: 'not-a-date' }, undefined, NOW, CFG), 2);
is('null window → Premium', activeLimitFor({ accessUntilTs: null }, undefined, NOW, CFG), 2);
is('org doc unreadable (null) → Premium',
  activeLimitFor({ accessUntilTs: ts(NOW - DAY), orgId: 'o1' }, null, NOW, CFG), 2);
is('no config → defaults (Free 1)', activeLimitFor({ accessUntilTs: ts(NOW - DAY) }, undefined, NOW, undefined), 1);
is('no config → defaults (Premium 2)', activeLimitFor({}, undefined, NOW, undefined), 2);
is('free limit misconfigured to 0 → clamped to 1',
  activeLimitFor({ accessUntilTs: ts(NOW - DAY) }, undefined, NOW, { activeLimit: 2, freeActiveLimit: 0 }), 1);
is('free limit misconfigured above Premium → clamped to Premium',
  activeLimitFor({ accessUntilTs: ts(NOW - DAY) }, undefined, NOW, { activeLimit: 2, freeActiveLimit: 5 }), 2);
is('windowOpen(undefined) is open', windowOpen(undefined, NOW), true);
is('isPremium(null user) is Premium', isPremium(null, undefined, NOW), true);

console.log('\nPrice catalogue — new purchases/changes use the NEW ids\n');
const NEW_LIVE = {
  professional: ['pri_01m3h46e1q42yg7rt4rq0fn004', 'pri_01m3h46e2xsenv086wg3h2k04t'],
  team_3: ['pri_01m3h46e42h9b3077z9j63tgrq', 'pri_01m3h46e58n1e935wb88vnwcwz'],
  team_5: ['pri_01m3h46e6jg424g9txe6m5ta8w', 'pri_01m3h46e84mkaxbxkcvqgdg7qm'],
};
const NEW_SANDBOX = {
  professional: ['pri_01m3h4754c2s68w460vnd7cpz4', 'pri_01m3h475d9r9kt9sv4cwfwt5ff'],
  team_3: ['pri_01m3h475q5q01jrzrw8xjj4hza', 'pri_01m3h475zgd1fnznkxb97en0xr'],
  team_5: ['pri_01m3h4767dnyesd7aqhx94e9kq', 'pri_01m3h476fvzz7m22wfja8ypets'],
};
for (const [env, table] of [['live', NEW_LIVE], ['sandbox', NEW_SANDBOX]]) {
  for (const [plan, [m, a]] of Object.entries(table)) {
    is(`${env} ${plan}/monthly → new id`, priceIdFor(plan, 'monthly', env), m);
    is(`${env} ${plan}/annual → new id`, priceIdFor(plan, 'annual', env), a);
    is(`${env} ${m} resolves back`, planFromPriceId(m), [plan, 'monthly']);
    is(`${env} ${a} resolves back`, planFromPriceId(a), [plan, 'annual']);
  }
}
is('six_months is never offered (live)', priceIdFor('professional', 'six_months', 'live'), null);
is('six_months is never offered (sandbox)', priceIdFor('team_5', 'six_months', 'sandbox'), null);
is('unknown plan → null', priceIdFor('enterprise', 'monthly', 'live'), null);
is('default env is live', priceIdFor('professional', 'monthly'), NEW_LIVE.professional[0]);

console.log('\nPrice catalogue — legacy ids keep resolving\n');
let legacyOk = 0, legacyTotal = 0;
for (const env of ['live', 'sandbox']) {
  for (const [id, pair] of Object.entries(LEGACY_PRICES[env])) {
    legacyTotal++;
    if (JSON.stringify(planFromPriceId(id)) === JSON.stringify(pair)) legacyOk++;
  }
}
is('all 18 legacy ids (incl. 6 six-month) still resolve', [legacyOk, legacyTotal], [18, 18]);
is('legacy six-month id → six_months', planFromPriceId('pri_01kxxw3yy10aw2qdy7y64xa0yn'), ['professional', 'six_months']);
const legacyIds = new Set([...Object.keys(LEGACY_PRICES.live), ...Object.keys(LEGACY_PRICES.sandbox)]);
const offered = ['live', 'sandbox'].flatMap((env) =>
  Object.values(CURRENT_PRICES[env]).flatMap((t) => Object.values(t)));
is('no CURRENT id is a legacy id', offered.filter((id) => legacyIds.has(id)), []);
is('12 current ids, all distinct', new Set(offered).size, 12);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
