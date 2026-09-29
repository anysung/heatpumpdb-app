/**
 * Unit tests for the Noise check model (src/hpiq/features/noise/noiseModel.ts).
 *
 *   Lp = Lw + 10·log10(Q/(4πr²)) − A_B (+ K_T)   ·   r_min solves it for r
 *   DE: TA Lärm Nr. 6.1 night values; pass ≤ night−6 (LAI), tight ≤ night, over
 *   GB: MCS 020 a) 37.0 dB(A), rounded to 0.1, no background term
 *   FR/PL/IT: table only, no verdict
 *
 * Run: node tests/noise-model.unit.mjs  (transpiles the REAL source with esbuild)
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const SRC = fileURLToPath(new URL('../src/hpiq/features/noise/noiseModel.ts', import.meta.url));
const { code } = await transform(await readFile(SRC, 'utf8'), { loader: 'ts', format: 'esm' });
const M = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

let failed = 0;
const is = (name, actual, expected) => {
  const ok = Object.is(actual, expected);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` — got ${actual}, expected ${expected}`}`);
};
const near = (name, actual, expected, tol = 1e-6) => {
  const ok = Math.abs(actual - expected) <= tol;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` — got ${actual}, expected ${expected}`}`);
};

/* Formula */
near('Q=2, r=1: Lp = Lw − 8.0', M.soundPressure(60, 1, 2), 60 + 10 * Math.log10(2 / (4 * Math.PI)));
near('Q=2, r=1 ≈ Lw − 7.98', M.soundPressure(60, 1, 2), 52.0184, 1e-3);
near('doubling distance −6.02 dB', M.soundPressure(60, 2, 2) - M.soundPressure(60, 4, 2), 20 * Math.log10(2));
near('Q 2→4 +3.01 dB', M.soundPressure(60, 5, 4) - M.soundPressure(60, 5, 2), 10 * Math.log10(2));
near('Q 4→8 +3.01 dB', M.soundPressure(60, 5, 8) - M.soundPressure(60, 5, 4), 10 * Math.log10(2));
near('barrier subtracts', M.soundPressure(60, 5, 4, 10), M.soundPressure(60, 5, 4) - 10);
near('surcharge adds', M.soundPressure(60, 5, 4, 0, 3), M.soundPressure(60, 5, 4) + 3);
is('placement → Q', [M.PLACEMENT_Q.free, M.PLACEMENT_Q.wall, M.PLACEMENT_Q.corner].join(), '2,4,8');
is('screening → A_B', [M.SCREENING_DB.none, M.SCREENING_DB.partial, M.SCREENING_DB.full].join(), '0,5,10');

/* Hand-checked: Lw 60, Q4, 5 m, no barrier → 60 + 10·log10(4/(4π·25)) = 60 − 18.951 = 41.049 */
near('hand example Lw60 Q4 r5', M.soundPressure(60, 5, 4), 41.0491, 1e-3);

/* r_min is the inverse */
for (const [lw, q, ab, tgt, kt] of [[58, 4, 0, 40, 0], [62, 8, 5, 35, 3], [55, 2, 10, 37, 0]]) {
  const r = M.minDistance(lw, q, ab, tgt, kt);
  near(`r_min inverse (Lw${lw} Q${q} −${ab} → ${tgt}, +${kt})`, M.soundPressure(lw, r, q, ab, kt), tgt, 1e-9);
}
near('r_min closed form', M.minDistance(60, 2, 0, 34), Math.sqrt(2 / (4 * Math.PI) * 10 ** ((60 - 34) / 10)));

/* TA Lärm Nr. 6.1 values */
const ta = M.TA_LAERM;
is('WR night 35', ta.pure.night, 35);
is('WA night 40', ta.general.night, 40);
is('MI/MD/MK night 45', ta.mixed.night, 45);
is('MU night 45 / day 63', `${ta.urban.night}/${ta.urban.day}`, '45/63');
is('GE night 50 / day 65', `${ta.commercial.night}/${ta.commercial.day}`, '50/65');
is('GI 70', ta.industrial.night, 70);
is('Kurgebiet 45/35', `${ta.spa.day}/${ta.spa.night}`, '45/35');
is('all areas selectable', M.DE_AREAS.length, 7);

/* DE regime: night decides; LAI margin */
const de = (lw, r, extra = {}) => M.evaluateNoise('de-ta-laerm', { lw, distance: r, placement: 'wall', screening: 'none', area: 'general', tonal: false, ...extra });
{
  const res = de(50, 10);           // 50 + 10log(4/(4π·100)) = 30.0 ≤ 34 → pass
  is('DE pass', res.verdict, 'pass');
  is('DE limit = night value', res.limit, 40);
  is('DE target = night − 6', res.target, 34);
  near('DE rLimit meets 40', M.soundPressure(50, res.rLimit, 4), 40, 1e-9);
  near('DE rTarget meets 34', M.soundPressure(50, res.rTarget, 4), 34, 1e-9);
}
is('DE tight (34 < Lp ≤ 40)', de(58, 8).verdict, 'tight');     // 58 − 23.0 = 35.0
is('DE over (> 40)', de(62, 5).verdict, 'over');              // 62 − 18.95 = 43.1
is('DE tonality +3 flips tight→over', de(58, 5, { tonal: true }).verdict, 'over'); // 39.1 + 3
is('DE tonality applied', de(58, 5, { tonal: true }).surchargeDb, 3);
is('DE industrial never over at 5 m for Lw 62', de(62, 5, { area: 'industrial' }).verdict, 'pass');
is('DE night value decides (WR stricter)', de(58, 6, { area: 'pure' }).verdict, 'over');

/* GB regime */
const gb = (lw, r, extra = {}) => M.evaluateNoise('gb-mcs020a', { lw, distance: r, placement: 'wall', screening: 'none', tonal: true, ...extra });
is('GB limit 37.0', gb(60, 5).limit, 37);
is('GB never adds tonality', gb(60, 5).surchargeDb, 0);
is('GB over at 38.0', gb(60, 5).verdict, 'over');
is('GB pass with full barrier', gb(60, 5, { screening: 'full' }).verdict, 'pass');
{
  // exactly 37.0 after rounding passes ("equal to or lower")
  const r = M.minDistance(60, 4, 0, 37.04);
  is('GB 37.0 (rounded) passes', gb(60, r).verdict, 'pass');
  is('GB has no tight state', ['pass', 'over'].includes(gb(59, 4).verdict), true);
  is('GB no LAI target', gb(60, 5).target, null);
}

/* FR / PL / IT: table only */
for (const reg of ['fr-emergence', 'pl-zoning', 'it-zoning']) {
  const res = M.evaluateNoise(reg, { lw: 60, distance: 7, placement: 'free', screening: 'partial', tonal: true });
  is(`${reg}: no verdict`, res.verdict, null);
  is(`${reg}: no limit`, res.limit, null);
  is(`${reg}: table at 1/3/5/10 m`, res.table.map(x => x.r).join(), '1,3,5,10');
  is(`${reg}: no tonality`, res.surchargeDb, 0);
  is(`${reg}: hasVerdict false`, M.hasVerdict(reg), false);
}
is('table values rounded to 0.1', M.evaluateNoise('fr-emergence', { lw: 60, distance: 7, placement: 'free', screening: 'none' }).table[0].lp, 52.0);

/* Input guards */
is('Lw 29 invalid (plausibility floor)', M.validLw(29), false);
is('Lw 58 valid', M.validLw(58), true);
is('distance 0 invalid', M.validDistance(0), false);
is('distance 0.5 valid', M.validDistance(0.5), true);

if (failed) { console.error(`\n${failed} failure(s)`); process.exit(1); }
console.log('\nall noise-model tests passed');
