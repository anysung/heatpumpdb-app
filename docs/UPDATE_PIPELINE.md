# Regular Update Pipeline — design & operations

> Single entry point: `node scripts/update-all.mjs` (see flags below).
> Never run the country builders by hand in production updates — the
> orchestrator owns ordering, verification and deploy.

## 1. The dependency graph (why order matters)

```
                    ┌────────────── EPREL crawl (opt-in, --fetch-eprel) ─┐
                    ▼                                                    │
  BAFA fetch → parse → master seed ──► match BAFA↔EPREL ─► DE builder ───┤
  (--fetch)                (self-accumulating)                │          │
                                                              ├─► FR builder (DE-derived)
  Ofgem PEL fetch → parse (--fetch)                           │
        └─► match canonical→PEL ──────────────────────────────┼─► GB builder
                                                              │
  Lista ZUM fetch → parse (--fetch)                           │
        └─► match canonical→ZUM ──────────────────────────────┴─► PL builder
                                                     (needs built DE datasets)
```

- **FR, GB and PL depend on the BUILT DE datasets** (each derives its
  catalogue from the canonical baseline). DE always runs first —
  the orchestrator computes this from `dependsOn`, never by hand.
- The PL builder additionally appends spec-complete ZUM-native extension
  records (see CLAUDE.md §2 and `scripts/pl/build-app-products-pl.mjs`).
- Matcher steps are **optional overlays**: if one fails, the run continues
  and the builders emit unenriched (but valid) output.
- EPREL is a slow full crawl (~45k records); refresh monthly at most.

## 2. Safety rails (each has caught or prevents a real incident)

| Rail | Where | What it prevents |
|---|---|---|
| Self-accumulating master seed | `build-master-seed.mjs` | Cleaning `parsed/`/`raw/` folders from disk silently dropping products (happened 2026-07-12: 289 June-only products lost; recovered via hosting-release rollback) |
| fetched-at index | `data_sources/bafa/fetched-at-index.json` | Cleaned raw folders breaking `bafa_snapshot_fetched_at` provenance |
| Builder validations | every `build-app-products-*` | Field-shape drift, price-key reintroduction, provenance gaps, duplicate ids |
| Freshness check | orchestrator | Deploying stale datasets after a silently skipped step |
| **Shrink guard** | orchestrator | Any catalogue count dropping below the live datasets (read from `gs://heatpumpdb-datasets` via gcloud, minus 1 canary/file); intentional reductions need `--allow-shrink` |
| Fail-fast + atomic deploy | orchestrator | Partial cross-country deploys — nothing ships unless every dataset verifies |
| Auth-protected datasets + canaries | `scripts/upload-datasets.mjs` + `storage.rules` | Anonymous bulk scraping of the catalogue; canary (honeytoken) records prove extraction if our data surfaces elsewhere |

## 3. Monthly run — commands

```bash
# Regular monthly update (new BAFA + PEL snapshots, refresh EPREL, ship):
node scripts/update-all.mjs --fetch --fetch-eprel --deploy

# Rebuild + ship without fetching new sources (config/logic change):
node scripts/update-all.mjs --deploy

# Inspect the plan without running anything:
node scripts/update-all.mjs --dry-run --fetch --deploy
```

npm aliases: `npm run update:all` / `npm run update:all:deploy`.

## 4. Schedule recommendation (decided 2026-07-12)

- **One sequential run, then deploy all sites together — do NOT stagger.**
  GB/FR derive from DE: staggering deploys by hours only creates windows
  where countries show inconsistent catalogues. Static hosting deploys are
  atomic swaps; releasing four sites back-to-back takes under a minute.
- **When**: monthly, **2nd of the month, 03:00–05:00 Europe/Berlin**, run
  manually (attended). Rationale: the news Cloud Scheduler fires on the 1st
  03:00; sources publish around month start; the 2nd gives BAFA/Ofgem a day
  of slack; the night window minimizes user impact across DE/UK/FR timezones
  (max 1h offset). Attended (not cron) while data volumes still shift —
  the operator reads the shrink-guard/summary before `--deploy`.
- **News is independent**: the Cloud Function handles `countries/<code>`
  news/policies on its own schedule; no coupling with this pipeline.

## 5. Adding a country (expansion checklist)

1. `scripts/<source>/…` fetch/parse/match/build scripts (copy the ofgem or fr
   pattern; builders must keep the validation gates).
2. `PIPELINES` entry in `scripts/update-all.mjs` with correct `dependsOn`
   (DE-derived catalogues depend on `DE`) — execution order is then automatic.
3. `COUNTRY_PROFILES` entry (+ `market.ts`, i18n dictionaries).
4. `vite.config.ts`: `marketStats` files map + `MARKET_HTML` + `__ALL_MARKET_STATS__`.
5. Hosting: `firebase hosting:sites:create`, target in `firebase.json`/`.firebaserc`,
   `build:xx`/`deploy:xx` scripts; add the target to the orchestrator deploy list
   and its datasets to `LIVE_GCS` (shrink guard). THREE per-domain allowlists
   (all three have caused a live incident when missed): reCAPTCHA key domains,
   datasets-bucket CORS (`scripts/infra/storage-cors.json`), and Firebase Auth
   authorized domains (identitytoolkit admin/v2 PATCH or console) — see
   CLAUDE.md §1. Add the market to
   `scripts/upload-datasets.mjs` DATASETS + a canary pair in
   `scripts/canary/canary-records.json` (datasets are served from the
   auth-protected Storage bucket, not hosting).
6. Cloud Function `MARKETS` entry for news.
The admin console picks the new market up automatically from COUNTRY_PROFILES.

## 6. Local disk prerequisites (gitignored, must exist on the build machine)

- `scraper/pricing/output/dataset-enriched-full.json` (DE overlay)
- `data_sources/bafa/idu_odu_mapping/<YYYY-MM>/` (newest auto-selected)
- `data_sources/eprel_raw/raw/<YYYY-MM>/` (for matchers; optional)
- `data_sources/ofgem_pel/parsed/<YYYY-MM>/`
The orchestrator preflights these and aborts with a clear message if missing.

## 7. Disaster recovery

Previous dataset versions survive in Firebase Hosting releases. To recover:
REST-rollback the site to the prior version (see
`scripts/bafa/recover-seed-from-app-export.mjs` header for the 2026-07-12
procedure), curl the old JSON, re-inject with that script, rerun the pipeline.
