/**
 * subscriptionService — organizations (Team 3/5 seats), free-access grants
 * (admin promotions) and renewal-time change requests.
 *
 * Ownership of writes (mirrors firestore.rules):
 *   - user.subscription entitlement: billing webhook / admin / free-grant
 *     redemption only — never plain client code.
 *   - organizations: created by admin (or webhook later). The org OWNER may
 *     manage seats (members / invitedEmails / keepMemberUids / name) but can
 *     never touch planCode / seatLimit / status. An INVITED user may join
 *     (add self to members, remove own email from invitedEmails).
 *   - freeAccessGrants: admin-only writes; the matching user may redeem
 *     (rules validate the grant window server-side).
 *   - subscriptionChangeRequests: the subscriber schedules/cancels their own;
 *     applied at renewal by ops/webhook — never mid-term.
 */
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, deleteField,
  query, where, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  User, Organization, FreeAccessGrant, SubscriptionChangeRequest, UserSubscription,
} from '../types';
import {
  SubPlanCode, BillingTerm, SUB_PLANS, TERM_MONTHS, isTeamPlan,
} from '../config/subscriptionPlans';
import { hasPaidAccess } from '../config/entitlementPolicy.js';

const ORGS = 'organizations';
const GRANTS = 'freeAccessGrants';
const CHANGES = 'subscriptionChangeRequests';

const nowIso = () => new Date().toISOString();
export const emailKey = (email: string) => email.trim().toLowerCase();

// ── Organizations (Team 3 / Team 5) ─────────────────────────────────────────

export async function getOrg(orgId: string): Promise<Organization | null> {
  const snap = await getDoc(doc(db, ORGS, orgId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Organization) : null;
}

export async function getMyOrg(user: User): Promise<Organization | null> {
  if (!user.orgId) return null;
  const org = await getOrg(user.orgId);
  // Stale pointer (removed member): treat as no team.
  if (org && !org.members.some(m => m.uid === user.id)) return null;
  return org;
}

/** Seats currently occupied or reserved by an open invitation. */
export const seatsUsed = (org: Organization): number =>
  org.members.length + (org.invitedEmails?.length ?? 0);

/** The uids occupying seats — `memberUids` when present, else derived (legacy orgs). */
export const orgMemberUids = (org: Organization): string[] =>
  org.memberUids ?? org.members.map(m => m.uid);

/**
 * The ONLY way to write org membership.
 *
 * `memberUids` is what the security rules read (they cannot look inside the
 * member maps), so the two must never diverge. Deriving the uid list from the
 * member list right here makes that structural rather than a convention: there
 * is no code path that can update one without the other, and both land in a
 * single document write, which Firestore applies atomically.
 */
type OrgMember = Organization['members'][number];
const membersPatch = (members: OrgMember[]) => ({
  members,
  memberUids: members.map(m => m.uid),
});

/** Team owner: invite a member into a free seat (replacement is allowed anytime). */
export async function inviteMember(org: Organization, email: string): Promise<void> {
  const key = emailKey(email);
  if (org.members.some(m => emailKey(m.email) === key)) throw new Error('already-member');
  if ((org.invitedEmails ?? []).includes(key)) throw new Error('already-invited');
  if (seatsUsed(org) >= org.seatLimit) throw new Error('no-seats');
  await updateDoc(doc(db, ORGS, org.id), {
    invitedEmails: arrayUnion(key),
    invitedAt: { ...(org.invitedAt ?? {}), [key]: nowIso() },
  });
}

/** Re-issue an open invitation (refreshes its date; the link itself is unchanged). */
export async function resendInvite(org: Organization, email: string): Promise<void> {
  const key = emailKey(email);
  if (!(org.invitedEmails ?? []).includes(key)) throw new Error('not-invited');
  await updateDoc(doc(db, ORGS, org.id), { invitedAt: { ...(org.invitedAt ?? {}), [key]: nowIso() } });
}

export async function cancelInvite(org: Organization, email: string): Promise<void> {
  const key = emailKey(email);
  const rest = { ...(org.invitedAt ?? {}) };
  delete rest[key];
  await updateDoc(doc(db, ORGS, org.id), { invitedEmails: arrayRemove(key), invitedAt: rest });
}

/** Team owner: free a seat. Never touches the Paddle subscription. */
export async function removeMember(org: Organization, uid: string): Promise<void> {
  if (uid === org.ownerUid) throw new Error('cannot-remove-owner');
  if (!org.members.some(m => m.uid === uid)) return;
  await updateDoc(doc(db, ORGS, org.id), {
    ...membersPatch(org.members.filter(m => m.uid !== uid)),
    keepMemberUids: arrayRemove(uid),
  });
  // The removed person keeps their personal account — only the team link goes.
  // Dropping the pointer IS the withdrawal of access: storage.rules reads the
  // team's entitlement through orgId, so there is no per-member flag to clear.
  await updateDoc(doc(db, 'users', uid), {
    orgId: deleteField(), orgRole: deleteField(),
  }).catch(() => {});
}

/**
 * Team member: leave the team. Frees the seat, keeps the personal account, and
 * never touches the team subscription. The owner cannot use this (they would
 * strand the team — ownership transfer goes through Support).
 */
export async function leaveTeam(org: Organization, user: User): Promise<void> {
  if (user.id === org.ownerUid) throw new Error('owner-cannot-leave');
  if (org.members.some(m => m.uid === user.id)) {
    await updateDoc(doc(db, ORGS, org.id), {
      ...membersPatch(org.members.filter(m => m.uid !== user.id)),
      keepMemberUids: arrayRemove(user.id),
    });
  }
  // The entitlement went with the seat — the pointer is the entitlement.
  await updateDoc(doc(db, 'users', user.id), {
    orgId: deleteField(), orgRole: deleteField(),
  });
}

/** Team owner: the company profile the whole team inherits. */
export async function updateOrgCompany(
  org: Organization,
  company: Pick<Organization, 'companyName' | 'companyType' | 'companyTypeOther' | 'companyCity' | 'companyWebsite'>,
): Promise<void> {
  const patch: Record<string, any> = {};
  for (const [k, v] of Object.entries(company)) if (v !== undefined) patch[k] = v;
  // `name` is the legacy display field — keep it in step so admin views agree.
  if (company.companyName !== undefined) patch.name = company.companyName;
  await updateDoc(doc(db, ORGS, org.id), patch);
}

/** Choose which members keep seats on a scheduled downgrade. */
export async function setKeepMembers(org: Organization, keepUids: string[]): Promise<void> {
  await updateDoc(doc(db, ORGS, org.id), { keepMemberUids: keepUids });
}

/**
 * Claim a seat in a SPECIFIC organization. The invitation link names the org, so
 * we join that one — never "whichever org happens to list this email first",
 * which could otherwise put the profile pointer and the membership in different
 * organizations when someone is invited to two teams.
 *
 * Every check here is mirrored server-side by firestore.rules: the caller's email
 * must be in the org's invitedEmails, the added seat must be the caller's own,
 * and the seat limit must still hold. Passing a foreign orgId or a foreign email
 * therefore fails at the database, not just here.
 */
export async function joinOrg(orgId: string, user: User): Promise<Organization | null> {
  const key = emailKey(user.email);
  const org = await getOrg(orgId);
  if (!org) return null;                                        // unknown organization
  if (!(org.invitedEmails ?? []).includes(key)) return null;    // not invited / invitation withdrawn or already used
  if (org.members.some(m => m.uid === user.id)) return org;     // already joined — invitation cannot be reused
  if (org.members.length >= org.seatLimit) return null;         // seat refilled meanwhile

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  const members = [...org.members, { uid: user.id, email: key, ...(name ? { name } : {}) }];
  const invitedAt = { ...(org.invitedAt ?? {}) };
  delete invitedAt[key];

  await updateDoc(doc(db, ORGS, org.id), {
    ...membersPatch(members),
    invitedEmails: (org.invitedEmails ?? []).filter(e => e !== key),
    invitedAt,
  });
  // The seat carries the team's entitlement: storage.rules follows this pointer
  // to the org, so a member is entitled the moment they hold a seat — and stops
  // being entitled the moment the team's billing lapses, with no per-member
  // flag to keep in step.
  await updateDoc(doc(db, 'users', user.id), { orgId: org.id, orgRole: 'member' });
  return { ...org, ...membersPatch(members) };
}

/**
 * Invited user with no invitation link to hand (they simply signed in): find the
 * org that invited this email and join it. Same guarantees as joinOrg — this only
 * resolves the org id.
 */
export async function joinOrgIfInvited(user: User): Promise<Organization | null> {
  const key = emailKey(user.email);
  const q = query(collection(db, ORGS), where('invitedEmails', 'array-contains', key));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return joinOrg(snap.docs[0].id, user);
}

// ── Admin: assign / clear subscriptions (ops backstop + admin_grant channel) ──

/**
 * Admin: put a user on a plan (creates the org for team plans). Used both as
 * the ops backstop before/alongside the Paddle webhook and for manual deals.
 */
export async function adminAssignSubscription(
  target: User,
  plan: SubPlanCode,
  term: BillingTerm,
  opts: { provider?: 'paddle' | 'free_grant'; status?: UserSubscription['status']; periodEndsAt?: string; adminName?: string } = {},
): Promise<void> {
  const periodEnd = opts.periodEndsAt
    ?? new Date(Date.now() + TERM_MONTHS[term] * 30.44 * 86400_000).toISOString();
  const sub: UserSubscription = {
    provider: opts.provider ?? 'paddle',
    planCode: plan,
    billingTerm: term,
    status: opts.status ?? 'active',
    seatLimit: SUB_PLANS[plan].seatLimit,
    paidPeriodStartsAt: nowIso(),
    currentPeriodEndsAt: periodEnd,
    cancelAtPeriodEnd: false,
  };
  // paidAccess is the denormalized flag storage.rules gates the dataset bucket
  // on. Every writer of `subscription` must set it from the same shared policy,
  // or an admin-assigned plan would grant a subscription with no actual access.
  const entitled = hasPaidAccess(sub);
  const update: Record<string, any> = {
    subscription: sub,
    paidAccess: entitled,
    billingChannel: opts.provider === 'free_grant' ? 'admin_grant' : 'paddle',
  };

  if (isTeamPlan(plan) && (plan === 'team_3' || plan === 'team_5')) {
    // One org per owner; reuse if it exists so member seats survive plan renewals.
    let orgId = target.orgId;
    const existing = orgId ? await getOrg(orgId) : null;
    if (existing && existing.ownerUid === target.id) {
      await updateDoc(doc(db, ORGS, existing.id), {
        planCode: plan,
        seatLimit: SUB_PLANS[plan].seatLimit,
        subscriptionStatus: sub.status,
        paidAccess: entitled,
        currentPeriodEndsAt: periodEnd,
        // Backfill for organizations created before memberUids existed — the
        // security rules read that list, so a missing one would break join/leave.
        ...(existing.memberUids ? {} : membersPatch(existing.members)),
      });
    } else {
      const ref = doc(collection(db, ORGS));
      orgId = ref.id;
      const org: Omit<Organization, 'id'> = {
        name: target.companyName || '',
        ownerUid: target.id,
        ownerEmail: emailKey(target.email),
        planCode: plan,
        seatLimit: SUB_PLANS[plan].seatLimit,
        subscriptionStatus: sub.status,
        paidAccess: entitled,
        trialEndsAt: sub.trialEndsAt ?? null,
        currentPeriodEndsAt: periodEnd,
        ...membersPatch([{ uid: target.id, email: emailKey(target.email), name: [target.firstName, target.lastName].filter(Boolean).join(' ') }]),
        invitedEmails: [],
        invitedAt: {},
        // The team inherits the buyer's company profile; the owner can edit it later.
        companyName: target.companyName || '',
        companyType: target.companyType || '',
        ...(target.companyTypeOther ? { companyTypeOther: target.companyTypeOther } : {}),
        ...(target.companyCity ? { companyCity: target.companyCity } : {}),
        ...(target.companyWebsite ? { companyWebsite: target.companyWebsite } : {}),
        createdAt: nowIso(),
      };
      await setDoc(ref, org);
    }
    update.orgId = orgId;
    update.orgRole = 'team_admin';
  }

  await updateDoc(doc(db, 'users', target.id), update);
}

/** Admin: end a subscription immediately (refund handling stays in Paddle). */
export async function adminClearSubscription(target: User): Promise<void> {
  // Ends the ENTITLEMENT, not the account: `status`/`isActive` are untouched, so
  // the person keeps their login and can re-subscribe from the Account page.
  const update: Record<string, any> = { paidAccess: false };
  if (target.subscription) update['subscription.status'] = 'expired';
  await updateDoc(doc(db, 'users', target.id), update);
  if (target.orgId && target.orgRole === 'team_admin') {
    // One write covers every seat — members read the team's entitlement from
    // this document, so there are no member profiles to chase.
    await updateDoc(doc(db, ORGS, target.orgId), { subscriptionStatus: 'expired', paidAccess: false });
  }
}

// ── Free-access grants (admin promotions) ───────────────────────────────────

export async function listGrants(): Promise<FreeAccessGrant[]> {
  const snap = await getDocs(collection(db, GRANTS));
  return snap.docs.map(d => d.data() as FreeAccessGrant)
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

/**
 * Admin: register a free-use email. If the account already exists it is
 * approved + entitled immediately; otherwise the grant auto-activates the
 * account at registration/login (authService.redeemFreeGrant).
 */
export async function createGrant(
  email: string,
  plan: SubPlanCode,
  startsAt: string,
  endsAt: string,
  note: string,
  grantedBy: string,
  existingUser: User | null,
): Promise<void> {
  const key = emailKey(email);
  const grant: FreeAccessGrant = {
    email: key, planCode: plan, startsAt, endsAt,
    note: note || '', grantedBy, createdAt: nowIso(),
    ...(existingUser ? { redeemedByUid: existingUser.id, redeemedAt: nowIso() } : {}),
  };
  await setDoc(doc(db, GRANTS, key), grant);

  if (existingUser) {
    const sub: UserSubscription = {
      provider: 'free_grant', planCode: plan, status: 'active',
      seatLimit: SUB_PLANS[plan].seatLimit,
      paidPeriodStartsAt: startsAt, currentPeriodEndsAt: endsAt,
      cancelAtPeriodEnd: true,
    };
    await updateDoc(doc(db, 'users', existingUser.id), {
      status: 'active', isActive: true,
      subscription: sub, paidAccess: hasPaidAccess(sub), billingChannel: 'admin_grant',
    });
  }
}

export async function revokeGrant(email: string): Promise<void> {
  const key = emailKey(email);
  const snap = await getDoc(doc(db, GRANTS, key));
  if (!snap.exists()) return;
  const grant = snap.data() as FreeAccessGrant;
  await updateDoc(doc(db, GRANTS, key), { revokedAt: nowIso(), endsAt: nowIso() });
  if (grant.redeemedByUid) {
    await updateDoc(doc(db, 'users', grant.redeemedByUid), {
      'subscription.status': 'expired',
      paidAccess: false,
    });
  }
}

/** Valid (started, not ended, not revoked) grant for an email, or null. */
export async function getValidGrant(email: string): Promise<FreeAccessGrant | null> {
  try {
    const snap = await getDoc(doc(db, GRANTS, emailKey(email)));
    if (!snap.exists()) return null;
    const g = snap.data() as FreeAccessGrant;
    const now = Date.now();
    if (g.revokedAt) return null;
    if (new Date(g.startsAt).getTime() > now) return null;
    if (new Date(g.endsAt).getTime() < now) return null;
    return g;
  } catch { return null; }
}

// ── Renewal-time change requests ────────────────────────────────────────────

export async function getMyChangeRequest(uid: string): Promise<SubscriptionChangeRequest | null> {
  const snap = await getDoc(doc(db, CHANGES, uid));
  if (!snap.exists()) return null;
  const req = { id: snap.id, ...snap.data() } as SubscriptionChangeRequest;
  return req.status === 'scheduled' ? req : null;
}

export async function scheduleChange(
  user: User,
  requestedPlan: SubPlanCode,
  requestedTerm: BillingTerm,
  keepMemberUids?: string[],
): Promise<void> {
  const req: Omit<SubscriptionChangeRequest, 'id'> = {
    userId: user.id,
    userEmail: emailKey(user.email),
    currentPlanCode: user.subscription?.planCode ?? '',
    currentBillingTerm: user.subscription?.billingTerm,
    requestedPlanCode: requestedPlan,
    requestedBillingTerm: requestedTerm,
    ...(keepMemberUids ? { keepMemberUids } : {}),
    effectiveAt: user.subscription?.currentPeriodEndsAt ?? null,
    status: 'scheduled',
    createdAt: nowIso(),
  };
  await setDoc(doc(db, CHANGES, user.id), req);
}

export async function cancelChange(uid: string): Promise<void> {
  await deleteDoc(doc(db, CHANGES, uid));
}

export async function listChangeRequests(): Promise<SubscriptionChangeRequest[]> {
  const snap = await getDocs(collection(db, CHANGES));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionChangeRequest))
    .filter(r => r.status === 'scheduled')
    .sort((a, b) => (a.effectiveAt ?? '').localeCompare(b.effectiveAt ?? ''));
}
