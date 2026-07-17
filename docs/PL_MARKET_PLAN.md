# Poland (PL) Market Expansion — First-Phase Report & Implementation Plan

Status: **PLANNING — awaiting owner approval. No code or data has been modified.**
Prepared: 2026-07-16. All external facts verified against primary sources on 2026-07-16
(URLs and verification notes inline). Repo facts cite file paths at commit `6fa4571`.

---

## A. Executive Summary

**Readiness.** The system is well prepared for a Poland edition. The permanent
"canonical technical baseline + local market overlay" architecture
(`docs/CANONICAL_TECHNICAL_BASELINE_AND_LOCAL_MARKET_OVERLAY.md`) was designed exactly
for this case, and Poland is the first market that exercises *both* halves of it at
once: the catalogue derives from the German canonical build (the France pattern,
`scripts/fr/build-app-products-fr.mjs`), and Poland **has an official national product
list — Lista ZUM — that is mandatory for heat pump grants under Czyste Powietrze**, so
it also gets a listing overlay (the UK/Ofgem-PEL pattern, `scripts/ofgem/`). Nothing
about Poland requires a redesign; every needed mechanism already exists and has a
working reference implementation.

**Recommended approach (one line).** Ship Poland as a DE-derived canonical catalogue
with bilingual PL|EN UI first (France pattern), then attach the Lista ZUM listing
overlay (UK pattern) as a separately gated stage — because ZUM has **no API/export and
no stated data-reuse license**, its ingestion needs a scraper plus a reuse-rights
confirmation from IOŚ-PIB before it may ship.

**Main workstreams.**
1. PL dataset builder + pipeline/gate/upload/canary plumbing (small — FR template).
2. PL country profile + market semantics + full `PL_PL`/`PL_EN` i18n dictionaries
   (medium — the largest content effort, ~600 keys × 2).
3. **PDF Unicode fix** (small-medium, load-bearing): the data-sheet generator silently
   deletes Polish diacritics today ("Gdańsk" → "Gdask").
4. Hosting/SEO/news/admin/test wiring (small — mechanical, well documented).
5. Lista ZUM overlay: fetch → parse → match → listing states (large; gated on data-reuse
   confirmation; strongest join key is the EPREL number, which ZUM now requires).

**Most significant risks.** (1) ZUM data acquisition & reuse rights — no export, no
license statement, ASP.NET-postback-only UI, broken TLS chains on the official hosts;
(2) Polish diacritics in the PDF pipeline; (3) Polish program rules change frequently
(the current Czyste Powietrze edition dates 31.03.2025, with further changes effective
20.07.2026 — four days after this report).

**Can implementation begin immediately after approval?** Yes for Stages 0–4 (the full
public PL edition without ZUM status). Stage 5 (ZUM overlay) starts only after the
owner-level data-reuse confirmation described in §I.

---

## B. Current Architecture Analysis

### B.1 The country-edition model

One deployment = one country. `VITE_COUNTRY_CODE` → `ACTIVE_COUNTRY`
(`src/config/countryProfiles.ts:226-245`; unknown codes fall back to DE). There is no
runtime country switcher; each market is its own Firebase Hosting site
(`.firebaserc` targets: de/uk/fr/hub) built by `build:de|uk|fr` (`package.json`).

`CountryProfile` (`countryProfiles.ts:36-128`) carries: name, marketName, currency,
locale, `firestoreRoot: 'countries/<code>'`, `primaryRegistry` (`'BAFA'|'OFGEM_PEL'`),
`primaryRegistryIdField`, subsidy labels, `sourceIdLabel`, `enabledEnrichmentLayers`
(`'EPREL'|'BAFA_REFERENCE'|'NF_PAC'`), `datasetPaths`, `technicalBaseline:'canonical'`,
and `localListingOverlay: { source: 'BAFA'|'PEL'|null; filterEnabled: boolean }`.

### B.2 Product data model & flow

Raw source → import → normalize → build → gate → upload → app:

- **Canonical build (DE):** `scripts/bafa/` fetch → parse → self-accumulating master
  seed → `build-app-products-from-master-seed.mjs` → `public/data/products.json` +
  `products-commercial.json`. 78 fields per record; identity, performance, physical,
  component-identity and EPREL-link fields are canonical; exactly four fields are
  German-market-only (`bafa_listing_status`, `bafa_foerderung_von/_bis`,
  `bafa_snapshot_fetched_at`) and are stripped by every derived market.
- **Derived market, no local list (FR):** `scripts/fr/build-app-products-fr.mjs` maps
  every DE record 1:1 — strips German-only fields, localises `type` strings, sets
  `country`, `performance_source='BAFA_REFERENCE'` + `bafa_reference_*`, optional
  NF PAC overlay by `bafa_id` (never guessed). Fatal validations: exact field count,
  no price keys, record count == DE.
- **Derived market with listing overlay (GB):** `scripts/ofgem/` fetch-pel-xlsx →
  parse-pel-xlsx → `match-canonical-to-pel.mjs` (direction always canonical→registry;
  confirming methods only: `exact_model`, `component_identity`,
  `family_market_suffix` without numeric conflict, plus committed official
  manufacturer mappings; ODU-only overlap never confirms — review queue) →
  `build-app-products-gb.mjs` adds 9 `pel_*`/`mcs_number` listing fields. Confirmed
  matches persist in committed `data_sources/ofgem_pel/pel-match-history.json`;
  `review_required` (was confirmed, stopped matching) is displayed as
  verification-required, never as delisted.
- **Eligibility:** one shared rule `scripts/lib/data-sheet-eligibility.mjs`
  (manufacturer, model, `bafa_id`, type, ηs, rated capacity from the 4-step capacity
  chain, resolvable segment, ≥2 of 5 core measured fields), applied once in the
  canonical builders — inherited by every market.
- **Gate:** `scripts/dataset-gate.mjs` vs `data_manifests/production.json` (absolute
  checks + change gates; German-status-fields-outside-Germany check; a new market's
  baseline entry bootstraps automatically on first `--approve`, with change gates
  skipped on the first run only).
- **Publish:** `scripts/upload-datasets.mjs` → `gs://heatpumpdb-datasets/datasets/<CC>/`
  with exactly one canary record per file (`scripts/canary/canary-records.json`;
  upload **fails** if a market has no canary pair defined).
- **Orchestration:** `scripts/update-all.mjs` `PIPELINES` graph (EPREL → DE → {GB, FR});
  `LIVE_GCS` shrink guard; `--deploy` = one atomic multi-site deploy. Header comment
  documents country onboarding.
- **App load:** `src/services/dbService.ts:24-41` — dev reads `public/data/*` locally;
  prod fetches `datasets/${ACTIVE_COUNTRY.code}/<file>` through the Firebase Storage
  SDK (App Check enforced; approved accounts only per `storage.rules`, whose
  `/datasets/{country}/{file}` wildcard already covers PL).

### B.3 Country-specific UI semantics

- `src/hpiq/market.ts` — the semantics hub, but implemented as `IS_GB ? … : IS_FR ? …
  : <DE default>` ternaries (SOURCE_ID_ABBR, REGISTRY_VERIFY_URL,
  FUNDING_SOURCE_LINKS, UI_LANGUAGES, DEFAULT_LANGUAGE, MARKET_WEB_DOMAIN,
  GUIDE_VIDEO_ID). **A PL build with no edits would silently render as a German-market
  site** (BAFA ids, bafa.de links, DE/EN languages, German dictionary via
  `tr()` in `src/hpiq/i18n.ts:2163`).
- `src/hpiq/listing.ts` — listing status resolver driven by
  `ACTIVE_COUNTRY.localListingOverlay`; states `listed | verification_required |
  not_listed`; `not_listed` producible only where the market owns its registry (DE).
- `src/config/segmentation.ts` — the 23 kW rule (`> 23` commercial, `≤ 23`
  residential, missing capacity → unclassified) is fully country-agnostic; **PL
  inherits it with zero changes** (confirmed in code; preserved as required).
- i18n: `src/hpiq/i18n.ts` has five dictionaries (EN base ~600 keys, DE, GB, FR_EN,
  FR_FR — `HpStrings = typeof EN` type-checks completeness); `src/translations.ts`
  (auth surface) has en/de/fr + per-country `FUNDING_CHIP` / `SEO_LINE`; admin is
  EN|KO only (`src/components/admin/adminI18n.ts`) with a `marketNames` map.
- SEO/build: `vite.config.ts` `MARKET_HTML` (title/desc/canonical/hreflang/theme/
  icons), `marketStats` file map, `__ALL_MARKET_STATS__`; per-market `sitemap.xml`,
  `robots.txt` (AI-crawler blocks, `Disallow: /data/`), `manifest.webmanifest`
  emitted at build. hreflang cluster auto-includes new entries.
- News: Cloud Function `google_cloud_function/index.js` `MARKETS` array writes
  `countries/<code>/news|policies`; localized fields are suffix-based (`_de`, `_fr`);
  `NewsPage.tsx`/`MobileApp.tsx` hardcode those suffixes.
- Admin: sidebar/overview/data pages iterate `Object.values(COUNTRY_PROFILES)` — a new
  market appears automatically; only `adminI18n.marketNames` (EN+KO) and the
  vite-injected stats map need entries. Users are stamped `country: ACTIVE_COUNTRY.code`
  at signup (`authService.ts:136`) so PL members/tickets route to a PL workspace
  automatically.
- Billing: `src/config/paddlePrices.ts` is keyed by **currency**; only a EUR (sandbox)
  catalogue exists. `activeBillingCurrency()` = profile currency; a currency without a
  catalogue renders subscriptions as "coming soon". No product-UI prices anywhere.

### B.4 Similarities/differences among existing editions

| | DE | GB | FR | → PL (proposed) |
|---|---|---|---|---|
| Catalogue | own registry (BAFA) | DE-derived | DE-derived | DE-derived |
| Local listing | BAFA (owns registry; may say "not listed") | PEL overlay (never "not listed") | none | **ZUM overlay** (never "not listed") |
| Languages | DE\|EN | EN | FR\|EN | **PL\|EN** |
| Subsidy framing | list-based (BAFA/KfW) | list + honesty framing (BUS/MCS) | criteria-based (MaPrimeRénov'/CEE) | **hybrid: ZUM list + criteria-based programs** |
| Listing filter | yes | no (didn't divide catalogue usefully at launch) | n/a | phase 2, once ZUM match-rate known |

### B.5 Reusable components

Everything: FR builder (template), ofgem matcher + match-history + cross-reference
overlay (template), shared eligibility, gate, upload/canary, orchestrator, listing
resolver, ListingChip, admin auto-discovery, e2e harness (`tests/run-*.sh` loop over
country codes), news pipeline. The documented expansion checklist
(`docs/UPDATE_PIPELINE.md` §5) matches the code with minor drift (below).

### B.6 Structural constraints & technical debt found (documented as risks, not fixed here)

1. `countryProfiles.ts:13-18` claims "adding a country requires only a profile entry" —
   contradicted by ~14 files with hardcoded `DE|GB|FR` branches (market.ts, i18n `tr()`,
   translations.ts `FUNDING_CHIP`/`SEO_LINE`, vite.config ×3, `brandSvg.ts` flag faces,
   `AuthShell.tsx` `MARKET_BG`, `adminI18n.marketNames`, `NewsPage.tsx` `_de/_fr` picks,
   `SignupForm.tsx` `TYPE_LABELS`, cloud function, tests' `for cc in DE GB FR` loops).
   All silently default to DE — the dangerous failure mode is a *working* site with
   German semantics.
2. `localListingOverlay.source` is typed `'BAFA'|'PEL'|null` (`countryProfiles.ts:125`)
   while the architecture doc §8 promises `'LOCAL_REGISTRY'`. A ZUM overlay needs a
   type extension (add `'ZUM'`).
3. **PDF WinAnsi folding deletes Polish letters.** `dataSheetPdf.ts:58-72` `ascii()`
   keeps only code points ≤ 0xFF plus a small extras set; ą ć ę ł ń ś ź ż (U+0104…)
   are silently dropped; only ó (U+00F3) survives. Verified empirically:
   "Gdańsk"→"Gdask", "Łódź"→"ód". No Unicode font is embedded (standard Helvetica).
4. Minor: gate checks 3 German-only fields while builders strip 4
   (`bafa_snapshot_fetched_at` unguarded); `BafaPage.tsx:12` hardcodes
   `toLocaleString('en-US')`; UPDATE_PIPELINE §5 says `src/market.ts` (actual:
   `src/hpiq/market.ts`); CLAUDE.md still says "EN/DE + GB" dictionaries (five exist).
5. Registration is globally paused (`src/config/registration.ts`, "pending European
   expansion review") — a PL launch needs the owner to decide when to unpause.

---

## C. Poland Market Requirements

All items verified 2026-07-16 against primary sources unless marked. Evidence copies
(HTML/PDF incl. the current ZUM Regulamin) are in the session scratchpad.

### C.1 Official data sources

**Lista ZUM** (Lista Zielonych Urządzeń i Materiałów) — https://lista-zum.ios.edu.pl
— *the* official Polish product list for clean heating devices; the only governmental
heat pump product registry in Poland.
- Operator: IOŚ-PIB (Instytut Ochrony Środowiska – Państwowy Instytut Badawczy),
  financed by NFOŚiGW; running since 02.09.2019 for the duration of Czyste Powietrze
  and Ciepłe Mieszkanie. [OFFICIAL: https://lista-zum.ios.edu.pl/docs/REGULAMIN.pdf §1]
- Current Regulamin in force since **16.12.2025**.
- Heat pump categories: air/water; air/water higher-efficiency class; air/water DHW;
  ground-source higher class (incl. water/water); air/air. Live counts read from the
  official filter UI on 2026-07-16: air/water 2,615 (A+ 23 / A++ 2,383 / A+++ 209,
  3–44 kW, 100% with test report attached); higher-class air/water 2,541 (subset);
  ground 442 (4–55 kW); DHW 39; air/air 1.
- Entry requirements (Regulamin §5): energy label per EU 811/2013 (min **A++ at 55 °C**
  for ground and higher-class air/water; A++ per 626/2011 for air/air; A per 812/2013
  for DHW); ecodesign docs per 813/2013; CE; **test report from an ISO/IEC
  17025-accredited EU/EFTA lab per EN 14511 / EN 14825 / EN 12102** (EN 16147 for DHW;
  EN 15879 for ground where applicable); families ("typoszereg") may share reports
  (≤5 subtypes per report, capacity within ±50% of the tested unit). Alternative
  route: valid **HP Keymark / EHPA Q / Eurovent** certificate; entry lives only as
  long as the certificate (suspension >30 days → removal).
- **EPREL:** since the 29.04.2025 Regulamin every new submission must include the EPREL
  registration number and link; existing entries were to be EPREL-verified by
  15.12.2025. [OFFICIAL: https://czystepowietrze.gov.pl/wazne-komunikaty/nowe-zasady-na-liscie-zum-wiekszy-wybor-urzadzen-z-troska-o-beneficjentow]
- Public entry content: manufacturer, product name, searchable ID code, rated heat
  output (55 °C moderate climate), annual energy consumption, ηs class at 55 °C (35 °C
  where tested), attached public documents (test reports, product cards; trade-secret
  redactions allowed), "Informacja dodatkowa". **No prices** (a price causes refusal,
  §4.16). Ordering deliberately random (§4.13 — "not a ranking"). A public
  "Usunięte/zawieszone" (removed/suspended) tab exists.
- **Access: web UI only.** ASP.NET WebForms with ViewState postbacks
  (`bepub/ben001.aspx`, `ben001rev.aspx`). **No API, no CSV/XLSX export, no
  dane.gov.pl dataset.** [OFFICIAL: site inspection 2026-07-16; dane.gov.pl search negative]
- **Licensing:** the site publishes **no reuse/open-data statement**. Sole legal
  notice: IOŚ-PIB does not consent to commercial third-party use of its or Lista ZUM's
  **logo, name or graphic mark** without written consent (restricts branding, not
  facts). Poland's Open Data Act (11.08.2021, implementing Directive (EU) 2019/1024)
  provides a formal re-use request route to IOŚ-PIB. [Legal reading — not stated by
  IOŚ-PIB; see Risks]
- Fetcher note: `lista-zum.ios.edu.pl` and `czystepowietrze.gov.pl` serve **incomplete
  TLS chains** (Node fetch fails; curl succeeds) — the fetcher must ship the
  intermediate CA or use a custom agent.

**EPREL** — already integrated as a canonical enrichment layer
(`eprel_registration_number` on DE records, link-only, no values copied). Treated as
shared European data, exactly as required.

### C.2 Subsidy programs (product-relevant vs applicant-relevant split)

| Program | Status (2026-07-16) | Product-side requirement | Applicant/building side (we never evaluate) |
|---|---|---|---|
| **Czyste Powietrze** (NFOŚiGW + 16 WFOŚiGW) | Running; edition of 31.03.2025; facilitation package effective **20.07.2026** | **Heat pump must be on Lista ZUM** (invoices from 14.06.2024; from 20.07.2026 status counts at the advance-invoice date). Min A++ at 55 °C (A+ air/water only for applications ≤ 31.08.2025) | income levels (≤135k zł/yr basic; elevated/highest per-person), 3-year ownership (with new exceptions), mandatory energy audit, one beneficiary–one building, building energy-demand bands; grant caps e.g. ground HP 18,000/31,500/45,000 zł, higher-class air/water 14,080/24,640/35,200 zł [OFFICIAL: czystepowietrze.gov.pl/wez-dofinansowanie/na-co-i-ile + /dla-kogo + 20.07.2026 komunikat] |
| **Moje Ciepło** (NFOŚiGW) | Open until **31.12.2026** or budget exhaustion (600M zł); assessing Nov 2025 applications as of 10.07.2026 | **No ZUM requirement.** Class-based: ground & air/water min A++ (55 °C); air/air min A+ | new single-family buildings only, EP ≤ 55 kWh/m²·yr; grants 30% (45% with large-family card), caps 21,000 zł ground / 7,000 zł air [OFFICIAL: mojecieplo.gov.pl/o-programie] |
| **Ciepłe Mieszkanie** | Budget largely allocated to gminas; last gmina intake ended 31.01.2024; possible new edition late 2026 [partly SECONDARY] | ZUM formally serves this program (Regulamin §1) | units in multi-family buildings; residents apply via gmina |
| **Ulga termomodernizacyjna** (tax relief) | In force | heat pumps eligible | deduction ≤ 53,000 zł per taxpayer; combinable with Czyste Powietrze (non-subsidized share only) [OFFICIAL: czystepowietrze.gov.pl/inne-programy/ulga-termomodernizacyjna; 2025 catalog amendment NOT yet officially confirmed] |

The UI must therefore present: (a) ZUM listing status as a *product* fact, (b) the
programs as *criteria-based* information with the FR-style "we never claim
eligibility" framing, and (c) a clear disclaimer that listing ≠ grant approval
(mirroring GB's "PEL listing ≠ full BUS eligibility" honesty wording).

### C.3 Localization requirements

- Polish UI (`PL_PL`) + English (`PL_EN`) — bilingual like FR. Default `pl`.
- Locale `pl-PL`: dates DD.MM.YYYY, decimal comma, space thousands separator, "zł"
  after amounts, VAT 23% standard (8% reduced for HP install in social-housing
  conditions — billing-side note only; no product-UI prices exist).
- Polish diacritics must survive the PDF (see §B.6-3) and UI (web fonts fine).
- "BAFA" and the source country must never appear on Polish pages (existing e2e
  enforces this); records present as "European reference" per the segmentation/
  presentation principles doc.

### C.4 Regulatory/licensing risks — see §H (ZUM reuse; IOŚ-PIB name/logo notice;
frequent program changes; 20.07.2026 rule change).

### C.5 Update frequency & history requirements

- ZUM changes continuously (entries added after ≤30-working-day verification;
  suspensions/removals published). Monthly refresh aligned with the existing pipeline
  schedule (2nd of month) is adequate, with the removed/suspended tab checked each run.
- Because grant eligibility counts ZUM status **at the advance-invoice date**
  (20.07.2026 rule), point-in-time history matters to users. We will persist
  first-matched / last-confirmed dates (match-history pattern) and snapshot dates, and
  display "verified on <date>" — but we will **not** compute date-specific eligibility
  for a user's invoice; that stays a disclaimed, criteria-based question.

### C.6 Not yet officially confirmed

1. ZUM bulk export/API — none found; assume scraping (needs decision).
2. Whether every public ZUM record displays its EPREL number and per-entry validity
   history (requires an interactive session with the postback grid — Stage-5 spike).
3. IOŚ-PIB's position on data reuse (site silent; formal request drafted in Stage 5).
4. The reported 01.01.2025 tax-relief catalog amendment.
5. Ciepłe Mieszkanie's possible late-2026 new edition.

---

## D. Recommended Data Model and Matching Strategy

### D.1 Relationship between shared products and Polish records

Identical to GB: the PL catalogue **is** the canonical (DE-derived) catalogue —
same record count as DE, same identities, same specs, presented neutrally
("European reference"). Lista ZUM is an **overlay only**: it may confirm listing,
attach the ZUM id/category/class and dates, and never creates a product, supplies a
spec, changes capacity/segment, or removes a product on match failure. German BAFA
status fields are stripped exactly as GB/FR do and the dataset gate enforces it.

### D.2 New/modified fields

PL product record = DE (78 fields) − 4 German-only + 5 common reference fields
(`performance_source='BAFA_REFERENCE'`, `bafa_reference_id/_model/_match_type`, plus
`country='PL'`), + in Stage 5 the ZUM overlay block (naming parallel to `pel_*`):

```
zum_match_status        'confirmed' | 'review_required' | 'verification_required'
zum_id                  official ZUM ID code (only when confirmed)
zum_product_name        registry product name (only when confirmed)
zum_category            e.g. 'air_water_higher_class' (only when confirmed)
zum_class_55c           registry ηs class at 55 °C (display-only registry fact —
                        never overwrites our derived energy class)
zum_match_method / zum_match_confidence
zum_snapshot / zum_snapshot_fetched_at
zum_first_matched_at / zum_last_confirmed_at
```

Type changes: `CountryCode` += `'PL'`; `Language` += `'pl'`;
`localListingOverlay.source` += `'ZUM'`; `EnrichmentLayer` unchanged (EPREL applies);
`primaryRegistry` stays `'BAFA'` for PL (internal provenance field, as FR does).

### D.3 Exact matching rules (canonical → ZUM, never the reverse)

Confirming methods only, in precedence order:
1. `manufacturer_official` — committed mappings in
   `data_sources/manufacturer_cross_reference/canonical-to-zum.json` (no code change
   to add one; mirrors the PEL file).
2. `eprel_number` — canonical `eprel_registration_number` equals the ZUM entry's EPREL
   number (ZUM mandates EPREL for new entries since 29.04.2025). Highest-quality
   automated method; an official EU identifier, not a string heuristic. Guarded by a
   numeric-conflict check (capacity/class sanity) like every other method.
3. `exact_model` — normalized exact model identity (reuse `pel-match-lib.mjs`
   `compact`/`identityKeys` conventions).
4. `component_identity` — exact ODU+IDU component identity (high).
5. `family_market_suffix` — family/variant with market suffix, medium confidence, must
   not `numericConflict`.

Never confirming: fuzzy similarity, manufacturer-only, ODU-only overlap (→ review
queue), capacity-only. One ZUM id confirms one product; one-to-many needs an
evidenced committed exception (PEL pattern). ZUM family entries ("typoszereg" — one
entry covering several subtypes) are the expected one-to-many case: handled via the
exceptions file with the registry's own family definition as evidence.

### D.4 Match/listing states (user-facing)

- `confirmed` → "**Na liście ZUM**" / "ZUM listed" + ZUM id + verified date.
- everything else → "**Weryfikacja ZUM wymagana**" / "ZUM verification required".
- `review_required` (was confirmed, stopped matching) → displayed as
  verification-required; internal follow-up queue; matcher regression presumed before
  delisting is believed.
- **Never "Not on ZUM"** — our catalogue does not originate from the registry, so a
  failed match is a fact about our matching (the GB rule, applied verbatim).
- Suspended/removed ZUM entries: a previously confirmed product whose ZUM id appears
  in the official removed/suspended tab keeps `confirmed` history but is displayed as
  verification-required with an internal "registry-removed" reason — never as a
  negative claim about the product.

### D.5 Poland-only models

None at launch by design: the canonical baseline principle forbids creating products
from a local list, and ZUM publishes no specs sufficient for the shared Data-Sheet
eligibility rule anyway (the PEL v2.1 lesson). ZUM-only entries that match no
canonical product go to a visible review/followup queue (operator-facing), which also
serves as the future signal for genuinely Poland-specific hardware. If a Poland-only
model ever needs publishing, it must enter through the canonical builder with full
specs — a separately approved workstream.

### D.6 Provenance & history

- Committed `data_sources/lista_zum/zum-match-history.json` (first/last-confirmed
  dates survive snapshot cleanup — PEL pattern).
- Snapshot folders `data_sources/lista_zum/{raw,parsed,matching}/YYYY-MM/` (gitignored)
  with `_meta.json` fetch timestamps; a committed `manifest.json` describing the
  source, terms status, and fetch method (NF PAC pattern).
- Every user-visible ZUM fact carries the snapshot date ("verified on …").

### D.7 Automation vs manual review boundary

Automated: fetch, parse, methods 2–5 matching, state transitions, gate checks.
Manual (admin/operator): official mapping entries, one-to-many exceptions, the review
queue (`canonical-zum-review.json`), gate overrides, and the monthly attended run —
identical to the GB operating model. No new admin UI is required at launch; review
artifacts are files, as they are for PEL.

### D.8 Rejected alternative

A generalized `LocalRegistry` abstraction over PEL+ZUM was considered and rejected for
now: two implementations are not enough to justify the refactor, and the PEL matcher's
library (`pel-match-lib.mjs`) can be reused with thin ZUM-specific adapters. If a
fourth market with a registry arrives, generalize then.

---

## E. Implementation Plan (stages, in recommended order)

> Rollback note common to all stages: every stage lands as ordinary commits gated by
> `npm test` + per-market e2e; datasets publish only through gate+upload; hosting
> rollback via Firebase release history (`docs/UPDATE_PIPELINE.md` §7). Nothing in
> Stages 0–4 touches DE/GB/FR datasets or behavior except where explicitly listed.

### Stage 0 — Shared groundwork (small)
- **Objective:** make the codebase PL-capable without behavior change.
- **Changes:** `CountryCode`+`'PL'`, `Language`+`'pl'` (`src/types.ts`),
  `localListingOverlay.source`+`'ZUM'`; **PDF Unicode fix** in
  `src/hpiq/pdf/dataSheetPdf.ts`: embed a Latin-Extended TTF subset (e.g. Noto Sans)
  via jsPDF `addFileToVFS`/`addFont`, keep the symbol folds (η→eta only where the font
  lacks it — with a real font, keep `ascii()` as a pass-through guard that
  NFD-transliterates instead of deleting). Fix `BafaPage.tsx` `'en-US'` →
  `t.locale` while there (one-line latent bug).
- **Completion criteria / test:** all existing unit+e2e green for DE/GB/FR; a PDF
  smoke test renders "Zażółć gęślą jaźń", "Gdańsk", plus existing DE/FR strings
  pixel-sane on all three current editions (manual visual check + string-extraction
  assert).
- **Regression risk:** the font swap touches every edition's PDF — mitigated by
  rendering before/after sheets for the same DE and FR products and comparing.
- **Rollback:** revert commit; `ascii()` fallback path retained behind the old code.

### Stage 1 — PL dataset builder + pipeline plumbing (small)
- **Objective:** `products-pl.json` + `products-commercial-pl.json` build, gate, and
  upload like FR's.
- **Changes:** `scripts/pl/build-app-products-pl.mjs` (copy FR builder: strip 4 German
  fields, Polish `type` localisation — `Luft/Wasser`→`Powietrze/Woda`,
  `Sole/Wasser`→`Solanka/Woda` [glycol/brine wording reviewed by owner],
  `Wasser/Wasser`→`Woda/Woda`, `Luft/Luft`→`Powietrze/Powietrze`, `country='PL'`,
  `performance_source='BAFA_REFERENCE'`, `EXPECTED_FIELD_COUNT=79`, empty optional
  ZUM-overlay slot); `PIPELINES.PL` (`dependsOn:['DE']`) + `LIVE_GCS` in
  `update-all.mjs`; `DATASETS.PL` in `dataset-gate.mjs` and `upload-datasets.mjs`;
  a PL canary pair (new fictitious manufacturer, id in the 1699xxxx block) in
  `scripts/canary/canary-records.json`.
- **Completion criteria / test:** builder validations pass; record count == DE;
  `dataset-gate.mjs` clean (PL baseline bootstraps on first `--approve` — absolute
  checks active, change gates from run 2); `tests/architecture.unit.mjs` +
  `listing.unit.mjs` extended with `'PL'` and green. **No upload yet.**
- **Regression:** none (additive files + map entries).

### Stage 2 — PL app edition: profile, semantics, content (medium-large; the i18n bulk)
- **Objective:** `VITE_COUNTRY_CODE=PL npm run build` produces a correct bilingual
  Polish site with FR-style criteria-based funding framing (no ZUM status yet:
  `localListingOverlay: { source: null, filterEnabled: false }` at this stage).
- **Changes:** `COUNTRY_PROFILES.PL` (currency `PLN`/`zł`, locale `pl-PL`,
  `firestoreRoot:'countries/PL'`, `subsidyAuthorityLabel:'NFOŚiGW'`,
  `subsidyTabLabel:'Czyste Powietrze / Moje Ciepło'`, `sourceIdLabel:{en:'European
  reference', pl:'Referencja europejska'}`, datasets `*-pl.json`,
  `enabledEnrichmentLayers:['EPREL']`); `market.ts` `IS_PL` branches (neutral 'Ref.'
  abbr, czystepowietrze.gov.pl verify link, funding links: czystepowietrze.gov.pl /
  mojecieplo.gov.pl / lista-zum.ios.edu.pl / nfosigw, `['pl','en']`, default `'pl'`,
  `www.heatpumpdb.pl`); **`PL_PL` + `PL_EN` dictionaries** in `i18n.ts` (funding page:
  Czyste Powietrze grant bands + ZUM explanation + Moje Ciepło + ulga, all
  criteria-based with FR-grade disclaimers and official links + verification dates);
  `translations.ts` `pl` dict + `FUNDING_CHIP.PL` + `SEO_LINE.PL`;
  `NewsPage.tsx`/`MobileApp.tsx` `_pl` branches + Polish `categoryOf` keywords;
  `SignupForm.tsx` `TYPE_LABELS.pl`; `adminI18n.marketNames.PL` (EN+KO);
  `brandSvg.ts` PL flag face (white/red waving cloth — extend `flagInner()`, artwork
  stays single-source); `AuthShell.tsx` `MARKET_BG.PL`; `vite.config.ts`
  `MARKET_HTML.PL` + `marketStats` + `__ALL_MARKET_STATS__`; `public/icons/pl-*`;
  `package.json` `build:pl`.
- **Completion criteria / test:** `build:pl` succeeds; dev-server walkthrough in
  PL+EN; e2e `run-*.sh` loops extended with `PL` + Polish market-language regexes
  (e.g. `/moc znamionowa/` for the unclassified note) — the existing "BAFA never
  appears outside DE" sweeps must pass on PL; data sheet PDF verified with Polish
  strings on desktop + iOS share path.
- **Regression:** i18n type `HpStrings = typeof EN` guarantees dictionary
  completeness at compile time; DE/GB/FR e2e re-run.

### Stage 3 — Hosting, SEO, news, launch ops (small)
- **Objective:** PL edition live at heatpumpdb-pl.web.app (custom domain when owner
  provides DNS), news flowing.
- **Changes:** `firebase hosting:sites:create heatpumpdb-pl`; target in
  `firebase.json`/`.firebaserc`; `deploy:pl`; add `hosting:pl` + `build:pl` to
  `update-all.mjs` deploy block; Cloud Function `MARKETS` PL entry
  (`polishTranslation` flag → `title_pl/summary_pl/body_pl`, Polish
  `researchScope`/`reputableSources` incl. gov.pl/NFOŚiGW/czystepowietrze.gov.pl,
  image rules unchanged — curated set + keyword matching, never AI-generated URLs);
  first dataset upload (`upload-datasets.mjs`) then `dataset-gate.mjs --approve`.
- **Completion criteria:** site serves with PL meta/hreflang/sitemap/robots;
  `countries/PL/news` populated by a narrowed manual run
  (`?newsOnly=true&countries=PL`); admin Overview shows PL with real counts; PL user
  signup→approval→dataset load verified end-to-end (App Check on).
- **Dependencies:** owner: Firebase site creation rights, decision on
  domain purchase, decision on registration unpause timing.
- **Rollback:** hosting release rollback; news is append-only (no destructive risk);
  bucket objects replaceable by re-upload (gate baseline supports
  `--baseline-from-live`).

### Stage 4 — Verification hardening + docs (small)
- **Objective:** PL is a first-class citizen of the safety net.
- **Changes:** PL entries in all five `tests/run-*.sh`; architecture/listing unit
  loops (done in St.1–2); `docs/UPDATE_PIPELINE.md` + CLAUDE.md country lists updated;
  ops notes (TLS-chain quirk, ZUM tab monitoring) recorded; fix the doc/code drifts
  from §B.6-4 while touching those files.
- **Completion criteria:** full `npm test` + all per-market e2e green in one run.

### Stage 5 — Lista ZUM listing overlay (large; **gated — see §I**)
- **Objective:** "Na liście ZUM / ZUM listed" status with id + dates on confirmed
  products; review queue for the rest; listing filter enabled if it usefully divides
  the catalogue.
- **Pre-conditions (hard gates):** (a) written or statutory clarity on ZUM data reuse
  (formal Open Data Act request to IOŚ-PIB, or owner accepts the facts-only legal
  reading); (b) a scraping spike proving stable extraction of the postback grid
  (per-category enumeration, entry fields incl. EPREL number, removed/suspended tab)
  under the site's ToS posture.
- **Changes:** `scripts/pl/fetch-zum.mjs` (curl-based or custom-CA agent; polite rate;
  raw HTML snapshots to `data_sources/lista_zum/raw/YYYY-MM/`), `parse-zum.mjs` →
  normalized JSON + summary validations, `match-canonical-to-zum.mjs` (methods §D.3,
  reusing `pel-match-lib.mjs` primitives), committed `zum-match-history.json` +
  `canonical-to-zum.json` cross-reference + one-to-many exceptions file; builder
  consumes the overlay (optional step, PEL semantics); `listing.ts` ZUM branch;
  profile flips to `localListingOverlay:{source:'ZUM', filterEnabled:<data-driven>}`;
  i18n listing wording; ListingChip/inspector/data-sheet sections light up
  automatically; dataset-gate local-id integrity checks extended to the `zum_*`
  field family; `tests/zum-matching.unit.mjs` (mirror of pel-matching);
  `PIPELINES.PL` gains the fetch/parse/match steps (match step `optional:true`).
- **Completion criteria:** match report reviewed (expected: confirmed set dominated by
  EPREL-number joins; every confirmation reproducible); gate green incl. the
  local-match-collapse change gate; e2e asserts "Not on ZUM" never appears; UI shows
  status only with snapshot date.
- **Regression risk:** GB is the reference; the shared matcher lib gets adapters, not
  edits — PEL unit tests must stay green untouched.
- **Rollback:** flip profile back to `source:null` (UI reverts to Stage-2 behavior);
  overlay step is optional in the pipeline so a matcher failure never blocks builds.

### Stage 6 — Billing activation for PL (small; timing owner-driven)
PLN Paddle price set (or EUR decision, §I-3); `paddlePrices.ts` PLN catalogue.
Independent of all other stages; PL runs "coming soon" until then, exactly like GB.

---

## F. Verification Plan

- **Data integrity:** builder fatal validations (field count 79, count==DE, no price
  keys, no German fields); `dataset-gate.mjs` absolute + change gates; shrink guard
  with canary subtraction; `architecture.unit.mjs` corrupted-dataset gate exercises
  extended to PL.
- **Matching accuracy (Stage 5):** unit suite per method incl. refusal cases (fuzzy,
  ODU-only, numeric conflict, one-ZUM-id-many-products); manual review of the full
  first match report before first publish; EPREL-join spot-check of ≥50 confirmations
  against the live ZUM UI; review/followup queues triaged before enabling the filter.
- **Unmatched/conflicting records:** `canonical-zum-review.json` +
  `canonical-zum-followup.json` inspected each run (operator step in the monthly
  attended window); `review_required` regressions alarmed by the gate's
  local-match-collapse threshold (>20%).
- **API/app-load testing:** dev local-file path + prod Storage path (App Check debug
  token e2e); approval-gated access verified with a pending vs approved account.
- **UI testing:** per-market Playwright e2e (products, detail, mobile shell, account,
  registration, signup) with `PL` added to every loop; Polish-language regex
  assertions; BAFA/source-country leak sweeps (already multi-language, PL inherits).
- **Polish translation review:** native-speaker (owner-arranged) review of `PL_PL`
  before launch, prioritized: legal disclaimers, funding page, listing wording,
  data-sheet labels. Program facts each carry their official link + verified date.
- **Search/filters:** refrigerant `.includes()` semantics unchanged (unit-tested);
  manufacturer/capacity/segment filters exercised in e2e; listing filter absent in
  Stages 2–4, evaluated with real match data in Stage 5.
- **Data sheet/print/PDF:** Polish-diacritics render test (strings incl.
  "Zażółć gęślą jaźń"), DE/FR before/after comparison for the font swap, iOS share
  path + desktop print dialog manual pass (the repo's hard-won print rules stay
  untouched — PDF generation only, never DOM print).
- **SEO:** built `dist-pl/index.html` inspected for lang/canonical/hreflang (PL joins
  the alternate cluster on all four sites — note this touches DE/GB/FR HTML at their
  next deploy), sitemap/robots emitted, AI-crawler blocks present.
- **Accessibility/responsive:** phone shell e2e (`run-account-mobile-e2e.sh` + mobile
  catalog assertions) on PL; manual phone/tablet pass like the FR launch.
- **Regression for existing countries:** full `npm test` + DE/GB/FR e2e on every
  stage; datasets for DE/GB/FR are byte-identical through Stages 0–4 (only PL files
  added) — assertable by manifest diff.
- **Performance/large-import:** PL dataset size == DE (~7k records, proven scale);
  ZUM scrape ~3k entries — trivial volume, but fetcher rate-limited and snapshot-cached.
- **Official-list update scenarios (Stage 5):** simulated snapshots for
  entry-added / entry-removed / entry-suspended / match-lost (→ review_required, id
  retained internally, date preserved via match-history) — unit-tested like PEL.
- **Release acceptance:** gate clean → upload → `--approve`; e2e green on all four
  markets; owner sign-off on Polish legal/disclaimer text; monitoring window after
  deploy (admin Overview counts, error console, news run).

---

## G. Expected Change Scope

**Precedent (git evidence):** FR shipped in 3 commits, ~925 line changes
(`51e1696`, `6ea8805`, `b8086e2`); the GB PEL overlay pipeline was several, much
larger commits. PL ≈ FR scope (Stages 0–4) + a GB-like overlay (Stage 5).

- **Added:** `scripts/pl/` (builder; later fetch/parse/match), `data_sources/lista_zum/`
  (manifest committed; snapshots gitignored; match-history + cross-reference committed),
  `public/icons/pl-*.png`, PL dictionaries, PL canary pair, `tests/zum-matching.unit.mjs`,
  `dist-pl/` (gitignored), font asset for the PDF.
- **Modified:** `types.ts`, `countryProfiles.ts`, `market.ts`, `i18n.ts`,
  `translations.ts`, `listing.ts` (St.5), `brandSvg.ts`, `AuthShell.tsx`,
  `SignupForm.tsx`, `NewsPage.tsx`, `MobileApp.tsx`, `adminI18n.ts`,
  `dataSheetPdf.ts`, `vite.config.ts`, `package.json`, `firebase.json`, `.firebaserc`,
  `update-all.mjs`, `dataset-gate.mjs`, `upload-datasets.mjs`,
  `canary-records.json`, `google_cloud_function/index.js`, five `tests/run-*.sh`,
  three unit tests, docs + CLAUDE.md.
- **Data migration:** none. No existing record changes; PL files are additive; the
  production manifest gains a PL entry through the normal `--approve` flow.
- **New dependencies:** none expected (jsPDF font embedding is built-in; scraper uses
  node + curl fallback; XLSX libs already present for PEL).
- **New env/secrets:** none for Stages 0–4. Stage 6 needs `VITE_PADDLE_PRICE_*` PLN
  ids when billing activates. Stage 5 needs no key (public site), only egress.
- **External accounts/services:** Firebase Hosting site `heatpumpdb-pl` (existing
  project, no new billing); optional domain `heatpumpdb.pl`.
- **Manual owner/operator work:** domain purchase + DNS; native Polish text review;
  IOŚ-PIB reuse inquiry sign-off; PL guide video (a `GUIDE_VIDEO_ID` slot exists per
  market); registration-unpause decision; Paddle PLN prices (later).
- **Relative complexity:** Stage 0 S · Stage 1 S · Stage 2 M-L (content volume) ·
  Stage 3 S · Stage 4 S · Stage 5 L (scraper + matcher + review workflow) · Stage 6 S.

---

## H. Risks and Open Issues

| # | Risk | Impact | Likelihood | Mitigation | Blocks? |
|---|---|---|---|---|---|
| 1 | **ZUM data reuse rights unclear** (no license statement; IOŚ-PIB name/logo notice; Open Data Act route untested) | Legal exposure; possible takedown of the overlay | Medium | Formal reuse request to IOŚ-PIB; ship facts-only (no logo/branding, nominative "Lista ZUM" references); Stage 5 hard-gated | Stage 5 only |
| 2 | **ZUM has no API/export** — ASP.NET postback scraping, plus broken TLS chains on the official hosts | Fragile ingestion; silent breakage on site redesign | High (eventually) | Snapshot+diff pattern with parse-count gates (exactly how BAFA/PEL failures are caught); curl/custom-CA fetcher; monthly attended runs | Stage 5 only |
| 3 | **PDF drops Polish diacritics** (verified: `ascii()` deletes ą ć ę ł ń ś ź ż) | Corrupted names on the flagship deliverable | Certain if unfixed | Stage 0 Unicode font embed + transliteration guard; regression-compare DE/FR sheets | Yes — fixed in Stage 0 |
| 4 | Program rules churn (edition 31.03.2025; changes effective 20.07.2026 — days after this report; possible Ciepłe Mieszkanie 2026 edition) | Stale funding-page content | High | Criteria-based framing with official links + verified dates (FR pattern); funding text re-verified at each monthly run; news pipeline covers announcements | No |
| 5 | Hidden DE-defaults: an unedited surface silently shows German semantics on PL (market.ts ternaries, `tr()` fallback) | Brand/correctness damage | Medium | The existing "BAFA never leaks" e2e + Polish-language asserts run on PL from Stage 2; checklist in §B.6-1 executed exhaustively | No |
| 6 | ZUM match-rate unknown (EPREL coverage on ZUM entries unverified; industry claims of gaps are secondary) | Overlay could confirm too few products to justify a filter | Medium | Stage-5 spike measures per-method yield before UI commitment; filter enabled only if it divides the catalogue (existing principle) | No (informs Stage 5 shape) |
| 7 | "Typoszereg" family entries = one ZUM id, many subtypes | One-to-many ambiguity | Certain (by design of ZUM) | Evidenced exceptions file (PEL mechanism) using the registry's own family definition as evidence | No |
| 8 | Registration globally paused | Launch without signups | Certain until unpaused | Owner timing decision; flag is per-build-agnostic today | Owner decision |
| 9 | Marking scheme confusion: ZUM listing ≠ grant approval (income/building/audit conditions) | Users misread status as eligibility | Medium | GB-style honesty wording + FR-style criteria framing + explicit disclaimer, native-reviewed | No |

Items 1–2 must be resolved before **Stage 5**; item 3 is resolved **by** Stage 0;
nothing blocks Stages 0–4 after plan approval.

---

## I. Approval Request (owner decisions only)

1. **Overall approach & phasing** — approve shipping PL as: canonical DE-derived
   catalogue, bilingual PL|EN, criteria-based funding framing first (Stages 0–4), ZUM
   listing overlay as a gated second phase (Stage 5).
   *Recommended because* it delivers a complete, honest Polish edition on the proven
   FR path while the only genuinely uncertain workstream (ZUM ingestion rights +
   scraping) is de-risked in parallel. *Alternative:* hold the entire launch until ZUM
   ships — delays everything behind the slowest external dependency. **Blocks all
   implementation** (this is the plan approval itself).
2. **Lista ZUM acquisition posture** — approve (a) sending a formal data-reuse inquiry
   to IOŚ-PIB (Open Data Act route; I will draft it), and (b) building the scraper
   only after that answer, or explicitly accept the facts-only legal reading and
   authorize the scraping spike now.
   *Recommended:* (a)+(b) sequential — cost is calendar time, not effort.
   **Blocks Stage 5 only.**
3. **Billing currency for PL** — recommended: profile currency **PLN** (locale-correct;
   subscriptions show "coming soon" until PLN Paddle prices exist — same posture as
   GB/GBP today). *Alternative:* EUR profile currency to reuse the existing catalogue
   immediately; practical difference is only when Paddle goes live and which currency
   Polish customers see. **Does not block** (profile field is a one-line change either
   way).
4. **Domain** — purchase `heatpumpdb.pl` (recommended, matches .de/.uk/.fr) vs launch
   on `heatpumpdb-pl.web.app` only. Owner action (registrar + DNS). **Does not block.**
5. **PDF font strategy** — recommended: embed one Unicode font for **all** editions in
   Stage 0 (single rendering path, also removes the WinAnsi tightrope for DE/FR).
   *Alternative:* PL-only font with existing path untouched elsewhere — less regression
   surface, permanent dual path. **Does not block** (Stage 0 implements whichever is
   chosen).

Everything else in this report is normal technical judgment under the approved plan.

---

**Ready to begin development after approval** — Stages 0–4 immediately; Stage 5 starts
only after decision I-2 resolves the ZUM data-reuse question, per the stop conditions
in the assignment.
