/**
 * Organization READ rules + the paidAccess entitlement flag (Firestore emulator).
 *
 * Two things are under test here.
 *
 * 1. Org documents used to be readable by ANY signed-in account. Every customer
 *    team's full seat-email list was therefore visible to every other user of
 *    the app. Reads are now limited to the owner, the seated members, the
 *    invited email and admins — without breaking the three real workflows that
 *    depend on reading an org (getMyOrg, joinOrg, and the
 *    `invitedEmails array-contains` lookup in joinOrgIfInvited).
 *
 * 2. `paidAccess` is what storage.rules gates the dataset bucket on, so a user
 *    must never be able to write it for themselves. The only client paths that
 *    may set it are the ones that COPY it from their organization or from a
 *    validated free-access grant.
 *
 * Run: npm run test:rules:orgs
 */
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, getDocs, collection, query, where, deleteField } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const PROJECT_ID = 'heatpumpdb-rules-test';

const OWNER = { uid: 'owner-uid', email: 'owner@team.example' };
const MEMBER = { uid: 'member-uid', email: 'member@team.example' };
const INVITED = { uid: 'invited-uid', email: 'invited@team.example' };
const STRANGER = { uid: 'stranger-uid', email: 'stranger@example.com' };
const ADMIN = { uid: 'admin-uid', email: 'admin@heatpumpdb.example' };

const ORG = 'org-1';
const OTHER_ORG = 'org-2';
const UNPAID_ORG = 'org-unpaid';

let passed = 0, failed = 0;
const check = async (name, fn) => {
  try { await fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});

const as = (u) => testEnv.authenticatedContext(u.uid, { email: u.email }).firestore();

const profile = (uid, email, extra = {}) => ({
  id: uid, email, firstName: 'A', lastName: 'B',
  companyName: 'Co', companyType: 'installer',
  isActive: true, status: 'active', role: 'user',
  registeredAt: new Date().toISOString(), ...extra,
});

const org = (ownerUid, ownerEmail, extra = {}) => ({
  ownerUid, ownerEmail,
  planCode: 'team_3', seatLimit: 3, subscriptionStatus: 'active',
  paidAccess: true,
  members: [{ uid: ownerUid, email: ownerEmail, name: 'Owner' }],
  memberUids: [ownerUid],
  invitedEmails: [],
  invitedAt: {},
  companyName: 'Co', companyType: 'installer',
  createdAt: new Date().toISOString(),
  ...extra,
});

async function seed() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', OWNER.uid), profile(OWNER.uid, OWNER.email, { orgId: ORG, orgRole: 'team_admin', paidAccess: true }));
    await setDoc(doc(db, 'users', MEMBER.uid), profile(MEMBER.uid, MEMBER.email, { orgId: ORG, orgRole: 'member', paidAccess: true }));
    await setDoc(doc(db, 'users', STRANGER.uid), profile(STRANGER.uid, STRANGER.email));
    await setDoc(doc(db, 'users', ADMIN.uid), profile(ADMIN.uid, ADMIN.email, { role: 'admin' }));

    // The team under test: owner + member seated, one open invitation.
    await setDoc(doc(db, 'organizations', ORG), org(OWNER.uid, OWNER.email, {
      members: [
        { uid: OWNER.uid, email: OWNER.email, name: 'Owner' },
        { uid: MEMBER.uid, email: MEMBER.email, name: 'Member' },
      ],
      memberUids: [OWNER.uid, MEMBER.uid],
      invitedEmails: [INVITED.email],
      invitedAt: { [INVITED.email]: new Date().toISOString() },
    }));

    // An unrelated customer's team — nobody in ORG has any business reading it.
    await setDoc(doc(db, 'organizations', OTHER_ORG), org('someone-else-uid', 'other@company.example'));

    // A team whose billing has lapsed — used for the entitlement-copy tests.
    await setDoc(doc(db, 'organizations', UNPAID_ORG), org('unpaid-owner-uid', 'unpaid@company.example', {
      subscriptionStatus: 'expired',
      paidAccess: false,
      invitedEmails: [INVITED.email],
    }));
  });
}

/* ── 15. Allowed reads ────────────────────────────────────────────────────── */

await seed();

await check('[15] the owner can read their own organization', async () => {
  const snap = await assertSucceeds(getDoc(doc(as(OWNER), 'organizations', ORG)));
  if (snap.get('ownerUid') !== OWNER.uid) throw new Error('read the wrong org');
});

await check('[15] a seated member can read their organization', async () => {
  await assertSucceeds(getDoc(doc(as(MEMBER), 'organizations', ORG)));
});

await check('[15] an invited (not yet seated) user can read the inviting organization', async () => {
  // joinOrg reads the org by id before claiming the seat.
  await assertSucceeds(getDoc(doc(as(INVITED), 'organizations', ORG)));
});

await check('[15] an admin can read any organization', async () => {
  await assertSucceeds(getDoc(doc(as(ADMIN), 'organizations', ORG)));
  await assertSucceeds(getDoc(doc(as(ADMIN), 'organizations', OTHER_ORG)));
});

await check('[15] the invitedEmails lookup query still works for the invitee', async () => {
  // joinOrgIfInvited: where('invitedEmails','array-contains', myEmail)
  const q = query(collection(as(INVITED), 'organizations'), where('invitedEmails', 'array-contains', INVITED.email));
  const snap = await assertSucceeds(getDocs(q));
  const ids = snap.docs.map(d => d.id).sort();
  if (!ids.includes(ORG)) throw new Error(`invitee could not find their inviting org (got ${ids.join(', ')})`);
});

/* ── 14. Denied reads ─────────────────────────────────────────────────────── */

await check('[14] an unrelated signed-in user cannot read another organization', async () => {
  await assertFails(getDoc(doc(as(STRANGER), 'organizations', ORG)));
});

await check('[14] a member of one team cannot read a different team', async () => {
  await assertFails(getDoc(doc(as(MEMBER), 'organizations', OTHER_ORG)));
});

await check('[14] the owner of one team cannot read a different team', async () => {
  await assertFails(getDoc(doc(as(OWNER), 'organizations', OTHER_ORG)));
});

await check('[14] an invitee cannot read teams they were not invited to', async () => {
  await assertFails(getDoc(doc(as(INVITED), 'organizations', OTHER_ORG)));
});

await check('[14] a stranger cannot enumerate organizations', async () => {
  await assertFails(getDocs(collection(as(STRANGER), 'organizations')));
});

await check('[14] a stranger cannot query their way around the read rule', async () => {
  // The rule is evaluated per returned document, so a filter that would return
  // someone else's org fails the whole query.
  const q = query(collection(as(STRANGER), 'organizations'), where('planCode', '==', 'team_3'));
  await assertFails(getDocs(q));
});

/* ── paidAccess cannot be self-granted ────────────────────────────────────── */

await seed();

await check('[entitlement] a user cannot grant themselves paidAccess', async () => {
  await assertFails(updateDoc(doc(as(STRANGER), 'users', STRANGER.uid), { paidAccess: true }));
});

await check('[entitlement] paidAccess cannot ride along on a profile edit', async () => {
  await assertFails(updateDoc(doc(as(STRANGER), 'users', STRANGER.uid), {
    firstName: 'Edited', paidAccess: true,
  }));
});

await check('[entitlement] a self-registered account cannot be created with paidAccess', async () => {
  const NEW = { uid: 'new-uid', email: 'new@example.com' };
  await assertFails(setDoc(doc(as(NEW), 'users', NEW.uid),
    profile(NEW.uid, NEW.email, { status: 'pending', isActive: false, paidAccess: true })));
});

await check('[entitlement] a self-registered pending account is still allowed without it', async () => {
  const NEW = { uid: 'new-uid-2', email: 'new2@example.com' };
  await assertSucceeds(setDoc(doc(as(NEW), 'users', NEW.uid),
    profile(NEW.uid, NEW.email, { status: 'pending', isActive: false })));
});

/* ── an invited member inherits nothing they can assert ───────────────────── */

await seed();

await check('[entitlement] an invited member creates their profile WITHOUT an entitlement flag', async () => {
  // Their access comes from the org at read time (storage.rules follows orgId),
  // so the profile itself must never carry paidAccess.
  await assertSucceeds(setDoc(doc(as(INVITED), 'users', INVITED.uid),
    profile(INVITED.uid, INVITED.email, { orgId: ORG, orgRole: 'member' })));
});

await seed();

await check('[entitlement] an invited member cannot create their profile WITH paidAccess', async () => {
  await assertFails(setDoc(doc(as(INVITED), 'users', INVITED.uid),
    profile(INVITED.uid, INVITED.email, { orgId: ORG, orgRole: 'member', paidAccess: true })));
});

/* ── the orgId pointer IS the entitlement, so setting it needs a real seat ── */

await seed();

await check('[entitlement] joining an org where the caller HOLDS a seat is allowed', async () => {
  // Mirrors joinOrg: the seat is claimed on the organization first, so by the
  // time the profile pointer moves, memberUids already contains the caller.
  await testEnv.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', INVITED.uid), profile(INVITED.uid, INVITED.email));
    await setDoc(doc(db, 'organizations', ORG), org(OWNER.uid, OWNER.email, {
      members: [
        { uid: OWNER.uid, email: OWNER.email },
        { uid: INVITED.uid, email: INVITED.email },
      ],
      memberUids: [OWNER.uid, INVITED.uid],
      invitedEmails: [],
    }));
  });
  await assertSucceeds(updateDoc(doc(as(INVITED), 'users', INVITED.uid), {
    orgId: ORG, orgRole: 'member',
  }));
});

await seed();

await check('[entitlement] pointing orgId at a paid org WITHOUT a seat is rejected', async () => {
  // The attack this closes: orgId is client-writable, and storage.rules reads
  // the team's entitlement through it — so an unchecked pointer would BE a
  // grant of that team's paid access.
  await testEnv.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'users', STRANGER.uid), profile(STRANGER.uid, STRANGER.email));
  });
  await assertFails(updateDoc(doc(as(STRANGER), 'users', STRANGER.uid), {
    orgId: ORG, orgRole: 'member',
  }));
});

await check('[entitlement] pointing orgId at a NON-EXISTENT org is rejected', async () => {
  await assertFails(updateDoc(doc(as(STRANGER), 'users', STRANGER.uid), {
    orgId: 'no-such-org', orgRole: 'member',
  }));
});

await check('[entitlement] an invitee who has not yet claimed a seat cannot set the pointer', async () => {
  // Invited is in invitedEmails but NOT in memberUids until joinOrg runs.
  await testEnv.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'users', INVITED.uid), profile(INVITED.uid, INVITED.email));
  });
  await assertFails(updateDoc(doc(as(INVITED), 'users', INVITED.uid), {
    orgId: ORG, orgRole: 'member',
  }));
});

await seed();

await check('[entitlement] 4. leaving a team drops the pointer, and with it the access', async () => {
  await assertSucceeds(updateDoc(doc(as(MEMBER), 'users', MEMBER.uid), {
    orgId: deleteField(), orgRole: deleteField(),
  }));
  const me = (await getDoc(doc(as(MEMBER), 'users', MEMBER.uid))).data();
  if (me.orgId) throw new Error('the org pointer must be gone');
});

await seed();

await check('[entitlement] a leave cannot smuggle in a paidAccess CHANGE', async () => {
  // The allow-list is orgId/orgRole only, so any attempt to write paidAccess on
  // this path — up or down — is rejected outright.
  await assertFails(updateDoc(doc(as(STRANGER), 'users', STRANGER.uid), {
    orgId: deleteField(), orgRole: deleteField(), paidAccess: true,
  }));
});

/* ── server-owned billing collections ─────────────────────────────────────── */

await seed();

await check('[billing] a user cannot read the webhook event ledger', async () => {
  await assertFails(getDoc(doc(as(STRANGER), 'paddleWebhookEvents', 'evt_1')));
});

await check('[billing] a user cannot write the webhook event ledger', async () => {
  await assertFails(setDoc(doc(as(STRANGER), 'paddleWebhookEvents', 'evt_1'), { eventId: 'evt_1' }));
});

await check('[billing] a user cannot read or write the quarantine queue', async () => {
  await assertFails(getDoc(doc(as(STRANGER), 'billingQuarantine', 'evt_1')));
  await assertFails(setDoc(doc(as(STRANGER), 'billingQuarantine', 'evt_1'), { resolved: true }));
});

await check('[billing] an admin can read the quarantine queue', async () => {
  await assertSucceeds(getDoc(doc(as(ADMIN), 'billingQuarantine', 'evt_1')));
});

await testEnv.cleanup();
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
