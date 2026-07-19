/**
 * Manual-news CMS security — Firestore `newsArticles` + default-bucket
 * `news/manual/**` (firestore.rules + storage.default.rules).
 *
 * Only admins may read/write draft articles or upload hero images; approved
 * non-admin users may READ a hero image (news is behind the approval gate) but
 * never write; pending/anonymous are denied everywhere.
 *
 * Run: firebase emulators:exec --config firebase.rules-test.json --only firestore,storage \
 *   --project heatpumpdb-rules-test "node tests/news-cms.rules.mjs"
 */
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadString, getBytes } from 'firebase/storage';
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const check = async (name, fn) => {
  try { await fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

const testEnv = await initializeTestEnvironment({
  projectId: 'heatpumpdb-rules-test',
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  storage: { rules: readFileSync('storage.default.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
});

await testEnv.withSecurityRulesDisabled(async ctx => {
  const fs = ctx.firestore();
  await setDoc(doc(fs, 'users/admin'), { role: 'admin', status: 'active', country: 'DE' });
  await setDoc(doc(fs, 'users/approved'), { role: 'user', status: 'active', country: 'DE' });
  await setDoc(doc(fs, 'users/pending'), { role: 'user', status: 'pending' });
  await setDoc(doc(fs, 'newsArticles/seed'), { title: 'x', status: 'draft', sourceType: 'manual' });
  await uploadString(ctx.storage().ref('news/manual/seed/hero.webp'), 'IMG', 'raw', { contentType: 'image/webp' });
});

const fsAs = uid => testEnv.authenticatedContext(uid).firestore();
const stAs = uid => testEnv.authenticatedContext(uid).storage();

/* Firestore newsArticles — admin only. */
await check('admin CAN read a draft', () => assertSucceeds(getDoc(doc(fsAs('admin'), 'newsArticles/seed'))));
await check('admin CAN write a draft', () => assertSucceeds(setDoc(doc(fsAs('admin'), 'newsArticles/a1'), { title: 'T', status: 'draft', sourceType: 'manual' })));
await check('approved non-admin CANNOT read a draft', () => assertFails(getDoc(doc(fsAs('approved'), 'newsArticles/seed'))));
await check('approved non-admin CANNOT write a draft', () => assertFails(setDoc(doc(fsAs('approved'), 'newsArticles/a2'), { title: 'T' })));
await check('pending CANNOT read a draft', () => assertFails(getDoc(doc(fsAs('pending'), 'newsArticles/seed'))));
await check('unauthenticated CANNOT read a draft', () => assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'newsArticles/seed'))));

/* Storage news/manual — admin write, approved read. */
await check('admin CAN upload a valid hero image', () =>
  assertSucceeds(uploadString(ref(stAs('admin'), 'news/manual/a1/hero.webp'), 'IMG', 'raw', { contentType: 'image/webp' })));
await check('admin CANNOT upload a non-image', () =>
  assertFails(uploadString(ref(stAs('admin'), 'news/manual/a1/hero.txt'), 'TEXT', 'raw', { contentType: 'text/plain' })));
await check('approved user CAN read a hero image', () =>
  assertSucceeds(getBytes(ref(stAs('approved'), 'news/manual/seed/hero.webp'))));
await check('approved user CANNOT upload a hero image', () =>
  assertFails(uploadString(ref(stAs('approved'), 'news/manual/seed/hero.webp'), 'IMG', 'raw', { contentType: 'image/webp' })));
await check('pending user CANNOT read a hero image', () =>
  assertFails(getBytes(ref(stAs('pending'), 'news/manual/seed/hero.webp'))));
await check('unauthenticated CANNOT read a hero image', () =>
  assertFails(getBytes(ref(testEnv.unauthenticatedContext().storage(), 'news/manual/seed/hero.webp'))));

await testEnv.cleanup();
console.log(failed ? `\n✗ ${failed} CMS rules assertion(s) failed\n` : `\n✓ all ${passed} manual-news CMS rules assertions passed\n`);
process.exit(failed ? 1 : 0);
