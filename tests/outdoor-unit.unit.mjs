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

// A model with its own image shows it; other models of the brand keep the brand image. Names are the
// display names the app passes (manufacturer_short).
const own = (brand, model, id) => assert.deepEqual(outdoorVisual(brand, 'Air / Water', 'residential', model), id ? { kind: 'photo', id } : { kind: 'graphic' }, model);
own('Stiebel Eltron', 'HPA-O 05.2 W Plus HC 230', 'stiebel-eltron-white');
own('Stiebel Eltron', 'WPL-A 05.2 Plus HK 230', 'stiebel-eltron-r290');
own('Stiebel Eltron', 'WPL-A 07 HK 230 Premium', 'stiebel-eltron');
own('Worcester Bosch', 'Compress CS8800iAW 11 O-T (B)', 'bosch-8800');
own('Bosch', 'Compress 5800i AW 7', 'bosch');
own('Vaillant', 'VWL 85/8.2 AS 230V S3', 'vaillant-split-85');
own('Vaillant', 'aroTHERM Split plus VWL 35/8.2 (AS/230V/S2) + uniTOWER Split plus VWL 58/8.2 IS', 'vaillant-split-small');
own('Mitsubishi', 'SUZ-SWM30VA + ERSD-VM2E', 'mitsubishi-suz-swm');
own('Panasonic', 'AQUAREA [WH-UD03JE5 + WH-SDC0305J3E5]', 'panasonic-aquarea-j');
own('BAXI', 'ALYA 4 FS Slim', 'baxi-alya-small');
own('BAXI', 'ALYA 8 FS Slim', null);
own('Saunier', 'HA 3-8.2 OS 230V + HA 5-8.2 STB C2', 'saunier-duval-split');
own('Vaillant', 'VWL 125/6 A 230V S3', 'vaillant');
own('Grant Engineering', 'Aerona HPR290i40', 'grant-aerona-290');
own('Grant Engineering', 'Aerona3 HPID10R32', null);
own('LAMBDA Wärmepumpen GmbH', 'EU13L', 'lambda-eureka');
own('STIEBEL', 'WPL-A 05.2 Plus HK 230', 'stiebel-eltron-r290');
own('DAIKIN', 'Daikin Altherma 4 H ECH2O 8KW', 'daikin-epsk-b');
own('Daikin', 'Daikin Altherma 3 H HT ECH2O 500 H (Biv) 14kW', 'daikin-epsk-b');
own('NIBE', 'S2060-6', 'nibe-s2060');
own('IMMERGAS', 'MAGIS M 5 TOP', 'immergas-magis-top');
assert.deepEqual(home('Lambda'), { kind: 'graphic' });

// Residential air/water only.
assert.equal(outdoorVisual('Bosch', 'Luft / Wasser', 'commercial'), null);
assert.equal(outdoorVisual('Bosch', 'Luft / Wasser', 'unclassified'), null);
for (const type of ['Sole / Wasser', 'Eau glycolée / Eau', 'Eau / Eau', 'Sol / Eau', 'Salamoia / Acqua', 'Acqua / Acqua', 'Solanka / Woda', null]) assert.equal(home('Bosch', type), null, String(type));

// Every configured image exists in each width.
for (const u of CONFIG.units) for (const w of CONFIG.widths) assert.ok(existsSync(new URL(`../public${unitFile(u.id, w)}`, import.meta.url)), `${u.id} ${w}`);
assert.equal(CONFIG.units.filter((u) => !u.match).length, 50);
assert.equal(CONFIG.units.filter((u) => u.match).length, 27);
console.log('outdoor-unit: ok');
