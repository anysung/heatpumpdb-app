# Heatpump Data Base — Development Resumption Report

**Date:** 2026-06-12 · **Reviewed commit:** `85142cc` (2026-04-14) · **Build status:** ✅ passes (`vite build`, 3.0s, 348 KB gzip)

> **Historical snapshot — superseded on payments (2026-07-19).** This report is
> kept as the record of what was true in June 2026 and is deliberately not
> rewritten. One recommendation is now wrong: it proposes **Stripe** checkout and
> webhooks (§ "Must-haves", Phase 3, Tier 1 item 5, and the BillingPage row in
> the file table). The project chose **Paddle** as merchant of record instead —
> Paddle handles EU VAT and invoicing, which Stripe would have left to us.
> Read every "Stripe" below as "Paddle", and see
> [PADDLE_BILLING.md](./PADDLE_BILLING.md) for what actually exists: checkout,
> the billing webhook, the entitlement policy and the seat model.
>
> Also since superseded: payments are no longer "zero integration code", and the
> pricing engine described here was **removed** in 2026-07 (`068e3ae`) — price
> logic is permanently out of the product.

---

## A. Executive Verdict

The app is a **functional, well-engineered Germany-only MVP — roughly "private beta" maturity — that is not yet a commercially usable subscription product.** The strongest assets are unusual for a project at this stage: a complete official BAFA dataset (6,514 air/water units, 100% coverage), a documented 5-stage data pipeline with per-field confidence scoring, a disciplined pricing engine (v3, calibrated against 168 market samples, ±15% display band already implemented per prior feedback), and a working 10-page admin console with an enforced approval gate. The decisive gaps are: **no payment processing** (billing is scaffolded only), **no automated update pipeline** (everything is manual scripts; the Cloud Function auto-updater is deliberately disabled and architecturally disconnected from the app's static-JSON data path), **no EPREL/EU-label integration**, **no per-product subsidy evidence/source metadata**, and **data freshness drift** (dataset generated 2026-03-21, now ~3 months old, contradicting the "monthly update" promise). Recommendation: **Build — resume with narrowed Germany-first scope** (see §N).

---

## B. Current Implementation Status

### Architecture
- **Frontend:** React 18 + Vite + Tailwind, state-based routing (no router), ~280 KB of source. Deployed via Firebase Hosting.
- **Backend:** Firebase Auth + Firestore (users, quotas, logs, `countries/DE/{news,policies,bafa}`, metadata). One Google Cloud Function (`autoUpdateDatabase`, Gemini 2.5 Flash + Search grounding) — **disabled** (`AUTO_UPDATE_ENABLED=false`; scheduler calls rejected at [index.js:495-497](google_cloud_function/index.js#L495)).
- **Data pipeline (offline, manual):** `bafa-scraper.cjs` → `run-pricing.cjs` → `build-dataset.cjs` → `enrich-physical-specs.cjs` → `consolidate-datasets.cjs` → `public/data/products.json`.
- **Product data served as static JSON**, not Firestore: 4,387 residential + 2,127 commercial records, 73 fields each.

### What actually works (verified in code)
- 6-tab app: Search, Comparison (max 4), Data Sheet (print/quota-gated), News, Policy, BAFA links. Residential/Commercial segment switcher.
- Auth with enforced admin-approval gate (pending → active/rejected/suspended lifecycle); Firestore rules back this server-side.
- Plan model (Standard 20 prints/mo, Premium 100 + Industry Insight), quota metering on print, admin bonus quota.
- Admin console: 9 of 10 pages fully functional (Members CRUD, Usage, Audit w/ Excel export, Analytics, Compliance deletion workflow, etc.). Billing page is a non-functional scaffold.
- EN/DE i18n, complete coverage (~140 keys).
- Pricing engine with confidence scoring, market segmentation, package-scope classification, calibration, review flags.

### What is planned-only / disconnected / stubbed
| Item | State |
|---|---|
| Payments (Stripe/App Store/Play) | Scaffolded UI only; zero integration code |
| Monthly auto-update | Cloud Scheduler job exists but rejected by function flag; app reads static JSON the function never touches |
| Gemini product research (Cloud Function) | Writes to Firestore `countries/DE/products` which **the app does not read** — dead path, and conflicts with "BAFA is source of truth" |
| EPREL / EU label | No code anywhere; only incidental EPREL URLs inside `website` field |
| Password reset | Hardcoded `alert()` stub ([App.tsx:203](src/App.tsx#L203)) |
| Admin roles (admin/support/ops) | Defined in config, not enforced — only `owner` works |
| Admin password | localStorage, default `'10041004'` ([authService.ts:56](src/services/authService.ts#L56)) — not real auth |
| Manual pipeline run buttons (DataOps page) | Disabled |
| BAFA `_enrichment` placeholders | All null, superseded — dead schema |

**Maturity classification: advanced MVP / private-beta.** Not prototype (real data, real auth, real quota enforcement), not commercial (no payments, no automated freshness, security gaps).

---

## C. Feature Completion Table

| Feature | Status | Completion | Notes |
|---|---|---|---|
| Product DB search | ✅ Working | 90% | Static JSON, config-driven filters; residential + commercial |
| Manufacturer/model filtering | ✅ Working | 90% | Badge filters + text search; manufacturer list hardcoded in `searchConfig.ts` |
| Country-based data structure | ⚠️ Partial | 30% | Firestore path `countries/DE/*` exists, but `'DE'` hardcoded ([dbService.ts:6](src/services/dbService.ts#L6)); product JSON has no country field |
| Product detail pages | ⚠️ Partial | 50% | No dedicated detail page; detail exists via comparison + datasheet |
| BAFA subsidy eligibility display | ⚠️ Implicit only | 40% | Whole dataset *is* the BAFA eligible list, so presence = eligible — but never stated per-product; no eligibility badge, date, or evidence; BAFA tab is just external links |
| EPREL / EU label readiness | ❌ Not started | 5% | EPREL URLs incidentally present in some `website` fields |
| Comparison (max 4) | ✅ Working | 95% | 12 fields, min 2 / max 4 |
| Data sheet generation/export | ✅ Working | 85% | Print-to-PDF via browser; quota-gated; BAFA-only fields; no true PDF file export |
| News/regulation/tech feeds | ✅ Working | 80% | Firestore-fed; Gemini-generated upstream; curated image system per CLAUDE.md rules |
| Monthly update pipeline | ❌ Manual only | 25% | 5 manual scripts + manual deploy; auto-updater disabled and wrong-pathed |
| AI market/regulatory content | ⚠️ Built, disabled | 60% | Cloud Function works when manually triggered with API key; budget-capped ($14/run) |
| Admin / data management | ✅ Working | 85% | 9/10 pages real; DataOps controls disabled |
| Auth + approval gate | ✅ Working | 90% | Enforced client + Firestore rules |
| Subscription gating | ⚠️ Partial | 60% | Plans + quotas work; assignment is admin-manual |
| Payments | ❌ Not started | 5% | Scaffold only |

---

## D. Data Architecture Assessment

**Schema (73 fields) — strong foundation.** Stable identity (`bafa_id` + `uuid`), `installation_type`, `package_scope` + confidence, `market_segment` + confidence, `price_confidence`, `physical_specs_confidence` + quarantine flags + `last_checked_at`. This matches the previously agreed conservative-identity model almost exactly (`unit_scope` is effectively covered by `package_scope`).

**Per-requirement check:**

| Requirement | Supported? | Gap |
|---|---|---|
| Multiple countries | ❌ | No `country` field in product schema; `DE` hardcoded; pricing config Germany-specific (portability templates exist in `scraper/pricing/docs/`) |
| Manufacturer normalization | ✅ | `manufacturer_normalized` + `manufacturer_short` + 199-brand tier map |
| Model name normalization | ⚠️ | Raw BAFA model strings kept (correctly conservative); no normalized family/variant key except in physical-specs matching |
| BAFA product matching | ✅ | Native — `bafa_id` IS the primary key |
| EPREL matching | ❌ | No `eprel_id` field; would need fuzzy manufacturer+model matching layer |
| Eligibility status + evidence | ⚠️ | Implicit (presence on list); no `bafa_listed_since`, `bafa_last_seen`, `eligibility_status`, or source snapshot |
| Technical fields (COP/SCOP/ηs/noise/flow temp/dims/price) | ✅ mostly | `efficiency_35C/55C_percent` ≈ ηs; SCOP only 59.2% populated (BAFA gap); dims/weight 59.7% |
| Confidence scoring | ✅ | 4 confidence dimensions — better than most commercial datasets |
| Source URL / timestamp / last-verified | ❌ | Only `physical_specs_last_checked_at`; no per-record `source_url`, `extracted_at`, `last_verified` in app dataset (scraper metadata exists at file level only) |
| Monthly versioned datasets | ❌ | Single overwritten file; no version history, no diffs |
| Product history / discontinued | ❌ | A delisted BAFA product silently vanishes on next rebuild — the opposite of what paying users need (they need "this model was removed from the BAFA list on date X") |

**Verdict:** The schema is 70% of the way to a subscription-grade data model. The missing 30% — country dimension, EPREL ID, explicit eligibility status + dates, source/verification metadata, and dataset versioning/diffing — is exactly what converts a "viewer" into a paid "intelligence" product.

---

## E. Germany-Readiness Assessment

- **BAFA eligibility lookup: structurally solved, presentationally missing.** Every product comes from the official eligible list — higher trust than competitors scraping manufacturer sites. But the app never says so per product. Add an explicit "✓ BAFA-listed (Stand: 2026-03-19)" badge + linkout; this is nearly free and is the single highest-value Germany feature.
- **KfW/BEG messaging: absent.** No mapping of BAFA listing → BEG-EM funding rates (30% base, +5% efficiency bonus for natural refrigerant, +20% Klimageschwindigkeitsbonus, etc.). This is the #1 question installers/homeowners actually ask. Needs careful legal wording ("listed as eligible per BAFA list of …; final funding depends on the overall measure") — never "you will receive X€".
- **Comparison: good** for the listed fields; lacks flow-temperature suitability and ηs display that energy consultants need for renovation cases.
- **Datasheets: trustworthy in design** (BAFA-only fields, explicit disclaimer, AI-data caveat), but print-only export and "Germany Heat Pump Database" branding limit professional use. A real PDF with data-stand date and source statement would be credible client material.
- **Pricing: the prior trust problem is fixed.** Raw engine spreads (~69% wide) are no longer shown; UI displays typical ±15% from canonical display fields. Remaining risk: `price_confidence` exists in data but is **not surfaced in the UI** — show it (badge) and the pricing story becomes defensible.
- **Freshness: the weakest Germany claim.** BAFA updates its list continuously; the dataset is from March. A monthly re-scrape is mandatory before charging money — staleness on a subsidy list is a refundable defect, not a quirk.

**Overall: 7/10 for a free Germany tool, 4/10 for a paid one** — gated almost entirely by eligibility presentation, freshness automation, and export quality, not by data quality.

---

## F. EU Expansion-Readiness Assessment

**Reusable across Europe (already country-neutral in design):**
- Pricing engine *mechanism* (capacity band × brand tier × refrigerant × installation × performance, calibration, confidence) — `PORTABILITY-GUIDE.md` + config/brand-tier/keyword templates already exist for porting.
- Frontend filter architecture (config-driven `searchConfig.ts`), comparison, datasheet template, quota/plan/admin stack, Firestore `countries/{code}/*` content structure.
- EPREL (when built) is **the** pan-EU layer: one integration covers all 27 markets' label data.

**Country-specific layers:**
- Product registry + subsidy authority (DE: BAFA; FR: certification + MaPrimeRénov'; PL: Czyste Powietrze list; UK: MCS + BUS; IT: GSE/conto termico; NL: ISDE apparatenlijst; AT/CH: cantonal/regional). Each needs its own scraper-adapter and eligibility semantics.
- Price bases, brand tiers, market keywords, language.

**Required abstractions (do *before* country #2, not now):**
1. Product identity keyed on `country + registry_id` (or EPREL ID as the cross-country spine), with `bafa_id` demoted to a DE-registry field — **the biggest hardcoding risk today is that `bafa_id` is the primary key of the entire system.**
2. `CountryAdapter` interface: `fetchRegistry() → canonical product[]`, `eligibilityRules()`, `subsidyPrograms()`, pricing config.
3. Separate the three concerns the spec already names: **product identity** (registry/EPREL) ⟂ **EU label data** (EPREL, shared) ⟂ **subsidy logic** (per-country adapter). Currently all three are fused into the BAFA record.
4. `COUNTRY_CODE` from hardcoded const → user/app context.

**Risk if unaddressed:** every UI component, datasheet, quota log, and the comparison view references `bafa_id`; retrofitting after a second country ships is a full-schema migration. Cost of abstracting now: moderate. Cost later: high.

**Verdict:** Expansion is *architecturally plausible* (better than typical MVPs — the portability docs prove intent), but **nothing should expand until Germany pays for itself.** Plan the identity abstraction in Phase 4; don't build other adapters yet.

---

## G. Subscription / Commercial Viability Assessment

**Does it solve a high-value pain point?** Yes, for a specific buyer: people who repeatedly answer *"Which heat pump fits, is it BAFA-eligible, what does it roughly cost, and give me a document for the client?"* That is installers and energy consultants (Energieberater) — Germany has ~50k+ active installers in heating and a legally mandated consultant market (iSFP/BEG requires Energieberater involvement). The free alternatives (BAFA's raw PDF/CSV list, manufacturer sites) are painful: no search, no comparison, no prices, no export. The wedge is real but narrow.

**Segment ranking (pay-likelihood × fit):**
1. **Energy consultants** — best fit: need eligibility evidence + exportable docs for funded projects; datasheet/quota model matches their per-project workflow.
2. **HVAC installers/sales teams** — high volume; need comparison + price orientation + client-facing PDF; price-sensitive, want mobile.
3. **Manufacturers / importers-distributors** — different product: competitive intelligence, market coverage analytics, API/exports — higher price point (€200–500/mo), low volume; pursue after MVP.
4. **Property managers, architects/planners** — occasional use; team plans later.
5. **Homeowners** — will not pay meaningfully; they are the free tier / lead-gen layer.

**Is monthly updating enough?** For product/label data: yes, monthly is the credible minimum. For **subsidy/regulation changes: no** — BEG changes are events, not cycles; paying professionals need change *alerts* within days. For news: weekly AI runs are cheap (~$14/run budget already enforced).

**Must-haves before anyone pays:** automated monthly refresh with visible "Datenstand" date, per-product BAFA-listed badge + funding-rate context, real PDF export with professional branding, price-confidence badges, Stripe checkout, password reset, real admin auth.

**Free vs paid split (recommendation):**
- **Free:** search + filters, basic product view, 3 datasheets/mo, news headlines.
- **Pro (~€19–29/mo):** unlimited search detail, comparison export, 50 datasheets/mo, price estimates with confidence, BAFA/BEG context panel, change alerts, watchlist.
- **Team/Business (~€59–99/mo):** multi-seat, company branding on PDFs, full news/policy intelligence, priority data requests.
- **Data/API tier (€250+/mo):** bulk export, API, manufacturer analytics — later.

The existing Standard/Premium quota plumbing maps cleanly onto Free/Pro; this is a config change plus Stripe, not a rebuild.

**Honest viability read:** as a Germany-only tool, this is a plausible **€2–10k MRR niche product** (200–400 Pro seats), not a venture-scale business — until EPREL + multi-country turns it into "the European heat pump intelligence platform," which is a genuinely defensible dataset play. The moat is not the code; it is the *maintained, confidence-scored, registry-anchored dataset* and the update discipline.

---

## H. App Naming & Positioning Recommendation

"Heatpump Data Base" (and the in-app "Germany Heat Pump Database") is descriptive but weak: generic, unbrandable, caps expansion at Germany, and "Data Base" signals a spreadsheet, not intelligence.

| # | Name | Rationale |
|---|---|---|
| 1 | **HeatpumpHQ** | Professional "headquarters" framing; country-neutral; clean domain potential |
| 2 | **PumpIntel** | Short, "intelligence" positioning; slight ambiguity (water pumps) |
| 3 | **HeatIndex** | Index = authoritative registry feel; broad |
| 4 | **WärmeIQ** | German-market warmth + intelligence; harder to scale beyond DACH |
| 5 | **Calorra** | Invented, brandable, EU-trademark-friendly; needs positioning tagline to carry meaning |
| 6 | **HeatpumpIQ** | Explicit category + intelligence; literal but effective |
| 7 | **ThermIndex** | Technical-professional tone |
| 8 | **EuroPump Intelligence** | States the ambition; long |
| 9 | **FörderScout Wärmepumpe** | Subsidy-first German positioning; great for DE SEO, dead end for EU |
| 10 | **HeatList** | Echoes "the list" (BAFA-Liste) — insider resonance with German installers |

**Primary recommendation: `HeatpumpIQ`** — tagline *"European Heat Pump Product & Subsidy Intelligence"*, German market entry as *"HeatpumpIQ Deutschland — die durchsuchbare BAFA-Liste mit Preis- und Förderintelligenz."* It names the category (no explanation needed), claims intelligence rather than storage, survives EU expansion, and the IQ suffix supports sub-brands (PriceIQ, FörderIQ, LabelIQ) for feature marketing. Verify trademark/domain before committing; `HeatpumpHQ` is the fallback.

---

## I. Missing Features / Recommended Additions

**Tier 1 — needed for paid launch (high value, low-moderate effort):**
1. **BAFA eligibility badge + evidence panel** per product (listed-since date, registry link, data-stand) — converts implicit trust into visible trust.
2. **Data confidence badges** in UI — the data already exists (4 confidence fields), pure frontend work.
3. **True PDF export** (datasheet + comparison report) with professional branding — replaces print hack.
4. **"Datenstand" freshness indicator** app-wide.
5. **Stripe subscription checkout** + plan self-service.
6. **Password reset** (real) + real admin authentication.

**Tier 2 — retention drivers (the reason subscriptions don't churn):**
7. **Watchlist** + **change alerts** (price band moved, product delisted from BAFA, new models from watched manufacturer) — requires dataset versioning/diffing (§D) first.
8. **Subsidy navigator** (BEG-EM funding-rate calculator with disclaimers).
9. **Natural-refrigerant filter as a first-class concept** (R290 already prominent; add the +5% BEG bonus context).
10. **Noise compliance helper** (TA Lärm distance estimate from `noise_outdoor_dB`) — uniquely valuable, data already present.
11. **AI weekly market briefing** email (Cloud Function already 80% capable).

**Tier 3 — expansion/upmarket:**
12. Replacement recommendation assistant (old unit → shortlist), product scoring, installer/client co-branded reports, team accounts, API tier, admin QA dashboard (review-flags queue already produced by pipeline — just needs UI), EPREL label display.

---

## J. Priority Roadmap

**Phase 1 — Resume & stabilize (1–2 weeks):** re-run full pipeline for fresh BAFA data; fix password-reset stub; replace localStorage admin password with Firebase custom claims; surface confidence badges + Datenstand; code-split the 1.3 MB bundle; decide and document the Cloud Function's role (recommend: news/policy only — remove Gemini *product* research, it conflicts with BAFA-as-truth).

**Phase 2 — BAFA depth + EPREL (3–5 weeks):** automate monthly scrape→pipeline→deploy (Cloud Run job or GitHub Action; promote pipeline to one orchestrated script); add dataset versioning + diff (new/changed/delisted); eligibility badge + evidence panel; delisted-product retention with status; EPREL API ingestion → `eprel_id` + label fields via conservative manufacturer+model matching (confidence-scored, unknown fallback — same philosophy as pricing).

**Phase 3 — Paid subscription MVP (3–4 weeks):** Stripe checkout + webhooks → existing plan/entitlement model; free/pro/team gating; true PDF export; watchlist + email change alerts; legal pages (Impressum, AGB, Datenschutz — mandatory in Germany); rename/rebrand.

**Phase 4 — EU expansion architecture (design 1 week now, build when DE MRR justifies):** `country + registry_id` identity migration; CountryAdapter interface; separate subsidy-logic module; pick market #2 (Netherlands ISDE or Austria — clean lists, adjacent) only after ≥100 paying DE users.

**Phase 5 — AI intelligence layer:** re-enable scheduled news/policy runs (weekly, budget-capped); regulation-change detection alerts; AI briefing emails; manufacturer-tier analytics products.

---

## K. Technical Risks & Mitigation

| Risk | Severity | Mitigation |
|---|---|---|
| Stale subsidy data while charging money | **High** | Automated monthly pipeline + visible Datenstand + delisting alerts (Phase 2 before Phase 3) |
| Legal wording on eligibility ("BAFA-eligible" overpromise) | **High** | Always "listed on BAFA list as of {date}"; funding depends on overall measure; reviewed disclaimer; never compute guaranteed € without disclaimer |
| Simulated prices mistaken for quotes | High | Confidence badges, "estimate" labeling, methodology page; ±15% band already mitigates |
| `bafa_id` as global primary key | Medium now, High later | Phase 4 identity abstraction; freeze new `bafa_id` couplings now |
| EPREL matching errors (wrong label on product) | Medium | Confidence-scored matching, unknown fallback, manual review queue — reuse pricing-engine philosophy |
| AI-generated news/policy hallucination | Medium | Already mitigated for images (curated URLs); add source-link verification + human spot-check before re-enabling scheduler |
| Admin auth weakness (localStorage password `10041004`) | **High** (immediate) | Replace with Firebase Auth custom claims in Phase 1 |
| Quota enforcement client-side bypass | Low–Medium | Move consume-check into Firestore rules (compare `used < limit`) or a callable function |
| Copyright/source reuse (BAFA data, Unsplash) | Low | BAFA = public administrative data; keep source attribution; Unsplash license OK; news must remain summary+link, never full-text |
| Subscription churn (thin update cadence) | Medium | Alerts/watchlist (Tier 2) are the retention features; monthly data alone won't hold subscribers |
| Single-maintainer pipeline (manual steps, local machine) | Medium | Move pipeline to CI/Cloud Run; document runbook |

---

## L. Files/Components Requiring Inspection or Modification

| File | Why |
|---|---|
| [src/services/authService.ts](src/services/authService.ts) | Remove localStorage admin password (L55-66), hardcoded owner email (L23) → env/claims; real password reset |
| [src/App.tsx](src/App.tsx) | Password-reset stub (L203); routing growth → consider React Router |
| [src/services/dbService.ts](src/services/dbService.ts) | Hardcoded `COUNTRY_CODE` (L6); future country context |
| [google_cloud_function/index.js](google_cloud_function/index.js) | Remove/disable Gemini *product* research path (writes to unused Firestore collection); keep news/policy; re-enable scheduler for news only |
| [scraper/pricing/consolidate-datasets.cjs](scraper/pricing/consolidate-datasets.cjs) + siblings | Wrap 5 scripts into one orchestrated, CI-runnable pipeline with version stamping + diff output |
| [scraper/bafa-scraper.cjs](scraper/bafa-scraper.cjs) | Add `extracted_at`/`source_url` per record; delisting detection vs previous snapshot |
| [src/types.ts](src/types.ts) | Add `eprel_id`, label fields, `eligibility` block, `country`, `dataset_version` |
| [src/components/admin/BillingPage.tsx](src/components/admin/BillingPage.tsx) + [adminService.ts](src/services/adminService.ts) | Stripe integration target |
| [src/components/ResultsTable.tsx](src/components/ResultsTable.tsx), [ComparisonView.tsx](src/components/ComparisonView.tsx) | Surface confidence badges + eligibility badge (respect locked layout rules in CLAUDE.md) |
| [src/components/DataSheetTemplate.tsx](src/components/DataSheetTemplate.tsx) | True PDF generation; rebrand header |
| [firestore.rules](firestore.rules) | Server-side quota count check; new collections (watchlists, alerts, subscriptions) |
| [vite.config.ts](vite.config.ts) | Code-splitting (1.34 MB main chunk) |

---

## M. Validation Checklist

- [x] `npm run build` passes (verified 2026-06-12)
- [ ] `node scraper/bafa-scraper.cjs --test 20` still works against BAFA API (API may have changed since March)
- [ ] Full pipeline re-run produces ≥6,514-row dataset with no validation errors (`dataset-validation.json`)
- [ ] Tier monotonicity + review-flag counts in `pricing-summary.json` within expected bounds
- [ ] Fresh `products.json` diff vs current: count of added/changed/delisted models reviewed before deploy
- [ ] Auth flow: register → pending → admin approve → login; suspended/rejected blocked
- [ ] Quota: print decrements; exhaustion blocks; Firestore rules reject foreign quota doc writes
- [ ] Firestore rules emulator tests for users/logs/quotas/countries
- [ ] Cloud Function manual trigger (API key) completes within budget; scheduler trigger correctly rejected
- [ ] Datasheet print output correct in Chrome + Safari; quota consumed once
- [ ] Comparison enforces min 2 / max 4
- [ ] EN/DE switch covers all new strings
- [ ] Lighthouse pass after code-splitting (current 348 KB gzip JS)

---

## N. Final Recommendation: **BUILD — with narrowed scope**

Resume development. Do **not** pause (the data asset decays and the March dataset is already stale) and do **not** pivot (the BAFA-anchored dataset + pipeline is genuinely differentiated and ~70% of the hard data work is done). Narrow the scope explicitly:

1. **Germany only** until ≥100 paying users; EU expansion is a Phase-4 *design* exercise, not a build.
2. **Installers + energy consultants** as the only target buyers for the paid MVP; homeowners are the free tier.
3. **Trust before features:** freshness automation, eligibility evidence, confidence display, and PDF export beat any new content feature.
4. **Kill the contradiction:** retire Gemini-based product research; BAFA scrape is the only product-data source (AI stays for news/policy/briefings).
5. Target: paid MVP (Phases 1–3) in ~8–11 weeks of focused work; first revenue test at €19–29/mo Pro tier under the **HeatpumpIQ** brand.
