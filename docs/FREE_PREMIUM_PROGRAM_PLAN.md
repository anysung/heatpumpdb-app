# Standard + Premium Program (plan, 2026-09-27)

Owner decision 2026-09-27: the service becomes **free by default**; a much
cheaper **Premium** subscription unlocks everything.

Naming (owner decision 2026-09-28): the free-of-charge tier is called
**"Standard"** in every piece of copy — never "Free". Pattern at first
mention: EN "Standard (free)", DE "Standard (kostenlos)", FR "Standard
(gratuit)", PL "Standard (bezpłatny)", IT "Standard (gratuito)", then just
"Standard". Premium plans stay Professional / Team 3 / Team 5. The trial is
a "15-day Premium trial", after which the account "continues on Standard".
Code identifiers are unchanged (tier values stay `'free'` / `'premium'`,
file names such as `free-tier-launch-notice.json` stay).

Welcome notice (owner decision 2026-09-28): every account activated WITH a
fresh trial receives a welcome mail from `finalizeSignup`
(`google_cloud_function_billing/welcomeMailCopy.js`; 15-day Premium trial
active, full app unlocked, end date, continues on Standard, no payment
method, nothing charged automatically). Fail-open and idempotent
(`welcomeMailSentAt` / `welcomeMailError` on the user doc). Status: PLAN — nothing
below is live except the Special Report menu split (code, not yet deployed)
and the new Paddle prices (created, not yet referenced by code).

## Tiers

| Area | Standard (free) | Premium |
|---|---|---|
| Find product (search) | ✓ | ✓ |
| Products — residential (≤ 23 kW), basic columns, listing status + id | ✓ | ✓ |
| Products — commercial (> 23 kW) | — | ✓ |
| Inspector basic specs (capacity, SCOP, class, refrigerant, listing) | ✓ | ✓ |
| Inspector full specs (COP A7/A2/−7, refrigerant kg, SG Ready, sound power …) | — | ✓ |
| Compare (up to 4) | — | ✓ |
| EU label records — view | ✓ | ✓ (full records + filters) |
| Data sheet studio — on-screen preview | ✓ | ✓ |
| Data sheet / label sheet PDF · print · share | — | ✓ |
| Subsidies page, funding guide, news, Market & Trends, installation videos | ✓ | ✓ |
| **Special Report** (own menu since 2026-09-27) | — | ✓ |
| Team management | — | Team plans |
| Concurrent active devices | 1 | 2 |

Enforcement must be server-side where data is involved: datasets split into
`basic` / `full` files (storage.rules: basic = any active account; full +
commercial = `isEntitled()`), each with its own canary. UI locks alone are
bypassable because the whole dataset lives on the device.

## Pricing (monthly / annual only — the 6-month term is retired)

| Plan | Monthly | Annual | Live price ids | Sandbox price ids |
|---|---|---|---|---|
| Professional | €9.90 | €99 | `pri_01m3h46e1q42yg7rt4rq0fn004` / `pri_01m3h46e2xsenv086wg3h2k04t` | `pri_01m3h4754c2s68w460vnd7cpz4` / `pri_01m3h475d9r9kt9sv4cwfwt5ff` |
| Team 3 | €24.90 | €249 | `pri_01m3h46e42h9b3077z9j63tgrq` / `pri_01m3h46e58n1e935wb88vnwcwz` | `pri_01m3h475q5q01jrzrw8xjj4hza` / `pri_01m3h475zgd1fnznkxb97en0xr` |
| Team 5 | €39 | €390 | `pri_01m3h46e6jg424g9txe6m5ta8w` / `pri_01m3h46e84mkaxbxkcvqgdg7qm` | `pri_01m3h4767dnyesd7aqhx94e9kq` / `pri_01m3h476fvzz7m22wfja8ypets` |

All EUR, VAT-exclusive (`tax_mode: external`), quantity 1, **no Paddle
trial**, `custom_data.program = "2026-10-free-tier"`. Created 2026-09-27 in
both catalogues. The old nine prices stay ACTIVE until the code switch ships;
archive them afterwards (never before — live checkout references them).
Live Paddle had exactly one subscription (a go-live test, canceled
2026-08-03) — there are no paying subscribers to migrate.

## Trial

15-day Premium trial at signup stays (one per email, emailRegistry). On expiry
the account continues on **Standard**, not on a lock screen. `accessUntilTs` then means
"Premium until", no longer "access until". `runTrialReminders` copy must change
accordingly ("continues on Standard", not "access closes").

## Existing members (2026-09-27 count, excl. admin + e2e)

9 accounts: 3 trial running, 4 trial expired never subscribed, 2 suspended,
0 paid, 0 grants. **0 have `marketingConsent`** — the launch mail goes out as
a factual service notice (account now has Standard, free of charge) to the 7 active
accounts, never as marketing; suspended accounts are excluded.

## Scraping notice (owner wording, 2026-09-27)

Small notice in the footer and under every data view (search results,
product list, label list, data sheet): "Data served by this site is protected
with encryption and access control; an unauthorised-use detection system is
in operation." Accurate as stated: TLS + auth-gated bucket, and the canary
records are exactly such a detection system (never name or describe them).

## Special Report

In-app: own menu (`report`), fed by `/special-report/feed.json` from
build-special-report.mjs; News leaves the SR announcements out
(`isSpecialReportItem`). Premium lock arrives with the tier layer. OPEN: the
report HTML is still public on hosting (`/special-report/<ed>/report.html`) —
Premium needs the file behind auth from the next edition on; the public
article page stays as the teaser.

## Phases

P0 decisions · P1 dataset split + gate + canaries · P2 rules + client tiers +
upgrade prompts + trial→Standard + 1-device Standard + notice · P3 price-id switch +
i18n + terms/legal + archive old prices · P4 launch (never on the 1st —
monthly window) + service-notice mail.

## Launch runbook (before 2026-10-01 00:00 Berlin — never inside the monthly window)

Order matters: rules first (old clients keep working — full objects keep
`isEntitled`), then the function, then the data, then the clients.

1. Rules: `npx firebase deploy --only firestore:rules,storage --project gen-lang-client-0324244302`
2. Billing function: `cd google_cloud_function_billing && ./deploy.sh && cd ..`
   (update-env-vars only; copies canary + datasetBasicFields.json)
3. Datasets (full + basic, gate runs inside): `node scripts/upload-datasets.mjs`
   then `node scripts/dataset-gate.mjs --approve` and `node scripts/verify-serving.mjs`
4. Hosting: `npm run deploy:de && npm run deploy:uk && npm run deploy:fr && npm run deploy:pl && npm run deploy:it && npm run deploy:admin && npm run deploy:eu`
5. Paddle: archive the nine old prices (only after step 4 is live).
6. Service notice (owner confirms first): admin bulk mailer, kind `notice`,
   audience `active`, copy in google_cloud_function_billing/mail-assets/free-tier-launch-notice.json.
7. From the October edition on: `node scripts/upload-special-report.mjs --edition 2026-10`
   before the site build that publishes its article page.

## Live checkout test (2026-09-28) — PASSED, cleaned up

Owner test account (DE) bought Professional monthly (new price
`pri_01m3h46e1q42yg7rt4rq0fn004`) with a 100% recurring coupon
(`HPDBTEST100`, `dsc_01m3jjaypcdb0y4cafr6a7at7v`): transaction
`txn_01m3jjq3fbvzp97z77r73ybrmz`, €0.00 incl. 19% VAT line, Paddle receipt +
tax invoice received. Webhooks `subscription.created` / `.activated` /
`transaction.completed` processed with no error; the profile got
`subscription = professional / monthly / active` and `accessUntilTs` extended
to the period end — new price ids resolve correctly end to end.
Cleanup: subscription `sub_01m3jjz24kb5msscw9k70n617n` canceled immediately
(webhook recorded `canceled`), coupon archived; 0 active subscriptions remain.
Per the fail-open rule the canceled test account keeps Premium until
2026-10-27 (natural expiry), then drops to Standard.
Lesson: a test coupon must be `recur: true` with no interval cap — a
first-payment-only 100% coupon leaves a real renewal charge scheduled.
