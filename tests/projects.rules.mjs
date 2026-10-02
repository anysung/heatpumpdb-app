/**
 * Security rules for Projects (Premium feature 4) — Firestore emulator.
 *
 *   users/{uid}/projects/{pid}            owner only
 *   organizations/{orgId}/projects/{pid}  org members (memberUids) only
 *
 * Run: npm run test:rules:projects
 */
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, query, where,
  serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const PROJECT_ID = 'heatpumpdb-rules-test';
const OWNER = { uid: 'owner-uid', email: 'owner@team.example' };
const MEMBER = { uid: 'member-uid', email: 'member@team.example' };
const PRO = { uid: 'pro-uid', email: 'pro@example.com' };
const STRANGER = { uid: 'stranger-uid', email: 'stranger@example.com' };
const LAPSED = { uid: 'lapsed-uid', email: 'lapsed@example.com' };
const ORG = 'org-1';

let passed = 0, failed = 0;
const check = async (name, fn) => {
  try { await fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

// emulators:exec exports FIRESTORE_EMULATOR_HOST — honour it so a parallel
// run on another port works; default to the suite's 8080.
const [EMU_HOST, EMU_PORT] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: EMU_HOST, port: Number(EMU_PORT) },
});

const profile = (uid, email, extra = {}) => ({
  id: uid, email, firstName: 'A', lastName: 'B', companyName: 'Co', companyType: 'installer',
  isActive: true, status: 'active', role: 'user', registeredAt: new Date().toISOString(), ...extra,
});

const past = Timestamp.fromMillis(Date.now() - 86400_000);
const future = Timestamp.fromMillis(Date.now() + 30 * 86400_000);

async function seed() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', OWNER.uid), profile(OWNER.uid, OWNER.email, { orgId: ORG, orgRole: 'team_admin' }));
    await setDoc(doc(db, 'users', MEMBER.uid), profile(MEMBER.uid, MEMBER.email, { orgId: ORG, orgRole: 'member' }));
    await setDoc(doc(db, 'users', PRO.uid), profile(PRO.uid, PRO.email, { accessUntilTs: future }));
    await setDoc(doc(db, 'users', STRANGER.uid), profile(STRANGER.uid, STRANGER.email));
    await setDoc(doc(db, 'users', LAPSED.uid), profile(LAPSED.uid, LAPSED.email, { accessUntilTs: past }));
    await setDoc(doc(db, 'organizations', ORG), {
      ownerUid: OWNER.uid, ownerEmail: OWNER.email, planCode: 'team_3', seatLimit: 3,
      subscriptionStatus: 'active', accessUntilTs: future,
      members: [{ uid: OWNER.uid, email: OWNER.email }, { uid: MEMBER.uid, email: MEMBER.email }],
      memberUids: [OWNER.uid, MEMBER.uid], invitedEmails: [],
    });
    // Existing docs for read/update/delete checks.
    const base = { name: 'Seed', customer: '', notes: '', market: 'DE', items: [], createdAt: past, updatedAt: past };
    await setDoc(doc(db, 'users', PRO.uid, 'projects', 'p1'), { ...base, createdBy: PRO.uid });
    await setDoc(doc(db, 'users', LAPSED.uid, 'projects', 'p1'), { ...base, createdBy: LAPSED.uid });
    await setDoc(doc(db, 'organizations', ORG, 'projects', 't1'), { ...base, createdBy: OWNER.uid });
  });
}

const as = u => testEnv.authenticatedContext(u.uid, { email: u.email }).firestore();
const newProject = (uid, extra = {}) => ({
  name: 'Müller — Einfamilienhaus', customer: 'Familie Müller', notes: '', market: 'DE',
  items: [{ id: '1234', addedAt: new Date().toISOString() }],
  createdBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
});

console.log('\nProjects security rules\n');
await seed();

/* ── Personal projects ─────────────────────────────────────────────────── */
await check('owner creates a personal project', async () => {
  await assertSucceeds(setDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'new'), newProject(PRO.uid)));
});
await check('owner reads + lists their projects (market query)', async () => {
  await assertSucceeds(getDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'p1')));
  await assertSucceeds(getDocs(query(collection(as(PRO), 'users', PRO.uid, 'projects'), where('market', '==', 'DE'))));
});
await check('owner updates items + name', async () => {
  await assertSucceeds(updateDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'p1'), {
    name: 'Renamed', items: [{ id: 'a', addedAt: 'x', note: 'n' }], updatedAt: serverTimestamp(),
  }));
});
await check('another user cannot read a personal project', async () => {
  await assertFails(getDoc(doc(as(STRANGER), 'users', PRO.uid, 'projects', 'p1')));
});
await check('another user cannot write into someone else\'s projects', async () => {
  await assertFails(setDoc(doc(as(STRANGER), 'users', PRO.uid, 'projects', 'x'), newProject(STRANGER.uid)));
});
await check('another user cannot delete a personal project', async () => {
  await assertFails(deleteDoc(doc(as(STRANGER), 'users', PRO.uid, 'projects', 'p1')));
});
await check('createdBy must be the caller', async () => {
  await assertFails(setDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'forged'), newProject('someone-else')));
});
await check('createdBy cannot be changed on update', async () => {
  await assertFails(updateDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'p1'), { createdBy: STRANGER.uid, updatedAt: serverTimestamp() }));
});
await check('updatedAt must be the server time', async () => {
  await assertFails(updateDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'p1'), { name: 'x', updatedAt: past }));
});
await check('unknown field is refused', async () => {
  await assertFails(setDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'extra'), newProject(PRO.uid, { price: 1 })));
});
await check('empty name is refused', async () => {
  await assertFails(setDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'noname'), newProject(PRO.uid, { name: '' })));
});
await check('name over 120 chars is refused', async () => {
  await assertFails(setDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'long'), newProject(PRO.uid, { name: 'x'.repeat(121) })));
});
await check('notes over 2000 chars are refused', async () => {
  await assertFails(setDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'notes'), newProject(PRO.uid, { notes: 'x'.repeat(2001) })));
});
await check('items capped at 50', async () => {
  const items = Array.from({ length: 51 }, (_, i) => ({ id: `id${i}`, addedAt: 'x' }));
  await assertFails(setDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'big'), newProject(PRO.uid, { items })));
  await assertSucceeds(setDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'fifty'), newProject(PRO.uid, { items: items.slice(0, 50) })));
});
/* ── v2 job file fields (2026-10-02) ───────────────────────────────────── */
const v2 = {
  status: 'quote', targetDate: '2026-11-15', selectedId: '1234',
  details: { phone: '+49 40 123', city: 'Hamburg', buildingType: 'detached', heatLoad: '9.5' },
  tasks: [{ id: 't1', text: 'Send quote', due: '2026-10-10', done: false }],
  history: [{ at: new Date().toISOString(), by: 'A B', k: 'created' }],
};
await check('v2: a project with status, details, tasks and history is accepted', async () => {
  await assertSucceeds(setDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'v2'), newProject(PRO.uid, v2)));
});
await check('v2: a v1 document (none of the new fields) can be updated with them', async () => {
  await assertSucceeds(updateDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'p1'), { ...v2, updatedAt: serverTimestamp() }));
});
await check('v2: a v1-shaped update still works (old clients)', async () => {
  await assertSucceeds(updateDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'p1'), { notes: 'old client', updatedAt: serverTimestamp() }));
});
await check('v2: status must be a short string', async () => {
  await assertFails(setDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'bad-s1'), newProject(PRO.uid, { status: 5 })));
  await assertFails(setDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'bad-s2'), newProject(PRO.uid, { status: 'x'.repeat(21) })));
});
await check('v2: details must be a map of at most 30 keys', async () => {
  await assertFails(setDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'bad-d1'), newProject(PRO.uid, { details: 'x' })));
  const big = Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`k${i}`, 'v']));
  await assertFails(setDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'bad-d2'), newProject(PRO.uid, { details: big })));
});
await check('v2: tasks capped at 40, history at 60', async () => {
  const tasks = Array.from({ length: 41 }, (_, i) => ({ id: `t${i}`, text: 'x', due: '', done: false }));
  await assertFails(setDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'bad-t'), newProject(PRO.uid, { tasks })));
  const history = Array.from({ length: 61 }, () => ({ at: 'x', by: '', k: 'details' }));
  await assertFails(setDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'bad-h'), newProject(PRO.uid, { history })));
});
await check('v2: targetDate longer than a date is refused', async () => {
  await assertFails(setDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'bad-td'), newProject(PRO.uid, { targetDate: '2026-11-15T00:00' })));
});
await check('v2: a team member updates tasks on a shared project', async () => {
  await assertSucceeds(updateDoc(doc(as(MEMBER), 'organizations', ORG, 'projects', 't1'), { tasks: v2.tasks, status: 'won', updatedAt: serverTimestamp() }));
});
await check('items must be a list', async () => {
  await assertFails(setDoc(doc(as(PRO), 'users', PRO.uid, 'projects', 'map'), newProject(PRO.uid, { items: { a: 1 } })));
});
await check('Standard (window closed) cannot create or update', async () => {
  await assertFails(setDoc(doc(as(LAPSED), 'users', LAPSED.uid, 'projects', 'new'), newProject(LAPSED.uid)));
  await assertFails(updateDoc(doc(as(LAPSED), 'users', LAPSED.uid, 'projects', 'p1'), { name: 'x', updatedAt: serverTimestamp() }));
});
await check('Standard (window closed) can still read and delete their own', async () => {
  await assertSucceeds(getDoc(doc(as(LAPSED), 'users', LAPSED.uid, 'projects', 'p1')));
  await assertSucceeds(deleteDoc(doc(as(LAPSED), 'users', LAPSED.uid, 'projects', 'p1')));
});
await check('signed-out cannot read', async () => {
  await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'users', PRO.uid, 'projects', 'p1')));
});

/* ── Team projects ─────────────────────────────────────────────────────── */
await check('team member creates a shared project', async () => {
  await assertSucceeds(setDoc(doc(as(MEMBER), 'organizations', ORG, 'projects', 'm1'), newProject(MEMBER.uid)));
});
await check('another member reads + updates it', async () => {
  await assertSucceeds(getDoc(doc(as(OWNER), 'organizations', ORG, 'projects', 'm1')));
  await assertSucceeds(updateDoc(doc(as(OWNER), 'organizations', ORG, 'projects', 'm1'), { notes: 'call Tue', updatedAt: serverTimestamp() }));
});
await check('members list the team collection', async () => {
  await assertSucceeds(getDocs(query(collection(as(MEMBER), 'organizations', ORG, 'projects'), where('market', '==', 'DE'))));
});
await check('member deletes a shared project', async () => {
  await assertSucceeds(deleteDoc(doc(as(MEMBER), 'organizations', ORG, 'projects', 't1')));
});
await check('non-member cannot read a team project', async () => {
  await assertFails(getDoc(doc(as(STRANGER), 'organizations', ORG, 'projects', 'm1')));
  await assertFails(getDocs(collection(as(STRANGER), 'organizations', ORG, 'projects')));
});
await check('non-member cannot create in a team', async () => {
  await assertFails(setDoc(doc(as(PRO), 'organizations', ORG, 'projects', 'x'), newProject(PRO.uid)));
});
await check('member cannot forge createdBy on a team project', async () => {
  await assertFails(setDoc(doc(as(MEMBER), 'organizations', ORG, 'projects', 'f'), newProject(OWNER.uid)));
});
await check('non-existent org is refused', async () => {
  await assertFails(setDoc(doc(as(MEMBER), 'organizations', 'nope', 'projects', 'x'), newProject(MEMBER.uid)));
});

await testEnv.cleanup();
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
