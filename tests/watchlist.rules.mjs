/**
 * Firestore rules — Premium watchlist (users/{uid}/watch/*) and the Premium-only
 * monthly change lists (countries/{cc}/changes/*).
 *
 * Run: firebase emulators:exec --config firebase.rules-test.json --only firestore \
 *   --project heatpumpdb-rules-test "node tests/watchlist.rules.mjs"
 */
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, deleteDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
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

const base = {
  firstName: 'A', lastName: 'B', companyName: 'Acme', companyType: 'installer',
  country: 'DE', isActive: true, status: 'active', role: 'user', registeredAt: '2026-07-01T00:00:00.000Z',
};
const future = Timestamp.fromMillis(Date.now() + 10 * 86400_000);
const past = Timestamp.fromMillis(Date.now() - 10 * 86400_000);

await testEnv.withSecurityRulesDisabled(async ctx => {
  const f = ctx.firestore();
  await setDoc(doc(f, 'users/prem'), { ...base, email: 'p@example.com', accessUntilTs: future });
  await setDoc(doc(f, 'users/std'), { ...base, email: 's@example.com', accessUntilTs: past });
  await setDoc(doc(f, 'users/other'), { ...base, email: 'o@example.com', accessUntilTs: future });
  await setDoc(doc(f, 'users/std/watch/DE_m_111'), { type: 'model', market: 'DE', key: '111', label: 'X', createdAt: past });
  await setDoc(doc(f, 'countries/DE/changes/latest'), { month: '2026-10', listing: [] });
  await setDoc(doc(f, 'countries/DE/news/n1'), { title: 'x' });
});

const fs = (uid) => testEnv.authenticatedContext(uid, { email: `${uid}@example.com` }).firestore();
const good = (over = {}) => ({ type: 'model', market: 'DE', key: '16010266', label: 'Vaillant aroTHERM', createdAt: serverTimestamp(), ...over });

await check('Premium CAN watch a model', () =>
  assertSucceeds(setDoc(doc(fs('prem'), 'users/prem/watch/DE_m_16010266'), good())));
await check('Premium CAN watch a manufacturer', () =>
  assertSucceeds(setDoc(doc(fs('prem'), 'users/prem/watch/DE_f_vaillant'), good({ type: 'manufacturer', key: 'vaillant', label: 'Vaillant' }))));
await check('Premium CAN list own watchlist', () =>
  assertSucceeds(getDocs(collection(fs('prem'), 'users/prem/watch'))));
await check('Premium CAN remove a watch', () =>
  assertSucceeds(deleteDoc(doc(fs('prem'), 'users/prem/watch/DE_f_vaillant'))));

await check('Standard CANNOT add a watch', () =>
  assertFails(setDoc(doc(fs('std'), 'users/std/watch/DE_m_222'), good({ key: '222' }))));
await check('Standard CAN remove an old watch (clean-up after lapse)', () =>
  assertSucceeds(deleteDoc(doc(fs('std'), 'users/std/watch/DE_m_111'))));
await check('Standard CAN switch email alerts off', () =>
  assertSucceeds(setDoc(doc(fs('std'), 'users/std/watch/_settings'), { emailAlerts: false, lang: 'de', updatedAt: serverTimestamp() })));

await check('another user CANNOT read my watchlist', () =>
  assertFails(getDocs(collection(fs('other'), 'users/prem/watch'))));
await check('another user CANNOT write into my watchlist', () =>
  assertFails(setDoc(doc(fs('other'), 'users/prem/watch/DE_m_333'), good({ key: '333' }))));
await check('signed-out CANNOT read', () =>
  assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'users/prem/watch/DE_m_16010266'))));

await check('extra field rejected', () =>
  assertFails(setDoc(doc(fs('prem'), 'users/prem/watch/DE_m_444'), good({ key: '444', note: 'x' }))));
await check('bad type rejected', () =>
  assertFails(setDoc(doc(fs('prem'), 'users/prem/watch/DE_m_445'), good({ key: '445', type: 'project' }))));
await check('docId market must match field', () =>
  assertFails(setDoc(doc(fs('prem'), 'users/prem/watch/GB_m_446'), good({ key: '446' }))));
await check('docId type letter must match field', () =>
  assertFails(setDoc(doc(fs('prem'), 'users/prem/watch/DE_f_447'), good({ key: '447' }))));
await check('over-long key rejected', () =>
  assertFails(setDoc(doc(fs('prem'), 'users/prem/watch/DE_m_x'), good({ key: 'x'.repeat(201) }))));
await check('client-chosen createdAt rejected', () =>
  assertFails(setDoc(doc(fs('prem'), 'users/prem/watch/DE_m_448'), good({ key: '448', createdAt: past }))));
await check('settings: bad lang rejected', () =>
  assertFails(setDoc(doc(fs('prem'), 'users/prem/watch/_settings'), { emailAlerts: true, lang: 'ko', updatedAt: serverTimestamp() })));
await check('settings: non-bool emailAlerts rejected', () =>
  assertFails(setDoc(doc(fs('prem'), 'users/prem/watch/_settings'), { emailAlerts: 'yes', updatedAt: serverTimestamp() })));
await check('settings: extra field rejected', () =>
  assertFails(setDoc(doc(fs('prem'), 'users/prem/watch/_settings'), { emailAlerts: true, isAdmin: true, updatedAt: serverTimestamp() })));

await check('Premium CAN read countries/DE/changes/latest', () =>
  assertSucceeds(getDoc(doc(fs('prem'), 'countries/DE/changes/latest'))));
await check('Standard CANNOT read countries/DE/changes/latest (Premium values)', () =>
  assertFails(getDoc(doc(fs('std'), 'countries/DE/changes/latest'))));
await check('Standard still CAN read countries/DE/news', () =>
  assertSucceeds(getDoc(doc(fs('std'), 'countries/DE/news/n1'))));
await check('nobody but admin writes changes', () =>
  assertFails(setDoc(doc(fs('prem'), 'countries/DE/changes/latest'), { month: 'x' })));

await testEnv.cleanup();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
