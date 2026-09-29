/**
 * scripts/lib/dataset-diff.mjs — the monthly change list behind the Premium
 * watchlist. Plain node: `node tests/dataset-diff.unit.mjs`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { diffMarket, capForStorage, changesById, mfrSlug, canaryMatcher } from '../scripts/lib/dataset-diff.mjs';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  PASS  ${name}`); };

const rec = (id, over = {}) => ({
  source_id: id, bafa_id: id, manufacturer: 'Vaillant GmbH', manufacturer_short: 'Vaillant', model: `M-${id}`,
  scop: 4.5, power_55C_kw: 8, power_35C_kw: 9, cop_A2W35: 4.1, noise_outdoor_dB: 55, refrigerant: 'R290',
  efficiency_35C_percent: 190, efficiency_55C_percent: 140, ...over,
});
const CANARIES = JSON.parse(readFileSync(new URL('../scripts/canary/canary-records.json', import.meta.url), 'utf8'));

test('identical sets → empty diff', () => {
  const a = [rec('1'), rec('2')];
  const d = diffMarket('GB', a, structuredClone(a));
  assert.deepEqual(d.counts, { previous: 2, candidate: 2, listing: 0, added: 0, removed: 0, specs: 0 });
});

test('added / removed by app id', () => {
  const d = diffMarket('GB', [rec('1'), rec('2')], [rec('2'), rec('3')]);
  assert.deepEqual(d.added.map(x => x.id), ['3']);
  assert.deepEqual(d.removed.map(x => x.id), ['1']);
  assert.equal(d.added[0].mfr, 'Vaillant');
});

test('spec change detected; float noise below 3 decimals ignored; null↔value counts', () => {
  const d = diffMarket('DE', [rec('1'), rec('2'), rec('3')],
    [rec('1', { scop: 4.6 }), rec('2', { scop: 4.50000001 }), rec('3', { noise_outdoor_dB: null })]);
  assert.deepEqual(d.specs.map(s => [s.id, s.changes.map(c => c.f)]), [['1', ['scop']], ['3', ['noise_outdoor_dB']]]);
  assert.deepEqual(d.specs[0].changes[0], { f: 'scop', a: 4.5, b: 4.6 });
});

test('refrigerant string change counts, whitespace does not', () => {
  const d = diffMarket('DE', [rec('1'), rec('2')], [rec('1', { refrigerant: 'R32' }), rec('2', { refrigerant: ' R290 ' })]);
  assert.deepEqual(d.specs.map(s => s.id), ['1']);
});

test('DE listing: listed_in_snapshot → delisted reported as listed → not_listed', () => {
  const d = diffMarket('DE', [rec('1', { bafa_listing_status: 'listed_in_snapshot' })], [rec('1', { bafa_listing_status: 'delisted' })]);
  assert.equal(d.listing.length, 1);
  assert.deepEqual([d.listing[0].from, d.listing[0].to], ['listed', 'not_listed']);
});

test('GB listing: only user-facing changes (confirmed ↔ other); review_required ↔ verification_required is silent', () => {
  const d = diffMarket('GB',
    [rec('1', { pel_match_status: 'confirmed' }), rec('2', { pel_match_status: 'verification_required' }), rec('3', { pel_match_status: 'verification_required' })],
    [rec('1', { pel_match_status: 'review_required' }), rec('2', { pel_match_status: 'review_required' }), rec('3', { pel_match_status: 'confirmed' })]);
  assert.deepEqual(d.listing.map(l => [l.id, l.from, l.to]), [['1', 'listed', 'verification_required'], ['3', 'verification_required', 'listed']]);
});

test('PL/IT use their own field; a GB field on a PL record is ignored', () => {
  const pl = diffMarket('PL', [rec('1', { zum_match_status: 'verification_required', pel_match_status: 'x' })], [rec('1', { zum_match_status: 'confirmed', pel_match_status: 'y' })]);
  assert.equal(pl.listing[0].field, 'zum_match_status');
  const it = diffMarket('IT', [rec('1', { gse_match_status: 'confirmed' })], [rec('1', { gse_match_status: 'verification_required' })]);
  assert.equal(it.listing[0].to, 'verification_required');
});

test('FR: agrément status + number + NF PAC reference', () => {
  const d = diffMarket('FR',
    [rec('1', { agrement_match_status: null, agrement_number: null }), rec('2', { agrement_match_status: 'confirmed', agrement_number: 'A1', nf_pac_reference: null })],
    [rec('1', { agrement_match_status: 'confirmed', agrement_number: 'A9' }), rec('2', { agrement_match_status: 'confirmed', agrement_number: 'A2', nf_pac_reference: 'NF-1' })]);
  const f = d.listing.map(l => `${l.id}:${l.field}`).sort();
  assert.deepEqual(f, ['1:agrement_match_status', '1:agrement_number', '2:agrement_number', '2:nf_pac_reference']);
});

test('canary records never appear (live side carries them, candidate does not)', () => {
  const c = CANARIES.DE.residential;
  const canary = { ...rec('x'), ...c };
  const d = diffMarket('DE', [rec('1'), canary], [rec('1')], { canaries: CANARIES });
  assert.equal(d.counts.previous, 1);
  assert.equal(d.removed.length, 0);
  // matched by name too, even if the id changed
  const d2 = diffMarket('DE', [rec('1'), { ...canary, source_id: 'zzz', bafa_id: 'zzz' }], [rec('1')], { canaries: CANARIES });
  assert.equal(d2.removed.length, 0);
  // every market's canaries are known
  const isC = canaryMatcher(CANARIES);
  for (const cc of ['DE', 'GB', 'FR', 'PL', 'IT']) for (const seg of ['residential', 'commercial']) assert.ok(isC(CANARIES[cc][seg]), `${cc}/${seg}`);
});

test('segment files are pooled: a record moving file is not new/removed', () => {
  const d = diffMarket('DE', [rec('1'), rec('2')], [rec('2'), rec('1')]);
  assert.equal(d.counts.added + d.counts.removed, 0);
});

test('capForStorage keeps counts, trims added first, stays under the limit', () => {
  const prev = Array.from({ length: 50 }, (_, i) => rec(String(i), { bafa_listing_status: 'listed_in_snapshot' }));
  const next = [...prev.map((r, i) => (i < 5 ? { ...r, bafa_listing_status: 'delisted' } : r)),
    ...Array.from({ length: 3000 }, (_, i) => rec(`n${i}`))];
  const d = diffMarket('DE', prev, next);
  const capped = capForStorage(d, 60_000);
  assert.ok(Buffer.byteLength(JSON.stringify(capped)) <= 60_000);
  assert.equal(capped.counts.added, 3000);
  assert.equal(capped.listing.length, 5);           // listing survives
  assert.ok(capped.truncated.added < 3000);
  assert.equal(capForStorage(diffMarket('DE', prev, prev)).truncated, null);
});

test('changesById merges kinds per id', () => {
  const d = diffMarket('GB', [rec('1', { pel_match_status: 'x' })], [rec('1', { pel_match_status: 'confirmed', scop: 5 }), rec('2')]);
  const m = changesById(d);
  assert.deepEqual(m.get('1').kinds.map(k => k.kind), ['listing', 'specs']);
  assert.deepEqual(m.get('2').kinds.map(k => k.kind), ['added']);
});

test('mfrSlug — shared vectors, identical to src/hpiq/features/watch/watchModel.ts', () => {
  const vectors = [['Vaillant', 'vaillant'], ['Nordvik Wärmesysteme GmbH', 'nordvik-warmesysteme-gmbh'],
    ['Stiebel Eltron', 'stiebel-eltron'], ['  Bosch / Buderus ', 'bosch-buderus'], ['Weiß & Co.', 'weiss-co'], ['', '']];
  for (const [a, b] of vectors) assert.equal(mfrSlug(a), b, a);
  // The client copy must be byte-identical in its body.
  const ts = readFileSync(new URL('../src/hpiq/features/watch/watchModel.ts', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../scripts/lib/dataset-diff.mjs', import.meta.url), 'utf8');
  const body = (src) => src.slice(src.indexOf('return String(name ?? \'\')'), src.indexOf('.slice(0, 80);') + 14);
  assert.equal(body(ts), body(js));
});

console.log(`\n${passed} passed`);
