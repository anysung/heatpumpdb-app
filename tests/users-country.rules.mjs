/**
 * Firestore rules — account-country + privilege immutability (firestore.rules).
 *
 * The one-email-one-country policy depends on `country` (and role/approval)
 * being writable only at creation and only by admins thereafter. These tests
 * prove a normal user cannot self-mutate those fields.
 *
 * Run: firebase emulators:exec --config firebase.rules-test.json --only firestore \
 *   --project heatpumpdb-rules-test "node tests/users-country.rules.mjs"
 */
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
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
});

const UID = 'de-user';
const base = {
  email: 'de@example.com', firstName: 'A', lastName: 'B',
  companyName: 'Acme', companyType: 'installer',
  country: 'DE', isActive: true, status: 'active', role: 'user',
  registeredAt: '2026-07-01T00:00:00.000Z',
};

/* Seed an approved DE user (rules disabled). */
await testEnv.withSecurityRulesDisabled(async ctx => {
  await setDoc(doc(ctx.firestore(), `users/${UID}`), base);
});

const meDoc = () => doc(testEnv.authenticatedContext(UID, { email: base.email }).firestore(), `users/${UID}`);

/* New signup assigns the current site's country (create with country=user's own). */
await check('normal user CAN create own pending doc carrying a country', async () => {
  const ctx = testEnv.authenticatedContext('new-uid', { email: 'new@example.com' });
  await assertSucceeds(setDoc(doc(ctx.firestore(), 'users/new-uid'), {
    email: 'new@example.com', firstName: 'N', lastName: 'U', companyName: 'X', companyType: 'installer',
    country: 'IT', isActive: false, status: 'pending', role: 'user', registeredAt: '2026-07-19T00:00:00.000Z',
  }));
});

/* A normal user may edit only name/company — sanity that the surface still works. */
await check('normal user CAN edit own name/company', () =>
  assertSucceeds(updateDoc(meDoc(), { firstName: 'Changed', companyName: 'NewCo' })));

/* The forbidden self-mutations. */
await check('normal user CANNOT change own country (DE→IT)', () =>
  assertFails(updateDoc(meDoc(), { country: 'IT' })));
await check('normal user CANNOT remove/blank own country', () =>
  assertFails(updateDoc(meDoc(), { country: '' })));
await check('normal user CANNOT change own role (user→admin)', () =>
  assertFails(updateDoc(meDoc(), { role: 'admin' })));
await check('a PENDING user CANNOT self-approve (status→active without a grant)', async () => {
  await testEnv.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'users/pending-uid'), {
      email: 'p@example.com', country: 'DE', isActive: false, status: 'pending', role: 'user',
      registeredAt: '2026-07-10T00:00:00.000Z',
    });
  });
  const p = testEnv.authenticatedContext('pending-uid', { email: 'p@example.com' }).firestore();
  await assertFails(updateDoc(doc(p, 'users/pending-uid'), { status: 'active', isActive: true }));
});
await check('normal user CANNOT flip isActive alone', () =>
  assertFails(updateDoc(meDoc(), { isActive: false })));
await check('normal user CANNOT smuggle country inside a profile edit', () =>
  assertFails(updateDoc(meDoc(), { firstName: 'Z', country: 'FR' })));

/* Admin may correct a country (the sanctioned path). */
await check('admin CAN change a user country', async () => {
  await testEnv.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'users/admin-uid'), { email: 'admin@x.com', role: 'admin', status: 'active', isActive: true, country: 'DE' });
  });
  const admin = testEnv.authenticatedContext('admin-uid', { email: 'admin@x.com' }).firestore();
  await assertSucceeds(updateDoc(doc(admin, `users/${UID}`), { country: 'IT' }));
});

await testEnv.cleanup();
console.log(failed ? `\n✗ ${failed} rules assertion(s) failed\n` : `\n✓ all ${passed} account-country rules assertions passed\n`);
process.exit(failed ? 1 : 0);
