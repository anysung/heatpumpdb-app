#!/usr/bin/env node
/** plausibility.unit.mjs — the A/B/C rules (src/shared/plausibility.mjs). */
import { impossibleFields, inconsistentFields, sanitizeRecord, plausibilityOf, CARNOT } from '../src/shared/plausibility.mjs';
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.error('  ✗', n); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

ok('Carnot limits', Math.abs(CARNOT.cop_A7W35 - 11.005) < 0.01 && Math.abs(CARNOT.cop_A2W35 - 9.338) < 0.01 && Math.abs(CARNOT.cop_AMinus7W35 - 7.337) < 0.01);
// A
ok('A: COP A7 12 impossible', eq(impossibleFields({ cop_A7W35: 12 }), ['cop_A7W35']));
ok('A: COP below 1', eq(impossibleFields({ cop_A2W35: 0.8 }), ['cop_A2W35']));
ok('A: sound 0 impossible', eq(impossibleFields({ noise_outdoor_dB: 0 }), ['noise_outdoor_dB']));
ok('A: normal values pass', impossibleFields({ cop_A7W35: 5.2, cop_A2W35: 4.1, cop_AMinus7W35: 3, noise_outdoor_dB: 55 }).length === 0);
ok('C: 7.3 at A7 is unusual but NOT removed', impossibleFields({ cop_A7W35: 7.35 }).length === 0);
// B
ok('B: A2 > A7 + 0.3', eq(inconsistentFields({ cop_A7W35: 4.55, cop_A2W35: 8.49 }).sort(), ['cop_A2W35', 'cop_A7W35']));
ok('B: within tolerance passes', inconsistentFields({ cop_A7W35: 4.5, cop_A2W35: 4.7 }).length === 0);
ok('B: A-7 > A2 + 0.3', eq(inconsistentFields({ cop_A2W35: 3.6, cop_AMinus7W35: 4.7 }).sort(), ['cop_A2W35', 'cop_AMinus7W35']));
ok('B: SCOP vs eta mismatch', eq(inconsistentFields({ scop: 3.5, efficiency_35C_percent: 190 }), ['scop']));
ok('B: SCOP matches eta', inconsistentFields({ scop: 4.73, efficiency_35C_percent: 186.1 }).length === 0);
ok('B: registry-native SCOP basis exempt (GSE)', inconsistentFields({ scop: 4.68, efficiency_35C_percent: 203, performance_source: 'GSE_CATALOGUE' }).length === 0);
ok('B: registry-native SCOP basis exempt (ZUM)', inconsistentFields({ scop: 3.0, efficiency_35C_percent: 190, performance_source: 'ZUM_REGISTRY' }).length === 0);
// sanitize
const s = sanitizeRecord({ model: 'X', cop_A7W35: 12, cop_A2W35: 9.1, cop_AMinus7W35: 10, noise_outdoor_dB: 65 });
ok('sanitize removes A values', s.cop_A7W35 === null && s.cop_AMinus7W35 === null && s.cop_A2W35 === 9.1);
ok('sanitize records qa_removed', eq(s.qa_removed, ['cop_A7W35', 'cop_AMinus7W35']));
ok('surviving COP of an impossible set is flagged', eq(s.qa_flags, ['cop_A2W35']));
ok('sound-only removal does not flag COPs', !sanitizeRecord({ noise_outdoor_dB: 0, cop_A7W35: 5 }).qa_flags);
ok('sanitize is idempotent', eq(sanitizeRecord(s), s));
ok('clean record gets no qa fields', !('qa_removed' in sanitizeRecord({ cop_A7W35: 5 })) && !('qa_flags' in sanitizeRecord({ cop_A7W35: 5 })));
ok('A record → needsCheck', plausibilityOf({ noise_outdoor_dB: 0 }).needsCheck === true);
ok('B record → needsCheck', plausibilityOf({ cop_A7W35: 4, cop_A2W35: 5 }).needsCheck === true);
ok('clean record → no check', plausibilityOf({ cop_A7W35: 5, cop_A2W35: 4 }).needsCheck === false);
console.log(`\nplausibility: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
