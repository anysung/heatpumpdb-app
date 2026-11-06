/**
 * Which picture a model gets (src/shared/outdoorUnit.mjs). Run: node tests/outdoor-unit.unit.mjs
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import CONFIG from '../src/config/outdoorUnits.json' with { type: 'json' };
import { outdoorVisual, unitFile } from '../src/shared/outdoorUnit.mjs';

const home = (brand, type = 'Luft / Wasser') => outdoorVisual(brand, type, 'residential');

// Every registered spelling of a brand finds its image.
assert.deepEqual(home('Bosch'), { kind: 'photo', id: 'bosch' });
assert.deepEqual(home('Worcester Bosch', 'Air / Water'), { kind: 'photo', id: 'bosch' });
assert.deepEqual(home('Robert', 'Powietrze / Woda'), { kind: 'photo', id: 'bosch' });
assert.deepEqual(home('Brötje'), { kind: 'photo', id: 'broetje' });
assert.deepEqual(home('GD TCL Intelligent Heating & Ventilating Equipment Co., Ltd.'), { kind: 'photo', id: 'tcl' });
assert.deepEqual(home('Johnson Controls'), { kind: 'photo', id: 'hitachi' });
assert.deepEqual(home('Saunier Duval', 'Air / Eau'), { kind: 'photo', id: 'saunier-duval' });

// A brand without an image gets the line graphic, never another brand's picture.
assert.deepEqual(home('Olimpia Splendid', 'Aria / Acqua'), { kind: 'graphic' });
assert.deepEqual(home('Wolfgang Heat'), { kind: 'graphic' });

// Residential air/water only.
assert.equal(outdoorVisual('Bosch', 'Luft / Wasser', 'commercial'), null);
assert.equal(outdoorVisual('Bosch', 'Luft / Wasser', 'unclassified'), null);
for (const type of ['Sole / Wasser', 'Eau glycolée / Eau', 'Eau / Eau', 'Sol / Eau', 'Salamoia / Acqua', 'Acqua / Acqua', 'Solanka / Woda', null]) assert.equal(home('Bosch', type), null, String(type));

// Every configured image exists in each width.
for (const u of CONFIG.units) for (const w of CONFIG.widths) assert.ok(existsSync(new URL(`../public${unitFile(u.id, w)}`, import.meta.url)), `${u.id} ${w}`);
assert.equal(CONFIG.units.length, 50);
console.log('outdoor-unit: ok');
