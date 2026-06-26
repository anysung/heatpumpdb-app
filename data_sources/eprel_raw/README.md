# EPREL Raw Data — Acquisition Workspace

**Status: inspection complete — bulk download NOT performed, awaiting official Public API key.**

> **This raw EPREL data is not yet integrated with the BAFA dataset.**
> Nothing in this folder is read by the app, the BAFA pipeline, or `public/data/*`.

## What was checked (2026-06-12)

- The public EPREL website (`https://eprel.ec.europa.eu/`) is an Angular SPA backed by JSON
  endpoints under `/api/...`. No robots.txt is published (the SPA shell is returned for `/robots.txt`).
- The product group **`spaceheaters` ("Space heaters/Combination heaters", Reg. (EU) 811/2013)
  contains both target categories** in one group:
  - 56,475 total records, of which **45,295 are heat pumps** (`type=HEAT_PUMP`):
    18,328 `category=SPACE_HEATER` + 26,967 `category=COMBINATION_HEATER`.
- Related groups confirmed to exist: `spaceheaterpackages` (111,497 — package-level, includes
  `heatPumpContribution` fields but no working server-side heat-pump filter found),
  `spaceheatertemperaturecontrol` (840), `spaceheatersolardevice` (207). `waterheaters` (11,887)
  noted as out of scope.
- List responses carry ~119 raw fields per record (see field list below) — rich enough that
  per-product detail calls are mostly redundant (the detail endpoint returns the same 119 fields).

## Access method and legal position

- The site's own JSON endpoints answer without authentication when a normal browser `Referer`
  header is present (CloudFront/WAF rule; 403 otherwise). **Technically reachable — but per
  project decision (2026-06-12) we do NOT bulk-scrape these anonymously.**
- The **official bulk channel is the EPREL Public API**, which requires a free API key:
  request form at <https://eprel.ec.europa.eu/screen/requestpublicapikey>.
  Endpoint documentation is in the EU-Login-protected EPREL wiki delivered with the key.
- Official Terms & Conditions (in force since 2024-06-03) are archived in
  [`terms/EPREL_Public_API_Terms_and_Conditions_EN.pdf`](terms/EPREL_Public_API_Terms_and_Conditions_EN.pdf). Key points:
  - **Permitted (Art. 4 §1):** commercial and non-commercial reuse as value-added services,
    derivative works, research, internal market analysis, and use in *"mobile applications and
    other comparison tools"* — this matches the Heatpump Data Base use case.
  - **Prohibited (Art. 4 §2):** selling the raw data as-is; restricting others' reuse; misleading
    modifications; **failing to keep locally stored data up to date** (a standing refresh
    obligation once we store EPREL data); circumventing technical limitations.
  - **Required (Art. 4 §3):** attribution to the European Commission / EPREL.
  - Data accuracy is supplier-declared and not guaranteed (Art. 7) — UI must carry a disclaimer.

## How the (sample) download was performed

Only small inspection samples were fetched (single-record probes per group, one 100-record page
as a schema reference, one product-detail record — 109 records total, ~0.2% of one category).
Requests were single, paced, and sent with an identifying User-Agent. They are stored verbatim
under [`raw/test/`](raw/test/).

## Completeness

**Partial by design.** No category was bulk-downloaded. The full download is prepared but gated:

```bash
node scripts/eprel/fetch-eprel-raw.mjs            # dry-run (no key): prints plan only
EPREL_API_KEY=... node scripts/eprel/fetch-eprel-raw.mjs --test   # 2 pages/category → raw/test/official-api/
EPREL_API_KEY=... node scripts/eprel/fetch-eprel-raw.mjs --full   # full download → raw/<category>/
```

The script refuses bulk operation without `EPREL_API_KEY`, probes candidate official API bases
before fetching, paces at 1 req/s with retry/backoff, saves responses byte-for-byte, and can
only write inside `data_sources/eprel_raw/`.

## Fields observed (spaceheaters heat-pump records)

Identity/metadata: `eprelRegistrationNumber`, `productModelCoreId`, `modelIdentifier`,
`supplierOrTrademark`, `trademarkOwner`, `organisation`, `category` (SPACE_HEATER /
COMBINATION_HEATER), `type` (HEAT_PUMP / …), `implementingAct`, `onMarketStartDate`,
`onMarketEndDate`, `firstPublicationDate`, `versionNumber`, `lastVersion`, `status`, `blocked`,
`modelAvailabilityInEUEEACountries`.
Energy/performance: `energyClass` (+35/55 variants), `seasonalSpaceHeatingEnergyEfficiency`
(average/cold/warm × 35/55), `ratedHeatOutput` (average/cold/warm × 35/55), annual energy
(kWh/GJ variants), `loadProfile`, water-heating efficiency fields (combination heaters).
Acoustics: `noise` (indoor LWA), `outdoorNoise` (outdoor LWA).
Label artifacts: `energyLabelId`, `generatedLabels`, `uploadedLabels`,
`energyClassImageWithScale`. Public product URL pattern:
`https://eprel.ec.europa.eu/screen/product/spaceheaters/<registrationNumber>`.
Not observed in list responses: GTIN, supplier contact details (null in samples).

## What was NOT downloaded and why

- **The 45,295 heat-pump records** — waiting for an official API key (project policy: no
  anonymous bulk scraping).
- **`spaceheaterpackages` (111,497)** — additionally blocked on finding a server-side heat-pump
  filter in the official docs; downloading 111k mostly non-heat-pump package records is wasteful.
- **Temperature controls (840) and solar devices (207)** — trivially small, but held to the same
  key-first policy; included in the prepared script.
- **Label PNGs/PDFs and product information sheets** — deferred until the official API documents
  these endpoints.

## Folder layout

```
data_sources/eprel_raw/
  README.md            this file
  manifest.json        machine-readable acquisition status
  fetch-log.md         chronological log of every request batch
  terms/               archived official API Terms & Conditions (PDF)
  raw/
    test/              small inspection samples (verbatim API responses)
    test/official-api/ (future) --test output after key issuance
    spaceheaters-heatpump/      (future) page-NNNN.json from --full
    temperature-controls/       (future)
    solar-devices/              (future)
```

Convention note: the repo previously kept raw source data inside `scraper/` (BAFA). A separate
top-level `data_sources/` is used here intentionally so EPREL acquisition stays fully isolated
from the production BAFA pipeline until integration is explicitly approved.
