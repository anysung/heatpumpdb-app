# Free + Premium Program (plan, 2026-09-27)

Owner decision 2026-09-27: the service becomes **Free by default**; a much
cheaper **Premium** subscription unlocks everything. Status: PLAN — nothing
below is live except the Special Report menu split (code, not yet deployed)
and the new Paddle prices (created, not yet referenced by code).

## Tiers

| Area | Free | Premium |
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
the account drops to **Free**, not to a lock screen. `accessUntilTs` then means
"Premium until", no longer "access until". `runTrialReminders` copy must change
accordingly ("moves to Free", not "access closes").

## Existing members (2026-09-27 count, excl. admin + e2e)

9 accounts: 3 trial running, 4 trial expired never subscribed, 2 suspended,
0 paid, 0 grants. **0 have `marketingConsent`** — the launch mail goes out as
a factual service notice (account now has Free access) to the 7 active
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
upgrade prompts + trial→Free + 1-device Free + notice · P3 price-id switch +
i18n + terms/legal + archive old prices · P4 launch (never on the 1st —
monthly window) + service-notice mail.
