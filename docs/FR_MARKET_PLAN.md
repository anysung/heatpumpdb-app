# France (FR) Edition — Comprehensive Plan

> Drafted 2026-07-07, after completing the GB edition end-to-end (data → UI → auth →
> hosting → news → enrichment). The plan reuses the proven DE/GB playbook; effort
> estimates assume the same working mode (one focused session per phase).

## 0. What already exists to reuse (proven on GB)

| Component | State | FR work |
|---|---|---|
| `src/config/countryProfiles.ts` | Country registry, one deployment = one country | Add `FR` profile entry |
| `src/hpiq/market.ts` | Single point for market UI semantics | Add FR values (id prefix, links, languages) |
| `src/hpiq/i18n.ts` | EN base + DE market dict + GB market dict pattern | Add FR market dictionary (largest item) |
| `WavingFlag` (BrandLogo.tsx) | Market-driven, clip-path face per country | Add tricolor face (~10 lines) |
| Auth shell | Market-driven flag/chip since c5e773f | FR funding chip string |
| Matcher family (`match-*-to-{bafa,eprel}`) | Conservative brand-gated token matching | Reuse against FR registry |
| EPREL raw snapshot | 45,623 HP registrations on disk (2026-07) | Direct enrichment source |
| Multi-site hosting + `deploy:de/uk` | firebase.json target array | Add `fr` target + site |
| News pipeline `MARKETS` (Cloud Function) | Market-parameterized since 634af49 | Add FR entry + French translations |

## 1. Critical path decision — the primary registry

Unlike DE (BAFA list) and GB (Ofgem PEL), **France has no single public product
eligibility list**: MaPrimeRénov' and CEE eligibility are *criteria-based*
(ηs ≥ thresholds, installer must be RGE-certified), not list-based. Candidates:

1. **NF PAC certified product directory (Certita)** — the French certification mark
   most used as subsidy evidence; public searchable directory. Needs Phase 0
   investigation: export/scrape feasibility, terms of use, record fields.
2. **EPREL as primary source** — already on disk, official EU label data (ηs, design
   output, sound power), proven parser/matcher. Caveat: no reliable per-country
   market-availability filter, and SCOP/COP test points are absent.
3. **Eurovent Certified Performance directory** — rich performance data, but
   coverage/terms need review.

**Recommendation:** Phase 0 evaluates NF PAC first (it is the closest analogue to
"registry with legal meaning in this market", matching the `primaryRegistry` concept).
If export is infeasible or terms prohibit reuse, fall back to **EPREL-primary**
(records brand-gated to suppliers active in France) with `performance_source='EPREL'`
and BAFA_REFERENCE as spec-depth enrichment — both layers already proven.

## 2. Phase plan

### Phase 0 — Source discovery & decision (investigation only)
- NF PAC/Certita directory: structure, record fields (does it carry a certificate
  number usable as `source_id`?), export/scrape feasibility, robots/terms, refresh cadence.
- Confirm MaPrimeRénov'/CEE criteria wording for the funding page (france-renov.gouv.fr,
  anah.gouv.fr, ADEME). Decide primary registry. **Output:** decision note in
  `data_sources/<registry>/manifest.json` (same discipline as ofgem_pel).

### Phase A — FR dataset pipeline (mirror `scripts/ofgem/`)
- `scripts/<registry>/fetch-*` → `parse-*` → `build-app-products-fr.mjs` →
  `public/data/products-fr.json` + `products-commercial-fr.json`.
- `manufacturer-short-names-fr.json` (curated, heuristic + overrides — same generator
  approach as GB).
- Same validation gates: field-count, provenance completeness, unique source_id,
  no price keys. Same honesty rules: subsidy eligibility is criteria-based — the app
  must say "meets/does not meet published criteria where data exists", never
  "eligible". Capacity segmentation only where kW data exists.

### Phase B — Enrichment matching (reuse matcher family)
- `match-fr-to-eprel.mjs` (label data or primary, per Phase 0 decision) and
  `match-fr-to-bafa.mjs` (spec depth: COP test points, refrigerant, noise).
- One performance source per record, never mixed; provenance fields
  (`performance_source`, `*_reference_*`) as on GB.
- Bonus: MaPrimeRénov'/CEE ηs thresholds can be *computed* from enriched ηs values —
  a criteria-check flag (`meets_maprimerenov_criteria: true|false|null`) with the
  criteria version stamped. Null when unenriched. This is FR's analogue of the
  BUS-caveat honesty rule.

### Phase C — App UI adaptation (the largest work item)
- `countryProfiles.ts`: FR entry (EUR, `fr-FR`, `countries/FR`, datasetPaths, subsidy
  labels `MaPrimeRénov' / CEE`, sourceIdLabel per Phase 0 registry).
- **`Language` type gains `'fr'`** — touches both i18n systems (`src/translations.ts`
  auth/admin + `src/hpiq/i18n.ts`) and NewsItem translated fields. Plan for FR/EN
  bilingual UI (a French consumer app must be French-first; GB's English-only shortcut
  does not apply). `UI_LANGUAGES = ['fr', 'en']` for FR builds.
- Full FR market dictionary: nav (`MaPrimeRénov' / CEE` tab), funding page (grant
  amounts by income band — keep amounts vague/linked, they change yearly), guide
  (RGE installer requirement is FR's MCS-analogue), data sheet labels/notes,
  French legal disclaimer.
- Estimated to be ~2× the GB dictionary effort because every string needs real French,
  not English with different market facts.

### Phase D — Auth & brand
- Tricolor `WavingFlag` face; funding chip `Éligibilité MaPrimeRénov' / CEE`;
  language pill shows FR|EN.

### Phase E — Hosting & deploy
- `firebase hosting:sites:create heatpumpdb-fr`; `fr` target → `dist-fr/`;
  `build:fr` (`VITE_COUNTRY_CODE=FR`) + `deploy:fr`; deploy to
  `heatpumpdb-fr.web.app`; custom domain (e.g. heatpumpdb.fr) connected manually
  (Console + DNS) as with heatpumpdb.uk.

### Phase F — News pipeline
- `MARKETS` += FR: research scope MaPrimeRénov'/CEE changes, market stats
  (AFPAC, Uniclima), RE2020, technology; reputable sources ecologie.gouv.fr,
  anah.gouv.fr, ademe.fr, afpac.org.
- Articles bilingual: `title_fr/summary_fr/body_fr` fields (NewsItem type + NewsPage
  language handling — same mechanism as `title_de`).

## 3. Risks / differences vs GB

1. **No product eligibility list** — the registry decision (Phase 0) is the critical
   path; everything else is proven machinery.
2. **French-language surface area** — the single largest cost; both i18n systems and
   news translations. Budget accordingly.
3. **Criteria-based subsidies change yearly** (MaPrimeRénov' income bands) — keep
   amounts out of static strings where possible; link to official sources.
4. **RGE vs MCS semantics** — FR funding flows through RGE installers + ANAH dossiers;
   guide content must reflect the France Rénov' process, not a voucher model.
5. Scraping terms for NF PAC/Certita/Eurovent need legal review before Phase A
   (same discipline as the Ofgem terms notes in `data_sources/ofgem_pel/`).

## 4. Suggested execution order

Phase 0 (investigate + decide, needs user sign-off on registry & domain)
→ A (pipeline) → B (matching) → C (UI/i18n, largest) → D (auth) → E (hosting)
→ F (news). A–B and E are near-mechanical reuse; C is the real work.

## 5. Open decisions for the user

1. Primary registry: NF PAC (pending feasibility) vs EPREL-primary fallback.
2. Domain: heatpumpdb.fr (assumed) — confirm before Phase E.
3. Bilingual FR/EN from day one (recommended) vs French-only.
4. Whether the FR edition ships before or after DE/GB EPREL deep-links
   (label PDF links per registration) — independent tracks.
