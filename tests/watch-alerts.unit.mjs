/**
 * scripts/lib/watch-alerts.mjs — who gets a watchlist alert and what it says.
 * Plain node: `node tests/watch-alerts.unit.mjs`.
 */
import assert from 'node:assert/strict';
import { diffMarket } from '../scripts/lib/dataset-diff.mjs';
import { skipRecipient, selectChanges, buildAlertMail, langFor, isTestEmail, MAX_LINES } from '../scripts/lib/watch-alerts.mjs';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  PASS  ${name}`); };

const NOW = Date.parse('2026-10-01T03:00:00Z');
const DAY = 86400_000;
const u = (over = {}) => ({ uid: 'u1', email: 'max@installer.de', status: 'active', role: 'user', country: 'DE', ...over });

test('recipient: legacy (no window anywhere) is Premium', () => assert.equal(skipRecipient(u(), null, NOW), null));
test('recipient: open own window', () => assert.equal(skipRecipient(u({ accessUntilTs: new Date(NOW + DAY).toISOString() }), null, NOW), null));
test('recipient: closed window → standard', () => assert.equal(skipRecipient(u({ accessUntilTs: { seconds: (NOW - DAY) / 1000 } }), null, NOW), 'standard'));
test('recipient: closed own, open TEAM window (member listed)', () => {
  const org = { accessUntilTs: new Date(NOW + DAY).toISOString(), memberUids: ['u1'] };
  assert.equal(skipRecipient(u({ accessUntilTs: NOW - DAY, orgId: 'o1' }), org, NOW), null);
  assert.equal(skipRecipient(u({ accessUntilTs: NOW - DAY, orgId: 'o1' }), { ...org, memberUids: [] }, NOW), 'standard');
});
test('recipient: live grant opens, revoked grant does not', () => {
  const grant = { endsAt: new Date(NOW + DAY).toISOString() };
  assert.equal(skipRecipient(u({ accessUntilTs: NOW - DAY, grant }), null, NOW), null);
  assert.equal(skipRecipient(u({ accessUntilTs: NOW - DAY, grant: { ...grant, revokedAt: 'x' } }), null, NOW), 'standard');
});
test('recipient: suspended / pending / admin / test / no email are skipped', () => {
  assert.equal(skipRecipient(u({ status: 'suspended' }), null, NOW), 'not-active');
  assert.equal(skipRecipient(u({ status: 'pending' }), null, NOW), 'not-active');
  assert.equal(skipRecipient(u({ status: undefined, isActive: true }), null, NOW), null);
  assert.equal(skipRecipient(u({ role: 'admin' }), null, NOW), 'admin');
  assert.equal(skipRecipient(u({ role: 'owner' }), null, NOW), 'admin');
  assert.equal(skipRecipient(u({ email: 'e2e-verify@heatpumpdb.de' }), null, NOW), 'test-email');
  assert.equal(skipRecipient(u({ email: '' }), null, NOW), 'no-email');
  assert.equal(skipRecipient(null, null, NOW), 'no-profile');
});
test('isTestEmail does not catch ordinary names', () => {
  for (const e of ['contest@firma.de', 'testa.mario@impresa.it', 'm.questa@x.it', 'latest@x.com']) assert.equal(isTestEmail(e), false, e);
  for (const e of ['test@x.de', 'a+test@x.de', 'qa.team@x.de', 'x@example.com']) assert.equal(isTestEmail(e), true, e);
});

const rec = (id, mfr, over = {}) => ({ source_id: id, manufacturer_short: mfr, manufacturer: mfr, model: `M${id}`, scop: 4, ...over });
const diffDE = diffMarket('DE',
  [rec('1', 'Vaillant', { bafa_listing_status: 'listed_in_snapshot' }), rec('2', 'Vaillant'), rec('3', 'Daikin'), rec('9', 'Bosch')],
  [rec('1', 'Vaillant', { bafa_listing_status: 'delisted' }), rec('2', 'Vaillant', { scop: 4.4 }), rec('3', 'Daikin'), rec('4', 'Vaillant')]);

test('selection: model watch hits only that model', () => {
  const r = selectChanges([{ type: 'model', market: 'DE', key: '1' }, { type: 'model', market: 'DE', key: '3' }], { DE: diffDE });
  assert.deepEqual(r.map(x => x.id), ['1']);
});
test('selection: manufacturer watch hits listing, specs and NEW models; dedup with model watch', () => {
  const r = selectChanges([{ type: 'model', market: 'DE', key: '1' }, { type: 'manufacturer', market: 'DE', key: 'vaillant' }], { DE: diffDE });
  assert.deepEqual(r.map(x => `${x.id}:${x.via}`), ['1:model', '2:manufacturer', '4:manufacturer']);
});
test('selection: other market / missing / suspect diffs never match', () => {
  assert.equal(selectChanges([{ type: 'model', market: 'GB', key: '1' }], { DE: diffDE }).length, 0);
  assert.equal(selectChanges([{ type: 'model', market: 'DE', key: '1' }], { DE: { ...diffDE, suspect: true } }).length, 0);
  assert.equal(selectChanges([], { DE: diffDE }).length, 0);
});
test('selection: removed model reported', () => {
  const r = selectChanges([{ type: 'model', market: 'DE', key: '9' }], { DE: diffDE });
  assert.equal(r[0].kinds[0].kind, 'removed');
});

test('language: settings lang wins, else market; GB always English', () => {
  assert.equal(langFor('fr', 'DE'), 'fr');
  assert.equal(langFor(undefined, 'PL'), 'pl');
  assert.equal(langFor('de', 'GB'), 'en');
  assert.equal(langFor('ko', 'IT'), 'it');
});

test('mail: five languages, link, CTA marker, registry name per market', () => {
  const items = selectChanges([{ type: 'manufacturer', market: 'DE', key: 'vaillant' }], { DE: diffDE });
  for (const lang of ['en', 'de', 'fr', 'pl', 'it']) {
    const m = buildAlertMail({ lang, name: 'Max Muster', month: '2026-10', items, site: 'https://www.heatpumpdb.de' });
    assert.equal(m.lang, lang);
    assert.ok(m.subject.length > 10 && m.subject.includes('3'), m.subject);
    assert.ok(m.body.includes('https://www.heatpumpdb.de/?open=watchlist'));
    assert.ok(m.body.includes('{{CTA}}'));
    assert.equal(m.cta.url, 'https://www.heatpumpdb.de/?open=watchlist');
    assert.ok(m.body.includes('BAFA'));
  }
  const de = buildAlertMail({ lang: 'de', name: '', month: '2026-10', items, site: 'x' });
  assert.ok(de.subject.includes('Oktober 2026'), de.subject);
  assert.ok(de.body.includes('gelistet → nicht gelistet'));
});
test('mail: GB never says "not listed" and never names BAFA', () => {
  const gb = diffMarket('GB', [rec('1', 'Vaillant', { pel_match_status: 'confirmed' })], [rec('1', 'Vaillant', { pel_match_status: 'review_required' })]);
  const m = buildAlertMail({ lang: 'en', name: '', month: '2026-10', items: selectChanges([{ type: 'model', market: 'GB', key: '1' }], { GB: gb }), site: 'x' });
  assert.ok(m.body.includes('PEL status: listed → verification required'), m.body);
  assert.ok(!/not listed|BAFA/.test(m.body));
});
test('mail: long lists are cut with a "more" line', () => {
  const many = Array.from({ length: MAX_LINES + 7 }, (_, i) => ({ market: 'DE', id: String(i), mfr: 'V', model: `M${i}`, kinds: [{ kind: 'added' }], via: 'manufacturer' }));
  const m = buildAlertMail({ lang: 'en', name: '', month: '2026-10', items: many, site: 'x' });
  assert.ok(m.body.includes('…and 7 more.'));
  assert.equal((m.body.match(/^• /gm) ?? []).length, MAX_LINES);
});

console.log(`\n${passed} passed`);
