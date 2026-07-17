# HeatPump DB — Project Rules

> **Brand (Jul 2026):** The app brand is **"HeatPump DB"** (capital P, one space before "DB").
> Never introduce the old "HeatpumpIQ" name in UI text. Logo: use `BrandLogo` /
> `WavingFlag` from `src/components/BrandLogo.tsx` (brand assets in `brand-assets/`,
> colors documented in `brand-assets/README.md`).
> **The artwork has ONE source: `src/components/brandSvg.ts`.** The React
> components and the PDF data sheet (`hpiq/pdf/brandArtwork.ts` rasterizes the
> same SVGs at print resolution) both read from it. NEVER redraw the mark or the
> flag by hand for a new surface — that is exactly how the PDF ended up with a
> different circle and a square flag (Jul 2026). The flag is a **waving cloth**,
> never a rectangle. Documents render it with `animated={false}`.

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
  `src/hpiq/i18n.ts` (main app: EN/DE + GB + FR_FR/FR_EN + PL_PL/PL_EN market dictionaries). Add
  strings to the matching one. The GB edition is English-only and always serves the
  GB dictionary — the DE dictionary is Germany-market *content*, not a translation.
- Country-specific UI semantics in hpiq go through `src/hpiq/market.ts` (derived from
  `ACTIVE_COUNTRY`): registry id prefix (BAFA/MCS), verify URLs, funding source links,
  UI languages. Do not scatter `code === 'GB'` checks across pages.
- Country config is centralized in `src/config/countryProfiles.ts` (`ACTIVE_COUNTRY`,
  resolved from `VITE_COUNTRY_CODE`). New-country work goes there — flag, dataset paths,
  subsidy labels all derive from it. Do not scatter country logic.
- Product data is built to `public/data/*.json` (gitignored) but is **NOT served
  publicly** (anti-scraping, Jul 2026): hosting deploys exclude `data/**`
  (firebase.json) and the app downloads datasets through the Firebase Storage
  SDK from the auth-protected bucket `gs://heatpumpdb-datasets`
  (`storage.rules`: approved accounts only; dev server still reads the local
  files). Ship datasets with `node scripts/upload-datasets.mjs` — it appends
  ONE fictitious CANARY record per file (`scripts/canary/canary-records.json`,
  honeytokens proving extraction; keep ids stable, never mention them publicly).
  The shrink guard reads live counts from the bucket via gcloud and subtracts
  the canary. robots.txt disallows `/data/` and opts out AI-training crawlers.
  **App Check** (reCAPTCHA Enterprise, `VITE_RECAPTCHA_SITE_KEY`) is initialized
  in `src/firebase.ts` and ENFORCED on Cloud Storage — raw scripts cannot read
  the datasets even with a stolen user token. Firestore is intentionally
  UNENFORCED (login safety); e2e tests use a registered debug token via
  `window.FIREBASE_APPCHECK_DEBUG_TOKEN` (dev server auto-generates one).
- Registration consent: every signup path (form + first-time social) must pass
  the account/data-use terms popup (one account per person; no data
  extraction) — `termsAcceptedAt` is stamped on the profile. The same terms
  are displayed on the Account page above the legal notice. Do not remove
  either without owner sign-off.
- hpiq global nav is **60px** tall; pages size themselves with `calc(100vh - 60px)` —
  keep in sync if the header changes.
- **Print / PDF: we GENERATE a real PDF — never print the DOM.** Both the Print and
  PDF buttons go through `src/hpiq/pdf/dataSheetPdf.ts` (jsPDF: exact A4, own
  margins/pagination/watermark) + `deliverPdf.ts` (mobile → OS share sheet, which is
  the only way to get a PDF on iOS; desktop → PDF opens with its print dialog, or
  downloads). DOM printing was tried every way and CANNOT work cross-device: WebKit
  (iOS Safari, iPhone *and* iPad) lays print out against the meta-viewport width, not
  the paper, and ignores `@page { margin }` → clipped, edge-to-edge sheets; a web page
  cannot force the print dialog's margins/scale and iOS has no margin controls. Do not
  reintroduce `window.print()` on the document.
  jsPDF's standard font is WinAnsi — keep `ascii()` in dataSheetPdf.ts (folds `η`→
  `eta-s` and U+2212 `−`→`-`, etc.), or DE/FR sheets get mojibake.

## 2. Data Pipeline (BAFA → app)

**Regular updates run through `node scripts/update-all.mjs`** (dependency-graph
orchestrator: DE first, then FR/GB/PL derive from the built DE datasets; optional
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
- **UK pipeline** (`scripts/ofgem/`) — **canonical baseline + PEL listing overlay
  (v3.0, Jul 2026; `docs/CANONICAL_TECHNICAL_BASELINE_AND_LOCAL_MARKET_OVERLAY.md`)**:
  `fetch-pel-xlsx` → `parse-pel-xlsx` → `match-canonical-to-pel` → `build-app-products-gb`.
  The UK catalogue IS the canonical (DE-derived) catalogue — run the DE builder first.
  The Ofgem PEL is an **overlay only**: it confirms listing, and never creates a
  product, supplies a spec, changes a capacity/segment, or removes a product when a
  match fails. The PEL publishes NO performance data, which is exactly why it can
  never be a technical source: the old PEL-first build (v2.1) published 4,422 PEL rows
  and left 2,134 of them with no capacity, no segment and a blank data sheet.
  Listing states: `confirmed` → "PEL Listed" + PEL id; `review_required` (was
  confirmed, stopped matching — a matcher regression is likelier than a delisting) and
  everything else → **"PEL verification required"**. **Never "Not on PEL"** — a failed
  match is a fact about our matching, not about the list. Only a market that OWNS its
  registry (DE) may say "not listed". Confirming evidence: exact model, approved alias,
  exact component identity — never fuzzy, never an ODU-only overlap (those go to a
  review queue). Confirmed mappings persist in the committed
  `data_sources/ofgem_pel/pel-match-history.json`. Official manufacturer mappings enter
  via `data_sources/manufacturer_cross_reference/canonical-to-pel.json` (no code change).
  The old PEL-first matchers live in `scripts/ofgem/internal/` — audit only, never wire
  them back into a builder.
- **PL pipeline** (`scripts/pl/`) — canonical baseline + **Lista ZUM listing overlay**
  (PEL rules verbatim): `fetch-zum.mjs` (public grid + detail pages, facts only, no
  attachments, ≥1.5s politeness) → `parse-zum.mjs` → `match-canonical-to-zum.mjs` →
  `build-app-products-pl.mjs`. Confirming methods only (manufacturer_official,
  eprel_exact/bridge, exact model/code, capacity-resolved identity, registry-published
  alias); fuzzy/family/ODU-only never confirm. States: `confirmed` → "Na liście ZUM" +
  ZUM id; everything else → "Weryfikacja ZUM wymagana" — **never "not on ZUM"**.
  Confirmed mappings persist in committed `data_sources/lista_zum/zum-match-history.json`;
  official mappings enter via `data_sources/manufacturer_cross_reference/canonical-to-zum.json`.
  PL additionally publishes **spec-complete PL-market extension records** (ZUM entries
  with no canonical counterpart, mostly DHW): `performance_source='ZUM_REGISTRY'`,
  `source_id 'PL-<zum id>'`, admitted ONLY through the shared Data-Sheet eligibility
  rule — never a weaker standard, and they never travel to other markets. ZUM data is
  used facts-only (no IOŚ-PIB logo/branding; source attribution + snapshot dates shown).
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
  (`MARKETS`: DE + FR + GB + PL → `countries/<code>/news|policies`); a manual run can be
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

- **Canonical baseline + local overlay (permanent — `docs/CANONICAL_TECHNICAL_BASELINE_AND_LOCAL_MARKET_OVERLAY.md`).**
  Every country publishes the SAME canonical technical products (the German dataset,
  presented neutrally). A local registry is only ever a listing OVERLAY:
  canonical → match → attach status. Never local-registry-first with specs
  reconstructed afterwards. Public products must pass ONE shared Data Sheet
  eligibility rule (`scripts/lib/data-sheet-eligibility.mjs`: manufacturer, model,
  canonical id, type, ηs, a rated capacity, a segment, and ≥2 of 5 measured fields) —
  applied in the DE canonical builder, inherited by every market.
- **Datasets are generated, then GATED, then published.** `node scripts/dataset-gate.mjs`
  compares the candidate with the committed `data_manifests/production.json` and blocks
  a bad update (zero/truncated parse, count or eligibility collapse, duplicate ids,
  local-match collapse, segment shift, German status fields outside Germany).
  `upload-datasets.mjs` runs it and refuses to publish if it fails; override needs
  `--override --reason="…"` and is recorded. After a successful upload:
  `node scripts/dataset-gate.mjs --approve`.
- **Segmentation + European presentation (permanent — `docs/EUROPE_DATA_AND_PRODUCT_SEGMENTATION_PRINCIPLES.md`).**
  The residential/commercial split is the app's OWN rule, identical in every country:
  rated capacity **≤ 23 kW residential, > 23 kW commercial** (never `>=`), missing
  capacity → **unclassified** (never silently residential). One source:
  `src/config/segmentation.ts`; the whole pool is re-split at load time because the
  dataset FILES are split by source, not capacity (that is why UK Commercial was
  empty). The capacity the UI shows/sorts/filters is the same one the split uses
  (`HpVM.ratedKw`). **The word "BAFA" — and the source country — may appear only on
  the German site**; elsewhere records are "European reference" (provenance stays
  internal). Local listing status comes only from the market's OWN list via
  `src/hpiq/listing.ts` (DE→BAFA, GB→PEL, FR→none; never inferred across markets),
  and a filter is offered only where it actually divides the catalogue
  (`searchCapabilities.localListingFilter`). Tests: `tests/segmentation.unit.mjs`,
  `tests/products-segmentation.e2e.mjs` (fails if BAFA appears on GB/FR pages).
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
  `npm run deploy:pl` → `heatpumpdb-pl` (www.heatpumpdb.pl);
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
