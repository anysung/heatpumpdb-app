/**
 * Paddle billing unit tests — environment separation, price→plan mapping, seat
 * limits, webhook signature verification, quantity enforcement and the shared
 * entitlement policy.
 *
 * Everything here is pure: no network, no Firestore, no Paddle account. The
 * emulator-backed rules tests live in tests/organization-read.rules.mjs.
 *
 * Run: node tests/paddle-billing.unit.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

import { environmentForToken, priceIdFrom } from '../src/config/paddleEnvPolicy.js';
import { paidAccessState, hasPaidAccess, PAST_DUE_GRACE_DAYS } from '../src/config/entitlementPolicy.js';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

const APP_CATALOGUE_PATH = 'src/config/paddleCatalogue.json';
const CF_CATALOGUE_PATH = 'google_cloud_function/paddle-catalogue.json';
const APP_POLICY_PATH = 'src/config/entitlementPolicy.js';
const CF_POLICY_PATH = 'google_cloud_function/entitlementPolicy.mjs';

const catalogue = JSON.parse(read(APP_CATALOGUE_PATH));
const webhook = require(resolve(ROOT, 'google_cloud_function/paddleWebhook.js'));

const PLANS = ['professional', 'team_3', 'team_5'];
const TERMS = ['monthly', 'six_months', 'annual'];
const EXPECTED_SEATS = { professional: 1, team_3: 3, team_5: 5 };

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    failures.push({ name, err });
    console.log(`FAIL  ${name}\n      ${err.message}`);
  }
}

const section = (t) => console.log(`\n${t}`);

// ── 0. Mirrored files must not drift ─────────────────────────────────────────
// The webhook and the app must agree on the price catalogue and on what counts
// as paid access. They cannot import each other, so the copies are compared
// byte-for-byte here — this test is the entire anti-drift mechanism.

section('0. Shared-file parity (app ↔ cloud function)');

test('paddle catalogue is byte-identical in both locations', () => {
  assert.equal(read(CF_CATALOGUE_PATH), read(APP_CATALOGUE_PATH),
    `${CF_CATALOGUE_PATH} has drifted from ${APP_CATALOGUE_PATH} — re-copy it`);
});

test('entitlement policy is byte-identical in both locations', () => {
  assert.equal(read(CF_POLICY_PATH), read(APP_POLICY_PATH),
    `${CF_POLICY_PATH} has drifted from ${APP_POLICY_PATH} — re-copy it`);
});

// ── 1-3. Environment separation ──────────────────────────────────────────────

section('1-3. Sandbox / live environment separation');

test('1. a test_ token selects the sandbox catalogue', () => {
  assert.equal(environmentForToken('test_abc123'), 'sandbox');
  const id = priceIdFrom(catalogue, environmentForToken('test_abc'), 'EUR', 'professional', 'monthly');
  assert.equal(id, catalogue.sandbox.EUR.professional.monthly);
  assert.ok(id.startsWith('pri_'), 'sandbox professional/monthly should be a real id');
});

test('2. a live token selects the live catalogue', () => {
  assert.equal(environmentForToken('live_abc123'), 'live');
  // Any non-test_ token is live — Paddle live tokens are not prefixed 'live_'.
  assert.equal(environmentForToken('abc123'), 'live');
  const id = priceIdFrom(catalogue, 'live', 'EUR', 'professional', 'monthly');
  assert.equal(id, catalogue.live.EUR.professional.monthly);
});

test('2b. no token at all means no environment and no checkout', () => {
  assert.equal(environmentForToken(''), null);
  assert.equal(environmentForToken(undefined), null);
  assert.equal(priceIdFrom(catalogue, null, 'EUR', 'professional', 'monthly'), '');
});

test('3. a missing environment-specific price id blocks checkout (no cross-env fallback)', () => {
  // The real live block is now populated, so the guarantee is exercised against
  // a catalogue with a hole in it: a blank id must resolve to '' and must NEVER
  // borrow the other environment's id for the same plan/term. (A live page
  // charging against a sandbox price, or a test taking real money, is the exact
  // failure this prevents — and it would be invisible until a customer hit it.)
  const holed = JSON.parse(JSON.stringify(catalogue));
  holed.live.EUR.team_3.six_months = '';
  assert.equal(priceIdFrom(holed, 'live', 'EUR', 'team_3', 'six_months'), '',
    'a blank live id must resolve to empty');
  assert.notEqual(priceIdFrom(holed, 'live', 'EUR', 'team_3', 'six_months'),
    holed.sandbox.EUR.team_3.six_months,
    'a blank live id must never fall back to the sandbox id');

  // And the reverse direction.
  holed.sandbox.EUR.professional.annual = '';
  assert.equal(priceIdFrom(holed, 'sandbox', 'EUR', 'professional', 'annual'), '');
  assert.notEqual(priceIdFrom(holed, 'sandbox', 'EUR', 'professional', 'annual'),
    holed.live.EUR.professional.annual);
});

test('3b. the shipped catalogue has no blank id in EITHER environment', () => {
  for (const env of ['sandbox', 'live']) {
    for (const plan of PLANS) {
      for (const term of TERMS) {
        const id = catalogue[env].EUR[plan][term];
        assert.ok(id && id.startsWith('pri_'),
          `${env}.EUR.${plan}.${term} is blank or malformed — checkout would be blocked`);
      }
    }
  }
});

test('3c. an unknown currency resolves to no price, not a default', () => {
  assert.equal(priceIdFrom(catalogue, 'sandbox', 'GBP', 'professional', 'monthly'), '');
  assert.equal(priceIdFrom(catalogue, 'sandbox', 'PLN', 'team_3', 'annual'), '');
});

// ── 4. All nine prices map to the right plan and term ────────────────────────

section('4. Price-id → plan/term mapping (all 9 per environment)');

test('4. every plan × term slot exists in both environments', () => {
  for (const env of ['sandbox', 'live']) {
    for (const plan of PLANS) {
      for (const term of TERMS) {
        assert.ok(
          typeof catalogue[env].EUR[plan]?.[term] === 'string',
          `${env}.EUR.${plan}.${term} is missing from the catalogue`,
        );
      }
    }
  }
});

test('4b. the webhook resolves each of the 9 sandbox ids to the right plan and term', () => {
  for (const plan of PLANS) {
    for (const term of TERMS) {
      const id = catalogue.sandbox.EUR[plan][term];
      const resolved = webhook.resolvePrice(id);
      assert.ok(resolved, `webhook could not resolve ${id}`);
      assert.equal(resolved.planCode, plan, `${id} resolved to the wrong plan`);
      assert.equal(resolved.billingTerm, term, `${id} resolved to the wrong term`);
      assert.equal(resolved.environment, 'sandbox');
    }
  }
});

test('4b-LIVE. the webhook resolves each of the 9 LIVE ids to the right plan, term and seats', () => {
  // The production mapping, asserted against the ids as supplied by Paddle.
  // planCode and billingTerm come from this table; seatLimit is then taken from
  // our own plan table, never from anything Paddle sends.
  for (const plan of PLANS) {
    for (const term of TERMS) {
      const id = catalogue.live.EUR[plan][term];
      const resolved = webhook.resolvePrice(id);
      assert.ok(resolved, `webhook could not resolve LIVE ${id}`);
      assert.equal(resolved.planCode, plan, `LIVE ${id} resolved to the wrong plan`);
      assert.equal(resolved.billingTerm, term, `LIVE ${id} resolved to the wrong term`);
      assert.equal(resolved.environment, 'live', `LIVE ${id} must resolve in the live catalogue`);
      assert.equal(resolved.currency, 'EUR');
      assert.equal(webhook.SEAT_LIMITS[resolved.planCode], EXPECTED_SEATS[plan],
        `LIVE ${id} must carry ${EXPECTED_SEATS[plan]} seat(s)`);
    }
  }
});

test('4b-LIVE2. the live ids are exactly the nine supplied by Paddle, in the right slots', () => {
  // Pinned literally so a copy/paste slip between two similar-looking pri_ ids
  // fails here rather than by charging a customer the wrong price.
  const EXPECTED_LIVE = {
    professional: {
      monthly:    'pri_01kxxw08bvfz6fe8ke0x4zgnt7',
      six_months: 'pri_01kxxw3yy10aw2qdy7y64xa0yn',
      annual:     'pri_01kxxw5qbvmfx75rc7f42p5d50',
    },
    team_3: {
      monthly:    'pri_01kxxw8xtvk8dvpa60c0dzxyvn',
      six_months: 'pri_01kxxwbgmpnj9jvcp218evxqfc',
      annual:     'pri_01kxxwde1bwd4x7tgn6sypkb4g',
    },
    team_5: {
      monthly:    'pri_01kxxwfm97ve7nfgnggtshfs49',
      six_months: 'pri_01kxxwhr4xyeq9gwd567j2x7me',
      annual:     'pri_01kxxwkhfjj3wsy5k7jekt2acn',
    },
  };
  assert.deepEqual(catalogue.live.EUR, EXPECTED_LIVE);
});

test('4b-ENV. a live token reaches ONLY live ids, a sandbox token ONLY sandbox ids', () => {
  const liveIds = new Set(PLANS.flatMap(p => TERMS.map(t => catalogue.live.EUR[p][t])));
  const sandboxIds = new Set(PLANS.flatMap(p => TERMS.map(t => catalogue.sandbox.EUR[p][t])));

  for (const plan of PLANS) {
    for (const term of TERMS) {
      const viaLive = priceIdFrom(catalogue, environmentForToken('live_abc'), 'EUR', plan, term);
      assert.ok(liveIds.has(viaLive), `a live token produced a non-live id for ${plan}/${term}`);
      assert.ok(!sandboxIds.has(viaLive), `a live token leaked a SANDBOX id for ${plan}/${term}`);

      const viaSandbox = priceIdFrom(catalogue, environmentForToken('test_abc'), 'EUR', plan, term);
      assert.ok(sandboxIds.has(viaSandbox), `a sandbox token produced a non-sandbox id for ${plan}/${term}`);
      assert.ok(!liveIds.has(viaSandbox), `a sandbox token leaked a LIVE id for ${plan}/${term}`);
    }
  }
});

test('4c. sandbox and live id spaces are disjoint (no id appears in both)', () => {
  const ids = (env) => PLANS.flatMap(p => TERMS.map(t => catalogue[env].EUR[p][t])).filter(Boolean);
  const overlap = ids('sandbox').filter(id => ids('live').includes(id));
  assert.deepEqual(overlap, [], `ids present in BOTH environments: ${overlap.join(', ')}`);
});

test('4d. no duplicate price ids within an environment', () => {
  for (const env of ['sandbox', 'live']) {
    const ids = PLANS.flatMap(p => TERMS.map(t => catalogue[env].EUR[p][t])).filter(Boolean);
    assert.equal(new Set(ids).size, ids.length, `${env} has a price id used for two plan/term slots`);
  }
});

// ── 5. Quantity is always exactly 1 ──────────────────────────────────────────

section('5. Quantity invariant');

test('5. checkout sends quantity: 1 and nothing else', () => {
  const src = read('src/services/paddleService.ts');
  assert.ok(/quantity:\s*1\b/.test(src), 'openCheckout must send quantity: 1');
  const quantities = [...src.matchAll(/quantity:\s*([^,\s}]+)/g)].map(m => m[1]);
  assert.deepEqual(quantities, ['1'], `unexpected quantity values in checkout: ${quantities.join(', ')}`);
});

test('5b. the webhook accepts quantity 1 and flags anything else', () => {
  assert.equal(webhook.quantityViolation([{ quantity: 1, price: { id: 'pri_x' } }]), null);
  assert.deepEqual(webhook.quantityViolation([{ quantity: 3, price: { id: 'pri_x' } }]),
    { priceId: 'pri_x', quantity: 3 });
  assert.deepEqual(webhook.quantityViolation([{ quantity: 0, price: { id: 'pri_x' } }]),
    { priceId: 'pri_x', quantity: 0 });
  // A missing quantity is an anomaly too — it is not assumed to be 1.
  assert.deepEqual(webhook.quantityViolation([{ price: { id: 'pri_x' } }]),
    { priceId: 'pri_x', quantity: null });
  // Violation anywhere in a multi-item payload is caught.
  assert.ok(webhook.quantityViolation([{ quantity: 1, price: { id: 'a' } }, { quantity: 2, price: { id: 'b' } }]));
});

// ── 6-8, 11. Seat limits ─────────────────────────────────────────────────────

section('6-8, 11. Seat limits (owner included)');

test('6. professional maps to 1 seat', () => assert.equal(webhook.SEAT_LIMITS.professional, 1));
test('7. team_3 maps to 3 seats', () => assert.equal(webhook.SEAT_LIMITS.team_3, 3));
test('8. team_5 maps to 5 seats', () => assert.equal(webhook.SEAT_LIMITS.team_5, 5));

test('6-8b. the webhook seat table matches SUB_PLANS in the app config', () => {
  const src = read('src/config/subscriptionPlans.ts');
  for (const [plan, seats] of Object.entries(EXPECTED_SEATS)) {
    const block = new RegExp(`code:\\s*'${plan}',\\s*seatLimit:\\s*(\\d+)`).exec(src);
    assert.ok(block, `seatLimit for ${plan} not found in subscriptionPlans.ts`);
    assert.equal(Number(block[1]), seats, `${plan} seatLimit disagrees with the app config`);
    assert.equal(webhook.SEAT_LIMITS[plan], seats, `${plan} seatLimit disagrees with the webhook`);
  }
});

test('11. the team owner occupies one of the seats', () => {
  // A new org is seeded with the buyer already in members/memberUids, so Team 3
  // is owner + 2 invitees, not owner + 3.
  const src = read('google_cloud_function/paddleWebhook.js');
  assert.ok(/members:\s*\[\{\s*uid:\s*userRef\.id/.test(src),
    'a newly created org must seed the owner as its first member');
  assert.ok(/memberUids:\s*\[userRef\.id\]/.test(src),
    'memberUids must contain the owner on creation');
  // And the existing client-side seat accounting counts invitations too.
  const svc = read('src/services/subscriptionService.ts');
  assert.ok(/members\.length \+ \(org\.invitedEmails\?\.length \?\? 0\)/.test(svc),
    'seatsUsed must count members plus open invitations');
});

// ── 9. Unknown price id grants nothing ───────────────────────────────────────

section('9. Unknown price id');

test('9. an unrecognized price id resolves to null, never a default plan', () => {
  assert.equal(webhook.resolvePrice('pri_totally_unknown_999'), null);
  assert.equal(webhook.resolvePrice(''), null);
  assert.equal(webhook.resolvePrice(null), null);
  assert.equal(webhook.resolvePrice(undefined), null);
});

test('9b. an empty catalogue slot never resolves (blank live ids match nothing)', () => {
  // Guards the obvious bug: matching '' against an unset live id and silently
  // handing out a plan.
  assert.equal(webhook.resolvePrice(''), null);
});

// ── Signature verification ───────────────────────────────────────────────────

section('Webhook signature verification');

const SECRET = 'pdl_ntfset_test_secret_value_not_real';
const sign = (body, secret = SECRET, tsSeconds = Math.floor(Date.now() / 1000)) => {
  const h1 = crypto.createHmac('sha256', secret).update(`${tsSeconds}:`).update(Buffer.from(body)).digest('hex');
  return `ts=${tsSeconds};h1=${h1}`;
};

test('a correctly signed body verifies', () => {
  const body = Buffer.from(JSON.stringify({ event_id: 'evt_1' }));
  assert.equal(webhook.verifySignature(body, sign(body), SECRET), true);
});

test('a tampered body does not verify', () => {
  const body = Buffer.from(JSON.stringify({ event_id: 'evt_1' }));
  const sig = sign(body);
  const tampered = Buffer.from(JSON.stringify({ event_id: 'evt_1', extra: 'injected' }));
  assert.equal(webhook.verifySignature(tampered, sig, SECRET), false);
});

test('the wrong secret does not verify', () => {
  const body = Buffer.from('{}');
  assert.equal(webhook.verifySignature(body, sign(body), 'a_different_secret'), false);
});

test('a stale timestamp is rejected (replay protection)', () => {
  const body = Buffer.from('{}');
  const old = Math.floor((Date.now() - webhook.MAX_SIGNATURE_AGE_MS - 60_000) / 1000);
  assert.equal(webhook.verifySignature(body, sign(body, SECRET, old), SECRET), false);
});

test('a malformed or absent signature header is rejected', () => {
  const body = Buffer.from('{}');
  assert.equal(webhook.verifySignature(body, '', SECRET), false);
  assert.equal(webhook.verifySignature(body, 'garbage', SECRET), false);
  assert.equal(webhook.verifySignature(body, 'ts=123', SECRET), false);
  assert.equal(webhook.verifySignature(body, null, SECRET), false);
});

test('a missing secret never verifies (fail closed)', () => {
  const body = Buffer.from('{}');
  assert.equal(webhook.verifySignature(body, sign(body), ''), false);
  assert.equal(webhook.verifySignature(body, sign(body), undefined), false);
});

test('failure reasons distinguish malformed (400) from inauthentic (401)', () => {
  const body = Buffer.from('{}');
  const reason = (sig, secrets = [SECRET]) => webhook.verifySignatureDetailed(body, sig, secrets).reason;

  // 400-class: the request itself is unusable.
  assert.equal(reason(null), 'missing-signature');
  assert.equal(reason(''), 'missing-signature');
  assert.equal(reason('garbage'), 'malformed-signature');
  assert.equal(reason('ts=123'), 'malformed-signature');
  assert.equal(reason('ts=notanumber;h1=abc'), 'malformed-signature');
  assert.equal(webhook.verifySignatureDetailed(Buffer.alloc(0), sign(body), [SECRET]).reason, 'empty-body');

  // 401-class: well-formed, but not from Paddle.
  const stale = Math.floor((Date.now() - webhook.MAX_SIGNATURE_AGE_MS - 60_000) / 1000);
  assert.equal(reason(sign(body, SECRET, stale)), 'stale-timestamp');
  assert.equal(reason(sign(body, 'other_secret')), 'signature-mismatch');
  assert.equal(reason(sign(body)), 'verified');
});

test('secret rotation: a body signed with the PREVIOUS secret still verifies', () => {
  const body = Buffer.from('{"event_id":"evt_rotate"}');
  const oldSecret = 'the_outgoing_secret';
  const sig = sign(body, oldSecret);
  // Only the new secret configured → rejected.
  assert.equal(webhook.verifySignatureDetailed(body, sig, [SECRET]).ok, false);
  // Both configured during the changeover → accepted.
  assert.equal(webhook.verifySignatureDetailed(body, sig, [SECRET, oldSecret]).ok, true);
  // And the new secret keeps working throughout.
  assert.equal(webhook.verifySignatureDetailed(body, sign(body, SECRET), [SECRET, oldSecret]).ok, true);
});

// ── 17-18. Out-of-order delivery ─────────────────────────────────────────────

section('17-18. Out-of-order delivery');

const snapOf = (fields) => ({ get: (k) => fields[k] });

test('17. an older event is stale against a newer applied state', () => {
  const applied = snapOf({
    lastPaddleEventOccurredAt: '2026-07-19T12:00:00.000Z',
    lastPaddleEventType: 'subscription.canceled',
  });
  assert.equal(
    webhook.isStale({ occurred_at: '2026-07-19T11:00:00.000Z', event_type: 'subscription.created' }, applied),
    true, 'a late-arriving created must not resurrect a cancelled subscription');
  assert.equal(
    webhook.isStale({ occurred_at: '2026-07-19T13:00:00.000Z', event_type: 'subscription.updated' }, applied),
    false, 'a genuinely newer event must apply');
});

test('17b. nothing applied yet means nothing is stale', () => {
  assert.equal(webhook.isStale({ occurred_at: '2026-07-19T12:00:00.000Z', event_type: 'subscription.created' }, snapOf({})), false);
});

test('17c. identical timestamps break the tie on lifecycle order', () => {
  const t = '2026-07-19T12:00:00.000Z';
  const afterCancel = snapOf({ lastPaddleEventOccurredAt: t, lastPaddleEventType: 'subscription.canceled' });
  assert.equal(webhook.isStale({ occurred_at: t, event_type: 'subscription.created' }, afterCancel), true);
  assert.equal(webhook.isStale({ occurred_at: t, event_type: 'subscription.canceled' }, afterCancel), false,
    're-applying the same state is harmless and must be allowed through');

  const afterCreate = snapOf({ lastPaddleEventOccurredAt: t, lastPaddleEventType: 'subscription.created' });
  assert.equal(webhook.isStale({ occurred_at: t, event_type: 'subscription.updated' }, afterCreate), false);
});

test('18. an older payment failure cannot override a later recovery', () => {
  const recovered = snapOf({
    lastPaddleEventOccurredAt: '2026-07-19T12:00:00.000Z',
    lastPaddleEventType: 'subscription.updated',
  });
  assert.equal(
    webhook.isStale({ occurred_at: '2026-07-19T10:00:00.000Z', event_type: 'transaction.payment_failed' }, recovered),
    true);
});

test('an unparseable timestamp is not treated as stale (fail open, then converge)', () => {
  const applied = snapOf({ lastPaddleEventOccurredAt: '2026-07-19T12:00:00.000Z', lastPaddleEventType: 'subscription.updated' });
  assert.equal(webhook.isStale({ occurred_at: 'not-a-date', event_type: 'subscription.updated' }, applied), false);
});

// ── 12-13. Entitlement policy ────────────────────────────────────────────────

section('12-13. Entitlement policy');

const DAY = 86400000;
const NOW = Date.parse('2026-07-19T12:00:00.000Z');
const iso = (offsetDays) => new Date(NOW + offsetDays * DAY).toISOString();

test('trialing and active allow access', () => {
  assert.equal(hasPaidAccess({ status: 'trialing', currentPeriodEndsAt: iso(7) }, NOW), true);
  assert.equal(hasPaidAccess({ status: 'active', currentPeriodEndsAt: iso(30) }, NOW), true);
});

test('canceled allows access until the period ends, then denies', () => {
  const before = paidAccessState({ status: 'canceled', currentPeriodEndsAt: iso(5) }, NOW);
  assert.equal(before.allowed, true);
  assert.equal(before.reason, 'canceled-until-period-end');

  const after = paidAccessState({ status: 'canceled', currentPeriodEndsAt: iso(-1) }, NOW);
  assert.equal(after.allowed, false);
  assert.equal(after.reason, 'canceled-period-over');
});

test('12. payment failure allows access for exactly the grace window', () => {
  assert.equal(PAST_DUE_GRACE_DAYS, 7);

  const day1 = paidAccessState({ status: 'past_due', pastDueSince: iso(-1) }, NOW);
  assert.equal(day1.allowed, true, 'day 1 of dunning must keep access');
  assert.equal(day1.reason, 'past-due-grace');

  const day6 = paidAccessState({ status: 'past_due', pastDueSince: iso(-6) }, NOW);
  assert.equal(day6.allowed, true, 'day 6 is still inside the 7-day window');

  const day8 = paidAccessState({ status: 'past_due', pastDueSince: iso(-8) }, NOW);
  assert.equal(day8.allowed, false, 'day 8 is past the grace window');
  assert.equal(day8.reason, 'past-due-grace-over');
});

test('12b. the grace window falls back to the period end, and denies with no anchor at all', () => {
  assert.equal(hasPaidAccess({ status: 'past_due', currentPeriodEndsAt: iso(-2) }, NOW), true);
  assert.equal(hasPaidAccess({ status: 'past_due', currentPeriodEndsAt: iso(-9) }, NOW), false);
  assert.equal(paidAccessState({ status: 'past_due' }, NOW).reason, 'past-due-no-anchor');
});

test('13. expired and paused deny access', () => {
  assert.equal(hasPaidAccess({ status: 'expired', currentPeriodEndsAt: iso(-1) }, NOW), false);
  assert.equal(hasPaidAccess({ status: 'paused', currentPeriodEndsAt: iso(30) }, NOW), false);
});

test('an absent or unrecognized subscription denies access', () => {
  assert.equal(hasPaidAccess(null, NOW), false);
  assert.equal(hasPaidAccess(undefined, NOW), false);
  assert.equal(paidAccessState({ status: 'something_new' }, NOW).reason, 'unknown-status');
});

test('an organization doc is accepted in the same shape (members inherit the team state)', () => {
  assert.equal(hasPaidAccess({ subscriptionStatus: 'active', currentPeriodEndsAt: iso(30) }, NOW), true);
  assert.equal(hasPaidAccess({ subscriptionStatus: 'expired' }, NOW), false);
});

test('13b. denying paid access never touches the account approval axis', () => {
  // The whole point of keeping billing and approval separate: no writer of
  // entitlement may set status/isActive as a way of expressing "unpaid".
  const wh = read('google_cloud_function/paddleWebhook.js');
  assert.ok(!/\bisActive\s*:/.test(wh), 'the webhook must never write isActive');
  assert.ok(!/\bstatus:\s*['"](suspended|disabled|pending)['"]/.test(wh),
    'the webhook must never set an account status');

  const svc = read('src/services/subscriptionService.ts');
  const clear = svc.slice(svc.indexOf('adminClearSubscription'), svc.indexOf('Free-access grants'));
  assert.ok(/paidAccess:\s*false/.test(clear), 'clearing a subscription must clear paidAccess');
  // Field ASSIGNMENT, not any mention — the surrounding comment names isActive
  // precisely to say it is left alone.
  assert.ok(!/isActive\s*:/.test(clear), 'clearing a subscription must not deactivate the account');
});

// ── 10. Idempotency (structural) ─────────────────────────────────────────────

section('10. Idempotency');

test('10. every delivery is claimed by event id in a transaction before processing', () => {
  const src = read('google_cloud_function/paddleWebhook.js');
  assert.ok(/runTransaction/.test(src), 'the event claim must be transactional');
  assert.ok(/paddleWebhookEvents/.test(src), 'there must be an event-id ledger');
  assert.ok(/claimEvent\(event\)/.test(src), 'the handler must claim before routing');
  // A duplicate must short-circuit BEFORE route() runs, or a retried
  // subscription.created would create a second organization.
  const handler = src.slice(src.indexOf('const fresh = await claimEvent'));
  const dupIdx = handler.indexOf('already-processed');
  const routeIdx = handler.indexOf('await route(event)');
  assert.ok(dupIdx !== -1 && routeIdx !== -1 && dupIdx < routeIdx,
    'the duplicate check must return before route() is called');
});

test('10b. org creation reuses an existing org instead of creating a second one', () => {
  const src = read('google_cloud_function/paddleWebhook.js');
  assert.ok(/where\('ownerUid', '==', userRef\.id\)/.test(src),
    'syncOrganization must look for an existing org by ownerUid before creating one');
  assert.ok(/ownerUid'\) === userRef\.id/.test(src),
    'a reused org must be verified as owned by this account');
});

test('10c. a failed handler releases its claim so the retry can reprocess', () => {
  const src = read('google_cloud_function/paddleWebhook.js');
  const cat = src.slice(src.indexOf('} catch (err) {', src.indexOf('await route(event)')));
  assert.ok(/collection\(EVENTS\)\.doc\(event\.event_id\)\.delete\(\)/.test(cat),
    'the error path must delete the claim before returning 500');
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Paddle billing unit tests: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.err.message}`);
  process.exit(1);
}
