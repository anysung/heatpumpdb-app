# Energy defaults — Running cost & CO₂ calculator

`src/config/energyDefaults.json` holds the default energy prices and CO₂ factors
of the Premium **Running cost & CO₂** calculator (`src/hpiq/features/cost/`),
one block per market. Every value carries `source`, `url` and `asOf`; the page
shows "defaults as of <markets.XX.asOf> — edit to your tariff", and the customer
PDF lists every source (a value the user changed is marked "custom value").

## Refresh: twice a year (owner rule)

Refresh in **April** and **October**. Those months follow the Eurostat semester
releases, the GB price-cap quarters and the ARERA/CRE tariff steps. Refresh
outside the monthly data window. It is a JSON edit plus a normal release.

1. For each market, re-read the primary source (table below) and update
   `value` and `asOf`. Also fix `note` if the basis changed (VAT, a tariff
   freeze, a new method).
2. Keep the bases consistent (see `_readme` in the JSON):
   - Prices are all-in household prices per kWh, including taxes.
   - Gas kWh and gas CO₂ are on the **gross calorific value** (Hs / PCS /
     gross CV). The same basis applies to billing and to boiler seasonal
     efficiency under EU 813/2013.
   - To convert a net-CV (Hi / PCI) factor, divide it by 1.11.
3. Set `markets.XX.asOf` to the refresh date and bump `version`.
4. Run `node tests/cost-model.unit.mjs`. It checks for sources, URLs, ISO
   dates, plausible CO₂ ranges, currencies, and no "BAFA" outside DE.
5. Mention the refresh in the release notes.

| Market | Electricity | Heat-pump tariff | Gas | Grid CO₂ | Gas CO₂ |
|---|---|---|---|---|---|
| DE (EUR) | BDEW Strompreisanalyse | Verivox Wärmepumpenstrom (no official average exists) | BDEW Gaspreisanalyse | UBA emission factor of the electricity mix | UBA natural gas factor (Hi → Hs) |
| GB (GBP) | Ofgem price cap (current quarter) | — | Ofgem price cap | DESNZ GHG conversion factors (generation + T&D) | DESNZ natural gas, gross CV |
| FR (EUR) | CRE TRVE Tarif Bleu Base | — | CRE prix repère gaz (chauffage) | ADEME heating-use content (RE2020/DPE) | ADEME Base Empreinte (PCI → PCS) |
| PL (PLN) | Eurostat nrg_pc_204 (URE G11 as cross-check) | — | URE W-3.6 tariff + distribution (Eurostat PL gas is confidential) | KOBiZE final-consumer factor | KOBiZE natural gas (Hi → Hs) |
| IT (EUR) | ARERA vulnerable-customer reference | — | ARERA vulnerable-customer reference (Smc → kWh at 10.70 kWh/Smc) | ISPRA consumption factor | ISPRA natural gas (Hi → Hs) |

Cross-check prices against Eurostat `nrg_pc_204` (electricity) and `nrg_pc_202`
(gas), using the band DC / D2 all-taxes series.

### Known soft spots (2026-09-29)

- **PL gas (0.38 PLN/kWh)** is the midpoint of the published 0.35–0.42 all-in
  range. It is not a single official figure. Replace it when URE or GUS publish
  an all-in household value.
- **FR:** the electricity and gas values come from the CRE decisions as quoted
  by price comparators. At the next refresh, open the official EDF grid and the
  CRE page directly.
- **IT:** the electricity value is Q3 2026. Take Q4 when ARERA publishes it.

## Building standards (heat-demand helper)

`buildingStandards.values` are space-heating demand in kWh/m²·a. They come from
the co2online *Heizspiegel für Deutschland* (German stock), using the
consumption bands low, medium and elevated, plus an age band for "renovated".
Each band is multiplied by 0.9 to turn gas consumption into useful heat.

These values describe the German building stock. The UI says so and the user
can always type the demand directly. Update them when a new Heizspiegel
appears (yearly, in autumn).

## Model (for reference)

The model lives in `costModel.ts` and is covered by `tests/cost-model.unit.mjs`.

- Heat-pump electricity = demand ÷ SCOP.
  - At 35 °C the SCOP is the published SCOP. If that is missing or
    plausibility-flagged, it is derived as 2.5·(ηs35+3)/100.
  - At 55 °C it is 2.5·(ηs55+3)/100.
  - If neither is available, the user enters a SCOP.
- Gas = demand ÷ boiler seasonal efficiency. The default is 0.90.
- Cost = kWh × price. An optional annual standing-charge difference is added
  on the gas side.
- CO₂ = kWh × factor.
- The heat-pump side carries a ±20 % band.
