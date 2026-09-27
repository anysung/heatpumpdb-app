/**
 * Storage security rules — per-market dataset isolation (storage.rules).
 *
 * The datasets bucket must let an approved user read ONLY their registered
 * market, let owner/admin read every market, deny the unapproved/unauthenticated,
 * and never lock out a legacy doc that has no `country` field.
 *
 * Runs against the Firestore + Storage emulators (storage.rules calls
 * firestore.get cross-service). Launch:
 *   firebase emulators:exec --only firestore,storage --project heatpumpdb-rules-test \
 *     "node tests/storage-datasets.rules.mjs"
 */
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadString, getBytes } from 'firebase/storage';
import { readFileSync } from 'node:fs';

const PROJECT_ID = 'heatpumpdb-rules-test';
let passed = 0, failed = 0;
const check = async (name, fn) => {
  try { await fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
});

/* Seed user profiles + one dataset object per market (rules disabled). */
await testEnv.withSecurityRulesDisabled(async ctx => {
  const fs = ctx.firestore();
  await setDoc(doc(fs, 'users/de-user'), { status: 'active', role: 'user', country: 'DE' });
  await setDoc(doc(fs, 'users/it-user'), { status: 'active', role: 'user', country: 'IT' });
  await setDoc(doc(fs, 'users/gb-user'), { status: 'active', role: 'user', country: 'GB' });
  await setDoc(doc(fs, 'users/owner'),   { status: 'active', role: 'owner' });            // no country
  await setDoc(doc(fs, 'users/admin'),   { status: 'active', role: 'admin', country: 'FR' });
  await setDoc(doc(fs, 'users/legacy'),  { status: 'active', role: 'user' });             // no country
  await setDoc(doc(fs, 'users/pending'), { status: 'pending', role: 'user', country: 'DE' });
  // Free + Premium split (2026-09-27): a Free (window closed) account and a suspended one.
  await setDoc(doc(fs, 'users/de-free'), { status: 'active', role: 'user', country: 'DE', accessUntilTs: new Date('2026-01-01') });
  await setDoc(doc(fs, 'users/de-suspended'), { status: 'suspended', role: 'user', country: 'DE' });
  const st = ctx.storage();
  for (const [cc, f] of [['DE', 'products.json'], ['DE', 'products-commercial.json'],
    ['IT', 'products-it.json'], ['IT', 'products-commercial-it.json'], ['GB', 'products-gb.json'],
    ['DE', 'products.basic.json'], ['DE', 'products-commercial.basic.json'], ['IT', 'products-it.basic.json']]) {
    await uploadString(ref(st, `datasets/${cc}/${f}`), '{"items":[]}', 'raw', { contentType: 'application/json' });
  }
  await uploadString(ref(st, 'special-report/2026-09/report.html'), '<p>x</p>', 'raw', { contentType: 'text/html' });
});

const asUser = uid => testEnv.authenticatedContext(uid).storage();
const read = (st, path) => getBytes(ref(st, path));

/* Own-market reads (residential + commercial) succeed. */
await check('DE user reads DE residential', () => assertSucceeds(read(asUser('de-user'), 'datasets/DE/products.json')));
await check('DE user reads DE commercial',  () => assertSucceeds(read(asUser('de-user'), 'datasets/DE/products-commercial.json')));
await check('IT user reads IT residential', () => assertSucceeds(read(asUser('it-user'), 'datasets/IT/products-it.json')));
await check('IT user reads IT commercial',  () => assertSucceeds(read(asUser('it-user'), 'datasets/IT/products-commercial-it.json')));

/* Cross-market reads are denied. */
await check('DE user CANNOT read IT residential', () => assertFails(read(asUser('de-user'), 'datasets/IT/products-it.json')));
await check('DE user CANNOT read GB residential', () => assertFails(read(asUser('de-user'), 'datasets/GB/products-gb.json')));
await check('IT user CANNOT read DE residential', () => assertFails(read(asUser('it-user'), 'datasets/DE/products.json')));
await check('GB user CANNOT read IT commercial',  () => assertFails(read(asUser('gb-user'), 'datasets/IT/products-commercial-it.json')));

/* Owner + admin read every market. */
await check('owner reads DE', () => assertSucceeds(read(asUser('owner'), 'datasets/DE/products.json')));
await check('owner reads IT', () => assertSucceeds(read(asUser('owner'), 'datasets/IT/products-it.json')));
await check('owner reads GB', () => assertSucceeds(read(asUser('owner'), 'datasets/GB/products-gb.json')));
await check('admin (FR) reads IT anyway', () => assertSucceeds(read(asUser('admin'), 'datasets/IT/products-it.json')));

/* Legacy doc without country is NOT locked out (fail-open, any market). */
await check('legacy no-country user reads DE', () => assertSucceeds(read(asUser('legacy'), 'datasets/DE/products.json')));
await check('legacy no-country user reads IT', () => assertSucceeds(read(asUser('legacy'), 'datasets/IT/products-it.json')));

/* Unapproved / unauthenticated are denied. */
await check('pending user CANNOT read own-market DE', () => assertFails(read(asUser('pending'), 'datasets/DE/products.json')));
await check('unauthenticated CANNOT read DE', () => assertFails(read(testEnv.unauthenticatedContext().storage(), 'datasets/DE/products.json')));
await check('no write from a client (owner)', async () => {
  await assertFails(uploadString(ref(asUser('owner'), 'datasets/DE/products.json'), 'x'));
});

/* Free + Premium tiers (2026-09-27): basic = any active account of the market; full = entitled. */
await check('Free DE user reads DE basic residential', () => assertSucceeds(read(asUser('de-free'), 'datasets/DE/products.basic.json')));
await check('Free DE user reads DE basic commercial',  () => assertSucceeds(read(asUser('de-free'), 'datasets/DE/products-commercial.basic.json')));
await check('Free DE user CANNOT read DE full',        () => assertFails(read(asUser('de-free'), 'datasets/DE/products.json')));
await check('Free DE user CANNOT read IT basic',       () => assertFails(read(asUser('de-free'), 'datasets/IT/products-it.basic.json')));
await check('entitled DE user reads DE basic too',     () => assertSucceeds(read(asUser('de-user'), 'datasets/DE/products.basic.json')));
await check('suspended user CANNOT read DE basic',     () => assertFails(read(asUser('de-suspended'), 'datasets/DE/products.basic.json')));
await check('pending user CANNOT read DE basic',       () => assertFails(read(asUser('pending'), 'datasets/DE/products.basic.json')));
await check('unauthenticated CANNOT read DE basic',    () => assertFails(read(testEnv.unauthenticatedContext().storage(), 'datasets/DE/products.basic.json')));

/* Special Report premium files. */
await check('entitled user reads Special Report',   () => assertSucceeds(read(asUser('de-user'), 'special-report/2026-09/report.html')));
await check('admin reads Special Report',           () => assertSucceeds(read(asUser('admin'), 'special-report/2026-09/report.html')));
await check('Free user CANNOT read Special Report', () => assertFails(read(asUser('de-free'), 'special-report/2026-09/report.html')));
await check('unauthenticated CANNOT read Special Report', () => assertFails(read(testEnv.unauthenticatedContext().storage(), 'special-report/2026-09/report.html')));
await check('no client write to Special Report (owner)', async () => {
  await assertFails(uploadString(ref(asUser('owner'), 'special-report/2026-09/x.html'), 'x'));
});

await testEnv.cleanup();
console.log(failed ? `\n✗ ${failed} rules assertion(s) failed\n` : `\n✓ all ${passed} storage-rules assertions passed\n`);
process.exit(failed ? 1 : 0);
