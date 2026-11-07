import assert from 'node:assert/strict';
import {
  fgasAllowed, refrigerantFromName, relativeNoiseStars, brandStarsFor, displayBrand, looksGroundSource, numberOnlyModel, sameProductGroup, modelNameForms, sameBrand, brandId, brandNamer, modelWithoutBrand, climateValues, displayFunding, energyClass35, energyClass55, excludedFromMarket, fundingState,
  groupSeries, incredibleScop, noiseStarsFromDb, publishable, scopFromEta, stripCompanyForm,
} from '../scripts/finder/consumer-rules.mjs';

// A failed match is never "not listed". Only the market owning its list can say so.
assert.equal(fundingState({ list: 'overlay', status: 'verification_required' }), 'verify');
assert.equal(fundingState({ list: 'overlay', status: 'review_required' }), 'verify');
assert.equal(fundingState({ list: 'overlay', status: 'confirmed' }), 'listed');
assert.equal(fundingState({ list: 'owned', listedDe: 'delisted' }), 'delisted');
assert.equal(fundingState({ list: 'owned', listedDe: 'listed_in_snapshot' }), 'listed');
assert.equal(fundingState({ list: 'owned', listedDe: null }), 'verify');
assert.equal(fundingState({ list: null }), null);
// Outside the ranking markets only a confirmed listing is shown.
assert.equal(displayFunding('verify', false), null);
assert.equal(displayFunding('listed', false), 'listed');
assert.equal(displayFunding('verify', true), 'verify');

// Only an explicit exclusion removes a model.
assert.equal(excludedFromMarket({ availabilityInEUEEACountries: 'ALL' }, 'ES'), false);
assert.equal(excludedFromMarket({ availabilityInEUEEACountries: 'AS_SPECIFIED', modelAvailabilityInEUEEACountries: ['DE'] }, 'ES'), true);
assert.equal(excludedFromMarket({ availabilityInEUEEACountries: 'AS_SPECIFIED', modelAvailabilityInEUEEACountries: ['ES'] }, 'ES'), false);
assert.equal(excludedFromMarket({ availabilityInEUEEACountries: 'NONE' }, 'ES'), true);
assert.equal(excludedFromMarket(null, 'ES'), false);
assert.equal(excludedFromMarket({ availabilityInEUEEACountries: 'NONE' }, null), false);

// The average climate keeps the canonical value. EPREL fills only cold and warm.
const base = { eta35: 180, eta55: 130, kw35: 8, kw55: 7 };
const eprel = { seasonalSpaceHeatingEnergyEfficiencyCold35: 150, seasonalSpaceHeatingEnergyEfficiencyCold55: 110, ratedHeatOutputCold35: 9, seasonalSpaceHeatingEnergyEfficiencyAverage35: 999 };
assert.deepEqual(climateValues(base, eprel, 'average'), { ...base, basis: 'average' });
assert.equal(climateValues(base, eprel, 'cold').eta35, 150);
assert.equal(climateValues(base, eprel, 'cold').basis, 'cold');
assert.equal(climateValues(base, null, 'cold').basis, 'average');

// One decimal, and the published grade carries no dB value.
assert.equal(scopFromEta(180), 4.6);
assert.equal(noiseStarsFromDb(50), 5);
assert.equal(noiseStarsFromDb(65), 1);
assert.equal(noiseStarsFromDb(0), null);
assert.equal(noiseStarsFromDb(25), null);
assert.equal(energyClass35(175), 'A+++');
assert.equal(energyClass55(125), 'A++');

// Listing needs an efficiency and a residential capacity.
assert.equal(publishable({ manufacturer: 'X', model: 'Y', values: { eta35: null, eta55: null, kw35: 8 } }), false);
assert.equal(publishable({ manufacturer: 'X', model: 'Y', values: { eta35: 180, kw35: 23 } }), true);
assert.equal(publishable({ manufacturer: 'X', model: 'Y', values: { eta35: 180, kw35: 23.5 } }), false);

// Twins fold into one card, and the best funding state and source win.
const card = { manufacturer: 'LG', ratedKw35: 9, ratedKw55: 8, scop35: 4.6, scop55: 3.5, noiseStars: 4, refrigerant: 'R32', climateBasis: 'average', id: 'a' };
const grouped = groupSeries([
  { ...card, model: 'HM091', funding: 'verify', source: 'eprel' },
  { ...card, model: 'HM093', funding: 'listed', source: 'reference' },
  { ...card, model: 'HM161', ratedKw35: 16, funding: 'verify', source: 'eprel' },
]);
assert.equal(grouped.length, 2);
assert.equal(grouped[0].variantCount, 2);
assert.equal(grouped[0].funding, 'listed');
assert.equal(grouped[0].source, 'reference');
assert.equal(grouped[0].model, 'HM093');

// A company is counted once, or the brand rule on the results list can be walked around by a spelling.
assert.equal(stripCompanyForm('KRONOTERM d.o.o.'), 'KRONOTERM');
assert.equal(stripCompanyForm('HEWALEX Sp. z o.o. Sp.k.'), 'HEWALEX');
assert.equal(stripCompanyForm('Nilan A/S'), 'Nilan');
assert.equal(stripCompanyForm('Baxi Spa'), 'Baxi');
assert.equal(stripCompanyForm('Hisense'), 'Hisense');
assert.equal(brandId('STIEBEL'), brandId('Stiebel Eltron'));
assert.equal(brandId('Dietrich'), brandId('De Dietrich'));
assert.equal(brandId('ACOND a.s.'), brandId('Acond'));
// Separate brands stay separate, including ones in one corporate group.
assert.notEqual(brandId('Bosch'), brandId('Buderus'));
assert.notEqual(brandId('Mitsubishi'), brandId('MITSUBISHI HEAVY INDUSTRIES'));
assert.notEqual(brandId('Electric'), brandId('Heating'));
const nameOf = brandNamer([
  { brand: 'ACOND a.s.', catalogue: true }, { brand: 'ACOND a.s.', catalogue: true }, { brand: 'Acond', catalogue: true },
  { brand: 'STIEBEL', catalogue: true }, { brand: 'Atlantic', catalogue: false }, { brand: 'Atlantic', catalogue: false }, { brand: 'ATLANTIC', catalogue: true },
]);
assert.equal(nameOf('Acond'), 'ACOND');
assert.equal(nameOf('ACOND a.s.'), 'ACOND');
assert.equal(nameOf('STIEBEL'), 'Stiebel Eltron');
assert.equal(nameOf('Atlantic'), 'ATLANTIC');

// A SCOP of 6.5 or more leaves the model out, whichever flow temperature it is at. The rule reads the same rounded value the card shows.
assert.equal(incredibleScop({ eta35: 256, eta55: 150 }), true);  // SCOP 6.5 at 35 °C
assert.equal(incredibleScop({ eta35: 150, eta55: 256 }), true);
assert.equal(incredibleScop({ eta35: 251, eta55: 150 }), false); // SCOP 6.4
assert.equal(incredibleScop({ eta35: null, eta55: null }), false);

// Recognition is per country, and anything unlisted gets one star.
assert.equal(brandId('Robert'), brandId('Bosch'));
assert.equal(brandId('iDM-Energiesysteme'), brandId('iDM'));
assert.equal(brandStarsFor("DE", "Vaillant"), 5);
assert.equal(brandStarsFor('DE', 'A brand nobody has heard of'), 1);
assert.equal(brandStarsFor('FR', 'ATLANTIC'), 5);
assert.equal(brandStarsFor('DE', 'Ritter Energie'), brandStarsFor('DE', 'Paradigma'));
assert.equal(brandStarsFor('NL', 'Vaillant'), null);
// Ground-source units do not belong in an air-to-water list. Air units with similar words stay.
for (const m of ['SMARTPACK 2 SOL/EAU 13 MONO', 'N1WP-09M', 'N3GP-20T', 'WW 14 EVI', 'EcoTouch Geo Cube 7019.7', 'TERRA SW 13 Complete', 'SMARTPACK 2 EAU GLYCOLEE EAU 8 Tri', 'WPF 20']) assert.equal(looksGroundSource(m), true, m);
for (const m of ['EU13L', 'TERRA AL 17 Twin (P)', 'Compress CS3800iAW 4 OE-S', 'Grandis N']) assert.equal(looksGroundSource(m), false, m);

assert.equal(modelWithoutBrand('KWB EasyAir Plus 24 Comfort', 'KWB Energiesysteme GmbH'), 'EASYAIRPLUS24COMFORT');
assert.equal(modelWithoutBrand('EasyAir Plus 24 Comfort', 'KWB'), 'EASYAIRPLUS24COMFORT');
assert.equal(modelWithoutBrand('NIBE', 'NIBE'), 'NIBE');
assert.equal(sameBrand('KWB', 'KWB Energiesysteme GmbH'), true);

assert.deepEqual(modelNameForms('Cosy 6 / 0101200004060'), ['COSY60101200004060', 'COSY6'].filter((m) => m.length >= 5));

assert.equal(displayBrand('GB', 'Bosch'), 'Worcester Bosch');
assert.equal(displayBrand('DE', 'Bosch'), 'Bosch');
assert.equal(brandStarsFor('GB', 'Bosch'), 5);
assert.equal(brandStarsFor('GB', 'Octopus Energy'), 5);
assert.equal(brandStarsFor('GB', 'Buderus'), 1);

for (const m of ['7738602872', '03-1050', '8755000539']) assert.equal(numberOnlyModel(m), true, m);
for (const m of ['EU13L', 'Compress CS3800iAW 4', 'Cosy 6 / 0101200004060', 'P20']) assert.equal(numberOnlyModel(m), false, m);
// Noise is graded within its size group, capped by the fixed dB scale, and a small group keeps that scale.
{
  const card = (db, kw = 8) => ({ ratedKw35: kw, ratedKw55: kw, noiseDb: db, noiseStars: noiseStarsFromDb(db) });
  const many = Array.from({ length: 100 }, (_, i) => card(40 + i * 0.3));
  const graded = relativeNoiseStars(many);
  assert.deepEqual([graded[0], graded[10], graded[25], graded[50], graded[80]], [5, 4, 3, 2, 1]);
  const loud = Array.from({ length: 30 }, (_, i) => card(66 + i * 0.1));
  assert.ok(relativeNoiseStars(loud).every((v) => v === 1));
  assert.deepEqual(relativeNoiseStars([card(50), card(58)]), [5, 3]);
  assert.deepEqual(relativeNoiseStars([{ ratedKw35: 8, ratedKw55: 8, noiseDb: null, noiseStars: null }]), [null]);
}

// EU F-gas rule for a new unit (Reg. 2024/573 Annex IV). Applied from 2027-01-01 already.
const now = '2026-11-07';
assert.equal(fgasAllowed({ refrigerant: 'R290', kw: 8, date: now }), true);
assert.equal(fgasAllowed({ refrigerant: 'R290 (propan)', kw: 8, date: '2040-01-01' }), true);
assert.equal(fgasAllowed({ refrigerant: 'R32', kw: 8, date: now }), false);
assert.equal(fgasAllowed({ refrigerant: 'R32', kw: 8, split: true, date: now }), false);
assert.equal(fgasAllowed({ refrigerant: 'R32', kw: 16, date: now }), false);
assert.equal(fgasAllowed({ refrigerant: 'R32', kw: 16, split: true, date: now }), true);
assert.equal(fgasAllowed({ refrigerant: 'R32', kw: 16, split: true, date: '2033-01-01' }), false);
assert.equal(fgasAllowed({ refrigerant: 'R410A', kw: 16, split: true, date: '2029-01-01' }), false);
assert.equal(fgasAllowed({ refrigerant: 'R410A', kw: 16, split: true, date: now }), false);
assert.equal(fgasAllowed({ refrigerant: 'R454C', kw: 8, date: now }), true);
assert.equal(fgasAllowed({ refrigerant: 'R454C', kw: 8, date: '2032-01-01' }), false);
assert.equal(fgasAllowed({ refrigerant: 'R454C', kw: 8, split: true, date: '2032-01-01' }), true);
assert.equal(fgasAllowed({ refrigerant: 'R454C', kw: 8, split: true, date: '2035-01-01' }), false);
assert.equal(fgasAllowed({ refrigerant: null, kw: 8, date: now }), false);
assert.equal(fgasAllowed({ refrigerant: 'R999', kw: 8, date: now }), false);
assert.equal(refrigerantFromName('Grant Engineering', 'Aerona HPR290i40'), 'R290');
assert.equal(refrigerantFromName('Ideal Heating', 'HP290 Monobloc Heat Pump 4.5kW'), 'R290');
assert.equal(refrigerantFromName('Ariston', 'NIMBUS 5 COMPACT 30 M R290'), 'R290');
assert.equal(refrigerantFromName('Vaillant', 'VWL 155/8.1 A S2 Q'), 'R290');
assert.equal(refrigerantFromName('Vaillant', 'VWL 85/8.2 AS 230V S3'), null);
assert.equal(refrigerantFromName('Bosch', 'VWL 155/8.1 A S2 Q'), null);

// An umlaut can make a different company: Walter Bösch of Austria is not Bosch.
assert.notEqual(brandId('Bösch'), brandId('Bosch'));
assert.notEqual(brandId('Walter Bösch GmbH & Co. KG'), brandId('Bosch'));
assert.equal(brandId('Brötje'), brandId('Broetje'));
assert.equal(looksGroundSource('VWS 171/3'), true);
assert.equal(looksGroundSource('GEOBLOCK20S-RU50'), true);
assert.equal(looksGroundSource('1-UltraSource® B cf C (8)'), true);
assert.equal(looksGroundSource('VWL 155/8.1 A S2 Q'), false);
assert.equal(looksGroundSource('Belaria pro comfort (15)'), false);
assert.equal(sameProductGroup({ manufacturer: 'Lambda', model: 'EU13L' }), 'lambda-eu13l');
assert.equal(sameProductGroup({ manufacturer: 'Ritter Energie', model: 'WP Aero Calima 13' }), 'lambda-eu13l');
assert.equal(sameProductGroup({ manufacturer: 'KRONOTERM', model: 'ADAPT 2 M / HK 1F', variantModels: ['ADAPT 2 M / HK 1F'] }), null);
assert.equal(sameProductGroup({ manufacturer: 'Zewotherm', model: 'ZewoLambda EU13L - Luft-Monoblock Außeneinheit' }), 'lambda-eu13l');
// The owner ruled Alpha G apart: equal values, but a different casing size.
assert.equal(sameProductGroup({ manufacturer: 'Zewotherm', model: 'Zewo WP Alpha G 7 kW' }), null);
assert.equal(sameProductGroup({ manufacturer: 'Zewotherm', model: 'Zewo Wärmepumpe Alpha G 16' }), null);
assert.equal(sameProductGroup({ manufacturer: 'Ritter Energie', model: 'WP Aero Vento 5' }), 'acond-grandis-n');
assert.equal(sameProductGroup({ manufacturer: 'Weishaupt', model: 'WEB 7/10-A-RME-A' }), 'stiebel-wpl-a-07');
assert.equal(sameProductGroup({ manufacturer: 'Stiebel Eltron', model: 'WPL-A 07.2 Plus HK 230' }), 'stiebel-wpl-a-07');
assert.equal(sameProductGroup({ manufacturer: 'Bosch', model: 'EU13L' }), null);

// Confirmed by the owner's eye, including indoor combinations of one outdoor unit.
assert.equal(sameProductGroup({ manufacturer: 'Remeha', model: 'Confida MB 400-4 + Confida 40E', ratedKw35: 5, ratedKw55: 5 }), 'bdr-r290-mono-5');
assert.equal(sameProductGroup({ manufacturer: 'Brötje', model: 'BLW Eco-KP 4.2', ratedKw35: 5.3, ratedKw55: 4.9 }), 'bdr-r290-mono-5');
assert.equal(sameProductGroup({ manufacturer: 'De Dietrich', model: '7882427 - ALEZIO M COMPACT R290 4 MR/E', ratedKw35: 5, ratedKw55: 5 }), 'bdr-r290-mono-5');
assert.equal(sameProductGroup({ manufacturer: 'Lamborghini Caloreclima', model: 'IDOLA IDU FT 200 HI3 - IDOLA LIFE M 4' }), 'midea-arctic-4');
assert.equal(sameProductGroup({ manufacturer: 'Ferroli', model: 'OMNIA LIFE M 4' }), 'midea-arctic-4');
assert.equal(sameProductGroup({ manufacturer: 'Saunier Duval', model: 'HA 3-8.2 OS 230V  + HA 5-8.2 STB', ratedKw35: 3, ratedKw55: 4 }), 'vaillant-8-2-4');
assert.equal(sameProductGroup({ manufacturer: 'Vaillant', model: 'VWL 45/8.2 AS 230V S3 + VWL 68/8.2 IS', ratedKw35: 3, ratedKw55: 4 }), 'vaillant-8-2-4');
// Size numbers differ across brands, so the capacity decides inside a series.
assert.equal(sameProductGroup({ manufacturer: 'Vaillant', model: 'VWL 175/8.1 A S3 Q', ratedKw35: 16, ratedKw55: 16 }), 'vaillant-8-1-16');
assert.equal(sameProductGroup({ manufacturer: 'Saunier Duval', model: 'HA 15-8.1 O N', ratedKw35: 16, ratedKw55: 16 }), 'vaillant-8-1-16');
assert.equal(sameProductGroup({ manufacturer: 'Bulex', model: 'HA 15-8.1 O B2 N', ratedKw35: 16, ratedKw55: 16 }), 'vaillant-8-1-16');
assert.notEqual(sameProductGroup({ manufacturer: 'Saunier Duval', model: 'HA 15-8.1 O 400V B3', ratedKw35: 12, ratedKw55: 12 }), 'vaillant-8-1-16');
// A series needs a capacity; the owner ruled the old generation apart; a variant does not outrank the card's own name.
assert.equal(sameProductGroup({ manufacturer: 'Vaillant', model: 'VWL 45/8.2 AS' }), null);
assert.equal(sameProductGroup({ manufacturer: 'Vaillant', model: 'VWL 55/3 A 230V', ratedKw35: 6, ratedKw55: 4 }), null);
assert.equal(sameProductGroup({ manufacturer: 'Saunier Duval', model: 'Genia Air 5/2 + GeniaSet', ratedKw35: 6, ratedKw55: 4 }), null);
assert.equal(sameProductGroup({ manufacturer: 'Saunier Duval', model: 'HA 8-6 O 230V B3', variantModels: ['HA 8-8.2 OS 230V B3'], ratedKw35: 7, ratedKw55: 6 }), 'vaillant-6-7');
// An R410A split and the newer R32 box are not the shared R32 unit.
assert.equal(sameProductGroup({ manufacturer: 'De Dietrich', model: '7692991 - Alezio S 6 MR/H V200', ratedKw35: 3, ratedKw55: 4 }), null);
assert.equal(sameProductGroup({ manufacturer: 'De Dietrich', model: '7926170 - ALEZIO S R32 6 /H', ratedKw35: 7, ratedKw55: 6 }), null);
assert.equal(sameProductGroup({ manufacturer: 'Remeha', model: '7791053+7736362 - Eria Tower Ace S R32 6MR/E', ratedKw35: 6, ratedKw55: 6 }), 'bdr-r32-split-6');
assert.equal(sameProductGroup({ manufacturer: 'De Dietrich', model: '7792410 - ALEZIO S 6 MR/EM R32', ratedKw35: 6, ratedKw55: 6 }), 'bdr-r32-split-6');
assert.equal(sameProductGroup({ manufacturer: 'Baxi', model: '7794010 - Platinum BC Mural iR32 4.5', ratedKw35: 5, ratedKw55: 5 }), null);
assert.equal(sameProductGroup({ manufacturer: 'Worcester Bosch', model: 'Compress CS5001AW 22' }), 'bosch-cs5001-22');
assert.equal(sameProductGroup({ manufacturer: 'Dimplex', model: 'LA 2030CP' }), 'bosch-cs5001-22');
// Ruled different by the owner, or different grille.
assert.equal(sameProductGroup({ manufacturer: 'Rossato', model: 'Air Inverter R290 05M' }), null);
assert.equal(sameProductGroup({ manufacturer: 'Weishaupt', model: 'WWP LA 20/30-A R' }), 'bosch-cs5001-22');

console.log('finder-export: ok');
