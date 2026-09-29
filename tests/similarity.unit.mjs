/**
 * Unit tests for the alternatives finder (src/hpiq/features/similar/similarity.ts)
 * and the projects item merge (src/hpiq/features/projects/projectModel.ts).
 *
 * Run: node tests/similarity.unit.mjs
 *
 * The TypeScript sources are transpiled in-process with Vite's esbuild (same
 * pattern as tests/segmentation.unit.mjs) — the REAL modules are exercised.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

async function load(rel) {
  const src = fileURLToPath(new URL(rel, import.meta.url));
  const { code } = await transform(await readFile(src, 'utf8'), { loader: 'ts', format: 'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
const { sourceFamily, rankAlternatives, isR290 } = await load('../src/hpiq/features/similar/similarity.ts');
const { mergeItems, MAX_PROJECT_ITEMS } = await load('../src/hpiq/features/projects/projectModel.ts');

let failed = 0, passed = 0;
const is = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.error(`  FAIL  ${name}\n        expected ${e}\n        actual   ${a}`); }
};

let n = 0;
const hp = (kw, o = {}) => (++n, {
  id: o.id ?? `id${n}`, mfr: o.mfr ?? 'Acme', model: o.model ?? `M-${n}`, ratedKwNum: kw,
  ref: o.ref ?? 'R32', listed: o.listed ?? false,
  raw: { scop: o.scop ?? null, noise_outdoor_dB: o.noise ?? null, type: o.type ?? 'Luft / Wasser' },
});
const ids = r => r.items.map(v => v.id);

console.log('\nsourceFamily\n');
is('DE air', sourceFamily('Luft / Wasser'), 'air');
is('GB air', sourceFamily('Air / Water'), 'air');
is('FR air', sourceFamily('Air / Eau'), 'air');
is('PL air', sourceFamily('Powietrze / Woda'), 'air');
is('IT air', sourceFamily('Aria / Acqua'), 'air');
is('DE brine', sourceFamily('Sole / Wasser'), 'ground');
is('PL brine', sourceFamily('Solanka / Woda'), 'ground');
is('IT brine', sourceFamily('Salamoia / Acqua'), 'ground');
is('FR glycol water is brine, not water', sourceFamily('Eau glycolée / Eau'), 'ground');
is('FR direct ground', sourceFamily('Sol / Eau'), 'ground');
is('FR water', sourceFamily('Eau / Eau'), 'water');
is('IT water', sourceFamily('Acqua / Acqua'), 'water');
is('DE water', sourceFamily('Wasser / Wasser'), 'water');
is('null type', sourceFamily(null), null);

console.log('\nrankAlternatives\n');
{
  const ref = hp(10, { id: 'ref', scop: 4.5, noise: 55 });
  const pool = [
    ref,
    hp(10.9, { id: 'in-hi', scop: 4.9, noise: 58 }),
    hp(9.1, { id: 'in-lo', scop: 4.9, noise: 52 }),
    hp(11.2, { id: 'out', scop: 5.5 }),                        // 12 % → outside ±10
    hp(10.2, { id: 'brine', scop: 5.2, type: 'Sole / Wasser' }), // other family
    hp(10.0, { id: 'dup', model: ref.model, scop: 9 }),          // exact duplicate of ref
    hp(10.1, { id: 'noscop', noise: 40 }),
    hp(null, { id: 'nokw', scop: 6 }),
  ];
  const r = rankAlternatives(ref, pool);
  is('band ±10 %, family + dup + self excluded, SCOP desc then quieter first, null SCOP last', ids(r), ['in-lo', 'in-hi', 'noscop']);
  is('not widened with 3 hits', [r.widened, r.tolerance], [false, 0.1]);
  is('teaser count = base hits', r.baseCount, 3);
}
{
  const ref = hp(20, { id: 'ref', noise: 60 });
  const pool = [ref, hp(21.5, { id: 'a', scop: 4 }), hp(22.9, { id: 'b', scop: 5 }), hp(17.5, { id: 'c', scop: 3 })];
  const r = rankAlternatives(ref, pool);
  is('< 3 hits at ±10 % widens to ±15 %', [r.widened, r.tolerance], [true, 0.15]);
  is('widened band includes 22.9 and 17.5 but not beyond', ids(r), ['b', 'a', 'c']);
}
{
  const ref = hp(10, { id: 'ref', noise: 55 });
  const pool = [
    hp(10, { id: 'p1', ref: 'R290', noise: 50, scop: 4, listed: true }),
    hp(10, { id: 'p2', ref: 'R290 (propan)', noise: 56, scop: 4.2 }),
    hp(10, { id: 'p3', ref: 'R32', noise: 49, scop: 4.4, listed: true }),
    hp(10, { id: 'p4', ref: 'R290(estimated)', noise: null, scop: 4.1 }),
  ];
  is('R290 chip uses contains-match', ids(rankAlternatives(ref, pool, { r290: true })), ['p2', 'p4', 'p1']);
  is('quieter = strictly lower sound power, unknown excluded', ids(rankAlternatives(ref, pool, { quieter: true })), ['p3', 'p1']);
  is('listed only via caller predicate', ids(rankAlternatives(ref, pool, { listedOnly: true }, v => v.listed)), ['p3', 'p1']);
  is('chips combine', ids(rankAlternatives(ref, pool, { r290: true, quieter: true, listedOnly: true }, v => v.listed)), ['p1']);
  is('baseCount ignores chips', rankAlternatives(ref, pool, { r290: true, quieter: true }).baseCount, 4);
  const silent = hp(10, { id: 'silent' });
  is('quieter ignored when reference has no sound power', rankAlternatives(silent, pool, { quieter: true }).items.length, 4);
  is('noNoise flag', rankAlternatives(silent, pool).noNoise, true);
}
{
  const ref = hp(10, { id: 'ref' });
  const pool = [hp(10, { id: 'x1', model: 'Same', scop: 4 }), hp(10.3, { id: 'x2', model: 'Same', scop: 4.6 }), hp(10, { id: 'y', scop: 3 })];
  is('duplicates among candidates collapse to the best-ranked row', ids(rankAlternatives(ref, pool)), ['x2', 'y']);
}
{
  const r = rankAlternatives(hp(null, { id: 'ref' }), [hp(10)]);
  is('no rated capacity → noCapacity, no items', [r.noCapacity, r.items.length], [true, 0]);
}
{
  const ref = hp(10, { id: 'ref', scop: 4 });
  const pool = [hp(10, { id: 'eq-b', model: 'B', scop: 4.2, noise: 50 }), hp(10.5, { id: 'eq-a', model: 'A', scop: 4.2, noise: 50 }), hp(10, { id: 'eq-c', model: 'C', scop: 4.2, noise: 50 })];
  is('ties → closer capacity, then model name', ids(rankAlternatives(ref, pool)), ['eq-b', 'eq-c', 'eq-a']);
}
is('isR290 contains-match', [isR290('R290'), isR290('r290 (propan)'), isR290('R32'), isR290(null)], [true, true, false, false]);

console.log('\nmergeItems\n');
{
  const now = '2026-09-29T00:00:00.000Z';
  const base = [{ id: 'a', addedAt: 'x', note: 'keep' }];
  const r = mergeItems(base, ['a', 'b', 'b', 'c', ''], now);
  is('dedupe against existing and within batch', r.items.map(i => i.id), ['a', 'b', 'c']);
  is('counts', [r.added, r.duplicates, r.overCap], [2, 2, 0]);
  is('existing note kept', r.items[0].note, 'keep');
  const full = Array.from({ length: MAX_PROJECT_ITEMS - 1 }, (_, i) => ({ id: `f${i}`, addedAt: 'x' }));
  const c = mergeItems(full, ['n1', 'n2', 'n3'], now);
  is('cap at 50', [c.items.length, c.added, c.overCap], [50, 1, 2]);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
