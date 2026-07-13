/**
 * DEV-ONLY preview fixtures.
 *
 * The Account page has three shapes (Professional / Team owner / Team member).
 * Driving the two team shapes through the real app would mean writing test
 * organizations into the live Firestore, so instead the existing `?preview=hpiq`
 * mode accepts `&as=owner|member` and renders against this in-memory org.
 *
 * Everything here is behind `import.meta.env.DEV` at the call sites, so it is
 * tree-shaken out of every production build.
 */
import { Organization, User } from '../types';

export type PreviewRole = 'pro' | 'owner' | 'member';

export function previewRole(): PreviewRole {
  if (!import.meta.env.DEV) return 'pro';
  const as = new URLSearchParams(window.location.search).get('as');
  return as === 'owner' || as === 'member' ? as : 'pro';
}

/** The synthetic org shown for `?preview=hpiq&as=owner|member`. */
export function previewOrg(user: User): Organization | null {
  if (!import.meta.env.DEV) return null;
  const role = previewRole();
  if (role === 'pro') return null;

  const ownerUid = role === 'owner' ? user.id : 'owner-uid';
  return {
    id: 'preview-org',
    name: 'Nordwind Wärmetechnik GmbH',
    ownerUid,
    ownerEmail: 'anna.berger@nordwind.example',
    planCode: 'team_3',
    seatLimit: 3,
    subscriptionStatus: 'active',
    currentPeriodEndsAt: new Date(Date.now() + 40 * 86400_000).toISOString(),
    members: [
      { uid: ownerUid, email: 'anna.berger@nordwind.example', name: 'Anna Berger' },
      ...(role === 'member'
        ? [{ uid: user.id, email: user.email, name: [user.firstName, user.lastName].filter(Boolean).join(' ') }]
        : [{ uid: 'member-uid', email: 'tom.klein@nordwind.example', name: 'Tom Klein' }]),
    ],
    memberUids: [ownerUid, role === 'member' ? user.id : 'member-uid'],
    invitedEmails: ['neu@nordwind.example'],
    invitedAt: { 'neu@nordwind.example': new Date(Date.now() - 2 * 86400_000).toISOString() },
    companyName: 'Nordwind Wärmetechnik GmbH',
    companyType: 'installer',
    companyCity: 'Hamburg',
    companyWebsite: 'nordwind.example',
    createdAt: new Date(Date.now() - 90 * 86400_000).toISOString(),
  };
}

/** The synthetic user for the preview role (org pointer + a plausible profile). */
export function previewUserPatch(): Partial<User> {
  const role = previewRole();
  if (role === 'owner') return { orgId: 'preview-org', orgRole: 'team_admin' };
  if (role === 'member') return { orgId: 'preview-org', orgRole: 'member' };
  return {};
}
