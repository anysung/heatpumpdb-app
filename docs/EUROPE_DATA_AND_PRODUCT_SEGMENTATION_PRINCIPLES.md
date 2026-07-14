# Europe data presentation & product segmentation — permanent principles

These are project-wide rules, not per-country decisions. Every country edition —
including ones that do not exist yet — inherits them. Do not add a country branch
to work around any rule here; change the rule, or change the country's configuration.

Related: `CLAUDE.md` (architecture), `src/config/segmentation.ts`,
`src/config/countryProfiles.ts`, `src/hpiq/listing.ts`.

---

## 1. Europe-wide product data presentation

Product information collected from one national European source becomes
**European-market product information** the moment it is shown on any other
country's site.

### 1.1 National terminology stays in its own country

* **The word "BAFA" may appear only on the German site.** Never on the UK, French,
  or any future non-German edition — not in labels, filters, badges, tooltips,
  data sheets, PDFs, empty states, error messages or marketing copy.
* The same applies in reverse to any other national term (PEL/Ofgem/MCS outside the
  UK, MaPrimeRénov'/CEE outside France, and so on).

### 1.2 Do not name the source country

A product is not "German", "British" or "French" because that is where we happened
to collect the record. When data collected in one country is displayed in another,
describe it **neutrally as European-market / European reference information**.

The originating country must not surface in: product pages, filters, comparison
tables, product details, data sheets, badges, tooltips, empty states, PDF output,
user-facing metadata, or explanatory copy.

### 1.3 Provenance is internal, and stays internal

Keep exact provenance for auditing, matching, debugging, pipelines, data-quality
checks and legal traceability: `performance_source`, source registry IDs,
source-country codes, import manifests, matching metadata.

**Internal provenance must never become user-facing wording by default.** An
internal field named `bafa_listing_status` does not license the string "BAFA" in a
UK label. Presentation goes through a resolver, never straight from a field name.

### 1.4 Presence in a European source proves nothing local

Finding a product in a European source does **not** show that it is registered,
certified, listed, sold, or subsidy-eligible in the country being displayed.

Local listing or eligibility wording may be shown **only** when it was determined
against the displayed country's own source:

* German BAFA status → German site only.
* UK PEL status → only from UK PEL data (never inferred from a German listing).
* France has **no national heat-pump list** here (MaPrimeRénov'/CEE are
  criteria-based, not a product list) → **France shows no local listing status at
  all**, and no foreign listing is relabelled as a generic "listed".

---

## 2. One residential / commercial rule for the whole site

HeatPump DB defines the split itself, at a single capacity threshold:

```
residential:  rated capacity ≤ 23 kW
commercial:   rated capacity  > 23 kW
unclassified: no usable rated capacity
```

* Exactly **23.00 kW is residential**. Only **above** 23 kW is commercial. Never `>=`.
* **One threshold for every country.** No per-country threshold, ever.
* **A source's own segment label never decides ours.** National sources disagree:
  the German registry labels some sub-23 kW units "commercial", and the Ofgem PEL
  has no segment concept at all (its records run to 177 kW). Source labels are kept
  internally; they do not drive the Products page.
* The dataset **files** are split by source, not by capacity — so the whole pool is
  re-split at load time. Which file a record arrived in means nothing.
* **A record with no published capacity is NOT filed as residential.** It is
  `unclassified`: excluded from both segments, counted, and disclosed to the user.
  Guessing a capacity class the source never published would be a data-honesty
  breach.

Implementation: `src/config/segmentation.ts` (`classifyProductSegment`,
`ratedCapacityKw`, `splitBySegment`). Canonical capacity, in order:
`power_35C_kw` → `power_design_35C_kw` → `power_55C_kw` → `power_design_55C_kw`.

**23 kW is this site's own rule. It is not an official, legal, or industry-wide
definition, and must never be presented as one.** The Products page says so, in
every language, next to the segment control.

The one capacity, everywhere: whatever number the split is made on is the number
the UI shows, sorts by, and filters on (`HpVM.ratedKw` / `ratedKwNum`). A row must
never display a 55 °C figure — or "—" — beside a segment derived from something
else. Fields explicitly labelled "55 °C" keep the 55 °C value; nothing else does.

*Effect as of the July 2026 datasets (recompute after each update — these move):*

| Market | Residential | Commercial | Unclassified |
|---|---|---|---|
| DE | 5,208 | 1,947 | 0 |
| GB | 2,216 | 2,016 | **2,134** |
| FR | 5,208 | 1,947 | 0 |

The GB unclassified block is real, not a bug: those Ofgem PEL records match no
European product record, and the PEL itself publishes no performance data — so they
have **no rated capacity from any source**. They cannot be placed in a segment
without inventing one, so they appear in neither, and the count is disclosed on the
page. The way to shrink it is better MATCHING (see
`docs/GB_PEL_CAPACITY_RECOVERY.md`, which recovered 611 of the original 2,745 in
July 2026) — never quietly calling them residential.

---

## 3. Only offer a filter that helps discovery

A search filter must **meaningfully divide the active catalogue**. Do not offer one
that returns nearly everything, nearly nothing, or zero — that is a trap, not
discovery. This applies to every country and every future filter.

Do not decide this from "the field exists". Decide it per market, in configuration:

```ts
searchCapabilities: { localListingFilter: boolean }
```

Current settings:

| Market | Local list | Listing filter | Why |
|---|---|---|---|
| DE | BAFA | **offered** | The registry meaningfully splits the catalogue |
| GB | PEL | **not offered** | PEL status splits the catalogue far too unevenly to help |
| FR | none | **not offered** | There is no national list to filter on |

Status that is *informative* but useless as a *filter* still belongs in the product
detail and the data sheet — it is removed from search only.

---

## 4. What a new country inherits automatically

Add a profile to `COUNTRY_PROFILES` and it gets, with no other code change:

1. neutral European-market presentation of imported records;
2. the global 23 kW residential/commercial split;
3. no foreign national terminology in its UI;
4. only the search filters it declares as useful;
5. an independent local-listing status (or none, if it has no national list).
