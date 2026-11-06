import assert from 'node:assert/strict';
import {
  brandId, brandNamer, climateValues, displayFunding, energyClass35, energyClass55, excludedFromMarket, fundingState,
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

console.log('finder-export: ok');
