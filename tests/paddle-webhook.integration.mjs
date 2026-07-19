/**
 * Paddle webhook integration test — the real handler, against the Firestore
 * emulator, driven by genuinely signed request bodies.
 *
 * The unit suite proves the pure pieces (signature maths, price mapping, seat
 * table, entitlement policy). This one proves the thing that actually matters
 * in production: what ends up in Firestore after a delivery — including the
 * retry that Paddle WILL send, which must not create a second organization or
 * corrupt the subscription.
 *
 * Nothing here talks to Paddle. Bodies are signed locally with a throwaway
 * secret, exactly as Paddle signs them.
 *
 * Run: npm run test:paddle:webhook
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// firebase-admin belongs to the Cloud Function, not the app, so it is resolved
// from there (run `npm install` in google_cloud_function/ first).
const cfRequire = createRequire(new URL('../google_cloud_function/package.json', import.meta.url));

// Point the Admin SDK at the emulator BEFORE it is loaded.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'heatpumpdb-rules-test';
process.env.GOOGLE_CLOUD_PROJECT = 'heatpumpdb-rules-test';
process.env.PADDLE_WEBHOOK_SECRET = 'pdl_ntfset_integration_test_secret';

const admin = cfRequire('firebase-admin');
if (!admin.apps.length) admin.initializeApp({ projectId: 'heatpumpdb-rules-test' });
const db = admin.firestore();

const { paddleWebhook } = require('../google_cloud_function/paddleWebhook.js');
const catalogue = require('../google_cloud_function/paddle-catalogue.json');

const SECRET = process.env.PADDLE_WEBHOOK_SECRET;
const PRICE = catalogue.sandbox.EUR;
const LIVE = catalogue.live.EUR;

let passed = 0, failed = 0;
const check = async (name, fn) => {
  try { await fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

/* ── Harness: a signed request and a capturing response ───────────────────── */

function signedRequest(event, { secret = SECRET, ts = Math.floor(Date.now() / 1000) } = {}) {
  const rawBody = Buffer.from(JSON.stringify(event));
  const h1 = crypto.createHmac('sha256', secret).update(`${ts}:`).update(rawBody).digest('hex');
  return {
    method: 'POST',
    rawBody,
    get: (h) => (h.toLowerCase() === 'paddle-signature' ? `ts=${ts};h1=${h1}` : undefined),
  };
}

function capturingResponse() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; return this; },
  };
  return res;
}

const deliver = async (event, opts) => {
  const res = capturingResponse();
  await paddleWebhook(signedRequest(event, opts), res);
  return res;
};

/* ── Fixtures ─────────────────────────────────────────────────────────────── */

let seq = 0;
const evt = (type, data, id) => ({
  event_id: id || `evt_test_${++seq}`,
  event_type: type,
  occurred_at: new Date().toISOString(),
  data,
});

const subscriptionData = (priceId, uid, overrides = {}) => ({
  id: overrides.subscriptionId || 'sub_test_001',
  status: 'active',
  customer_id: 'ctm_test_001',
  custom_data: { userId: uid },
  current_billing_period: {
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  },
  next_billed_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  items: [{ quantity: 1, price: { id: priceId }, trial_dates: null }],
  ...overrides,
});

async function reset(uid, extra = {}) {
  // Clear the collections this test touches.
  for (const c of ['users', 'organizations', 'paddleWebhookEvents', 'billingQuarantine']) {
    const snap = await db.collection(c).get();
    await Promise.all(snap.docs.map(d => d.ref.delete()));
  }
  await db.collection('users').doc(uid).set({
    id: uid, email: `${uid}@example.com`, firstName: 'Test', lastName: 'User',
    companyName: 'Test Co', companyType: 'installer',
    status: 'active', isActive: true, role: 'user', country: 'DE',
    registeredAt: new Date().toISOString(), ...extra,
  });
}

const userDoc = (uid) => db.collection('users').doc(uid).get().then(s => s.data());
const orgsOwnedBy = async (uid) =>
  (await db.collection('organizations').where('ownerUid', '==', uid).get()).docs;

/* ── Professional ─────────────────────────────────────────────────────────── */

console.log('\nProfessional');

await reset('u-pro');
await check('a Professional purchase writes the entitlement and creates NO organization', async () => {
  const res = await deliver(evt('subscription.created', subscriptionData(PRICE.professional.monthly, 'u-pro')));
  assert.equal(res.statusCode, 200);

  const u = await userDoc('u-pro');
  assert.equal(u.subscription.planCode, 'professional');
  assert.equal(u.subscription.billingTerm, 'monthly');
  assert.equal(u.subscription.seatLimit, 1, 'Professional must be 1 seat');
  assert.equal(u.subscription.status, 'active');
  assert.equal(u.subscription.provider, 'paddle');
  assert.equal(u.subscription.paddleSubscriptionId, 'sub_test_001');
  assert.equal(u.subscription.paddleCustomerId, 'ctm_test_001');
  assert.equal(u.subscription.paddlePriceId, PRICE.professional.monthly);
  assert.equal(u.paidAccess, true);
  assert.equal(u.subscriptionStatus, 'active');
  assert.equal(u.billingChannel, 'paddle');
  assert.ok(u.nextBilledAt, 'nextBilledAt must be mirrored');

  const orgs = await orgsOwnedBy('u-pro');
  assert.equal(orgs.length, 0, 'Professional must never get an organization');
  assert.equal(u.orgId, undefined, 'Professional must not be given an orgId');
});

await check('the account approval axis is untouched by billing', async () => {
  const u = await userDoc('u-pro');
  assert.equal(u.status, 'active');
  assert.equal(u.isActive, true);
});

/* ── Team plans and seats ─────────────────────────────────────────────────── */

console.log('\nTeam plans (owner counts as a seat)');

await reset('u-team3');
await check('Team 3 creates an org with 3 seats and the OWNER already seated', async () => {
  await deliver(evt('subscription.created', subscriptionData(PRICE.team_3.annual, 'u-team3')));

  const u = await userDoc('u-team3');
  assert.equal(u.subscription.planCode, 'team_3');
  assert.equal(u.subscription.billingTerm, 'annual');
  assert.equal(u.subscription.seatLimit, 3);
  assert.equal(u.orgRole, 'team_admin');
  assert.ok(u.orgId, 'the owner must be pointed at the org');

  const orgs = await orgsOwnedBy('u-team3');
  assert.equal(orgs.length, 1);
  const org = orgs[0].data();
  assert.equal(org.seatLimit, 3);
  assert.equal(org.planCode, 'team_3');
  assert.equal(org.paidAccess, true);
  assert.equal(org.subscriptionStatus, 'active');
  // The decisive assertion: the buyer occupies seat 1 of 3, so only 2 remain.
  assert.deepEqual(org.memberUids, ['u-team3'], 'the owner must occupy a seat');
  assert.equal(org.members.length, 1);
  assert.equal(org.members[0].uid, 'u-team3');
  assert.equal(org.seatLimit - org.members.length, 2, 'Team 3 leaves 2 invitable seats');
});

await reset('u-team5');
await check('Team 5 creates an org with 5 seats, owner seated (4 invitable)', async () => {
  await deliver(evt('subscription.created', subscriptionData(PRICE.team_5.six_months, 'u-team5')));
  const org = (await orgsOwnedBy('u-team5'))[0].data();
  assert.equal(org.seatLimit, 5);
  assert.equal(org.members.length, 1);
  assert.equal(org.seatLimit - org.members.length, 4, 'Team 5 leaves 4 invitable seats');
  const u = await userDoc('u-team5');
  assert.equal(u.subscription.billingTerm, 'six_months');
});

/* ── 10. Idempotency ──────────────────────────────────────────────────────── */

console.log('\nIdempotency (Paddle retries the same event_id)');

await reset('u-dup');
await check('10. a duplicate delivery creates no second organization and no state change', async () => {
  const event = evt('subscription.created', subscriptionData(PRICE.team_3.monthly, 'u-dup'), 'evt_duplicate_001');

  const first = await deliver(event);
  assert.equal(first.statusCode, 200);
  assert.equal(first.body, 'ok');

  const afterFirst = await userDoc('u-dup');
  const orgsAfterFirst = await orgsOwnedBy('u-dup');
  assert.equal(orgsAfterFirst.length, 1);

  // Paddle retries the identical payload.
  const second = await deliver(event);
  assert.equal(second.statusCode, 200);
  assert.equal(second.body, 'already-processed', 'the retry must be recognized as a duplicate');

  const orgsAfterSecond = await orgsOwnedBy('u-dup');
  assert.equal(orgsAfterSecond.length, 1, 'a retry must NOT create a second organization');
  assert.equal(orgsAfterSecond[0].id, orgsAfterFirst[0].id, 'the org id must be stable across retries');

  const afterSecond = await userDoc('u-dup');
  assert.deepEqual(afterSecond.subscription, afterFirst.subscription, 'the subscription must be unchanged');
  assert.equal(afterSecond.orgId, afterFirst.orgId);
});

await check('10b. a repeated purchase under a NEW event id still reuses the same org', async () => {
  // Renewals arrive as fresh events; they must update, not duplicate.
  await deliver(evt('subscription.updated', subscriptionData(PRICE.team_3.monthly, 'u-dup')));
  const orgs = await orgsOwnedBy('u-dup');
  assert.equal(orgs.length, 1, 'a renewal must not create another organization');
});

/* ── Lifecycle: cancel, pause, expire, payment failure ────────────────────── */

console.log('\nLifecycle');

await reset('u-cancel');
await check('cancellation keeps access until the period ends', async () => {
  await deliver(evt('subscription.created', subscriptionData(PRICE.professional.monthly, 'u-cancel')));
  await deliver(evt('subscription.canceled', subscriptionData(PRICE.professional.monthly, 'u-cancel', {
    status: 'canceled',
    current_billing_period: {
      starts_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      ends_at: new Date(Date.now() + 20 * 86400000).toISOString(),   // still in the future
    },
  })));
  const u = await userDoc('u-cancel');
  assert.equal(u.subscription.status, 'canceled');
  assert.equal(u.subscription.cancelAtPeriodEnd, true);
  assert.equal(u.paidAccess, true, 'a cancelled but still-paid period keeps access');
});

await reset('u-expired');
await check('cancellation with the period already over denies access', async () => {
  await deliver(evt('subscription.canceled', subscriptionData(PRICE.professional.monthly, 'u-expired', {
    status: 'canceled',
    current_billing_period: {
      starts_at: new Date(Date.now() - 40 * 86400000).toISOString(),
      ends_at: new Date(Date.now() - 1 * 86400000).toISOString(),    // yesterday
    },
  })));
  const u = await userDoc('u-expired');
  assert.equal(u.paidAccess, false, 'an elapsed cancelled period must deny access');
  assert.equal(u.status, 'active', 'the ACCOUNT must remain active');
  assert.equal(u.isActive, true, 'losing paid access must not disable the account');
});

await reset('u-paused');
await check('a paused subscription denies access but keeps the account', async () => {
  await deliver(evt('subscription.updated', subscriptionData(PRICE.professional.monthly, 'u-paused', {
    status: 'paused',
  })));
  const u = await userDoc('u-paused');
  assert.equal(u.subscription.status, 'paused');
  assert.equal(u.paidAccess, false);
  assert.equal(u.status, 'active');
});

await reset('u-dunning');
await check('12. a failed payment starts the grace window and KEEPS access', async () => {
  await deliver(evt('subscription.created', subscriptionData(PRICE.professional.monthly, 'u-dunning')));
  await deliver(evt('transaction.payment_failed', {
    id: 'txn_failed_001',
    subscription_id: 'sub_test_001',
    customer_id: 'ctm_test_001',
    custom_data: { userId: 'u-dunning' },
  }));
  const u = await userDoc('u-dunning');
  assert.equal(u.subscription.status, 'past_due');
  assert.ok(u.subscription.pastDueSince, 'the grace window needs an anchor');
  assert.equal(u.paidAccess, true, 'day 0 of dunning must keep access');
  assert.equal(u.subscriptionStatus, 'past_due');
});

await check('12b. a second failed payment does not slide the grace window forward', async () => {
  const before = (await userDoc('u-dunning')).subscription.pastDueSince;
  await deliver(evt('transaction.payment_failed', {
    id: 'txn_failed_002',
    subscription_id: 'sub_test_001',
    customer_id: 'ctm_test_001',
    custom_data: { userId: 'u-dunning' },
  }));
  const after = (await userDoc('u-dunning')).subscription.pastDueSince;
  assert.equal(after, before, 'the anchor must stay at the FIRST failure');
});

/* ── Quarantine paths ─────────────────────────────────────────────────────── */

console.log('\nQuarantine (acknowledged, never applied)');

await reset('u-qty');
await check('1. quantity != 1 is quarantined and grants nothing', async () => {
  const res = await deliver(evt('subscription.created', subscriptionData(PRICE.team_5.monthly, 'u-qty', {
    items: [{ quantity: 7, price: { id: PRICE.team_5.monthly } }],
  })));
  assert.equal(res.statusCode, 200, 'must ack so Paddle stops retrying an unfixable anomaly');

  const u = await userDoc('u-qty');
  assert.equal(u.subscription, undefined, 'no entitlement may be granted');
  assert.ok(!u.paidAccess, 'no access may be granted');

  const q = await db.collection('billingQuarantine').get();
  const kinds = q.docs.map(d => d.get('kind'));
  assert.ok(kinds.includes('quantity-not-one'), `expected a quantity quarantine, got: ${kinds.join(', ')}`);
  // Seats must never be derived from quantity.
  const orgs = await orgsOwnedBy('u-qty');
  assert.equal(orgs.length, 0, 'a bad quantity must not create a 7-seat org');
});

await reset('u-unknown');
await check('9. an unknown price id is quarantined, with no default plan', async () => {
  const res = await deliver(evt('subscription.created', subscriptionData('pri_not_in_our_catalogue', 'u-unknown')));
  assert.equal(res.statusCode, 200);
  const u = await userDoc('u-unknown');
  assert.equal(u.subscription, undefined, 'an unknown price must never yield a plan');
  assert.ok(!u.paidAccess);
  const kinds = (await db.collection('billingQuarantine').get()).docs.map(d => d.get('kind'));
  assert.ok(kinds.includes('unknown-price-id'));
});

await reset('u-present');
await check('an event for an unknown account is quarantined, not guessed at', async () => {
  const res = await deliver(evt('subscription.created',
    subscriptionData(PRICE.professional.monthly, 'no-such-user', { subscriptionId: 'sub_orphan' })));
  assert.equal(res.statusCode, 200);
  const kinds = (await db.collection('billingQuarantine').get()).docs.map(d => d.get('kind'));
  assert.ok(kinds.includes('unresolved-account'));
  // The unrelated seeded account must be untouched.
  const u = await userDoc('u-present');
  assert.equal(u.subscription, undefined);
});

/* ── custom_data is a pointer, never an entitlement ───────────────────────── */

console.log('\ncustom_data cannot inflate entitlement');

await reset('u-forge');
await check('a forged planCode in custom_data is ignored; the price id decides', async () => {
  await deliver(evt('subscription.created', subscriptionData(PRICE.professional.monthly, 'u-forge', {
    // Attacker-controlled: claims Team 5 while paying for Professional.
    custom_data: { userId: 'u-forge', planCode: 'team_5', billingTerm: 'annual', seatLimit: 5 },
  })));
  const u = await userDoc('u-forge');
  assert.equal(u.subscription.planCode, 'professional', 'the PRICE ID must decide the plan');
  assert.equal(u.subscription.seatLimit, 1, 'seats must come from our plan table, not the payload');
  assert.equal(u.subscription.billingTerm, 'monthly');
  assert.equal((await orgsOwnedBy('u-forge')).length, 0, 'no team may be conjured from custom_data');
});

/* ── Signature enforcement on the real handler ────────────────────────────── */

console.log('\nSignature enforcement (end to end)');

await reset('u-sig');
await check('12. a body signed with the wrong secret is 401 and writes nothing', async () => {
  const res = capturingResponse();
  const event = evt('subscription.created', subscriptionData(PRICE.team_5.annual, 'u-sig'));
  await paddleWebhook(signedRequest(event, { secret: 'the_wrong_secret' }), res);
  assert.equal(res.statusCode, 401, 'failing to prove you are Paddle is 401, not a server error');
  const u = await userDoc('u-sig');
  assert.equal(u.subscription, undefined, 'an unverified body must not grant anything');
});

await check('11. an unsigned request is 400 and writes nothing', async () => {
  const res = capturingResponse();
  await paddleWebhook({ method: 'POST', rawBody: Buffer.from('{}'), get: () => undefined }, res);
  assert.equal(res.statusCode, 400);
});

await check('13. a stale signature timestamp is 401', async () => {
  const res = capturingResponse();
  const event = evt('subscription.created', subscriptionData(PRICE.professional.monthly, 'u-sig'));
  const oldTs = Math.floor((Date.now() - 30 * 60 * 1000) / 1000);
  await paddleWebhook(signedRequest(event, { ts: oldTs }), res);
  assert.equal(res.statusCode, 401);
});

await check('a malformed signature header is 400', async () => {
  const res = capturingResponse();
  await paddleWebhook({ method: 'POST', rawBody: Buffer.from('{}'), get: () => 'not-a-signature' }, res);
  assert.equal(res.statusCode, 400);
});

await check('11-13b. NO rejected request leaves an event claim, quarantine or write', async () => {
  // Every rejection above ran against the same clean state; nothing may persist.
  const events = await db.collection('paddleWebhookEvents').get();
  const quarantined = await db.collection('billingQuarantine').get();
  assert.equal(events.size, 0, 'an unauthenticated request must not claim an event id');
  assert.equal(quarantined.size, 0, 'an unauthenticated request must not create a quarantine record');
  const u = await userDoc('u-sig');
  assert.equal(u.subscription, undefined);
  assert.equal(u.paidAccess, undefined);
});

await check('14. a server-side fault returns 5xx so the event stays retryable', async () => {
  // The distinction that matters: WE are broken (5xx — the event must survive in
  // Paddle's retry budget until we are fixed) versus THEY failed to authenticate
  // (4xx — no point retrying, and real outages must not be buried under forged
  // traffic). A missing secret is squarely our fault.
  const saved = process.env.PADDLE_WEBHOOK_SECRET;
  delete process.env.PADDLE_WEBHOOK_SECRET;
  try {
    const res = capturingResponse();
    const event = evt('subscription.created', subscriptionData(PRICE.professional.monthly, 'u-sig'));
    await paddleWebhook(signedRequest(event, { secret: saved }), res);
    assert.equal(res.statusCode, 500, 'a missing secret is OUR fault — keep it retryable');
    assert.equal((await db.collection('paddleWebhookEvents').get()).size, 0,
      'a misconfigured server must not claim the event id');
  } finally {
    process.env.PADDLE_WEBHOOK_SECRET = saved;
  }
});

await check('a GET is refused outright', async () => {
  const res = capturingResponse();
  await paddleWebhook({ method: 'GET', get: () => undefined }, res);
  assert.equal(res.statusCode, 405);
});

/* ── Team downgrade preserves team data ───────────────────────────────────── */

console.log('\nTeam → Professional downgrade');

await reset('u-down');
await check('downgrading to Professional stops team access but DELETES NOTHING', async () => {
  await deliver(evt('subscription.created', subscriptionData(PRICE.team_5.monthly, 'u-down')));
  const orgId = (await userDoc('u-down')).orgId;

  // Seat a second member, as a real team would have.
  await db.collection('organizations').doc(orgId).update({
    members: admin.firestore.FieldValue.arrayUnion({ uid: 'u-member', email: 'm@example.com' }),
    memberUids: admin.firestore.FieldValue.arrayUnion('u-member'),
    invitedEmails: ['pending@example.com'],
  });
  await db.collection('users').doc('u-member').set({ id: 'u-member', orgId, orgRole: 'member' });

  await deliver(evt('subscription.updated', subscriptionData(PRICE.professional.monthly, 'u-down')));

  const org = (await db.collection('organizations').doc(orgId).get()).data();
  assert.ok(org, 'the organization must still exist');
  assert.equal(org.memberUids.length, 2, 'members must be preserved');
  assert.deepEqual(org.invitedEmails, ['pending@example.com'], 'invitations must be preserved');
  assert.equal(org.paidAccess, false, 'the team must lose entitlement');
  assert.equal(org.subscriptionStatus, 'expired');

  // The member's access goes with the ORG's flag — there is no per-member copy
  // to update, which is exactly why it cannot be left behind.
  const member = await userDoc('u-member');
  assert.equal(member.paidAccess, undefined, 'members carry no entitlement flag of their own');
  assert.equal(member.orgId, orgId, 'the member keeps their seat pointer; nothing is deleted');

  const kinds = (await db.collection('billingQuarantine').get()).docs.map(d => d.get('kind'));
  assert.ok(kinds.includes('team-downgraded-to-professional'), 'the downgrade must be raised for admin review');
});

/* ── Team member entitlement is derived, not copied ───────────────────────── */

console.log('\nTeam member entitlement (single source: the organization)');

await reset('u-fan');
await check('1-5. one org write governs every seat; members hold no flag of their own', async () => {
  await deliver(evt('subscription.created', subscriptionData(PRICE.team_3.monthly, 'u-fan')));
  const orgId = (await userDoc('u-fan')).orgId;

  // A second seat, exactly as joinOrg leaves it: a pointer, nothing more.
  await db.collection('organizations').doc(orgId).update({
    members: admin.firestore.FieldValue.arrayUnion({ uid: 'u-fan-member', email: 'f@example.com' }),
    memberUids: admin.firestore.FieldValue.arrayUnion('u-fan-member'),
  });
  await db.collection('users').doc('u-fan-member').set({ id: 'u-fan-member', orgId, orgRole: 'member' });

  const org = () => db.collection('organizations').doc(orgId).get().then(s => s.data());

  assert.equal((await org()).paidAccess, true, 'an active team is entitled');
  assert.equal((await userDoc('u-fan-member')).paidAccess, undefined,
    'a member must not carry a duplicated entitlement flag');

  // 5. Pause: ONE write withdraws access for every seat at once.
  await deliver(evt('subscription.updated', subscriptionData(PRICE.team_3.monthly, 'u-fan', { status: 'paused' })));
  assert.equal((await org()).paidAccess, false, 'a paused team is not entitled');
  assert.equal((await userDoc('u-fan-member')).paidAccess, undefined, 'still nothing to go stale');

  // Recovery is equally a single write.
  await deliver(evt('subscription.updated', subscriptionData(PRICE.team_3.monthly, 'u-fan', { status: 'active' })));
  assert.equal((await org()).paidAccess, true);
});

await check('3. a member who joins AFTER the purchase needs no back-fill', async () => {
  const orgId = (await userDoc('u-fan')).orgId;
  await db.collection('organizations').doc(orgId).update({
    members: admin.firestore.FieldValue.arrayUnion({ uid: 'u-late', email: 'late@example.com' }),
    memberUids: admin.firestore.FieldValue.arrayUnion('u-late'),
  });
  await db.collection('users').doc('u-late').set({ id: 'u-late', orgId, orgRole: 'member' });
  // No webhook event and no write to their profile: they are entitled because
  // the org they now sit in is. (Proven at the rule level in the rules suite.)
  assert.equal((await db.collection('organizations').doc(orgId).get()).get('paidAccess'), true);
  assert.equal((await userDoc('u-late')).paidAccess, undefined);
});

/* ── Live catalogue end to end ────────────────────────────────────────────── */

console.log('\nLive price ids (production mapping)');

await reset('u-live-pro');
await check('a LIVE Professional price grants 1 seat and no organization', async () => {
  const res = await deliver(evt('subscription.created', subscriptionData(LIVE.professional.annual, 'u-live-pro')));
  assert.equal(res.statusCode, 200);
  const u = await userDoc('u-live-pro');
  assert.equal(u.subscription.planCode, 'professional');
  assert.equal(u.subscription.billingTerm, 'annual');
  assert.equal(u.subscription.seatLimit, 1);
  assert.equal(u.subscription.paddlePriceId, LIVE.professional.annual);
  assert.equal(u.paidAccess, true);
  assert.equal((await orgsOwnedBy('u-live-pro')).length, 0);
});

await reset('u-live-t3');
await check('a LIVE Team 3 price creates a 3-seat org with the owner seated', async () => {
  await deliver(evt('subscription.created', subscriptionData(LIVE.team_3.monthly, 'u-live-t3')));
  const u = await userDoc('u-live-t3');
  assert.equal(u.subscription.planCode, 'team_3');
  assert.equal(u.subscription.billingTerm, 'monthly');
  assert.equal(u.subscription.seatLimit, 3);
  const org = (await orgsOwnedBy('u-live-t3'))[0].data();
  assert.equal(org.seatLimit, 3);
  assert.equal(org.members.length, 1, 'the buyer occupies seat 1 of 3');
  assert.equal(org.seatLimit - org.members.length, 2, 'Team 3 leaves 2 invitable seats');
});

await reset('u-live-t5');
await check('a LIVE Team 5 price creates a 5-seat org with the owner seated', async () => {
  await deliver(evt('subscription.created', subscriptionData(LIVE.team_5.six_months, 'u-live-t5')));
  const u = await userDoc('u-live-t5');
  assert.equal(u.subscription.planCode, 'team_5');
  assert.equal(u.subscription.billingTerm, 'six_months');
  assert.equal(u.subscription.seatLimit, 5);
  const org = (await orgsOwnedBy('u-live-t5'))[0].data();
  assert.equal(org.seatLimit, 5);
  assert.equal(org.seatLimit - org.members.length, 4, 'Team 5 leaves 4 invitable seats');
});

await reset('u-live-qty');
await check('a LIVE price with quantity != 1 is still quarantined', async () => {
  const res = await deliver(evt('subscription.created', subscriptionData(LIVE.team_5.annual, 'u-live-qty', {
    items: [{ quantity: 4, price: { id: LIVE.team_5.annual } }],
  })));
  assert.equal(res.statusCode, 200);
  assert.equal((await userDoc('u-live-qty')).subscription, undefined, 'no entitlement from a bad quantity');
  const kinds = (await db.collection('billingQuarantine').get()).docs.map(d => d.get('kind'));
  assert.ok(kinds.includes('quantity-not-one'));
});

/* ── 15-16. Account binding ───────────────────────────────────────────────── */

console.log('\nAccount binding (first binding wins)');

await reset('u-bind');
await check('15. a bound subscription is never reassigned by later custom_data', async () => {
  await db.collection('users').doc('u-thief').set({
    id: 'u-thief', email: 'thief@example.com', status: 'active', isActive: true, role: 'user', country: 'DE',
  });
  await deliver(evt('subscription.created', subscriptionData(PRICE.team_5.monthly, 'u-bind')));
  assert.equal((await userDoc('u-bind')).subscription.planCode, 'team_5');

  // A perfectly well-signed later event whose custom_data names someone else.
  const res = await deliver(evt('subscription.updated', subscriptionData(PRICE.team_5.monthly, 'u-bind', {
    custom_data: { userId: 'u-thief' },
  })));
  assert.equal(res.statusCode, 200, 'acknowledged — retrying would not resolve the conflict');

  const thief = await userDoc('u-thief');
  assert.equal(thief.subscription, undefined, 'the subscription must NOT move to another account');
  assert.ok(!thief.paidAccess);
  assert.equal((await userDoc('u-bind')).subscription.planCode, 'team_5', 'the original binding stands');

  const kinds = (await db.collection('billingQuarantine').get()).docs.map(d => d.get('kind'));
  assert.ok(kinds.includes('subscription-rebind-refused'), `expected a rebind refusal, got: ${kinds.join(', ')}`);
});

await reset('u-dupe');
await check('16. two accounts already claiming one subscription is quarantined, not guessed', async () => {
  await db.collection('users').doc('u-dupe').set({ paddleSubscriptionId: 'sub_shared' }, { merge: true });
  await db.collection('users').doc('u-dupe-2').set({ id: 'u-dupe-2', paddleSubscriptionId: 'sub_shared' });

  const res = await deliver(evt('subscription.updated',
    subscriptionData(PRICE.professional.monthly, 'u-dupe', { subscriptionId: 'sub_shared' })));
  assert.equal(res.statusCode, 200);
  const kinds = (await db.collection('billingQuarantine').get()).docs.map(d => d.get('kind'));
  assert.ok(kinds.includes('duplicate-subscription-binding'), `got: ${kinds.join(', ')}`);
});

await reset('u-second');
await check('16b. a second subscription for an already-subscribed account is quarantined', async () => {
  await deliver(evt('subscription.created', subscriptionData(PRICE.professional.monthly, 'u-second')));
  const res = await deliver(evt('subscription.created',
    subscriptionData(PRICE.team_5.annual, 'u-second', { subscriptionId: 'sub_second_001' })));
  assert.equal(res.statusCode, 200);
  assert.equal((await userDoc('u-second')).subscription.planCode, 'professional', 'the first subscription stands');
  const kinds = (await db.collection('billingQuarantine').get()).docs.map(d => d.get('kind'));
  assert.ok(kinds.includes('account-already-has-subscription'), `got: ${kinds.join(', ')}`);
});

await reset('u-nocd');
await check('a later event with NO custom_data still lands on the bound account', async () => {
  await deliver(evt('subscription.created', subscriptionData(PRICE.professional.monthly, 'u-nocd')));
  const data = subscriptionData(PRICE.professional.monthly, 'u-nocd', { status: 'paused' });
  delete data.custom_data;                        // renewals often carry none
  await deliver(evt('subscription.updated', data));
  assert.equal((await userDoc('u-nocd')).subscription.status, 'paused',
    'the stored binding, not custom_data, located the account');
});

/* ── 17-18. Out-of-order delivery ─────────────────────────────────────────── */

console.log('\nOut-of-order delivery');

await reset('u-order');
await check('17. an older created event cannot resurrect a cancelled subscription', async () => {
  const tOld = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const created = {
    ...evt('subscription.created', subscriptionData(PRICE.professional.monthly, 'u-order')),
    occurred_at: tOld,
  };
  const canceled = evt('subscription.canceled', subscriptionData(PRICE.professional.monthly, 'u-order', {
    status: 'canceled',
    current_billing_period: {
      starts_at: new Date(Date.now() - 40 * 86400000).toISOString(),
      ends_at: new Date(Date.now() - 86400000).toISOString(),       // already elapsed
    },
  }));

  await deliver(created);
  await deliver(canceled);
  assert.equal((await userDoc('u-order')).paidAccess, false, 'cancelled and elapsed = no access');

  // The retry of that ORIGINAL created event now arrives, out of order.
  const res = await deliver({ ...created, event_id: 'evt_late_created' });
  assert.equal(res.statusCode, 200, 'acknowledged, but not applied');

  const u = await userDoc('u-order');
  assert.equal(u.subscription.status, 'canceled', 'the newer state must survive');
  assert.equal(u.paidAccess, false, 'a stale event must not restore access');
});

await reset('u-recover');
await check('18. an older payment failure cannot drag a recovered subscription back', async () => {
  const tOld = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  await deliver(evt('subscription.created', subscriptionData(PRICE.professional.monthly, 'u-recover')));

  const late = {
    ...evt('transaction.payment_failed', {
      id: 'txn_late', subscription_id: 'sub_test_001', customer_id: 'ctm_test_001',
      custom_data: { userId: 'u-recover' },
    }),
    occurred_at: tOld,
  };
  await deliver(late);

  const u = await userDoc('u-recover');
  assert.equal(u.subscription.status, 'active', 'the later active state must stand');
  assert.equal(u.paidAccess, true);
});

await check('ordering metadata is recorded for every applied event', async () => {
  const u = await userDoc('u-recover');
  assert.ok(u.lastPaddleEventOccurredAt, 'lastPaddleEventOccurredAt must be stored');
  assert.ok(u.lastPaddleEventId, 'lastPaddleEventId must be stored');
  assert.equal(u.lastPaddleEventType, 'subscription.created');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
