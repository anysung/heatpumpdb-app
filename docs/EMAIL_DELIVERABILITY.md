# Email deliverability — heatpumpdb.* (2026-11-08)

Scope: HeatPump DB domains only. heatpumpfinder.* is a separate project and is
not touched here.

## What sends mail

All automated mail leaves through Zoho SMTP (`smtppro.zoho.eu:465`) as
`support@heatpumpdb.eu` — SPF/DKIM aligned on heatpumpdb.eu:

- billing function (`google_cloud_function_billing/index.js`): verification,
  welcome, trial reminders, member/bulk mail, partner documents
- `scripts/send-watchlist-alerts.mjs`
- Firebase Auth's own fallback mail: `CUSTOM_SMTP` → same Zoho relay, sender
  `support@heatpumpdb.eu` (checked 2026-11-08 in the Identity Toolkit config).
  It does NOT go out from firebaseapp.com, and %APP_NAME% in its subject is the
  public-facing name "HeatPump DB". What is still not ideal: the link host is
  `gen-lang-client-0324244302.firebaseapp.com`. Firebase refuses template edits
  through the API (`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`).

No other domain (heatpumpdb.uk/.fr/.de/.pl/.it) sends mail.

## Done

| Date | Change |
|---|---|
| 2026-11-08 | heatpumpdb.uk (Cloudflare) locked: `v=spf1 -all`, Null MX `0 .`, `*._domainkey` empty key, DMARC `p=reject; sp=reject; adkim=s; aspf=s` |
| 2026-11-08 | Marketing (announcement) mail: HTTPS `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058), footer link in text + HTML; endpoint `/unsubscribe` on the billing function (GET = confirm page, never writes; POST = clears `marketingConsent`, audited). Test: `tests/unsubscribe.unit.mjs` |

## Owner checklist (no API access from the repo)

### 1. Firebase public-facing name — already `HeatPump DB` (checked 2026-11-08)
%APP_NAME% therefore renders as "HeatPump DB"; nothing to do. Only the link
host (firebaseapp.com) remains — see "Later".

### 2. heatpumpdb.eu — Namecheap → Advanced DNS
Keep DMARC at `p=none` for now (2–4 weeks of reports first).

| Type | Host | Value |
|---|---|---|
| TXT | `*._report._dmarc` | `v=DMARC1` |

If Namecheap refuses the wildcard, add one record per domain instead:
`heatpumpdb.uk._report._dmarc`, `heatpumpdb.fr._report._dmarc`,
`heatpumpdb.de._report._dmarc`, `heatpumpdb.pl._report._dmarc`,
`heatpumpdb.it._report._dmarc` — each `v=DMARC1`. Without it, receivers drop
the DMARC reports of the other five domains (they point at support@heatpumpdb.eu).

### 3. Lock the non-sending domains — same four records each
heatpumpdb.fr, heatpumpdb.de (Namecheap), heatpumpdb.pl (OVH), heatpumpdb.it (Aruba):

| Type | Host | Value |
|---|---|---|
| TXT | `@` | `v=spf1 -all` |
| MX | `@` | `.` priority `0` (Null MX) — on Namecheap: Mail Settings → Custom MX |
| TXT | `*._domainkey` | `v=DKIM1; p=` |
| TXT | `_dmarc` (replace existing) | `v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s; rua=mailto:support@heatpumpdb.eu` |

Leave the A/CNAME, `hosting-site=` and `google-site-verification=` records alone.
**heatpumpdb.it**: has Aruba's default MX `mx.heatpumpdb.it`. Only replace it with
Null MX if no Aruba mailbox is in use. If a registrar refuses `.` as MX, simply
delete the MX records — SPF `-all` + DMARC reject still block spoofing.

### 4. After 2–4 weeks of reports (heatpumpdb.eu)
Only Zoho should appear as a legitimate source. Then:
`p=quarantine; pct=25` → `pct=100` → `p=reject`. If Paddle or another service
shows up sending as @heatpumpdb.eu, add its SPF include / DKIM first.

### 5. Google Postmaster Tools
Register heatpumpdb.eu (DNS TXT verification). Keep the spam-complaint rate
under 0.1 %, never above 0.3 %.

## Later (when volume grows)
- Transactional mail (verification, billing, watchlist) via ZeptoMail/Postmark as
  `noreply@heatpumpdb.eu`; marketing on a subdomain (`news.heatpumpdb.eu`) with a
  campaign tool. Zoho Mail is a person's mailbox, and a spam complaint against a
  marketing mail drags support mail down with it.
- Firebase action links on our own host: set the Auth `callbackUri` to
  `https://heatpumpdb.eu/__/auth/action` (the handler already answers 200 there).
  Affects verification + reset links for every market, so test with the
  e2e-verify account before switching.

## Verify
`dig +short TXT _dmarc.<domain>`, `dig +short MX <domain>`; mail-tester.com from
support@heatpumpdb.eu; Gmail "Show original" → SPF/DKIM/DMARC PASS.
