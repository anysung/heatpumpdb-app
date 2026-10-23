# HeatPump DataBase Europe — Special Report, October 2026
## Research dossier / complete content record

**Report title:** *The Complete F-Gas Rulebook for Heat Pumps*
**Subtitle:** *EU Regulation 2024/573 in one document: every refrigerant, every size, every date to 2050 — and what changes in five markets.*
**Edition:** October 2026 · **Published:** 2026-10-23 · **Tier:** Premium (first Premium edition)
**Markets:** Germany · United Kingdom · France · Poland · Italy
**Purpose of this file:** the legal sources, the rule reduction, the data and the editorial rules
behind the report. Every date and figure on every page traces to a line in this file.
**Regenerate the report:** `node data_sources/special_report/2026-10/source/build-report.mjs`
(copy in `source/strings/<lang>.json`, data in `source/data.json`, rule function in `source/pages.mjs`).

---

## 1. Editorial rules

1. **"Placing on the market", never "banned".** Every year in the report is the *last calendar year a
   NEW unit may be placed on the EU market*. Never write "R32 is banned" — stock placed earlier may
   still be sold and installed (§3).
2. **One rule function.** All tables derive their years from `lastYear(segment, GWP, natural)` in
   `source/pages.mjs`. No year is typed by hand into a table.
3. **GWP as listed in the Regulation** (AR4 for HFCs; blends computed with the Annex VI formula).
4. **Safety exemption is mentioned, not modelled.** Every Annex IV date carries it (§2.3); the tables
   show the rule without the exemption and say so in a footnote.
5. **Subsidy facts only from the scheme's own text.** No eligibility claims; "check on the day of the
   quote" on the national page.
6. **No catalogue model counts in the tables** (owner, 2026-10-23). Only two catalogue shares are used:
   56% (residential, GWP ≥ 150) and 44% (residential, R290).

---

## 2. The Regulation — Annex IV reduced to seven segments

Source: Regulation (EU) 2024/573, Official Journal text obtained via Publications Office
(ELI http://data.europa.eu/eli/reg/2024/573/oj), cross-checked with EHPA, *The new F-gas Regulation:
detailed guidelines* (Nov 2024).

### 2.1 Annex IV points used

| Point | Equipment | Capacity | Prohibited | From |
|---|---|---|---|---|
| 8(b) | Self-contained (monoblock) AC and heat pumps | ≤ 12 kW | GWP ≥ 150 | 1 Jan 2027 |
| 8(c) | Self-contained AC and heat pumps | ≤ 12 kW | any F-gas | 1 Jan 2032 |
| 8(d) | Self-contained AC and heat pumps | > 12 to ≤ 50 kW | GWP ≥ 150 | 1 Jan 2027 |
| 8(e) | Other self-contained AC and heat pumps | > 50 kW | GWP ≥ 150 | 1 Jan 2030 |
| 9(a) | Single split, charge < 3 kg | — | GWP ≥ 750 | 1 Jan 2025 |
| 9(b) | Split air-to-water | ≤ 12 kW | GWP ≥ 150 | 1 Jan 2027 |
| 9(c) | Split air-to-air | ≤ 12 kW | GWP ≥ 150 | 1 Jan 2029 |
| 9(d) | Split (all) | ≤ 12 kW | any F-gas | 1 Jan 2035 |
| 9(e) | Split (all) | > 12 kW | GWP ≥ 750 | 1 Jan 2029 |
| 9(f) | Split (all) | > 12 kW | GWP ≥ 150 | 1 Jan 2033 |
| 7(d) | Chillers (primary function: cooling) | > 12 kW | GWP ≥ 750 | 1 Jan 2027 |

Point 8 excludes chillers. A heating-first hydronic heat pump above 50 kW reads as 8(e); a
cooling-first chiller as 7(d). The report states this in the page-4 footnote and page-5 row "> 50 kW".

### 2.2 The seven segments and the rule function

Report segments (residential ≤ 23 kW / commercial > 23 kW is HeatPump DB's own split):

| Segment | Rule → last year of new supply |
|---|---|
| Monoblock ≤ 12 kW | GWP ≥ 150 → 2026 · F-gas < 150 → 2031 · natural → none |
| Split air/water ≤ 12 kW | GWP ≥ 750 → 2024 (9(a), < 3 kg) · GWP ≥ 150 → 2026 · F-gas < 150 → 2034 · natural → none |
| Monoblock 12–23 kW, 23–50 kW | GWP ≥ 150 → 2026 · below → none |
| Split 12–23 kW, > 23 kW | GWP ≥ 750 → 2028 · GWP ≥ 150 → 2032 · below → none |
| Monoblock > 50 kW | GWP ≥ 150 → 2029 · below → none |

### 2.3 Safety exemption, labelling, evidence

- Every point above: "except if required to meet safety requirements at the site of operation".
  Point 8 adds: the GWP limit then becomes 750. Point 9 has no 750 text.
- Art. 12(15): equipment relying on the exemption is labelled for that use.
- Art. 13(19)–(20): putting such equipment into operation after the date requires evidence (safety
  requirement, or placing on the market before the date), kept for 5 years.
- Art. 11(2): lifecycle-CO₂ exemption via Ecodesign — no heat-pump finding exists (not used).

### 2.4 Servicing and quota

- Art. 13(4): from 1 Jan 2026 virgin F-gas with GWP ≥ 2,500 may not be used to service AC and heat
  pumps; reclaimed/recycled allowed until 1 Jan 2032. No 750 servicing rule for heat pumps.
- Annex VII HFC maximum quantities (t CO₂e): 2025–26 42,874,410 · 2027–29 21,665,691 ·
  2030–32 9,132,097 · 2033–35 8,445,713 · 2036–38 6,782,265 · 2039–41 6,136,732 ·
  2042–44 5,491,199 · 2045–47 4,845,666 · 2048–49 4,200,133 · 2050 → 0.

---

## 3. Stock already on the market

- Art. 3(6): "placing on the market" = customs release for free circulation, or first supply in the Union.
- Art. 11(1): one year after each Annex IV date, further supply of products lawfully placed before
  the date is allowed only with evidence of that placing.
- Art. 23(10)(b): customs check that presented products do not fall under Art. 11(1) prohibitions →
  banned equipment presented after the date is stopped at the border.
- DG CLIMA reading (via EHPA, webinar 11 Jan 2024): the prohibition applies to each single product;
  units acquired from the manufacturer before the date may still be sold.

Report wording (all pages): *"Stock placed earlier may still be sold and installed — from one year
after the date, with proof of when it was placed."*

---

## 4. GWP values

| Refrigerant | GWP | Basis | Class | Safety | PFAS component |
|---|---|---|---|---|---|
| R290 propane | 0.02 (shown ≈ 0) | Annex VI | natural | A3 | no |
| R744 CO₂ | 1 | definition | natural | A1 | no |
| R717 ammonia | 0 | Annex VI | natural | B2L | no |
| R1234yf | 0.501 (shown < 1) | Annex II | F-gas < 150 | A2L | yes |
| R1234ze(E) | 1.37 (shown 1) | Annex II | F-gas < 150 | A2L | yes |
| R454C | 146 (145.5) | blend, Annex VI formula | F-gas < 150 — marginal (± 1% tolerance ≈ 152) | A2L | yes (R1234yf) |
| R515B | 288 | blend R1234ze(E)/R227ea 91.1/8.9 | 150–749 | A1 | yes |
| R454B | 465 | blend | 150–749 | A2L | yes (R1234yf) |
| R450A | 601 | blend R134a/R1234ze(E) 42/58 | 150–749 | A1 | yes |
| R513A | 630 | blend | 150–749 | A1 | yes |
| R32 | 675 | Annex I (AR4) | 150–749 | A2L | **no** |
| R452B | 697 | blend | 150–749 | A2L | yes |
| R134a | 1,430 | Annex I (AR4) | ≥ 750 | A1 | yes |
| R407C | 1,774 | blend | ≥ 750 | A1 | yes |
| R410A | 2,088 | blend | ≥ 750 | A1 | yes |

Blend compositions are standard ASHRAE 34 compositions (not printed in the Regulation).
PFAS: OECD definition; EU universal PFAS restriction — RAC final opinion 2 Mar 2026, SEAC final
opinion expected end 2026, nothing adopted (secondary sources; echa.europa.eu blocked fetches).

---

## 5. National layer (checked 2026-10-23)

| Market | Variable | Status | Source |
|---|---|---|---|
| DE | BEG EM: from 1 Jan 2028 only heat pumps with natural refrigerants (R290, R600a, R1270, R717, R718, R744) are funded | VERIFIED | BAnz AT 27.08.2026 B1, Anlage 3.4.4 |
| DE | 5-point efficiency bonus not continued; guideline in force 21 Jul 2026 | VERIFIED | BAnz AT 27.08.2026 B1; BWP 18 Jul 2026 |
| DE | 15-point bonus for heat pumps of EU origin from Q1 2027 | VERIFIED | BAnz, 8.4.6 |
| DE | ChemKlimaschutzV: Sachkunde extended to propane/CO₂; old certificates valid to 12 Mar 2029 | VERIFIED (secondary) | IHK/DIHK |
| GB | Own F-gas regime; no 2027 heat-pump ban; only single split < 3 kg, GWP > 750 (from 2025), air-to-water singles exempt | VERIFIED | gov.uk bans page, updated 27 Aug 2026 |
| GB | Boiler Upgrade Scheme: no refrigerant condition (≤ 45 kW, MCS, SCOP ≥ 2.8) | VERIFIED | SI 2022/565 reg. 9 |
| NI | Regulation 2024/573 applies directly | VERIFIED | DAERA |
| FR | CEE BAR-TH-171 vA82-5: no refrigerant/GWP criterion | VERIFIED | fiche text |
| FR | MaPrimeRénov': no refrigerant criterion found | UNVERIFIED — not stated in the report | — |
| FR | ERP (CH 35): charge limits for A2L/A2/A3 refrigerants in public buildings, from 10 Sep 2025 | VERIFIED (secondary) | FFB, 17 Mar 2026 |
| FR | HFC tax repealed | VERIFIED | loi 2025-127 art. 72 |
| PL | Czyste Powietrze: no refrigerant criterion; Lista ZUM entry on invoice date | VERIFIED | programme annex 2 (20 Jul 2026) |
| PL | F-gas act amended (Dz.U. 2025 poz. 1863, in force 13 Jan 2026) | VERIFIED (secondary) | Inforlex |
| IT | Conto Termico 3.0: no GWP condition for air/water; lower ηs threshold for air/air ≤ 12 kW with GWP < 150 | VERIFIED (secondary) | DM 7 Aug 2025; GSE webinar 3 Feb 2026 |
| IT | DPR 146/2018 and D.Lgs 163/2019 being updated | VERIFIED | MASE, 15 Oct 2026 |
| EEA | Regulation 2024/573 not yet incorporated (NO/IS/LI) | partly UNVERIFIED — not stated in the report | EEA-Lex |
| EU | Omnibus IV (COM(2025) 501) changes only Art. 20(4)(a) portal registration, not Annex IV dates | VERIFIED (proposal text); adoption status UNVERIFIED | COM(2025) 501 |

---

## 6. Catalogue figures

Source: HeatPump DB European reference catalogue (`public/data/products.json` +
`products-commercial.json`), October 2026 build: 7,416 models; residential (≤ 23 kW) 5,452.

- Residential with GWP ≥ 150 (R32, R410A, R454B, R452B, R407C, R513A): 3,055 of 5,452 → **56%**.
- Residential with R290: 2,379 of 5,452 → **44%**.

Rated capacity = heating output at 35 °C (the app's segmentation capacity).

---

## 7. Page plan (8 pages)

1. Cover — title, 1 Jan 2027 · 2035 · 56%
2. Refrigerant × capacity → last year of new supply (+ national one-liners)
3. Year × capacity → bars by GWP class (Today / 1 Jan 2027 markers)
4. Year × refrigerant → ○ △ × (residential | commercial & industrial, 15 refrigerants)
5. Year × capacity → nine key dates (+ quota and servicing)
6. GWP class × capacity at 1 Jan 2027 / 2030 / 2035 (+ F-gas class table, build icons, 44%)
7. Refrigerant passports (GWP, safety class, PFAS, deadlines by build, Germany BEG 2028)
8. Five markets — ban dates · for the installer · subsidy (+ 56%)
