# HeatPump DB — multi-country heat pump database app

One codebase, one deployment per country. The active market is selected at
build time via `VITE_COUNTRY_CODE` (profiles in `src/config/countryProfiles.ts`).

| Country | Domain | Registry | Dataset |
|---|---|---|---|
| DE (live) | heatpumpdb.de | BAFA | `public/data/products*.json` |
| GB (live) | heatpumpdb.uk (DNS pending) | Ofgem PEL / MCS | `public/data/products-gb*.json` |
| FR (live) | heatpumpdb.fr (DNS pending) | BAFA-derived + NF PAC refs | `public/data/products-fr*.json` |

- App code: `src/` (auth surface, `src/hpiq/` main UI, `src/components/admin/` unified console)
- Data pipelines: `scripts/bafa/` (DE), `scripts/ofgem/` (GB), sources in `data_sources/`
- News pipeline: `google_cloud_function/` (deployed separately via its own `deploy.sh`)
- Project rules: see `CLAUDE.md`

## Build & deploy (multi-site hosting)

One Firebase project, one Hosting **site per country**. Targets are mapped in
`.firebaserc` (`de` → `gen-lang-client-0324244302`, `uk` → `heatpumpdb-uk`);
per-target config lives in `firebase.json` (`de` serves `dist/`, `uk` serves `dist-uk/`).

```bash
npm install

# Germany — https://gen-lang-client-0324244302.web.app (heatpumpdb.de)
npm run deploy:de          # = build:de (dist/) + firebase deploy --only hosting:de

# United Kingdom — https://heatpumpdb-uk.web.app (heatpumpdb.uk pending DNS)
npm run deploy:uk          # = build:uk (VITE_COUNTRY_CODE=GB → dist-uk/) + firebase deploy --only hosting:uk

# France — https://heatpumpdb-fr.web.app (heatpumpdb.fr pending DNS)
npm run deploy:fr          # = build:fr (VITE_COUNTRY_CODE=FR → dist-fr/) + firebase deploy --only hosting:fr
```

- **Always deploy a named target** (`hosting:de` / `hosting:uk`) — a bare
  `firebase deploy --only hosting` would deploy every target at once.
- Rebuild the country datasets (`scripts/bafa/`, `scripts/ofgem/`) before deploying —
  `public/data/` is gitignored and copied into both builds.
- Custom domain (heatpumpdb.uk): connected manually in Firebase Console →
  Hosting → site `heatpumpdb-uk` → Add custom domain (TXT verification + A/AAAA
  records at the registrar). Not managed from this repo.

Firebase project: `gen-lang-client-0324244302` (linked via `.firebaserc`).
