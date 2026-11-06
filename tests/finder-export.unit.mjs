import assert from 'node:assert/strict';
import {
  brandStarsFor, displayBrand, looksGroundSource, numberOnlyModel, sameProductGroup, modelNameForms, sameBrand, brandId, brandNamer, modelWithoutBrand, climateValues, displayFunding, energyClass35, energyClass55, excludedFromMarket, fundingState,
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
assert.equal(sameProductGroup({ manufacturer: 'Lambda', model: 'EU13L' }), 'lambda-eu13l');
assert.equal(sameProductGroup({ manufacturer: 'Ritter Energie', model: 'WP Aero Calima 13' }), 'lambda-eu13l');
assert.equal(sameProductGroup({ manufacturer: 'KRONOTERM', model: 'ADAPT 2 M / HK 1F', variantModels: ['ADAPT 2 M / HK 1F'] }), null);
// A different grille is a different product, so Zewotherm stays out even with equal values.
assert.equal(sameProductGroup({ manufacturer: 'Zewotherm', model: 'ZewoLambda EU13L - Luft-Monoblock Außeneinheit' }), null);
assert.equal(sameProductGroup({ manufacturer: 'Bosch', model: 'EU13L' }), null);

// Confirmed by the owner's eye, including indoor combinations of one outdoor unit.
assert.equal(sameProductGroup({ manufacturer: 'Remeha', model: 'Confida MB 400-4 + Confida 40E' }), 'bdr-monobloc-4');
assert.equal(sameProductGroup({ manufacturer: 'Brötje', model: 'BLW Eco-KP 4.2' }), 'bdr-monobloc-4');
assert.equal(sameProductGroup({ manufacturer: 'Lamborghini Caloreclima', model: 'IDOLA IDU FT 200 HI3 - IDOLA LIFE M 4' }), 'midea-arctic-4');
assert.equal(sameProductGroup({ manufacturer: 'Ferroli', model: 'OMNIA LIFE M 4' }), 'midea-arctic-4');
assert.equal(sameProductGroup({ manufacturer: 'Saunier Duval', model: 'HA 3-8.2 OS 230V  + HA 5-8.2 STB' }), 'vaillant-split-3');
assert.equal(sameProductGroup({ manufacturer: 'Vaillant', model: 'VWL 45/8.2 AS 230V S3 + VWL 68/8.2 IS' }), 'vaillant-split-3');
assert.equal(sameProductGroup({ manufacturer: 'Worcester Bosch', model: 'Compress CS5001AW 22' }), 'bosch-cs5001-22');
assert.equal(sameProductGroup({ manufacturer: 'Dimplex', model: 'LA 2030CP' }), 'bosch-cs5001-22');
// Ruled different by the owner, or different grille.
assert.equal(sameProductGroup({ manufacturer: 'Rossato', model: 'Air Inverter R290 05M' }), null);
assert.equal(sameProductGroup({ manufacturer: 'Weishaupt', model: 'WWP LA 20/30-A R' }), null);

console.log('finder-export: ok');
