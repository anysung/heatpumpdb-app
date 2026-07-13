/**
 * Registration pause — SERVER-SIDE tests (firestore.rules), run against the
 * Firestore emulator. These are the tests that matter: they prove a client that
 * bypasses our UI entirely (raw SDK, curl, a patched bundle) still cannot create
 * a user profile while registration is paused.
 *
 * Run:  npm run test:registration
 *       (firebase emulators:exec --only firestore "node tests/registration-pause.rules.mjs")
 */
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const PROJECT_ID = 'heatpumpdb-rules-test';
const OWNER_EMAIL = 'sungyongsoo1976@gmail.com';

const pendingProfile = (uid, email, country) => ({
  id: uid,
  email,
  firstName: 'Test',
  lastName: 'User',
  companyType: 'Installer',
  jobRole: 'Technician',
  country,
  isActive: false,
  status: 'pending',
  registeredAt: new Date().toISOString(),
  termsAcceptedAt: new Date().toISOString(),
  role: 'user',
  plan: 'standard',
});

let passed = 0;
let failed = 0;
const check = async (name, fn) => {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL  ${name}\n        ${err.message}`);
  }
};

const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: {
    rules: readFileSync('firestore.rules', 'utf8'),
    host: '127.0.0.1',
    port: 8080,
  },
});

// Seed the docs the rules read (an approved user, an admin, a free-access grant)
// with rules disabled — this is fixture setup, not part of the assertions.
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'users', 'approved-uid'), {
    id: 'approved-uid',
    email: 'approved@heatpumpdb.de',
    firstName: 'Existing',
    lastName: 'Member',
    isActive: true,
    status: 'active',
    role: 'user',
    registeredAt: new Date().toISOString(),
  });
  await setDoc(doc(db, 'users', 'admin-uid'), {
    id: 'admin-uid',
    email: 'admin@heatpumpdb.de',
    isActive: true,
    status: 'active',
    role: 'admin',
    registeredAt: new Date().toISOString(),
  });
  await setDoc(doc(db, 'freeAccessGrants', 'granted@heatpumpdb.de'), {
    email: 'granted@heatpumpdb.de',
    planCode: 'professional',
    startsAt: new Date(Date.now() - 86400000).toISOString(),
    endsAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date().toISOString(),
  });
});

console.log('\nRegistration pause — Firestore rules\n');

// ── 1. No new profile may be created, in any country edition ──────────────
for (const country of ['DE', 'GB', 'FR']) {
  const uid = `new-${country}`;
  const email = `new-${country.toLowerCase()}@example.com`;
  await check(`new signup profile is DENIED (${country} edition)`, async () => {
    const db = testEnv.authenticatedContext(uid, { email }).firestore();
    await assertFails(setDoc(doc(db, 'users', uid), pendingProfile(uid, email, country)));
  });
}

// ── 2. The bypass shapes a determined caller would try ────────────────────
await check('new signup cannot self-activate (status active)', async () => {
  const db = testEnv.authenticatedContext('sneaky-uid', { email: 'sneaky@example.com' }).firestore();
  await assertFails(
    setDoc(doc(db, 'users', 'sneaky-uid'), {
      ...pendingProfile('sneaky-uid', 'sneaky@example.com', 'DE'),
      status: 'active',
      isActive: true,
    }),
  );
});

await check('free-access grant holder cannot register a NEW account while paused', async () => {
  const db = testEnv
    .authenticatedContext('grant-uid', { email: 'granted@heatpumpdb.de' })
    .firestore();
  await assertFails(
    setDoc(doc(db, 'users', 'grant-uid'), {
      ...pendingProfile('grant-uid', 'granted@heatpumpdb.de', 'DE'),
      status: 'active',
      isActive: true,
      billingChannel: 'admin_grant',
      subscription: {
        provider: 'free_grant',
        planCode: 'professional',
        status: 'active',
        seatLimit: 1,
        currentPeriodEndsAt: new Date(Date.now() + 86400000).toISOString(),
      },
    }),
  );
});

// ── 3. Existing users are NOT affected ────────────────────────────────────
await check('existing approved user can still read their own profile', async () => {
  const db = testEnv
    .authenticatedContext('approved-uid', { email: 'approved@heatpumpdb.de' })
    .firestore();
  await assertSucceeds(getDoc(doc(db, 'users', 'approved-uid')));
});

await check('existing user can still request account deletion', async () => {
  const db = testEnv
    .authenticatedContext('approved-uid', { email: 'approved@heatpumpdb.de' })
    .firestore();
  await assertSucceeds(
    updateDoc(doc(db, 'users', 'approved-uid'), {
      status: 'deletion_requested',
      isActive: false,
      deletionRequestedAt: new Date().toISOString(),
    }),
  );
});

// ── 4. The admin route out of the pause still works ───────────────────────
await check('admin can still create an account (secure server-side workflow)', async () => {
  const db = testEnv.authenticatedContext('admin-uid', { email: 'admin@heatpumpdb.de' }).firestore();
  await assertSucceeds(
    setDoc(doc(db, 'users', 'admin-made-uid'), pendingProfile('admin-made-uid', 'made@x.com', 'DE')),
  );
});

await check('owner bootstrap profile still allowed', async () => {
  const db = testEnv.authenticatedContext('owner-uid', { email: OWNER_EMAIL }).firestore();
  await assertSucceeds(
    setDoc(doc(db, 'users', 'owner-uid'), {
      id: 'owner-uid',
      email: OWNER_EMAIL,
      firstName: 'Christopher',
      lastName: 'Sung',
      isActive: true,
      status: 'active',
      role: 'owner',
      registeredAt: new Date().toISOString(),
    }),
  );
});

await testEnv.cleanup();

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
