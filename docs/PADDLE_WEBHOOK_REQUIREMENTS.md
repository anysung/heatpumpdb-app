# Paddle Webhook — Quantity & Entitlement Requirements

> Status (2026-07-19): **IMPLEMENTED.** Every requirement below is enforced by
> [`google_cloud_function/paddleWebhook.js`](../google_cloud_function/paddleWebhook.js)
> and covered by tests — see the compliance table at the end. This document
> stays as the statement of intent; the operational guide is
> [PADDLE_BILLING.md](./PADDLE_BILLING.md).
>
> Requirement 5 ("do not deploy") is still in force: the code exists and is
> tested against the sandbox, but nothing has been deployed and live checkout
> remains disabled pending Paddle's domain approval.

## Context: checkout is single-item, quantity 1 by construction

The app opens exactly one kind of Paddle Checkout, in one place:

- [`src/services/paddleService.ts:65-70`](../src/services/paddleService.ts#L65-L70) —
  the only `Paddle.Checkout.open()` call. It always sends:
  ```ts
  items: [{ priceId: paddlePriceId(plan, term), quantity: 1 }]
  ```
  One item, `quantity: 1`, hard-coded. There is no code path that adds a second
  item or a quantity other than 1.
- Callers pass only `(user, plan, term)` — no quantity is threaded through:
  - [`src/hpiq/pages/AccountPage.tsx:58`](../src/hpiq/pages/AccountPage.tsx#L58)
  - [`src/hpiq/mobile/MobileApp.tsx:424`](../src/hpiq/mobile/MobileApp.tsx#L424)
- Seat count is a property of the **plan**, not the checkout quantity. Team plans
  bill as a single line item; the seats live in `SUB_PLANS[plan].seatLimit`
  ([`src/config/subscriptionPlans.ts:45-58`](../src/config/subscriptionPlans.ts#L45-L58)):
  Professional = 1, Team 3 = 3, Team 5 = 5.

Because checkout is single-item/quantity-1 by construction, **any** transaction or
subscription item arriving at the webhook with a different shape is anomalous and
must be treated as such.

## Requirements the webhook MUST enforce

### 1. Reject or quarantine `quantity != 1`
For every transaction line item and every subscription item in the payload, assert
`quantity === 1`. If any item has `quantity !== 1`:
- Do **not** grant, extend, or modify entitlement.
- Quarantine the event: log it, flag it for admin review (surface on the admin
  Billing/Audit page), and return a non-error acknowledgement so Paddle does not
  retry indefinitely (or return the code your idempotency layer uses for
  "received, not applied"). Never silently drop.

### 2. Never derive account or seat count from Paddle quantity
Quantity is `1` and carries no meaning. Seats and account entitlement are **never**
computed from `item.quantity`. Do not multiply, sum, or otherwise read seat count
from the quantity field.

### 3. Derive entitlement only from the verified Paddle Price ID
After verifying the webhook signature, resolve the plan strictly from the Price ID
on the (single) item, then take `seatLimit` from the plan definition — never from
the payload:

| Paddle Price ID resolves to | Plan           | Total seats |
|-----------------------------|----------------|-------------|
| `professional`              | Professional   | 1           |
| `team_3`                    | Team 3         | 3           |
| `team_5`                    | Team 5         | 5           |

- The Price ID → plan/term map is the single source of truth in
  [`src/config/paddlePrices.ts`](../src/config/paddlePrices.ts) (`PADDLE_PRICE_IDS`,
  keyed by currency) and `seatLimit` in
  [`src/config/subscriptionPlans.ts`](../src/config/subscriptionPlans.ts) (`SUB_PLANS`).
  The webhook (server-side) must use the same mapping — a Price ID it does not
  recognize is a reject/quarantine, not a default plan.
- `customData` from checkout (`userId`, `planCode`, `billingTerm`, `country` —
  set at [`paddleService.ts:68`](../src/services/paddleService.ts#L68)) may be used
  to locate the Firebase account, but the **entitlement itself** (plan + seatLimit)
  must be re-derived from the verified Price ID, not trusted from `customData`.
- Entitlement is written to `user.subscription` exactly as the ops/admin path does
  it (`adminAssignSubscription`,
  [`src/services/subscriptionService.ts:197`](../src/services/subscriptionService.ts#L197)):
  `seatLimit: SUB_PLANS[plan].seatLimit`. Team plans create/reuse the org with the
  same `seatLimit`. Per project rules, `user.subscription` may be written only by
  the billing webhook, an admin, or the rules-validated free-grant redemption.

### 4. Re-check quantity on `subscription.created` AND `subscription.updated`
The quantity assertion (Requirement 1) is not a one-time check at first purchase.
Re-run it on **every** `subscription.created` and `subscription.updated` event
(and any transaction event that carries items). A subscription whose item quantity
becomes `!= 1` at any point is quarantined and does not update entitlement until an
admin resolves it.

### 5. Do not deploy
These are requirements for the upcoming implementation. No webhook code is to be
written, wired, or deployed as part of recording them.

> **Still in force.** The webhook is now written and tested, but it has not been
> deployed, the live price ids are blank, and no production site carries a live
> Paddle token. Live checkout stays off until Paddle approves the domains.

## Compliance — how each requirement is met

| # | Requirement | Implementation | Test |
|---|---|---|---|
| 1 | Quarantine `quantity != 1` | `quantityViolation()` → `quarantine(…, 'quantity-not-one')`, returns 200 so Paddle stops retrying | `paddle-billing.unit.mjs` 5b; `paddle-webhook.integration.mjs` "quantity != 1 is quarantined" |
| 2 | Never derive seats from quantity | Seats come only from `SEAT_LIMITS[planCode]`; `quantity` is read solely to assert it is 1 | integration: a `quantity: 7` event creates no org |
| 3 | Entitlement from the verified Price ID only | `resolvePrice()` over the shared catalogue; unknown id → quarantine, never a default | unit 4b/9; integration "forged planCode in custom_data is ignored" |
| 4 | Re-check on created AND updated | Both route through `handleSubscriptionEvent()`, which runs the check every time | integration lifecycle cases |
| 5 | Do not deploy | Not deployed. Deploy script exists but has never been run | — |

## Summary of the original state (2026-07-19, before implementation)
- One checkout call, one item, `quantity: 1` — confirmed at
  [`paddleService.ts:65-70`](../src/services/paddleService.ts#L65-L70).
- No webhook implementation existed in the repo (searched `src/`,
  `google_cloud_function/`). The billing webhook was the missing server-side
  piece; the client and admin paths already assumed it owned
  `user.subscription` writes.
