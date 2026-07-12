# HeatPump DB — Project Rules

> **Brand (Jul 2026):** The app brand is **"HeatPump DB"** (capital P, one space before "DB").
> Never introduce the old "HeatpumpIQ" name in UI text. Logo: use `BrandLogo` /
> `WavingFlag` from `src/components/BrandLogo.tsx` (brand assets in `brand-assets/`,
> colors documented in `brand-assets/README.md`).

> **UI (Jul 2026):** The user-facing app is the **hpiq** design (`src/hpiq/`, spec in
> `design_handoff_heatpumpiq/README.md` — authoritative UI spec). The legacy components
> (`HeatPumpApp.tsx`, `ResultsTable.tsx`, `NewsView.tsx`, etc.) were **removed** in the
> Jul 2026 cleanup; their layout rules no longer apply. The Admin dashboard lives in
> `src/components/admin/` + `AdminDashboard.tsx`.

---

## 1. Architecture Facts

- Entry: `src/index.tsx` → `src/App.tsx`. Views: auth surface (`src/components/auth/AuthShell.tsx`),
  main app (`src/hpiq/HpiqApp.tsx`), admin (`src/components/AdminDashboard.tsx`).
- Two parallel i18n systems, both live: `src/translations.ts` (auth + admin) and
  `src/hpiq/i18n.ts` (main app, EN/DE dictionaries + a GB market dictionary). Add
  strings to the matching one. The GB edition is English-only and always serves the
  GB dictionary — the DE dictionary is Germany-market *content*, not a translation.
- Country-specific UI semantics in hpiq go through `src/hpiq/market.ts` (derived from
  `ACTIVE_COUNTRY`): registry id prefix (BAFA/MCS), verify URLs, funding source links,
  UI languages. Do not scatter `code === 'GB'` checks across pages.
- Country config is centralized in `src/config/countryProfiles.ts` (`ACTIVE_COUNTRY`,
  resolved from `VITE_COUNTRY_CODE`). New-country work goes there — flag, dataset paths,
  subsidy labels all derive from it. Do not scatter country logic.
- Product data is loaded from static JSON: `public/data/products.json` and
  `public/data/products-commercial.json` (gitignored; rebuilt by pipeline before deploy).
- hpiq global nav is **60px** tall; pages size themselves with `calc(100vh - 60px)` —
  keep in sync if the header changes.
- Printing: hpiq data sheet uses `body.hpiq-printing` + `.hpiq-print-doc` visibility
  rules in `src/hpiq/hpiq.css`. The legacy print block in `src/index.css` is scoped to
  `body:not(.hpiq-printing)` — do not unscope it (it blanks hpiq print/PDF output).

## 2. Data Pipeline (BAFA → app)

**Regular updates run through `node scripts/update-all.mjs`** (dependency-graph
orchestrator: DE first, then FR/GB derive from the built DE datasets; optional
matcher overlays; freshness + shrink-guard verification; `--deploy` ships all
sites in one atomic call). Never hand-run builders for production updates —
see `docs/UPDATE_PIPELINE.md` for the graph, schedule (monthly, 2nd, 03:00
Europe/Berlin, attended) and the country-expansion checklist.
`build-master-seed` is SELF-ACCUMULATING: it unions previous master seeds so
cleaning parsed/raw folders never drops products (regression 2026-07-12).

`scripts/bafa/`: `fetch-bafa-raw` → `parse-bafa-raw` → `build-master-seed` →
`build-app-products-from-master-seed` (auto-selects newest `data_sources/bafa/master_seed/YYYY-MM/`).
- `bafa_id` comes from BAFA raw (`anlagennummer`) and flows through automatically.
- Overlay source: `scraper/pricing/output/dataset-enriched-full.json` (installation_type,
  uuid — price fields are gone and guarded against; do not reintroduce).
- Diff reference baseline snapshot: `2026-03` (keep `data_sources/bafa/raw/2026-03` + `parsed/2026-03`).
- EPREL matching (DE): `match-bafa-to-eprel` attaches `eprel_registration_number` as a
  **link only** — no performance values are copied; energy-label classes stay derived
  from BAFA ηs per EU 811/2013 and the data sheet says so — keep that honesty.
- Raw snapshot folders may be cleaned from disk; per-snapshot fetch timestamps are
  accumulated in the committed `data_sources/bafa/fetched-at-index.json` (the builder
  merges live `raw/_meta.json` values over it and writes it back — do not gitignore it).
- **UK pipeline** (`scripts/ofgem/`): `fetch-pel-xlsx` → `parse-pel-xlsx` →
  `match-pel-to-bafa` + `match-pel-to-eprel` (optional overlays) → `build-app-products-gb`
  (auto-selects newest `data_sources/ofgem_pel/parsed/YYYY-MM/`) →
  `public/data/products-gb.json` + `products-commercial-gb.json`. PEL publishes no
  performance data; one performance source per record, never mixed:
  `performance_source='BAFA_REFERENCE'` (German registry cross-reference — say so in UI)
  takes precedence, else `'EPREL'` (official EU label data: ηs, design output, sound
  power; SCOP/COP are NOT on EPREL and must not be derived). `eprel_registration_number`
  is set on every EPREL match regardless. Unmatched records keep null performance fields
  and stay residential with `market_segment` null. Biomass is excluded.
  **GB split catalogue (v2.1)**: residential = ALL PEL records
  (`bafa_listing_status='listed_in_snapshot'` → "On Ofgem PEL"); commercial = the
  European (DE-derived) COMMERCIAL catalogue only (`'not_in_latest_snapshot'` →
  "Not on PEL", full specs as BAFA_REFERENCE, English type labels; PEL-matched
  bafa_ids excluded). Derived RESIDENTIAL records are never exported — unmatched PEL
  and European records can be the same hardware and would double-count. Run the DE
  builder before the GB builder. BUS funding requires a PEL-listed product — keep that
  caveat. Matching is
  conservative: brand-gated token-sequence matching only, never plain substring
  (false variant matches like "WPL 25 AS" vs "WPL 25 A"); multi-candidate accepted only
  with identical copied values. PEL listing ≠ full BUS eligibility — keep the caveat.
  Brand short names: `scripts/ofgem/manufacturer-short-names-gb.json` (curated).
- **FR pipeline** (`scripts/fr/`): `build-app-products-fr.mjs` derives the France
  catalogue from the **built DE datasets** (same hardware sold in both markets — run the
  DE builder first) → `public/data/products-fr*.json`. German type strings are localised
  (Luft/Wasser → Air/Eau); specs are framed as `performance_source='BAFA_REFERENCE'`.
  MaPrimeRénov'/CEE are **criteria-based** — the app never claims eligibility. NF PAC
  references come from an optional overlay (`data_sources/nf_pac/matching/`) and are
  shown ONLY on confident matches — never guessed. FR UI is bilingual FR|EN
  (FR_FR/FR_EN dictionaries in `src/hpiq/i18n.ts`).
- Cloud Function (`google_cloud_function/index.js`) is deployed separately via its own
  `deploy.sh`; it owns the news pipeline. News/policies are market-parameterized
  (`MARKETS`: DE + FR + GB → `countries/<code>/news|policies`); a manual run can be
  narrowed with `?newsOnly=true&countries=GB`. GB articles are English-only (no `_de`
  fields); FR articles carry `_fr` fields.
  News is **append-only** (press-agency format, byline "HeatPump DataBase (Europe)",
  date-based ids `news-YYYYMMDD-<cc>-NNN`) — never reintroduce collection deletion for
  news; policies are still replaced each run. The app shows a searchable archive of all
  past articles and `/?article=<id>` share deep links.
  Redeploying with plain `gcloud functions deploy` (no env flags) preserves the
  function's env vars; `deploy.sh` overwrites them — only run it with real secrets exported.

## 3. Market News Image Rules (google_cloud_function/index.js)

- **Every news article must always display an image** — never leave the image slot empty.
- **Never let AI (Gemini) generate or hallucinate image URLs** — assign images by keyword
  matching (`selectNewsImage(title, summary)` with `NEWS_IMAGE_RULES` priority list) from
  the curated Unsplash `NEWS_IMAGES` set in `index.js`.
- The hpiq NewsPage renders `imageUrl` assigned at write time by the function.

## 4. General Rules

- Refrigerant filtering always uses `.includes()` contains logic (values like
  `R290(estimated)` must match), never exact match.
- Auth flow is approval-gated: registration (email or Google/Apple social) creates a
  `pending` profile; only admin approval activates it. Social sign-in must never bypass
  this gate.
- Build: `export PATH="/Users/christophersung/.nvm/versions/node/v20.19.6/bin:$PATH" && npm run build:de` (DE, `dist/`)
  or `npm run build:uk` (GB, `VITE_COUNTRY_CODE=GB` → `dist-uk/`).
- Deploy: multi-site hosting — **always use a named target**, never bare
  `firebase deploy --only hosting` (it deploys every target).
  `npm run deploy:de` → site `gen-lang-client-0324244302` (heatpumpdb.de);
  `npm run deploy:uk` → site `heatpumpdb-uk`; `npm run deploy:fr` → `heatpumpdb-fr`;
  `npm run deploy:admin` → `heatpumpdb-hub` (unified ops console, noindex,
  VITE_APP_MODE=admin, admin-role gate — heatpumpdb.click attachable later).
  Targets are mapped in `.firebaserc`; per-target config in `firebase.json`.
- Billing is web-only via Paddle (merchant of record) — no app-store
  distribution. **Subscription program (Jul 2026): Professional / Team 3 /
  Team 5 × monthly / 6 months / annual** — single source of truth is
  `src/config/subscriptionPlans.ts` (prices VAT-excl, 7-day trial on every
  Paddle price, per-term price ids via `VITE_PADDLE_PRICE_*`; unset =
  'coming soon'). Operating rules: plan/term/seats are FIXED during a paid
  period — changes apply at the NEXT RENEWAL only (`subscriptionChangeRequests`,
  applied from the admin Billing page); team member replacement is always
  allowed and never touches Paddle; team trials are anchored to the admin's
  checkout (one end date per org). Entitlements (`user.subscription`) are
  written ONLY by the billing webhook, an admin, or the rules-validated
  free-grant redemption — never plain client code. Teams live in
  `organizations` (owner manages seats, never plan/seatLimit); free
  promotions in `freeAccessGrants` (admin Billing page registers email +
  plan + period → account auto-approves and gets the plan at registration
  or immediately if it exists).
- Admin console: unified Overview = live per-market status + action alerts;
  the actual work (approvals, support, subscriptions) happens in per-market
  workspaces and the Billing page. Admin UI languages are **EN | KO only**
  (adminI18n.ts, sidebar text buttons) — never reintroduce German there.
