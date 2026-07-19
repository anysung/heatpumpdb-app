/**
 * paddleWebhook — the server-side half of Paddle billing.
 *
 * This is the ONLY component allowed to turn money into entitlement. Client code
 * can open a checkout; it can never write `user.subscription`. Everything below
 * exists to make that boundary trustworthy.
 *
 * ── Trust model ───────────────────────────────────────────────────────────────
 * Nothing in the request body is trusted until the HMAC signature over the RAW
 * bytes verifies against the destination's secret. After that:
 *   - the PLAN comes from the verified Paddle Price ID and nothing else;
 *   - the SEAT COUNT comes from our own plan table, never from the payload;
 *   - `custom_data.userId` is used only to LOCATE the Firebase account — never
 *     to decide what that account is entitled to. Anyone who can open a checkout
 *     can put anything in custom_data.
 * See docs/PADDLE_WEBHOOK_REQUIREMENTS.md for the rules this implements.
 *
 * ── Delivery contract (drives every response code below) ──────────────────────
 * Paddle treats ONLY a 2xx as delivered; every other response is retried (live:
 * ~60 attempts over ~3 days). So:
 *   - transient failure / bad signature  → 500, because a retry can fix it
 *     (a rotated secret that has not been redeployed recovers by itself);
 *   - anomalous but well-formed event    → 200 + a quarantine record, because
 *     retrying will produce the identical anomaly forever. Never silently
 *     dropped: an admin sees it on the Billing page.
 * Deliveries are at-least-once and NOT ordered, so every write here is
 * convergent (upsert to latest state) and guarded by an event-id ledger.
 */
const crypto = require('crypto');
const admin = require('firebase-admin');

const CATALOGUE = require('./paddle-catalogue.json');

// The shared entitlement policy, byte-identical to src/config/entitlementPolicy.js
// (tests/paddle-catalogue.unit.mjs enforces that). It is ESM and this function is
// CommonJS, so it is pulled in with a dynamic import and cached.
let policyPromise = null;
const entitlementPolicy = () => (policyPromise ??= import('./entitlementPolicy.mjs'));

// ── Plan table — the ONLY source of seat counts ──────────────────────────────
// Mirrors SUB_PLANS in src/config/subscriptionPlans.ts. Seats INCLUDE the team
// admin: Team 3 = owner + 2, Team 5 = owner + 4.
const SEAT_LIMITS = { professional: 1, team_3: 3, team_5: 5 };
const TEAM_PLANS = new Set(['team_3', 'team_5']);

const EVENTS = 'paddleWebhookEvents';
const QUARANTINE = 'billingQuarantine';
const USERS = 'users';
const ORGS = 'organizations';

/** Signature freshness window. Bounds replay of a captured request. */
const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;

const nowIso = () => new Date().toISOString();

function db() {
  if (!admin.apps.length) admin.initializeApp();
  return admin.firestore();
}

// ── Signature verification ───────────────────────────────────────────────────

/**
 * Paddle signs `${timestamp}:${rawBody}` with HMAC-SHA256 and sends
 * `paddle-signature: ts=<unix>;h1=<hex>`.
 *
 * The RAW bytes matter: re-serializing parsed JSON changes key order and
 * whitespace, so the hash would never match. That is why this takes a Buffer
 * and the handler never calls req.body before this returns true.
 */
function verifySignature(rawBody, signatureHeader, secret) {
  return verifySignatureDetailed(rawBody, signatureHeader, [secret]).ok;
}

/**
 * As above, but reports WHY it failed so the handler can answer 400 (you sent a
 * malformed request) versus 401 (you are not Paddle). The reason is used for a
 * status code and a log line only — it is never returned to the caller, because
 * telling a prober "the timestamp was fine but the digest was wrong" hands them
 * an oracle. The response body is the same opaque string either way.
 *
 * `secrets` may hold more than one value to support rotation; see the handler.
 */
function verifySignatureDetailed(rawBody, signatureHeader, secrets) {
  if (!rawBody || !rawBody.length) return { ok: false, reason: 'empty-body' };
  if (!signatureHeader) return { ok: false, reason: 'missing-signature' };

  let ts = '';
  let h1 = '';
  for (const part of String(signatureHeader).split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === 'ts') ts = value;
    else if (key === 'h1') h1 = value;
  }
  if (!ts || !h1) return { ok: false, reason: 'malformed-signature' };

  // Reject stale signatures so a captured request cannot be replayed later.
  const tsMs = Number(ts) * 1000;
  if (!Number.isFinite(tsMs)) return { ok: false, reason: 'malformed-signature' };
  if (Math.abs(Date.now() - tsMs) > MAX_SIGNATURE_AGE_MS) return { ok: false, reason: 'stale-timestamp' };

  const provided = Buffer.from(h1, 'utf8');

  // Every configured secret is tried, and the result is folded with |= rather
  // than returned early, so the work done does not depend on WHICH secret
  // matched — during a rotation the timing must not reveal that the old secret
  // is still the live one.
  let matched = false;
  for (const secret of secrets) {
    if (!secret) continue;
    const expected = Buffer.from(
      crypto.createHmac('sha256', secret).update(`${ts}:`).update(rawBody).digest('hex'),
      'utf8',
    );
    // timingSafeEqual throws on a length mismatch, so that is checked first —
    // a wrong LENGTH digest is not a secret-dependent fact, it is malformed input.
    if (expected.length === provided.length && crypto.timingSafeEqual(expected, provided)) matched = true;
  }

  return matched ? { ok: true, reason: 'verified' } : { ok: false, reason: 'signature-mismatch' };
}

/**
 * The secrets a request may be signed with.
 *
 * ROTATION: set PADDLE_WEBHOOK_SECRET_PREVIOUS to the outgoing secret for the
 * length of the changeover, so in-flight retries signed with the old value are
 * still accepted, then REMOVE it. Both come from Secret Manager; neither is ever
 * hardcoded, logged or passed on a command line. Rotation is why this returns a
 * list — it is deliberately NOT a reason to answer 5xx on a bad signature.
 */
function signingSecrets() {
  return [process.env.PADDLE_WEBHOOK_SECRET, process.env.PADDLE_WEBHOOK_SECRET_PREVIOUS].filter(Boolean);
}

// ── Price id → plan/term ─────────────────────────────────────────────────────

/**
 * Resolve a verified Paddle Price ID to a plan and billing term.
 *
 * Both environment blocks are searched because sandbox and live price ids are
 * disjoint — the id itself says which catalogue it belongs to, so no separate
 * environment toggle can be set wrong. An id in neither block returns null,
 * which is a quarantine, never a default plan.
 */
function resolvePrice(priceId) {
  if (!priceId) return null;
  for (const [environment, currencies] of Object.entries(CATALOGUE)) {
    if (!currencies || typeof currencies !== 'object') continue;
    for (const [currency, plans] of Object.entries(currencies)) {
      if (!plans || typeof plans !== 'object') continue;
      for (const [planCode, terms] of Object.entries(plans)) {
        for (const [billingTerm, id] of Object.entries(terms)) {
          if (id && id === priceId) return { planCode, billingTerm, currency, environment };
        }
      }
    }
  }
  return null;
}

// ── Payload helpers ──────────────────────────────────────────────────────────

const itemsOf = (data) => (Array.isArray(data && data.items) ? data.items : []);
const priceIdOf = (item) => (item && item.price && item.price.id) || item.price_id || null;

/**
 * Every line item must have quantity exactly 1.
 *
 * Checkout is single-item/quantity-1 by construction (paddleService.openCheckout),
 * and seats come from the plan, never from quantity. So any other quantity means
 * the subscription was edited outside the app — it is an anomaly to be reviewed,
 * not arithmetic to be honoured. Re-checked on EVERY event, not just the first.
 */
function quantityViolation(items) {
  for (const item of items) {
    const q = item && item.quantity;
    if (q !== 1) return { priceId: priceIdOf(item), quantity: q === undefined ? null : q };
  }
  return null;
}

// ── Quarantine ───────────────────────────────────────────────────────────────

/**
 * Record an event we refuse to act on, for admin review. Returns 200 to Paddle:
 * the delivery succeeded, we simply did not grant anything. Retrying would
 * reproduce the same anomaly for three days and bury the real signal.
 *
 * Stores ids and shapes only — never customer names, addresses or card data.
 */
async function quarantine(event, kind, detail) {
  await db().collection(QUARANTINE).doc(event.event_id).set({
    eventId: event.event_id,
    eventType: event.event_type,
    occurredAt: event.occurred_at || null,
    kind,
    detail: detail || {},
    subscriptionId: (event.data && event.data.id) || null,
    customerId: (event.data && event.data.customer_id) || null,
    resolved: false,
    createdAt: nowIso(),
  }, { merge: true });
  console.warn(JSON.stringify({ severity: 'WARNING', msg: 'paddle-quarantine', kind, eventId: event.event_id, eventType: event.event_type, detail }));
}

// ── Account resolution ───────────────────────────────────────────────────────

/**
 * Find the Firebase account this event belongs to — FIRST BINDING WINS.
 *
 * `custom_data` is written by our own checkout call, but it is attacker-reachable:
 * anyone who can open a checkout can put any string in `custom_data.userId`, and
 * Paddle will faithfully sign it. A valid signature proves the event came from
 * Paddle; it proves nothing about whose account the payload names. So:
 *
 *   1. If this subscription id is ALREADY bound to an account, that binding is
 *      authoritative. A subscription is never silently reassigned — the whole
 *      point of the binding is that a later event carrying different (or stale,
 *      or forged) custom_data cannot move someone's entitlement to another uid.
 *      If custom_data disagrees with the binding, the event is quarantined
 *      rather than guessed at.
 *   2. Otherwise this is a first sighting, and custom_data.userId names the
 *      account — the only moment it is trusted, and only to say WHICH account.
 *      WHAT that account gets is always derived from the verified price id.
 *   3. Failing that, fall back to the Paddle customer id, which we wrote
 *      ourselves on an earlier event.
 *
 * Email is deliberately NOT a fallback: the checkout email is customer-supplied
 * and need not match the Firebase account, so matching on it would let someone
 * bind a subscription to an account they merely know the address of.
 *
 * @returns {{ ref, reason }} on success, or {@link null} plus a quarantine kind.
 */
async function resolveAccount(data) {
  const firestore = db();
  const subscriptionId = (data && data.id) || null;
  const customerId = (data && data.customer_id) || null;
  const claimedUid = data && data.custom_data && typeof data.custom_data.userId === 'string'
    ? data.custom_data.userId
    : null;

  // 1. An existing binding for this subscription id always wins.
  if (subscriptionId) {
    const bound = await firestore.collection(USERS)
      .where('paddleSubscriptionId', '==', subscriptionId).get();

    if (bound.size > 1) {
      // Two accounts claiming one subscription: never pick one.
      return { ref: null, kind: 'duplicate-subscription-binding',
        detail: { subscriptionId, boundCount: bound.size } };
    }
    if (bound.size === 1) {
      const ref = bound.docs[0].ref;
      if (claimedUid && claimedUid !== ref.id) {
        // Stale or forged custom_data on a later event. Refuse to reassign.
        return { ref: null, kind: 'subscription-rebind-refused',
          detail: { subscriptionId, boundUid: ref.id, claimedUid } };
      }
      return { ref, kind: null };
    }
  }

  // 2. First sighting — custom_data names the account.
  if (claimedUid) {
    const snap = await firestore.collection(USERS).doc(claimedUid).get();
    if (snap.exists) {
      // Guard against one account collecting several subscriptions by accident
      // (a second checkout before the first was cancelled). Superseding an
      // existing subscription id is an ops decision, not a webhook one.
      const existing = snap.get('paddleSubscriptionId');
      if (subscriptionId && existing && existing !== subscriptionId) {
        return { ref: null, kind: 'account-already-has-subscription',
          detail: { uid: snap.id, existingSubscriptionId: existing, incomingSubscriptionId: subscriptionId } };
      }
      return { ref: snap.ref, kind: null };
    }
  }

  // 3. Fall back to the customer id we stored ourselves on an earlier event.
  if (customerId) {
    const q = await firestore.collection(USERS)
      .where('paddleCustomerId', '==', customerId).limit(2).get();
    if (q.size === 1) return { ref: q.docs[0].ref, kind: null };
    if (q.size > 1) {
      return { ref: null, kind: 'ambiguous-customer-id', detail: { customerId } };
    }
  }

  return { ref: null, kind: 'unresolved-account',
    detail: { subscriptionId, hasCustomData: !!claimedUid } };
}

// ── Entitlement write ────────────────────────────────────────────────────────

/**
 * Map a Paddle subscription status onto ours. Paddle's vocabulary is already
 * close; 'expired' is ours alone (Paddle simply stops sending events), so it is
 * only ever reached through the policy, never through this map.
 */
function mapStatus(paddleStatus) {
  switch (paddleStatus) {
    case 'trialing': return 'trialing';
    case 'active': return 'active';
    case 'past_due': return 'past_due';
    case 'paused': return 'paused';
    case 'canceled': return 'canceled';
    default: return null;
  }
}

// ── Ordering ─────────────────────────────────────────────────────────────────

/**
 * Rank for breaking ties when two events carry the SAME occurred_at.
 *
 * Convergent writes are not enough on their own: Paddle does not guarantee
 * delivery order, so a retried `subscription.created` can land after the
 * `subscription.canceled` that followed it and would otherwise resurrect a dead
 * subscription. Timestamps settle almost every case; this settles the rest by
 * preferring the state that is further along the lifecycle.
 */
const EVENT_RANK = {
  'subscription.created': 1,
  'transaction.payment_failed': 2,
  'subscription.updated': 3,
  'subscription.canceled': 4,
};

/**
 * Is this event OLDER than what we have already applied to the account?
 *
 * Compares `occurred_at` against the last applied event's, falling back to the
 * lifecycle rank when they are identical. Equal timestamp AND equal rank means
 * it is effectively the same state — allowed through, because re-applying an
 * identical state is harmless and convergent.
 */
function isStale(event, userSnap) {
  const lastAt = userSnap && userSnap.get('lastPaddleEventOccurredAt');
  if (!lastAt) return false;                       // nothing applied yet

  const incoming = Date.parse(event.occurred_at || '');
  const applied = Date.parse(lastAt);
  if (!Number.isFinite(incoming) || !Number.isFinite(applied)) return false;

  if (incoming < applied) return true;
  if (incoming > applied) return false;

  // Same instant — fall back to lifecycle order.
  const lastType = (userSnap && userSnap.get('lastPaddleEventType')) || '';
  return (EVENT_RANK[event.event_type] || 0) < (EVENT_RANK[lastType] || 0);
}

/** Server-owned ordering metadata. Never client-writable (see firestore.rules). */
function orderingFields(event) {
  return {
    lastPaddleEventOccurredAt: event.occurred_at || nowIso(),
    lastPaddleEventType: event.event_type,
    lastPaddleEventId: event.event_id,
  };
}

/**
 * Apply a verified subscription event to Firestore.
 *
 * Convergent by construction: it writes the full latest state rather than a
 * delta, so duplicate deliveries land on the same result. Ordering is handled
 * separately by isStale() — convergence alone cannot save you from an OLD event
 * arriving last.
 */
async function applySubscription(event, userRef, resolved, opts) {
  const data = event.data || {};
  const firestore = db();
  const { paidAccessState } = await entitlementPolicy();

  const planCode = resolved.planCode;
  const seatLimit = SEAT_LIMITS[planCode];
  const status = opts.statusOverride || mapStatus(data.status) || 'active';

  const billingPeriod = data.current_billing_period || {};
  const trial = (itemsOf(data)[0] || {}).trial_dates || {};
  const scheduled = data.scheduled_change || null;

  const currentPeriodEndsAt = billingPeriod.ends_at || null;
  const pastDueSince = status === 'past_due'
    ? (opts.pastDueSince || (await readPastDueSince(userRef)) || nowIso())
    : null;

  const subscription = {
    provider: 'paddle',
    planCode,
    billingTerm: resolved.billingTerm,
    status,
    seatLimit,
    trialStartedAt: trial.starts_at || null,
    trialEndsAt: trial.ends_at || null,
    paidPeriodStartsAt: billingPeriod.starts_at || null,
    currentPeriodEndsAt,
    cancelAtPeriodEnd: !!(scheduled && scheduled.action === 'cancel') || status === 'canceled',
    scheduledPlanCode: null,
    scheduledBillingTerm: null,
    pastDueSince,
    paddleCustomerId: data.customer_id || null,
    paddleSubscriptionId: data.id || null,
    paddlePriceId: resolved.priceId,
  };

  const access = paidAccessState(subscription);

  // Flat mirror fields the app already reads. `status` / `isActive` are NOT
  // touched here: billing state must never masquerade as account state, or a
  // lapsed card would lock someone out of the account they need to fix it.
  const userUpdate = {
    subscription,
    paidAccess: access.allowed,
    billingChannel: 'paddle',
    paddleCustomerId: data.customer_id || null,
    paddleSubscriptionId: data.id || null,
    subscriptionStatus: status,
    nextBilledAt: data.next_billed_at || null,
    ...orderingFields(event),
  };

  await userRef.set(userUpdate, { merge: true });

  // ── Team plans ──────────────────────────────────────────────────────────
  // The org carries the team's entitlement for ALL its seats; storage.rules
  // reads it directly, so there is nothing to copy onto member profiles.
  if (TEAM_PLANS.has(planCode)) {
    await syncOrganization(userRef, subscription, access.allowed);
  } else {
    await handleTeamToProfessional(event, userRef);
  }

  console.log(JSON.stringify({
    severity: 'INFO', msg: 'paddle-entitlement-applied',
    eventId: event.event_id, eventType: event.event_type,
    uid: userRef.id, planCode, seatLimit, status,
    paidAccess: access.allowed, reason: access.reason,
    environment: resolved.environment,
  }));
}

/** Preserve an existing grace anchor so retries do not keep extending it. */
async function readPastDueSince(userRef) {
  const snap = await userRef.get();
  const sub = snap.exists ? snap.get('subscription') : null;
  return (sub && sub.pastDueSince) || null;
}

/**
 * Create or update the team's organization — billing fields only.
 *
 * Seats, invitations and membership stay owned by subscriptionService.ts; this
 * never writes `members`, `memberUids` or `invitedEmails` on an existing org, so
 * a renewal cannot disturb a team that is mid-invitation. A NEW org is seeded
 * with the buyer as its first member, because seats include the admin.
 */
async function syncOrganization(userRef, subscription, allowed) {
  const firestore = db();
  const userSnap = await userRef.get();
  const user = userSnap.data() || {};

  const billing = {
    planCode: subscription.planCode,
    seatLimit: subscription.seatLimit,
    subscriptionStatus: subscription.status,
    trialEndsAt: subscription.trialEndsAt || null,
    currentPeriodEndsAt: subscription.currentPeriodEndsAt || null,
    pastDueSince: subscription.pastDueSince || null,
    paidAccess: allowed,
  };

  let orgRef = null;
  if (user.orgId) {
    const existing = await firestore.collection(ORGS).doc(user.orgId).get();
    // Only reuse an org this account actually owns — never repoint someone
    // else's team at this subscription.
    if (existing.exists && existing.get('ownerUid') === userRef.id) orgRef = existing.ref;
  }
  if (!orgRef) {
    const q = await firestore.collection(ORGS).where('ownerUid', '==', userRef.id).limit(1).get();
    if (!q.empty) orgRef = q.docs[0].ref;
  }

  if (orgRef) {
    await orgRef.set(billing, { merge: true });
  } else {
    const email = String(user.email || '').trim().toLowerCase();
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
    orgRef = firestore.collection(ORGS).doc();
    await orgRef.set({
      ...billing,
      name: user.companyName || '',
      ownerUid: userRef.id,
      ownerEmail: email,
      // The buyer occupies the first seat — Team 3 is owner + 2, not owner + 3.
      members: [{ uid: userRef.id, email, ...(name ? { name } : {}) }],
      memberUids: [userRef.id],
      invitedEmails: [],
      invitedAt: {},
      companyName: user.companyName || '',
      companyType: user.companyType || '',
      createdAt: nowIso(),
    });
    await userRef.set({ orgId: orgRef.id, orgRole: 'team_admin' }, { merge: true });
  }

  return orgRef;
}

/**
 * A team plan became Professional.
 *
 * Team data is NEVER deleted here. The house rule is that plan changes apply at
 * renewal through subscriptionChangeRequests, with the owner choosing who keeps
 * a seat; a webhook arriving with a smaller plan means that path was bypassed
 * (a change made directly in Paddle). So: stop the team's entitlement, keep
 * every member, invitation and company profile intact, and raise it for an
 * admin. Reversible by re-upgrading; a delete would not be.
 */
async function handleTeamToProfessional(event, userRef) {
  const firestore = db();
  const snap = await userRef.get();
  const orgId = snap.get('orgId');
  if (!orgId) return;

  const orgSnap = await firestore.collection(ORGS).doc(orgId).get();
  if (!orgSnap.exists || orgSnap.get('ownerUid') !== userRef.id) return;

  // One write withdraws the whole team's access — every seat reads this doc.
  await orgSnap.ref.set({ subscriptionStatus: 'expired', paidAccess: false }, { merge: true });
  await quarantine(event, 'team-downgraded-to-professional', {
    orgId,
    memberCount: (orgSnap.get('memberUids') || []).length,
    note: 'Team entitlement stopped; members, invitations and company profile preserved for admin review.',
  });
}

// ── Event routing ────────────────────────────────────────────────────────────

async function handleSubscriptionEvent(event, statusOverride) {
  const data = event.data || {};
  const items = itemsOf(data);

  if (!items.length) {
    await quarantine(event, 'no-items', {});
    return;
  }

  const bad = quantityViolation(items);
  if (bad) {
    await quarantine(event, 'quantity-not-one', bad);
    return;
  }
  if (items.length > 1) {
    await quarantine(event, 'multiple-items', { count: items.length });
    return;
  }

  const priceId = priceIdOf(items[0]);
  const resolved = resolvePrice(priceId);
  if (!resolved) {
    await quarantine(event, 'unknown-price-id', { priceId });
    return;
  }
  resolved.priceId = priceId;

  const { ref: userRef, kind, detail } = await resolveAccount(data);
  if (!userRef) {
    await quarantine(event, kind, detail);
    return;
  }

  // Ordering: an event older than what we have already applied is dropped, so a
  // late-arriving `created` cannot resurrect a cancelled subscription.
  const userSnap = await userRef.get();
  if (isStale(event, userSnap)) {
    await noteStale(event, userRef, userSnap);
    return;
  }

  await applySubscription(event, userRef, resolved, { statusOverride });
}

/** Record that an out-of-order event was deliberately not applied. */
async function noteStale(event, userRef, userSnap) {
  console.log(JSON.stringify({
    severity: 'INFO', msg: 'paddle-stale-event-ignored',
    eventId: event.event_id, eventType: event.event_type, uid: userRef.id,
    occurredAt: event.occurred_at || null,
    lastAppliedAt: userSnap.get('lastPaddleEventOccurredAt') || null,
    lastAppliedType: userSnap.get('lastPaddleEventType') || null,
  }));
}

/**
 * A renewal charge failed. Paddle keeps retrying the card for days; we start the
 * grace window and keep access on until it runs out. The subscription's own
 * status transition arrives separately as subscription.updated.
 */
async function handlePaymentFailed(event) {
  const data = event.data || {};
  const firestore = db();
  const { paidAccessState } = await entitlementPolicy();

  const { ref: userRef, kind, detail } = await resolveAccount({
    id: data.subscription_id,
    customer_id: data.customer_id,
    custom_data: data.custom_data,
  });
  if (!userRef) {
    await quarantine(event, kind, { ...detail, transactionId: data.id || null });
    return;
  }

  const snap = await userRef.get();
  const sub = snap.get('subscription');
  if (!sub) {
    await quarantine(event, 'payment-failed-without-subscription', { transactionId: data.id || null });
    return;
  }

  // A payment failure that predates the state we hold must not drag an already
  // recovered subscription back into dunning.
  if (isStale(event, snap)) {
    await noteStale(event, userRef, snap);
    return;
  }

  // Keep the FIRST failure as the anchor — a second failed retry must not slide
  // the 7-day window forward and grant unpaid access indefinitely.
  const pastDueSince = sub.pastDueSince || event.occurred_at || nowIso();
  const next = { ...sub, status: 'past_due', pastDueSince };
  const access = paidAccessState(next);

  await userRef.set({
    subscription: next,
    paidAccess: access.allowed,
    subscriptionStatus: 'past_due',
    ...orderingFields(event),
  }, { merge: true });

  const orgId = snap.get('orgId');
  if (orgId && snap.get('orgRole') === 'team_admin') {
    // One write; every seat reads the team's state from this doc.
    const orgRef = firestore.collection(ORGS).doc(orgId);
    await orgRef.set({ subscriptionStatus: 'past_due', pastDueSince, paidAccess: access.allowed }, { merge: true });
  }

  console.log(JSON.stringify({
    severity: 'INFO', msg: 'paddle-payment-failed',
    eventId: event.event_id, uid: userRef.id,
    paidAccess: access.allowed, reason: access.reason,
  }));
}

async function route(event) {
  switch (event.event_type) {
    case 'subscription.created':
    case 'subscription.updated':
      return handleSubscriptionEvent(event, null);
    case 'subscription.canceled':
      // Access continues to currentPeriodEndsAt — the policy decides, not this.
      return handleSubscriptionEvent(event, 'canceled');
    case 'transaction.payment_failed':
      return handlePaymentFailed(event);
    default:
      // Subscribed to something we do not act on yet: acknowledge, do nothing.
      console.log(JSON.stringify({ severity: 'INFO', msg: 'paddle-event-ignored', eventType: event.event_type, eventId: event.event_id }));
      return;
  }
}

// ── Idempotency ──────────────────────────────────────────────────────────────

/**
 * Claim an event id, atomically. Paddle re-sends the SAME event_id on every
 * retry, so the first delivery to win this transaction is the only one that
 * processes. Without it, a retried subscription.created could create a second
 * organization for the same purchase.
 */
async function claimEvent(event) {
  const ref = db().collection(EVENTS).doc(event.event_id);
  try {
    return await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) return false;
      tx.set(ref, {
        eventId: event.event_id,
        eventType: event.event_type,
        occurredAt: event.occurred_at || null,
        receivedAt: nowIso(),
      });
      return true;
    });
  } catch (err) {
    console.error(JSON.stringify({ severity: 'ERROR', msg: 'paddle-claim-failed', eventId: event.event_id, error: err.message }));
    throw err;
  }
}

// ── HTTP entry point ─────────────────────────────────────────────────────────

/**
 * Registered by index.js. Deploy as its own Cloud Function from the same source:
 *   gcloud functions deploy paddleWebhook --entry-point=paddleWebhook ...
 */
async function paddleWebhook(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('method-not-allowed');
    return;
  }

  const secrets = signingSecrets();
  if (!secrets.length) {
    // A genuine server-side misconfiguration — 500 is correct here, and the
    // retry is wanted: the events survive until the secret is mounted. Never
    // echo the variable, only its absence.
    console.error(JSON.stringify({ severity: 'ERROR', msg: 'paddle-webhook-secret-missing' }));
    res.status(500).send('not-configured');
    return;
  }

  // rawBody is the exact bytes Paddle signed. Anything derived from req.body has
  // already been through JSON.parse and cannot reproduce the signature.
  const rawBody = req.rawBody;
  const signature = req.get('paddle-signature');

  const verdict = verifySignatureDetailed(rawBody, signature, secrets);
  if (!verdict.ok) {
    // AUTHENTICATION failure — answer 4xx, not 5xx. A 5xx here would claim the
    // server broke when in fact the caller failed to prove it is Paddle, and it
    // would bury real outages under forged traffic. Rotation is handled by
    // accepting a previous secret (signingSecrets), NOT by asking Paddle to
    // retry until a deploy lands.
    //   400 — the request is malformed (no/!parseable signature, empty body)
    //   401 — well-formed but not authentic (wrong digest, stale timestamp)
    const status = (verdict.reason === 'missing-signature' ||
                    verdict.reason === 'malformed-signature' ||
                    verdict.reason === 'empty-body') ? 400 : 401;
    // The REASON is logged for operators but never returned: a caller that can
    // tell "stale timestamp" from "wrong digest" has an oracle for probing.
    // The signature header, the body and the secrets are never logged.
    console.warn(JSON.stringify({
      severity: 'WARNING', msg: 'paddle-signature-rejected', reason: verdict.reason, status,
    }));
    res.status(status).send('unauthorized');
    return;
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    // Authentic (it verified) but not JSON. Nothing to retry into.
    console.error(JSON.stringify({ severity: 'ERROR', msg: 'paddle-body-unparseable' }));
    res.status(400).send('bad-body');
    return;
  }

  if (!event || !event.event_id || !event.event_type) {
    await quarantine({ event_id: `malformed-${Date.now()}`, event_type: 'unknown', data: {} }, 'malformed-event', {});
    res.status(200).send('received');
    return;
  }

  try {
    const fresh = await claimEvent(event);
    if (!fresh) {
      console.log(JSON.stringify({ severity: 'INFO', msg: 'paddle-duplicate-ignored', eventId: event.event_id }));
      res.status(200).send('already-processed');
      return;
    }

    await route(event);
    res.status(200).send('ok');
  } catch (err) {
    // Release the claim so the retry can actually reprocess, then fail loudly.
    await db().collection(EVENTS).doc(event.event_id).delete().catch(() => {});
    console.error(JSON.stringify({
      severity: 'ERROR', msg: 'paddle-webhook-error',
      eventId: event.event_id, eventType: event.event_type, error: err.message,
    }));
    res.status(500).send('error');
  }
}

module.exports = {
  paddleWebhook,
  // Exported for tests — no network, no Firestore.
  verifySignature,
  verifySignatureDetailed,
  resolvePrice,
  quantityViolation,
  mapStatus,
  isStale,
  EVENT_RANK,
  SEAT_LIMITS,
  MAX_SIGNATURE_AGE_MS,
};
