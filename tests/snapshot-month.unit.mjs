// snapshot-month: the monthly window opens at 00:05 Berlin, which is still the
// previous month in UTC — the label must follow Berlin (2026-10-01 incident).
import assert from 'node:assert/strict';
import { berlinMonth, snapshotMonth } from '../scripts/lib/snapshot-month.mjs';

const cases = [
  ['2026-09-30T22:05:00Z', '2026-10'],  // 00:05 CEST on 1 Oct — UTC still says September
  ['2026-09-30T21:59:59Z', '2026-09'],  // 23:59 CEST on 30 Sep
  ['2026-10-31T23:05:00Z', '2026-11'],  // 00:05 CET on 1 Nov (after the DST change)
  ['2026-12-31T23:30:00Z', '2027-01'],  // year rollover
  ['2026-06-15T12:00:00Z', '2026-06'],
];
for (const [iso, want] of cases) assert.equal(berlinMonth(new Date(iso)), want, iso);

const saved = process.env.SNAPSHOT_MONTH;
process.env.SNAPSHOT_MONTH = '2026-07';
assert.equal(snapshotMonth(), '2026-07', 'env wins over the clock');
assert.equal(snapshotMonth('2026-05'), '2026-05', 'explicit flag wins over env');
assert.throws(() => snapshotMonth('2026-13'));
process.env.SNAPSHOT_MONTH = 'bad';
assert.throws(() => snapshotMonth());
if (saved === undefined) delete process.env.SNAPSHOT_MONTH; else process.env.SNAPSHOT_MONTH = saved;
console.log('snapshot-month: all cases pass');
