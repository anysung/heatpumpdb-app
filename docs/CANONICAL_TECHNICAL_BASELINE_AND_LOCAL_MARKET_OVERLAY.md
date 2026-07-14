# Canonical technical baseline + local market overlay

The architecture every country site is built on. It is not a UK decision — a new
country inherits it by adding a profile, and a country that tries to work around
it is the bug.

Companion documents: `EUROPE_DATA_AND_PRODUCT_SEGMENTATION_PRINCIPLES.md`
(presentation + the 23 kW rule), `UPDATE_PIPELINE.md` (how updates run).

---

## 1. The two layers

```
canonical technical product            ← what the product IS
        │
        ├── Data Sheet eligibility     ← is it fit to publish?
        ├── 23 kW segmentation         ← residential or commercial
        │
        └── local market overlay       ← has THIS country listed it?
```

**The technical layer is shared. The listing layer is local.** They never mix.

The German technical dataset is the canonical baseline. Internally it decides
product identity, manufacturer and model normalization, rated capacity, technical
specifications, segmentation, search, filters, sorting, comparison, Product
Details and the Data Sheet. Externally it is never named: outside Germany these
are European-market products, and the word "BAFA", the source country and German
registration status never appear (see the segmentation/presentation principles).

## 2. Matching direction — this is the whole architecture

```
canonical product → match against the local registry → attach a listing overlay
```

**Never the other way round.** A local registry must not become the public
technical catalogue with its missing specifications reconstructed afterwards from
EPREL, component inference, manual research or any other secondary source.

That is not a hypothetical. The UK was built PEL-first: all 4,422 Ofgem PEL rows
were published as technical products, and because the PEL publishes **no
performance data at all**, their specs were reconstructed from EPREL plus a
component-recovery matcher. The result:

* **2,134 UK "products" had no rated capacity** — no segment, blank data sheet;
* the catalogue depended on which *file* a record arrived in;
* a failed match was displayed as **"Not on PEL"**, which asserts absence from a
  public list on the strength of our own matcher failing.

Under the overlay architecture the product exists because the canonical baseline
says it exists. The registry can only add a listing. **A failed match removes
nothing, changes no capacity, no segment, no specification, and no identity.**

## 3. What the local overlay may and may not do

| The overlay MAY | The overlay MUST NOT |
|---|---|
| confirm local listing status | create a public product |
| carry the local identifier (PEL/MCS id) | supply or overwrite a technical field |
| carry the source record id + snapshot date | change a rated capacity |
| carry match method, confidence and history | change a segment |
| | overwrite manufacturer/model identity |
| | remove a canonical product when no match is found |
| | import another country's listing status |
| | assert subsidy eligibility |

## 4. Listing states — and the one that matters

```
listed                 the local registry lists this product (confirmed match)
verification_required  we could not confirm a match
not_listed             VERIFIED absence
```

**`verification_required` is not `not_listed`.** The absence of an automated match
is a fact about our matching, not about the registry. The UK therefore shows
**"PEL verification required"**, never "Not on PEL".

`not_listed` is only ever producible by a market that **owns** its registry —
Germany, whose catalogue *is* the BAFA snapshot, so a product missing from the
current snapshot really has been delisted. No overlay market can produce it.

**Match stability.** A confirmed mapping that stops matching becomes
`review_required`, keeps its identifier, and is shown as verification-required —
never flipped to a negative status. A matcher regression, a parser change or an
incomplete snapshot is far likelier than a national registry silently removing a
product, and we do not assert removals we cannot prove.

## 5. Evidence required to confirm a listing

Reproducible identity only:

* exact normalized manufacturer + model;
* approved, source-controlled manufacturer aliases (evidence-based, never name similarity);
* exact full-system identity;
* exact component identity where the system relation is clear;
* an official manufacturer cross-reference.

**Never** fuzzy similarity, and **never** an outdoor-unit-only overlap: sharing an
outdoor unit does not prove the registry listed *this* package. Those produce a
human review queue and nothing else.

## 6. Data Sheet eligibility

A public product must be able to produce a data sheet worth reading — a
manufacturer, a model and a registration number is a business card, not a sheet.
One shared, tested rule (`scripts/lib/data-sheet-eligibility.mjs`), applied once in
the canonical builder so every country inherits the same publishable set.

**Required** (each present on 100 % of the canonical baseline): manufacturer,
model, canonical id, type, ηs (35 °C → the energy class), a rated capacity, and a
resolvable segment.

**At least 2 of 5 measured fields**: refrigerant, SCOP, COP A7/W35, COP A2/W35,
outdoor sound power.

Thresholds come from measured availability, never from wishes. Dimensions and
weight exist on only 46 % of records, so they are not required; maximum water
temperature and operating range are not in the schema at all, so they cannot be.

## 7. Deduplication

Identity is the **canonical product**. The old PEL-first build deduplicated by
matched source-record id, which let one shared outdoor unit delete distinct
packages. That whole mechanism is gone: there is nothing to deduplicate, because
products come from one catalogue.

One local certificate legitimately covers **several** canonical packages (one
Clivet MCS number covers five packages of the same 5.5 kW heat pump). That is
normal and is only a contradiction if the packages fall in **different segments** —
which the dataset gate blocks.

## 8. Adding a country

Add a profile to `COUNTRY_PROFILES`:

```ts
technicalBaseline: 'canonical',
localListingOverlay: { source: 'PEL' | 'LOCAL_REGISTRY' | null, filterEnabled: boolean },
```

and the market inherits the canonical catalogue, the 23 kW rule, the eligibility
rule, neutral European presentation, and the listing semantics above. Then supply:
the registry source and its matcher, the confirmed / verification-required wording
in the market dictionary, the local identifier label, and whether a listing filter
actually helps discovery (usually it does not).

**A country with no reliable local list shows no local status at all** (France).
It never borrows another country's, and it never invents a neutral-sounding one.

## 9. Current state (July 2026)

| Market | Public products | Local overlay | Confirmed | Verification required |
|---|---:|---|---:|---:|
| DE | 7,063 | BAFA (owns its registry) | — | — |
| GB | 7,063 | Ofgem PEL | 521 | 6,542 |
| FR | 7,063 | none | — | — |

The UK went from 6,365 records (2,134 of them unclassifiable) to 7,063 products
that all have a capacity, a segment and a data sheet.

## 10. One local id confirms one product

An MCS certificate that lands on several canonical products is not evidence that it
covers them all — it is equally evidence that our matcher over-reached. We cannot
tell the two apart from the data, so we assert neither: the products stay published,
with their specs and their segment, and simply carry no confirmed listing until a
document settles it. 54 identifiers (260 products) are blocked this way today, which
is why the confirmed count is 521 and not 781.

An approved exception (`data_sources/manufacturer_cross_reference/pel-one-to-many-exceptions.json`)
may confirm a one-to-many mapping, but only with an evidence reference AND full
technical compatibility — same manufacturer, capacity, refrigerant and family. An
exception without a document is an override in disguise, and the gate blocks it.
