/**
 * Unit tests for the running cost & CO₂ model
 * (src/hpiq/features/cost/costModel.ts) and its market defaults
 * (src/config/energyDefaults.json).
 *
 * Run: node tests/cost-model.unit.mjs
 *
 * The TypeScript source is transpiled in-process with esbuild (same pattern as
 * tests/similarity.unit.mjs) — the REAL module is exercised.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

async function load(rel) {
  const src = fileURLToPath(new URL(rel, import.meta.url));
  const { code } = await transform(await readFile(src, 'utf8'), { loader: 'ts', format: 'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
const M = await load('../src/hpiq/features/cost/costModel.ts');
const { sanitizeRecord } = await import('../src/shared/plausibility.mjs');
const defaults = JSON.parse(await readFile(fileURLToPath(new URL('../src/config/energyDefaults.json', import.meta.url)), 'utf8'));

let failed = 0, passed = 0;
const is = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.error(`  FAIL  ${name}\n        expected ${e}\n        actual   ${a}`); }
};
const near = (name, actual, expected, tol = 1e-6) => is(name, Math.abs(actual - expected) <= tol ? 'ok' : actual, 'ok');

console.log('\nSCOP derivation\n');
is('ηs 151 → 3.85', M.scopFromEta(151), 3.85);
is('ηs 125 → 3.2', M.scopFromEta(125), 3.2);
is('ηs null → null', M.scopFromEta(null), null);
is('ηs 0 → null', M.scopFromEta(0), null);

is('35 °C uses published SCOP', M.scopFor({ scop: 4.6, eta35: 181, eta55: 130 }, 35), { value: 4.6, basis: 'scop', scopFlagged: false });
is('35 °C, SCOP missing → ηs35', M.scopFor({ scop: null, eta35: 181 }, 35), { value: 4.6, basis: 'eta35', scopFlagged: false });
is('35 °C, SCOP flagged → ηs35', M.scopFor({ scop: 5.9, eta35: 181, qaFlags: ['scop'] }, 35), { value: 4.6, basis: 'eta35', scopFlagged: true });
is('35 °C, flag on another field keeps SCOP', M.scopFor({ scop: 4.6, eta35: 181, qaFlags: ['cop_A7W35'] }, 35).basis, 'scop');
is('35 °C, nothing → none', M.scopFor({}, 35), { value: null, basis: 'none', scopFlagged: false });
is('55 °C → ηs55', M.scopFor({ scop: 4.6, eta35: 181, eta55: 130 }, 55), { value: 3.33, basis: 'eta55', scopFlagged: false });
is('55 °C never falls back to the 35 °C SCOP', M.scopFor({ scop: 4.6, eta35: 181, eta55: null }, 55), { value: null, basis: 'none', scopFlagged: false });

// The real plausibility rule produces the flag the model reacts to.
const rec = sanitizeRecord({ scop: 5.9, efficiency_35C_percent: 181 });
is('plausibility flags an inconsistent SCOP', rec.qa_flags, ['scop']);
is('…and the model then derives from ηs35', M.scopFor({ scop: rec.scop, eta35: rec.efficiency_35C_percent, qaFlags: rec.qa_flags }, 35).value, 4.6);
const ok = sanitizeRecord({ scop: 4.6, efficiency_35C_percent: 181 });
is('a consistent SCOP is not flagged', ok.qa_flags ?? [], []);

console.log('\nHeat-demand helper\n');
is('140 m² × 115', M.demandFromArea(140, 115), 16100);
is('area 0 → null', M.demandFromArea(0, 115), null);
is('area missing → null', M.demandFromArea(null, 115), null);
const bs = defaults.buildingStandards.values;
is('building standards ordered new < renovated < partly < unrenovated', bs.new < bs.renovated && bs.renovated < bs.partly && bs.partly < bs.unrenovated, true);
is('every standard has a value', M.BUILDING_STANDARDS.every(k => typeof bs[k] === 'number'), true);

console.log('\nCosts + CO₂\n');
const base = { demandKwh: 12000, scop: 4, boilerEfficiency: 0.9, electricityPrice: 0.3, gasPrice: 0.12, standingDiff: 0, gridCo2: 0.35, gasCo2: 0.18 };
const r = M.estimate(base);
near('hp kWh = demand / SCOP', r.hpKwh, 3000);
near('gas kWh = demand / efficiency', r.gasKwh, 13333.333333, 1e-4);
near('hp cost', r.hpCost, 900);
near('gas cost', r.gasCost, 1600, 1e-6);
near('saving', r.saving, 700, 1e-6);
near('hp CO₂', r.hpCo2Kg, 1050);
near('gas CO₂', r.gasCo2Kg, 2400, 1e-6);
near('CO₂ saving', r.co2SavingKg, 1350, 1e-6);
near('band hp cost low (−20 %)', r.band.hpCost.low, 720);
near('band hp cost high (+20 %)', r.band.hpCost.high, 1080);
near('band saving low = gas − hp·1.2', r.band.saving.low, 520, 1e-6);
near('band saving high = gas − hp·0.8', r.band.saving.high, 880, 1e-6);
near('band CO₂ saving low', r.band.co2SavingKg.low, 1140, 1e-6);
const rs = M.estimate({ ...base, standingDiff: 100 });
near('standing-charge difference lands on the gas side', rs.gasCost - r.gasCost, 100, 1e-9);
near('…and in the saving', rs.saving - r.saving, 100, 1e-9);
is('negative saving is reported, not hidden', M.estimate({ ...base, electricityPrice: 0.6 }).saving < 0, true);

console.log('\nInput validation\n');
is('valid inputs → none bad', M.invalidInputs(base), []);
is('SCOP missing → bad', M.invalidInputs({ ...base, scop: null }), ['scop']);
is('SCOP below 1 → bad', M.invalidInputs({ ...base, scop: 0.8 }), ['scop']);
is('demand 0 → bad', M.invalidInputs({ ...base, demandKwh: 0 }), ['demandKwh']);
is('boiler 95 (percent typed) → bad', M.invalidInputs({ ...base, boilerEfficiency: 95 }), ['boilerEfficiency']);
is('CO₂ factor 0 allowed (green tariff)', M.invalidInputs({ ...base, gridCo2: 0 }), []);
is('estimate refuses bad input', M.estimate({ ...base, scop: null }), null);

console.log('\nMarket defaults + currency\n');
for (const cc of ['DE', 'GB', 'FR', 'PL', 'IT']) {
  const d = M.marketDefaults(defaults, cc);
  const vals = [d.electricity, d.gas, d.gridCo2, d.gasCo2, ...(d.heatPumpTariff ? [d.heatPumpTariff] : [])];
  is(`${cc}: every default has value, source, https url, asOf`, vals.every(v => typeof v.value === 'number' && v.value > 0 && v.source && /^https:\/\//.test(v.url) && v.asOf), true);
  is(`${cc}: market asOf is an ISO date`, /^\d{4}-\d{2}-\d{2}$/.test(d.asOf), true);
  is(`${cc}: CO₂ factors are plausible (kg/kWh)`, d.gridCo2.value < 1.2 && d.gasCo2.value > 0.15 && d.gasCo2.value < 0.26, true);
}
is('GB → GBP', M.marketDefaults(defaults, 'GB').currency, 'GBP');
is('PL → PLN', M.marketDefaults(defaults, 'PL').currency, 'PLN');
is('DE/FR/IT → EUR', ['DE', 'FR', 'IT'].map(c => M.marketDefaults(defaults, c).currency), ['EUR', 'EUR', 'EUR']);
is('unknown market falls back to DE', M.marketDefaults(defaults, 'XX').currency, 'EUR');
is('DE offers a heat-pump tariff below the household price', M.marketDefaults(defaults, 'DE').heatPumpTariff.value < M.marketDefaults(defaults, 'DE').electricity.value, true);
is('BAFA never named in a non-DE default', ['GB', 'FR', 'PL', 'IT'].every(c => !/BAFA/.test(JSON.stringify(defaults.markets[c]))), true);
is('GBP formatting', M.formatMoney(1234, 'GBP', 'en-GB'), '£1,234');
is('PLN formatting (pl-PL)', /^1\s?234\szł$/.test(M.formatMoney(1234, 'PLN', 'pl-PL')), true);
is('EUR formatting (de-DE)', M.formatMoney(1234, 'EUR', 'de-DE').replace(/\s/g, ' '), '1.234 €');
is('roundTo 10', M.roundTo(1234), 1230);

console.log(failed ? `\n✗ ${failed} failed, ${passed} passed\n` : `\n✓ all ${passed} cost-model assertions passed\n`);
process.exit(failed ? 1 : 0);
