/**
 * Unit tests for the ONE residential/commercial rule (src/config/segmentation.ts).
 *
 *   residential:  rated capacity ≤ 23 kW
 *   commercial:   rated capacity  > 23 kW   (never `>=` — 23.00 is residential)
 *   unclassified: no usable rated capacity  (never silently residential)
 *
 * Run: node tests/segmentation.unit.mjs
 *
 * The module under test is TypeScript, so it is transpiled in-process with the
 * esbuild that Vite already ships — no test runner, no new dependency, and the
 * REAL source is exercised (not a copy of the rule).
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const SRC = fileURLToPath(new URL('../src/config/segmentation.ts', import.meta.url));
const { code } = await transform(await readFile(SRC, 'utf8'), { loader: 'ts', format: 'esm' });
const {
  SEGMENT_THRESHOLD_KW,
  classifyProductSegment,
  ratedCapacityKw,
  segmentOfProduct,
  splitBySegment,
} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

let failed = 0;
const is = (name, actual, expected) => {
  const ok = Object.is(actual, expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${ok ? '' : `  — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
};

console.log('\nThreshold');
is('is 23 kW', SEGMENT_THRESHOLD_KW, 23);

// The exact boundary cases the rule turns on. 23.00 kW is RESIDENTIAL.
console.log('\nclassifyProductSegment — boundary');
is('22.99 kW → residential', classifyProductSegment(22.99), 'residential');
is('23.00 kW → residential', classifyProductSegment(23.0), 'residential');
is('23.01 kW → commercial', classifyProductSegment(23.01), 'commercial');
is('24.00 kW → commercial', classifyProductSegment(24.0), 'commercial');
is('177.00 kW → commercial (the PEL maximum)', classifyProductSegment(177.0), 'commercial');
is('0 kW → residential', classifyProductSegment(0), 'residential');

// Missing capacity must NEVER fall through to residential.
console.log('\nclassifyProductSegment — missing / invalid capacity → unclassified');
is('null', classifyProductSegment(null), 'unclassified');
is('undefined', classifyProductSegment(undefined), 'unclassified');
is('NaN', classifyProductSegment(NaN), 'unclassified');
is('Infinity', classifyProductSegment(Infinity), 'unclassified');
is('string "24"', classifyProductSegment('24'), 'unclassified');

console.log('\nratedCapacityKw — preference order');
is('power_35C_kw wins', ratedCapacityKw({ power_35C_kw: 12, power_design_35C_kw: 40, power_55C_kw: 50 }), 12);
is('falls back to power_design_35C_kw (EPREL records)', ratedCapacityKw({ power_design_35C_kw: 30, power_55C_kw: 50 }), 30);
is('falls back to power_55C_kw', ratedCapacityKw({ power_55C_kw: 26 }), 26);
is('falls back to power_design_55C_kw', ratedCapacityKw({ power_design_55C_kw: 9 }), 9);
is('no capacity published at all → null', ratedCapacityKw({ model: 'PEL-only record' }), null);
is('null capacity fields → null', ratedCapacityKw({ power_35C_kw: null, power_design_35C_kw: null }), null);
is('0 is a real value, not "missing"', ratedCapacityKw({ power_35C_kw: 0, power_55C_kw: 40 }), 0);

console.log('\nsegmentOfProduct');
is('EPREL-only 24 kW record → commercial', segmentOfProduct({ power_design_35C_kw: 24 }), 'commercial');
is('registry 23 kW record → residential', segmentOfProduct({ power_35C_kw: 23 }), 'residential');
is('PEL record with no performance data → unclassified', segmentOfProduct({ mcs_number: 'X', performance_source: null }), 'unclassified');

// A source's own segment label must not decide ours.
console.log('\nsegmentOfProduct — the source label never decides');
is(
  'source says commercial, 18 kW → residential',
  segmentOfProduct({ market_segment: 'commercial', power_35C_kw: 18 }),
  'residential',
);
is(
  'source says residential, 45 kW → commercial',
  segmentOfProduct({ market_segment: 'residential', power_35C_kw: 45 }),
  'commercial',
);

console.log('\nsplitBySegment');
{
  const pool = [
    { id: 'a', power_35C_kw: 9 },
    { id: 'b', power_35C_kw: 23 },
    { id: 'c', power_35C_kw: 23.01 },
    { id: 'd', power_design_35C_kw: 177 },
    { id: 'e' },
  ];
  const { residential, commercial, unclassified } = splitBySegment(pool);
  is('residential ids', residential.map(p => p.id).join(','), 'a,b');
  is('commercial ids', commercial.map(p => p.id).join(','), 'c,d');
  is('unclassified ids', unclassified.map(p => p.id).join(','), 'e');
  is('every record lands in exactly one bucket',
    residential.length + commercial.length + unclassified.length, pool.length);
}
{
  const { residential, commercial, unclassified } = splitBySegment([]);
  is('empty pool → empty buckets', residential.length + commercial.length + unclassified.length, 0);
}

console.log(failed ? `\n✗ ${failed} assertion(s) failed\n` : '\n✓ all segmentation assertions passed\n');
process.exit(failed ? 1 : 0);
