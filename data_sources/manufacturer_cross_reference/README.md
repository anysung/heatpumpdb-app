# Manufacturer cross-references — official product mappings

A place for mappings a **manufacturer has confirmed**, so they enter the recurring
update with no code change.

Automated matching can only confirm a local listing from reproducible product
identity (exact model, approved alias, exact component identity). Some
manufacturers publish model codes in the local registry that appear nowhere in the
European sources, so no amount of matching logic will ever link them — the only
way through is the manufacturer telling us which product is which.

**Daikin is the standing example.** Its UK PEL codes (`ERGA04EVA`, `EPRA14DW1`,
`EBLQ011CV3`) are variants that do not exist in EPREL, and the German registry
publishes no Daikin component codes at all (it lists marketing names such as
"Altherma 3 H HT ECH2O 500 H 14kW"). 338 PEL rows and ~2,000 canonical Daikin
products therefore cannot be linked automatically, and we will not guess.

## File format

`canonical-to-pel.json` (this directory; commit it — it is evidence, not data):

```json
{
  "version": 1,
  "note": "Mappings confirmed by the manufacturer. Applied as CONFIRMED listings.",
  "mappings": [
    {
      "canonical_id": "16004827",          // bafa_id of the canonical product
      "local_registry": "PEL",
      "local_id": "041-K008-02 a",         // the MCS / PEL identifier
      "manufacturer": "Daikin",
      "evidence": "Daikin UK cross-reference sheet, 2026-08-14, ref DK-UK-2026-08",
      "confirmed_by": "manufacturer_official",
      "added_at": "2026-08-14"
    }
  ]
}
```

`match-canonical-to-pel.mjs` reads this file if it exists and applies each mapping
as a **confirmed** listing with `match_method: 'manufacturer_official'` and
`match_confidence: 'official'`. Official mappings **outrank** automated ones and are
never overwritten by a matcher regression.

## What to ask a manufacturer for

1. their **canonical model designations** (as registered in the European registry
   they supply data to) mapped to
2. their **UK PEL / MCS model designations and certificate numbers**,
3. for the model ranges currently sold in the UK,
4. with a date and a document reference we can cite as evidence.

Do not accept a marketing brochure as a mapping. The mapping must name both codes.

## Adding a mapping

1. Add entries to `canonical-to-pel.json` with the evidence reference.
2. Re-run the update (`node scripts/update-all.mjs`).
3. The dataset gate reports the new confirmed listings; publish as normal.

No code changes, no new matcher, no deploy of application code.
