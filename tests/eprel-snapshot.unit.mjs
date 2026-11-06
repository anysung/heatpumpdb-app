import assert from 'node:assert/strict';
import { STABLE_SORT, isSnapshotComplete } from '../scripts/lib/eprel-snapshot.mjs';

// The real 2026-11 failure: every row saved, a quarter of the products missing.
assert.equal(isSnapshotComplete({ total: 47787, uniqueRecords: 36521, lastPageReached: true }), false);
assert.equal(isSnapshotComplete({ total: 47787, uniqueRecords: 47787, lastPageReached: true }), true);
// Small registry movement during a crawl is not a failed snapshot.
assert.equal(isSnapshotComplete({ total: 47787, uniqueRecords: 47700, lastPageReached: true }), true);
assert.equal(isSnapshotComplete({ total: 47787, uniqueRecords: 47787, lastPageReached: false }), false);
assert.equal(isSnapshotComplete({ total: null, uniqueRecords: 100, lastPageReached: true }), false);
assert.equal(STABLE_SORT.sort1, 'eprelRegistrationNumber');
console.log('eprel-snapshot: ok');
