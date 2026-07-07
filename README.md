# HeatPump DB — multi-country heat pump database app

One codebase, one deployment per country. The active market is selected at
build time via `VITE_COUNTRY_CODE` (profiles in `src/config/countryProfiles.ts`).

| Country | Domain | Registry | Dataset |
|---|---|---|---|
| DE (live) | heatpumpdb.de | BAFA | `public/data/products*.json` |
| GB (in progress) | heatpumpdb.uk | Ofgem PEL / MCS | `public/data/products-gb*.json` |
| FR (planned) | — | — | — |

- App code: `src/` (auth surface, `src/hpiq/` main UI, `src/components/admin/` unified console)
- Data pipelines: `scripts/bafa/` (DE), `scripts/ofgem/` (GB), sources in `data_sources/`
- News pipeline: `google_cloud_function/` (deployed separately via its own `deploy.sh`)
- Project rules: see `CLAUDE.md`

## Build & deploy

```bash
npm install
npm run build              # DE build (default country)
firebase deploy --only hosting
```

Firebase project: `gen-lang-client-0324244302` (linked via `.firebaserc`).
