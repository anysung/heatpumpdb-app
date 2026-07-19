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
  // Paying customers. Since the blanket grandfather clause was removed, an
  // approved account is no longer entitled by virtue of being approved — it
  // must actually have been granted access, exactly like a real subscriber.
  const paid = { paidAccess: true, subscription: { provider: 'paddle', planCode: 'professional', status: 'active', seatLimit: 1 } };
  await setDoc(doc(fs, 'users/de-user'), { status: 'active', role: 'user', country: 'DE', ...paid });
  await setDoc(doc(fs, 'users/it-user'), { status: 'active', role: 'user', country: 'IT', ...paid });
  await setDoc(doc(fs, 'users/gb-user'), { status: 'active', role: 'user', country: 'GB', ...paid });
  await setDoc(doc(fs, 'users/owner'),   { status: 'active', role: 'owner' });            // no country
  await setDoc(doc(fs, 'users/admin'),   { status: 'active', role: 'admin', country: 'FR' });
  await setDoc(doc(fs, 'users/legacy'),  { status: 'active', role: 'user', plan: 'premium' });  // no country; legacy premium
  await setDoc(doc(fs, 'users/pending'), { status: 'pending', role: 'user', country: 'DE' });
  // ── Paid entitlement (isEntitled in storage.rules) ────────────────────────
  // The account approval axis is identical for all four: status 'active'. Only
  // the BILLING state differs, which is the whole point — an unpaid account is
  // still a live account, it just cannot read the catalogue.
  await setDoc(doc(fs, 'users/paid-user'), {
    status: 'active', role: 'user', country: 'DE', paidAccess: true,
    subscription: { provider: 'paddle', planCode: 'professional', status: 'active', seatLimit: 1 },
  });
  await setDoc(doc(fs, 'users/expired-user'), {
    status: 'active', role: 'user', country: 'DE', paidAccess: false,
    subscription: { provider: 'paddle', planCode: 'professional', status: 'expired', seatLimit: 1 },
  });
  await setDoc(doc(fs, 'users/grace-user'), {
    status: 'active', role: 'user', country: 'DE', paidAccess: true,
    subscription: { provider: 'paddle', planCode: 'professional', status: 'past_due', seatLimit: 1 },
  });
  // A Team 3 member: no subscription and NO paidAccess flag of their own — the
  // rule follows orgId to the organization, which is the single source.
  await setDoc(doc(fs, 'users/team-member'), {
    status: 'active', role: 'user', country: 'DE',
    orgId: 'org-paid', orgRole: 'member',
  });
  // A member of a team whose billing has lapsed.
  await setDoc(doc(fs, 'users/team-lapsed'), {
    status: 'active', role: 'user', country: 'DE',
    orgId: 'org-lapsed', orgRole: 'member',
  });
  // Points at a paid org they hold NO seat in (firestore.rules forbids writing
  // this, but the storage rule must not rely on that alone).
  await setDoc(doc(fs, 'users/team-impostor'), {
    status: 'active', role: 'user', country: 'DE',
    orgId: 'org-paid', orgRole: 'member',
  });
  // An approved account that simply never paid — the case the grandfather
  // clause used to wave through.
  await setDoc(doc(fs, 'users/unpaid'), { status: 'active', role: 'user', country: 'DE' });
  // A NORMAL approved registration, exactly as authService writes it:
  // plan 'standard', no subscription, no paidAccess. The `legacy premium` arm of
  // isEntitled() must not reach this account — `premium` is admin-assignable
  // only (it is in no client-writable allow-list in firestore.rules), so it is a
  // deliberate manual-access state, never something an ordinary signup carries.
  await setDoc(doc(fs, 'users/standard-unpaid'), {
    status: 'active', isActive: true, role: 'user', country: 'DE', plan: 'standard',
  });
  // The admin-assigned manual-access account the `premium` arm exists for.
  await setDoc(doc(fs, 'users/legacy-premium'), {
    status: 'active', isActive: true, role: 'user', country: 'DE', plan: 'premium',
  });
  // Manually assigned by an admin (adminAssignSubscription writes paidAccess).
  await setDoc(doc(fs, 'users/manual'), {
    status: 'active', role: 'user', country: 'DE', paidAccess: true,
    subscription: { provider: 'paddle', planCode: 'team_3', status: 'active', seatLimit: 3 },
  });

  await setDoc(doc(fs, 'organizations/org-paid'), {
    ownerUid: 'de-user', planCode: 'team_3', seatLimit: 3,
    subscriptionStatus: 'active', paidAccess: true,
    memberUids: ['de-user', 'team-member'],
  });
  await setDoc(doc(fs, 'organizations/org-lapsed'), {
    ownerUid: 'other-owner', planCode: 'team_3', seatLimit: 3,
    subscriptionStatus: 'expired', paidAccess: false,
    memberUids: ['other-owner', 'team-lapsed'],
  });
  const st = ctx.storage();
  for (const [cc, f] of [['DE', 'products.json'], ['DE', 'products-commercial.json'],
    ['IT', 'products-it.json'], ['IT', 'products-commercial-it.json'], ['GB', 'products-gb.json']]) {
    await uploadString(ref(st, `datasets/${cc}/${f}`), '{"items":[]}', 'raw', { contentType: 'application/json' });
  }
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

/* ── Paid entitlement gates the catalogue, approval alone no longer does ──── */
await check('[entitlement] a paying user reads their market',
  () => assertSucceeds(read(asUser('paid-user'), 'datasets/DE/products.json')));
await check('[entitlement] a user inside the payment-failure grace window still reads',
  () => assertSucceeds(read(asUser('grace-user'), 'datasets/DE/products.json')));
await check('[entitlement] 22. a team MEMBER entitled through their org reads',
  () => assertSucceeds(read(asUser('team-member'), 'datasets/DE/products.json')));
await check('[entitlement] 5. a member of a LAPSED team CANNOT read',
  () => assertFails(read(asUser('team-lapsed'), 'datasets/DE/products.json')));
await check('[entitlement] an orgId pointer without a seat grants nothing',
  () => assertFails(read(asUser('team-impostor'), 'datasets/DE/products.json')));
await check('[entitlement] 9. a NEW approved account with no subscription is NOT grandfathered',
  () => assertFails(read(asUser('unpaid'), 'datasets/DE/products.json')));
await check('[entitlement] D. a normal approved+unpaid account (plan standard) CANNOT read the paid dataset',
  () => assertFails(read(asUser('standard-unpaid'), 'datasets/DE/products.json')));
await check('[entitlement] D2. admin-assigned legacy premium still reads (intentional manual access)',
  () => assertSucceeds(read(asUser('legacy-premium'), 'datasets/DE/products.json')));
await check('[entitlement] 10. an admin-assigned subscription is allowed',
  () => assertSucceeds(read(asUser('manual'), 'datasets/DE/products.json')));
await check('[entitlement] an EXPIRED subscription CANNOT read the catalogue',
  () => assertFails(read(asUser('expired-user'), 'datasets/DE/products.json')));
await check('[entitlement] an expired account is still approved (billing ≠ account state)', async () => {
  // The account is untouched: status stays 'active', so the person can still
  // sign in and reach Account/Billing to renew. Only the catalogue is closed.
  await testEnv.withSecurityRulesDisabled(async ctx => {
    const snap = await import('firebase/firestore').then(m => m.getDoc(m.doc(ctx.firestore(), 'users/expired-user')));
    if (snap.get('status') !== 'active') throw new Error('expired billing must not deactivate the account');
    if (snap.get('isActive') === false) throw new Error('expired billing must not clear isActive');
  });
});

/* Legacy doc without country is NOT locked out (fail-open, any market). */
await check('legacy no-country user reads DE', () => assertSucceeds(read(asUser('legacy'), 'datasets/DE/products.json')));
await check('legacy no-country user reads IT', () => assertSucceeds(read(asUser('legacy'), 'datasets/IT/products-it.json')));

/* Unapproved / unauthenticated are denied. */
await check('pending user CANNOT read own-market DE', () => assertFails(read(asUser('pending'), 'datasets/DE/products.json')));
await check('unauthenticated CANNOT read DE', () => assertFails(read(testEnv.unauthenticatedContext().storage(), 'datasets/DE/products.json')));
await check('no write from a client (owner)', async () => {
  await assertFails(uploadString(ref(asUser('owner'), 'datasets/DE/products.json'), 'x'));
});

await testEnv.cleanup();
console.log(failed ? `\n✗ ${failed} rules assertion(s) failed\n` : `\n✓ all ${passed} storage-rules assertions passed\n`);
process.exit(failed ? 1 : 0);
