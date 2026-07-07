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
  `src/hpiq/i18n.ts` (main app, EN/DE dictionaries). Add strings to the matching one.
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

`scripts/bafa/`: `fetch-bafa-raw` → `parse-bafa-raw` → `build-master-seed` →
`build-app-products-from-master-seed` (auto-selects newest `data_sources/bafa/master_seed/YYYY-MM/`).
- `bafa_id` comes from BAFA raw (`anlagennummer`) and flows through automatically.
- Overlay source: `scraper/pricing/output/dataset-enriched-full.json` (installation_type,
  uuid — price fields are gone and guarded against; do not reintroduce).
- Diff reference baseline snapshot: `2026-03` (keep `data_sources/bafa/raw/2026-03` + `parsed/2026-03`).
- EPREL matching is **not yet implemented** (0 matches); energy-label classes are derived
  from BAFA ηs per EU 811/2013 and the data sheet says so — keep that honesty.
- **UK pipeline** (`scripts/ofgem/`): `fetch-pel-xlsx` → `parse-pel-xlsx` →
  `build-app-products-gb` (auto-selects newest `data_sources/ofgem_pel/parsed/YYYY-MM/`) →
  `public/data/products-gb.json`. PEL publishes no performance data (kW/COP/SCOP stay null
  until enrichment), Biomass is excluded, capacity segmentation is impossible → the GB
  commercial dataset is intentionally empty. PEL listing ≠ full BUS eligibility — keep the
  caveat. Brand short names: `scripts/ofgem/manufacturer-short-names-gb.json` (curated).
- Cloud Function (`google_cloud_function/index.js`) is deployed separately via its own
  `deploy.sh`; it owns the news pipeline.

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
- Build: `export PATH="/Users/christophersung/.nvm/versions/node/v20.19.6/bin:$PATH" && npm run build`
- Deploy: `firebase deploy --only hosting`
