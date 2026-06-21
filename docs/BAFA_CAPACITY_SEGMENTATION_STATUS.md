# BAFA Capacity-Only Segmentation — Status Document

> **Last verified:** 2026-06-21
> **Live URL:** https://gen-lang-client-0324244302.web.app

---

## Milestone Summary

Capacity-only product segmentation is implemented and live on Firebase Hosting.
Cloud Functions, Firestore, and the scheduler were not modified.

### Source-of-truth commits

| Commit | Description |
|--------|-------------|
| `30b4dca` | `refactor(data): apply capacity-based product segmentation` |
| `fe3116e` | `fix(filters): close capacity range decimal gaps` |

---

## Product Policy

### Segmentation authority

BAFA source data provides **no official Residential / Commercial classification**.
The app derives `market_segment` from `power_35C_kw` only. The legacy enriched-dataset
overlay field (`dataset-enriched-full.json → _pricing.market_segment`) is **not** the
segmentation authority.

### Capacity classification rules

| Condition | Segment | Tab |
|-----------|---------|-----|
| `power_35C_kw <= 20.99` | `residential_core` | Residential |
| `21 <= power_35C_kw <= 45` | `light_commercial` | Commercial |
| `power_35C_kw > 45` | `commercial_project` | Commercial |
| `power_35C_kw` null / non-numeric | `null` (pending) | Excluded from default app data |

### BAFA List status

Products are described only as **BAFA List Yes** (`bafa_list_current === true`) or
**BAFA List No** (`bafa_list_current === false`). No cause for BAFA List No is inferred.
Only BAFA List Yes products are included in the default app export.

### Price removal

Market price logic was permanently removed (commit `068e3ae`). No price-like keys
(`equipment_price`, `price_confidence`, `brand_tier`, etc.) appear in any app-facing JSON.
Do not reintroduce price fields.

---

## Current Data Counts

Verified 2026-06-21 against live endpoints and master seed.

| Source | Count |
|--------|-------|
| BAFA master seed total | 7,163 |
| BAFA List Yes | 6,887 |
| BAFA List No | 276 |
| unknown / null | 0 |

App-facing default export (BAFA List Yes products with valid `power_35C_kw`):

| Segment | Count | File |
|---------|-------|------|
| Residential (`residential_core`) | 5,017 | `public/data/products.json` |
| Commercial — Light (`light_commercial`) | 361 | `public/data/products-commercial.json` |
| Commercial — Project (`commercial_project`) | 1,473 | `public/data/products-commercial.json` |
| **Commercial total** | **1,834** | |
| Pending capacity-missing | 36 | `data_sources/bafa/segmentation-pending/2026-06-capacity-missing.json` (gitignored) |
| **BAFA List Yes total** | **6,887** | 5,017 + 1,834 + 36 |

> **Accounting note:** The 36 pending products are already counted within the 6,887 BAFA
> List Yes total. If their capacity is later resolved, the default app-facing total moves
> from 6,851 (5,017 + 1,834) to up to 6,887. The total does not become 6,923.

### Output schema

- **Field count:** 65 per item (both residential and commercial files)
- **Price-like keys:** none
- **Required provenance fields present:** `source_id`, `country`, `primary_source`,
  `bafa_listing_status`, `bafa_snapshot_fetched_at`, `source_snapshot_generated_at`

---

## Capacity Filter Configuration

### Residential (4 ranges)

| Displayed label | Internal bounds | Notes |
|-----------------|-----------------|-------|
| `4 kW ~ 7 kW` | min 4, max 7.999 | Covers decimal values 7.01–7.99 kW |
| `8 kW ~ 11 kW` | min 8, max 11.999 | Covers decimal values 11.01–11.99 kW |
| `12 kW ~ 14 kW` | min 12, max 14.999 | Covers decimal values 14.01–14.99 kW |
| `15 kW ~ 20.99 kW` | min 15, max 20.99 | Policy ceiling; inclusive |

Products with `power_35C_kw < 4` (14 products) have no dedicated filter badge —
this is intentional; they appear in the unfiltered Residential tab.

The prior 505 decimal-gap products (7.01–7.99, 11.01–11.99, 14.01–14.99 kW) are
now covered after commit `fe3116e`. No residential products remain unmatched by
a displayed filter (excluding the intentional `<4 kW` group).

### Commercial (4 ranges)

| Displayed label | Internal bounds | Notes |
|-----------------|-----------------|-------|
| `21 – 45 kW` | min 21, max 45.999 | Covers decimal values 45.01–45.99 kW |
| `46 – 80 kW` | min 46, max 80.999 | Covers decimal values 80.01–80.99 kW |
| `81 – 150 kW` | min 81, max 150 | Inclusive at 150 kW |
| `150+ kW` | min 150.001, max ∞ | Avoids overlap with 81–150 at exactly 150 kW |

The prior 19 decimal-gap commercial products (45.47, 45.98, 80.2–80.8 kW range) are
now covered after commit `fe3116e`. No commercial products remain unmatched.

### Implementation

Both residential and commercial configs override `parseCapacity` in
`src/config/searchConfig.ts` with explicit bounds maps. Display labels are unchanged.

---

## Pending Capacity-Missing Products

**Count:** 36 (all BAFA List Yes)

**Manufacturer breakdown:**

| Manufacturer | Count | `power_55C_kw` range |
|---|---|---|
| Germany GREE GmbH | 18 | 5–15.5 kW |
| CLIVET GmbH | 8 | 30.1–58 kW |
| Kampmann GmbH & Co. KG | 4 | 33.2–58 kW |
| Remeha GmbH | 4 | 41.6–67.8 kW |
| Nilan GmbH | 2 | 4.7 kW |

**Root cause:** BAFA registrations for all 36 products contain `power_55C_kw` but omit
`power_35C_kw`. This absence is present in both the raw/parsed snapshots and the master
seed — confirmed not a parser bug. These products were submitted to BAFA with 55°C test
data only.

**Status:** Remain excluded from default app data. Pending report is written to
`data_sources/bafa/segmentation-pending/2026-06-capacity-missing.json` (gitignored).

**Policy:** Do not substitute `power_55C_kw` for `power_35C_kw`. Do not manually invent
capacity values.

---

## Remaining Limitations

- **36 capacity-missing products** remain pending — excluded from default app data until
  BAFA receives updated registrations with `power_35C_kw`.
- **BAFA List No products** (276) are excluded from the default app export by policy.
  No cause for absence is inferred.
- **No EPREL registration number overlay** — `eprel_registration_number` field exists in
  the schema (nullable) but is not populated.
- **No Ofgem / UK overlay** — schema supports it but UK data has not been imported.
- **No full multi-country product master** — currently DE (BAFA) only.

---

## Recommended Next Milestones

Listed in approximate priority order. None are implemented in this document.

1. **BAFA fresh fetch cycle** — Re-run `fetch-bafa-raw` → `parse-bafa-raw` →
   `build-master-seed` → `build-app-products-from-master-seed` to check whether the 36
   pending products (GREE `GRS-CQ*`, CLIVET `WiSAN-YSE1`, Kampmann `KaClima`, Nilan
   `Air9`, Remeha `Effenca 400`) now have `power_35C_kw` in updated BAFA registrations.

2. **EPREL matching design** — Plan how to match BAFA products to EPREL registration
   numbers using manufacturer + model string matching (confidence-scored). Populate the
   `eprel_registration_number` field after validation.

3. **BAFA dataset versioning / diff** — Track new / changed / removed products between
   monthly BAFA snapshots. Required before any "product delisted" or "new model" alert
   feature.

4. **Ofgem / UK overlay** — Import UK MCS product registry. Requires a separate source
   profile and export pipeline.

5. **Full multi-country product master** — Extend beyond DE to a unified schema covering
   multiple national registries.

---

## Verification Commands

### Local count validation

```bash
node -e "
const fs = require('fs');
const r = JSON.parse(fs.readFileSync('public/data/products.json','utf8')).items || [];
const c = JSON.parse(fs.readFileSync('public/data/products-commercial.json','utf8')).items || [];
const priceRegex = /price|pricing|eur|equipment_price|market_price|price_confidence|price_basis/i;
function priceKeys(items){ return [...new Set(items.flatMap(i => Object.keys(i)))].filter(k => priceRegex.test(k)); }
console.log('residential:', r.length);
console.log('commercial:', c.length);
console.log('residential >=21 (should be 0):', r.filter(i => Number(i.power_35C_kw) >= 21).length);
console.log('commercial <21 (should be 0):', c.filter(i => Number(i.power_35C_kw) < 21).length);
console.log('residential price-like keys (should be empty):', priceKeys(r));
console.log('commercial price-like keys (should be empty):', priceKeys(c));
console.log('residential fields (should be 65):', Object.keys(r[0] || {}).length);
console.log('commercial fields (should be 65):', Object.keys(c[0] || {}).length);
"
```

### Live endpoint validation

```bash
curl -I https://gen-lang-client-0324244302.web.app/data/products.json
curl -I https://gen-lang-client-0324244302.web.app/data/products-commercial.json
```

### Price-key regression check (source files)

```bash
grep -RIn "equipment_price\|market_price\|price_confidence\|brand_tier\|capacity_band\|refrigerant_group" \
  src/ scripts/ --include="*.ts" --include="*.tsx" --include="*.mjs" | \
  grep -v "PRICE_KEY_FRAGMENTS" | grep -v "#"
```

No matches expected. The `PRICE_KEY_FRAGMENTS` constant in
`scripts/bafa/build-app-products-from-master-seed.mjs` is the guard that actively blocks
these keys from appearing in the output — finding it is expected and correct.

### Regenerate and build

```bash
# Regenerate app-facing data from master seed
export PATH="/Users/christophersung/.nvm/versions/node/v20.19.6/bin:$PATH"
node scripts/bafa/build-app-products-from-master-seed.mjs

# Build
npm run build
```

### Deploy Hosting only (when ready)

```bash
firebase deploy --only hosting
```

Do not deploy Cloud Functions.
