# Paddle Billing — how it works and how to switch it on

> Status (2026-07-20): implemented and tested. **The nine live price ids are now
> entered**, so the catalogue is complete in both environments.
>
> Live checkout is still **not active**: the environment is chosen by the client
> token, and no live token is configured anywhere. What decides whether a real
> customer can be charged is that one variable — see
> [Going live](#going-live).
>
> ⚠️ **A production build currently ships a SANDBOX token** (it is set in the
> gitignored `.env.production.local`, which `vite build` loads). That is safe for
> money — nothing real can be charged — but it means a deployed site would show a
> *working checkout button* that opens a sandbox payment and grants nothing,
> because no webhook is deployed. Unset that variable before deploying any public
> site, or leave billing looking deliberately unavailable ("coming soon").

Paddle is the merchant of record: it owns payment methods, EU VAT, invoices and
the customer self-service flows. We never see a card. What we own is the
translation of "Paddle says this subscription is in state X" into "this account
may read the catalogue", and that translation lives in exactly three files.

## The moving parts

| Concern | File | Notes |
|---|---|---|
| Which Paddle environment | [`src/config/paddleEnv.ts`](../src/config/paddleEnv.ts) | Derived from the client token prefix — one decision, used by both Paddle.js and the catalogue |
| Price ids | [`src/config/paddleCatalogue.json`](../src/config/paddleCatalogue.json) | `sandbox` / `live` blocks, keyed by currency. **Mirrored** into `google_cloud_function/paddle-catalogue.json` |
| Plans + seats | [`src/config/subscriptionPlans.ts`](../src/config/subscriptionPlans.ts) | `SUB_PLANS` — the only source of seat counts |
| Who may read the catalogue | [`src/config/entitlementPolicy.js`](../src/config/entitlementPolicy.js) | **Mirrored** into `google_cloud_function/entitlementPolicy.mjs` |
| Checkout | [`src/services/paddleService.ts`](../src/services/paddleService.ts) | One `Checkout.open()`, always `quantity: 1` |
| Webhook | [`google_cloud_function/paddleWebhook.js`](../google_cloud_function/paddleWebhook.js) | The only writer of `user.subscription` besides admin + free grants |
| Enforcement | [`storage.rules`](../storage.rules) | Gates the dataset bucket on `paidAccess`, or the team's via `orgId` |

**The two mirrored files are copies, on purpose.** The browser app and the Cloud
Function cannot import each other, so `tests/paddle-billing.unit.mjs` compares
them byte-for-byte and fails the build if they drift. If you edit one, copy it:

```bash
cp src/config/paddleCatalogue.json  google_cloud_function/paddle-catalogue.json
cp src/config/entitlementPolicy.js  google_cloud_function/entitlementPolicy.mjs
```

## Environment separation

The client token's prefix is the single switch:

| `VITE_PADDLE_CLIENT_TOKEN` | Paddle.js env | Catalogue block |
|---|---|---|
| `test_…` | `sandbox` | `sandbox` |
| anything else, non-empty | `production` | `live` |
| unset | — | none; checkout disabled, "coming soon" |

Not hostname-based: the same bundle is served from several domains per market
(apex, `www`, `*.web.app`, preview channels), and a hostname rule would silently
turn a preview deploy into a live-charging page. The token is what actually
authorizes the charge, so the token decides.

**There is no fallback between environments.** A blank live id resolves to `''`
and blocks checkout for that plan/term; it never borrows the sandbox id. That
substitution is the single most expensive mistake available here and it would be
invisible until a customer hit it.

## Entitlement policy

One table, implemented once in `entitlementPolicy.js`:

| Subscription status | Paid catalogue | Why |
|---|---|---|
| `trialing` | ✅ allowed | 7-day trial, card already on file |
| `active` | ✅ allowed | |
| `canceled`, period end in the future | ✅ allowed until that date | Cancelling stops renewal; it never shortens a paid period |
| `canceled`, period end passed | ❌ denied | |
| `past_due` | ✅ allowed for **7 days** from the first failure, then ❌ | Paddle is still retrying the card; cutting someone off over one failed charge is worse than a week of unpaid access |
| `paused` | ❌ denied | No money flowing, none expected |
| `expired` | ❌ denied | |
| no subscription | ❌ denied | |

**Billing state is never account state.** Losing paid access never touches
`status` / `isActive`, so the person still logs in and still reaches the Account
and Billing pages to renew. Nothing in the webhook writes `isActive`, and a test
enforces that.

Team members hold no subscription of their own — the owner paid for the seat — so
their entitlement IS the organization's, read live through their `orgId` pointer.
It is deliberately not copied onto member profiles: one write to the org governs
every seat, so expiry, pause and cancellation take effect for the whole team at
once, a member who joins later is entitled immediately with no back-fill, and a
removed member loses access the moment their pointer goes. A per-member copy
would mean N writes per billing event and N chances to leave a seat stale.

Because the pointer *is* the entitlement, `firestore.rules` only lets an account
set `orgId` to an organization whose `memberUids` already contain it — and
`storage.rules` checks that membership again at read time.

### How it is enforced

Security rules cannot compare ISO dates or evaluate a grace window, so they read
a denormalized boolean, `paidAccess`, written server-side from the policy above.
The app re-evaluates the policy for what it *shows*; `storage.rules` is what
*enforces*. Clients can never write `paidAccess` for themselves: the only client-reachable
path that sets it is a rules-validated free-grant redemption. Team members never
carry the flag at all — the rule follows their `orgId` to the organization
(`firestore.rules`, and `tests/organization-read.rules.mjs`).

There is **no grandfather clause**. An earlier draft allowed any account with no
`subscription` field, which was a standing bypass for every approved account —
including brand-new signups, which would have been born entitled. Pre-launch
there are no paying users to protect, so the rule is simply: pay, be granted, or
be an admin. Ops and test accounts get access the same way a customer does, via
an admin assignment or a free-access grant (both set `paidAccess`).

## The webhook

**Endpoint:** a gen2 Cloud Function, `paddleWebhook`, deployed from
`google_cloud_function/` with `--entry-point=paddleWebhook`. It shares the source
directory with the news pipeline but is its own function with its own URL,
secret and scaling.

**Events handled:** `subscription.created`, `subscription.updated`,
`subscription.canceled`, `transaction.payment_failed`. Anything else is
acknowledged and ignored.

**Trust model.** Nothing in the body is trusted until the HMAC signature over the
*raw bytes* verifies (`ts=<unix>;h1=<hex>` over `${ts}:${rawBody}`, constant-time
compare, 5-minute freshness window). After that:

- the **plan** comes from the verified Paddle Price ID and nothing else;
- the **seat count** comes from `SUB_PLANS`, never from the payload;
- `custom_data.userId` only *locates* the account. It never decides entitlement —
  anyone who can open a checkout can put anything in `custom_data`. A test
  proves a forged `planCode: 'team_5'` on a Professional price still yields
  1 seat.

**Response codes** follow Paddle's delivery contract — only a 2xx counts as
delivered, everything else is retried (live: ~60 attempts over ~3 days):

| Situation | Response | Why |
|---|---|---|
| Applied successfully | `200` | |
| Duplicate `event_id` | `200 already-processed` | |
| Missing/malformed signature, unparseable body | `400` | The request is unusable; retrying cannot fix it |
| Wrong digest or stale timestamp | `401` | Authentication failed. Not a server error — a 5xx here would bury real outages under forged traffic |
| Internal fault (secret unmounted, Firestore down) | `500` | Genuinely our fault; the retry budget is what saves the event |
| Quantity ≠ 1, unknown price id, unresolved account | `200` + quarantine record | Retrying reproduces the same anomaly for three days and buries the signal |

Failure reasons are logged for operators but never returned: a caller that can
tell "stale timestamp" from "wrong digest" has an oracle for probing. Signature
headers, bodies and secrets are never logged.

**Secret rotation** is handled by configuration, not by response codes. Set
`PADDLE_WEBHOOK_SECRET_PREVIOUS` to the outgoing secret for the length of the
changeover so in-flight retries still verify, then remove it. Both values come
from Secret Manager.

**Account binding — first binding wins.** `custom_data` is written by our own
checkout, but anyone who can open a checkout can put any uid in it and Paddle
will faithfully sign it: a valid signature proves the event came from Paddle,
never whose account it names. So an existing `paddleSubscriptionId` binding is
authoritative; a later event whose `custom_data` disagrees is quarantined
(`subscription-rebind-refused`) rather than silently reassigning someone's
entitlement. `custom_data` is trusted only on first sighting, and only to say
*which* account — never *what* it gets. Email is deliberately not a fallback.

**Idempotency.** Every delivery claims its `event_id` in a Firestore transaction
(`paddleWebhookEvents`) before anything is processed; a retry short-circuits
before `route()` runs. On an error the claim is released so the retry can
genuinely reprocess.

**Ordering.** Deliveries are **not ordered** — a retried `subscription.created`
can land after the `canceled` that followed it. Convergent writes alone cannot
save you from that, so each account stores `lastPaddleEventOccurredAt` /
`lastPaddleEventType` (server-owned, never client-writable) and an event older
than the applied state is acknowledged and dropped. Equal timestamps break the
tie on lifecycle rank, so `created` can never overwrite `canceled`.

**Quarantine.** Refused events land in `billingQuarantine` (admin-readable) with
ids and shapes only — never customer names, addresses or card data. Nothing is
ever silently dropped.

### Seats

`SUB_PLANS[plan].seatLimit`, always including the buyer:

| Plan | Seats | Invitable after purchase |
|---|---|---|
| Professional | 1 | — (no organization is created at all) |
| Team 3 | 3 | 2 |
| Team 5 | 5 | 4 |

A new organization is seeded with the buyer already in `members`/`memberUids`.
Seat *management* (invite / remove / leave) stays entirely in
`src/services/subscriptionService.ts` — the webhook only ever writes the org's
billing fields, so a renewal can never disturb a team mid-invitation.

**Team → Professional deletes nothing.** Plan changes are supposed to go through
`subscriptionChangeRequests` at renewal, with the owner choosing who keeps a
seat. A webhook arriving with a smaller plan means that path was bypassed (a
change made directly in Paddle), so the webhook stops the team's entitlement,
preserves every member, invitation and the company profile, and raises a
quarantine record for an admin. Re-upgrading restores access; a delete would not
be reversible.

## Testing

```bash
npm run test:paddle           # pure: env separation, price map, seats, signature, policy
npm run test:paddle:webhook   # the real handler against the Firestore emulator
npm run test:rules:orgs       # organization read rules + paidAccess cannot be self-granted
npm run test:rules:storage    # the entitlement gate on the dataset bucket
```

The emulator suites need a JDK on the PATH:
`export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"`.

No test touches Paddle or performs a charge. Webhook bodies are signed locally
with a throwaway secret, exactly as Paddle signs them.

## Secrets

| Name | Where | Notes |
|---|---|---|
| `VITE_PADDLE_CLIENT_TOKEN` | build env | **Public by design.** Authorizes opening a checkout, not charging |
| `PADDLE_WEBHOOK_SECRET` | Google Secret Manager → mounted with `--set-secrets` | One per notification destination. Sandbox and live secrets are different and must never be shared |
| `PADDLE_API_KEY` | *not used* | The webhook needs no Paddle API access. Only add one if something genuinely has to *call* Paddle (e.g. minting portal URLs) |

The secret never appears in source, in a git-tracked env file, on a deploy
command line, or in logs. `deploy-paddle-webhook.sh` mounts it from Secret
Manager by name.

## Going live

In order. Do not skip ahead — steps 1–4 are safe today; step 6 charges real
customers.

1. **Deploy the webhook to sandbox** and point a sandbox Paddle destination at
   the printed URL:
   ```bash
   cd google_cloud_function && ./deploy-paddle-webhook.sh sandbox
   ```
2. **Verify with the Paddle simulator** (Developer tools → Simulations): send
   `subscription.created` and confirm a 200 plus a written `user.subscription`.
3. **Run a sandbox checkout end to end** with a test card, on a build carrying a
   `test_…` token.
4. **Wait for Paddle to approve the production domains.**
5. ~~**Fill in the live price ids**~~ — **done 2026-07-20.** All nine live EUR
   ids are in `src/config/paddleCatalogue.json` and mirrored into
   `google_cloud_function/paddle-catalogue.json`; `npm run test:paddle` pins them
   literally and fails on any drift or blank.
6. **Switch the sites to live** — the single action that turns real money on:
   replace the sandbox `VITE_PADDLE_CLIENT_TOKEN` in the production build env
   with the live token, deploy the webhook with `./deploy-paddle-webhook.sh live`
   against a live destination, and rebuild the market sites. Do the webhook
   FIRST: a live checkout with no webhook takes money and grants nothing.
7. **Give any ops/test account an entitlement** (admin assignment or free
   grant) before deploying the rules — there is no blanket bypass, so an
   approved-but-unpaid account will correctly lose catalogue access.

### Rollback

Each step is independently reversible:

- **Checkout** — unset `VITE_PADDLE_CLIENT_TOKEN` and rebuild. Every plan
  reverts to "coming soon"; nothing can be bought.
- **Webhook** — `gcloud functions delete paddleWebhook --gen2 …`. Entitlement
  writes stop and the app falls back to admin-assigned subscriptions, exactly as
  before this feature.
- **Enforcement** — restore the previous `storage.rules` and deploy; the bucket
  goes back to gating on approval alone.
- **Live → sandbox** — put the `test_…` token back and rebuild. The catalogue
  follows the token automatically.
