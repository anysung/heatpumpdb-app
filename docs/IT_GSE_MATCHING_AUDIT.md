# IT — GSE Conto Termico matching audit (2026-07)

Root-cause audit of the canonical↔GSE match rate on the 2026-07 snapshot
(III.A sha256 `b59452e8…`, published by GSE 2026-04-15, fetched 2026-07-18).
Machine-readable evidence: `data_sources/gse_ct/audit/2026-07/` (committed).
Instrumentation: `scripts/it/audit-gse-matching.mjs` + `audit-gse-extraction.mjs`,
running the SAME matcher code as production (`gse-match-lib.mjs`) in switchable
rule modes, so every proposed change was measured before adoption.

## Verdict

The low confirmed rate is **explained by the data, not by the matcher**:

| Where the 10,268 GSE III.A identities go | Count | Share |
|---|---:|---:|
| Out of scope — air/air splits, VRF, packaged AC (5,805), water/air (68), ground-source (178), water/water (133), gas-driven (7): the canonical public catalogue is **100 % air/water** ('Luft / Wasser'), so these have a ZERO comparable pool | 6,191 | 60.3 % |
| In scope (air/water), brand has **zero canonical presence** (Toshiba 240, Innova 153, Eneren 115, Ferroli 93, Lamborghini 93, Ariston 89, Chaffotteaux 89, Beretta 67, De Dietrich 53, Immergas 48, …) — Italian-market brands the German-registry baseline never carried | 1,844 | 18.0 % |
| In scope, brand present, but the **hardware/combination genuinely absent** from canonical (combo absent 801 · monobloc/ODU absent ~498 · model absent 372 — e.g. the whole Vaillant aroTHERM 8.2 generation, Daikin Altherma 4) | ~1,671 | 16.3 % |
| Confirmed combinations (→ 422 products + 50 second-combos of the same product) | 472 | 4.6 % |
| Review candidates (numeric-conflict 52, ambiguous 38, cross-brand 3, …) + guard conflicts (5) | ~95 | 0.9 % |

Rates: raw 4.6 % of identities / 5.9 % of canonical products; **scope-adjusted
11.6 %** (472 of the 4,077 air/water identities). The original 425 were
**largely correct**: manual stratified review found 3 wrong/unproven confirms
(0.7 %), all from the weakest resolution rung — now demoted and structurally
prevented. Parser quality contributes **zero**: 13,613/13,613 rows verified
field-level against the PDF text layer (numeric tails 100 %, token coverage
100 %, 0 ODU/IDU reversals), plus visual comparison of rendered pages.

## What changed (all measured, evidence in `audit/2026-07/delta-*.json`)

1. **False-confirm fixes (425 → 422).** The capacity/spec resolution rungs
   could finish what identity did not start:
   - multi-component packages may now only resolve among candidates containing
     the FULL component identity (was: primary/ODU overlap + capacity — exactly
     the forbidden ODU-only pattern). Killed: Shenling `OU: HPM-V120W/R3-D +
     IU: HM-120/DR3-D` → `…/SR3-B + HM-90/DM` (different indoor unit).
   - `numericSubset` guard: every numeric token of the entry's string must
     appear in the winner's (GREE `…/NpG4-E` ≠ `…/NhH3-E`), while extra
     canonical detail stays allowed (`Vitocal 250-A PRO, Typ …`).
   The 3 demoted mappings are `review_required` (ids withheld, history kept).
2. **Distinct-maker guard**: a shared "MITSUBISHI" token no longer bridges
   Mitsubishi Electric ↔ Mitsubishi Heavy Industries (latent risk; 0 confirms
   affected).
3. **Brand legal-name identity** (`brandCompactIdentity`, ON): exact
   compacted-name identity accepts spacing-only variants ("DEDIETRICH" ↔
   "De Dietrich …"). Measured +0/−0 today — kept because it is exact identity
   with zero false-positive surface.
4. **Rejected after measurement**: '+'-aware package decomposition
   (`plusAwareComponents`) — measured **−4 correct confirms** (the '/'-eager
   split is load-bearing for collapsed notations like Vaillant "(AS/S2)").
   OFF in production; kept as a flag for future re-measurement.
5. **Parser**: dual-registered rows (same unit under Acqua/acqua AND
   Salamoia/acqua — 30 rows, MASTER THERM) now record `scambio_alt` instead of
   silently keeping only the first type.

## Canonical matching-readiness (why component matching is bounded)

Of 7,106 canonical products: ODU identifier available 92.1 % (incl.
outdoor-side display model), **IDU identifier only 21.5 %**, both 21.4 %,
package/system model string 29 %, no component identity at all 7.4 %.
BUT: of the 9,007 unconfirmed GSE entries carrying an ODU id, only **131**
(1.5 %) have that ODU anywhere in same-brand canonical identity
(`component-candidates.json`: canonical-IDU-missing 29, same-core/different-
indoor 17, multiple indoor combos 25, technical conflict 7, rest ambiguous/
package). So missing canonical IDU fields are a MINOR cause; the dominant
cause is that the hardware itself is not in the German-registry baseline.

## Identity granularity

GSE III.A: 13,613 rows → 10,268 identities (brand|model|ODU|IDU) → 8,968
unique ODU+IDU combinations; 4,087 unique ODUs, 3,362 unique IDUs (~1.33
rating rows per identity — climate zones). 50 confirmed combinations were
second combinations of an already-confirmed product (kept as review rows —
one catalogue entry confirms one product; no per-row GSE id exists to carry).

## Public status decision (§ reviewed, unchanged)

`Nel catalogo GSE` (422) / `Verifica catalogo GSE richiesta` (6,681 + 3
review_required) stays. The verification wording never claims Italian-market
establishment or incentive eligibility; the inspector text explicitly says a
failed match is not evidence of absence, and fuori-catalogo appliances remain
incentivabile with full documentation. A component-level public status was
considered and NOT added: 131 component candidates are unproven relationships
(kept as committed audit artifacts for future official cross-references, which
enter via `data_sources/manufacturer_cross_reference/canonical-to-gse.json`).

## Where growth can actually come from (next work, in impact order)

1. **Canonical scope**: the baseline publishes no air/air catalogue — 5,805
   GSE identities are unreachable by design. A deliberate product decision,
   not a matching task.
2. **Official manufacturer cross-references** for Italian-market brands with
   zero canonical presence (3,631 identities in the top-60 alone) — these are
   different-market product lines; only evidence can bridge them (e.g. the
   Ariston Group ↔ ELCO relationship must come from the manufacturer, never
   from name similarity).
3. **Canonical freshness**: newer generations (Vaillant 8.2, Daikin Altherma
   4, NIBE F2050 sizes) will match automatically once they appear in the
   monthly BAFA baseline — no IT-side work needed.
4. The 52 `exact_model_numeric_conflict` review rows (mostly Airwell
   `-19/-25` revision suffixes) need documentation evidence, not looser rules.

## Addendum (2026-07-18, later the same day): the GSE-primary layer shipped

The owner approved making GSE the primary Italy-specific product axis. The
audit above sized the population; the implementation
(`build-app-products-it.mjs` v2.0) now publishes, alongside the unchanged
7,106-product European reference catalogue, the **Italy-only GSE-native
layer: 3,729 products** (in-scope 4,388 − 422 canonical-confirmed − 147
review-blocked − 90 ineligible), under the Italy-specific tier
`gseNativeEligibility`. Temperature-basis mapping: 2,581 dual-row entries
(provable 35/55 °C application pairs) + 240 "LWT"-labelled single rows are
mapped onto the canonical 35/55 fields; 908 basis-unstated entries keep
`gse_ratings` + `declared_capacity_kw` only. IT totals: 10,835 products
(residential 8,548 / commercial 2,287 by the shared 23 kW rule). Isolation is
gate-enforced (GSE_CATALOGUE records outside IT are a blocker) and
architecture-tested; the one-time count/segment transition is declared in
`data_manifests/migration.json` (id 2026-07-it-gse-primary-layer).
