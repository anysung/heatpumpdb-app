import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  getAdditionalUserInfo,
  deleteUser as deleteAuthAccount,
  GoogleAuthProvider,
  OAuthProvider,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User, ActivityLog, UserSubscription } from '../types';
import { ACTIVE_COUNTRY } from '../config/countryProfiles';
import { getValidGrant, joinOrgIfInvited, emailKey } from './subscriptionService';
import { SUB_PLANS } from '../config/subscriptionPlans';
import { REGISTRATION_OPEN, REGISTRATION_CLOSED_ERROR } from '../config/registration';

const OWNER_EMAIL = 'sungyongsoo1976@gmail.com';

/**
 * Free-access grants (admin promotions): if an admin registered this email in
 * freeAccessGrants with a currently-valid window, self-activate the account
 * with the granted plan — no manual approval step. Rules bind the entitlement
 * to the grant's own plan + end date. Returns the updated user or null.
 */
async function redeemFreeGrantIfAny(user: User): Promise<User | null> {
  try {
    const grant = await getValidGrant(user.email);
    if (!grant) return null;
    const sub: UserSubscription = {
      provider: 'free_grant',
      planCode: grant.planCode,
      status: 'active',
      seatLimit: SUB_PLANS[grant.planCode].seatLimit,
      paidPeriodStartsAt: grant.startsAt,
      currentPeriodEndsAt: grant.endsAt,   // must equal the grant's endsAt (rules)
      cancelAtPeriodEnd: true,
    };
    await updateDoc(doc(db, 'users', user.id), {
      status: 'active', isActive: true,
      subscription: sub, billingChannel: 'admin_grant',
    });
    await updateDoc(doc(db, 'freeAccessGrants', emailKey(user.email)), {
      redeemedByUid: user.id, redeemedAt: new Date().toISOString(),
    }).catch(() => {});
    await logActivity(user.id, 'APPROVE_USER', `Free-access grant redeemed (${grant.planCode}, until ${grant.endsAt.slice(0, 10)})`, user.email, `${user.firstName} ${user.lastName}`);
    return { ...user, status: 'active', isActive: true, subscription: sub, billingChannel: 'admin_grant' };
  } catch {
    return null;
  }
}

/** Roles allowed into the admin console — mirrors isAdmin() in firestore.rules. */
export const isAdminRole = (role?: string): boolean =>
  !!role && ['owner', 'admin', 'support', 'ops'].includes(role);

// --- Activity Logging (Firestore) ---
export const logActivity = async (
  userId: string, action: string, details: string,
  userEmail = '', userName = ''
) => {
  try {
    await addDoc(collection(db, 'activityLogs'), {
      userId, userEmail, userName, action, details,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Log error', error);
  }
};

export const getLogs = async (fromDate?: string, toDate?: string): Promise<ActivityLog[]> => {
  try {
    const q = query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(2000));
    const snapshot = await getDocs(q);
    let logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as ActivityLog[];
    if (fromDate) logs = logs.filter(l => l.timestamp.slice(0, 10) >= fromDate);
    if (toDate)   logs = logs.filter(l => l.timestamp.slice(0, 10) <= toDate);
    return logs;
  } catch (error) {
    console.error('Fetch Logs Error', error);
    return [];
  }
};

// --- Registration (status: pending, auto sign-out) ---
// Returns the activated user when a free-access grant applied (no approval
// wait, stays signed in), or null for the normal pending flow.
export const registerUser = async (userData: any): Promise<User | null> => {
  // Registration pause: refuse BEFORE createUserWithEmailAndPassword, so no
  // Firebase Auth account is created at all (and therefore no orphaned Auth
  // user without a Firestore profile). Firestore rules deny the profile write
  // independently — this guard is the UX half, not the enforcement.
  if (!REGISTRATION_OPEN) throw new Error(REGISTRATION_CLOSED_ERROR);

  const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
  const uid = userCredential.user?.uid;
  if (!uid) throw new Error('User ID missing');

  const newUser: User = {
    id: uid,
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
    companyType: userData.companyType,
    jobRole: userData.jobRole,
    companyName: userData.companyName || '',
    companyCity: userData.companyCity || '',
    country: ACTIVE_COUNTRY.code,
    referralSource: userData.referralSource || '',
    isActive: false,
    status: 'pending',
    registeredAt: new Date().toISOString(),
    termsAcceptedAt: userData.termsAcceptedAt || new Date().toISOString(),
    role: 'user',
    plan: 'standard',
  };

  await setDoc(doc(db, 'users', uid), newUser);

  // Free-access grant (admin promotion): activate immediately, stay signed in.
  const redeemed = await redeemFreeGrantIfAny(newUser);
  if (redeemed) return redeemed;

  // Sign out immediately — must wait for admin approval
  await signOut(auth);
  await logActivity(uid, 'REGISTER_PENDING', `Registration pending: ${userData.email}`, userData.email, `${userData.firstName} ${userData.lastName}`);
  return null;
};

// --- Login (blocks pending/suspended) ---
export const loginUser = async (email: string, pass: string): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    const uid = userCredential.user?.uid;
    if (!uid) throw new Error('Login failed');

    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      // Only the owner gets an auto-created profile — all other Firebase Auth users without
      // a Firestore doc are rejected. This closes the bypass where any Firebase Auth account
      // without a Firestore record would previously be auto-admitted as 'active'.
      if (email !== OWNER_EMAIL) {
        await signOut(auth);
        throw new Error('No account found for this email. Please register to request access, or contact the administrator.');
      }
      const fallbackUser: User = {
        id: uid, email,
        firstName: 'Christopher',
        lastName: 'Sung',
        companyType: 'Private Individual', jobRole: 'General Public',
        isActive: true, status: 'active',
        registeredAt: new Date().toISOString(),
        role: 'owner',
        plan: 'standard',
      };
      await setDoc(userDocRef, fallbackUser);
      await logActivity(fallbackUser.id, 'LOGIN', 'Owner logged in (profile created)', email, 'Christopher Sung');
      return fallbackUser;
    }

    let userData = {
      ...userDoc.data() as User,
      role: email === OWNER_EMAIL ? 'owner' as const : (userDoc.data() as User).role || 'user' as const,
    };

    if (userData.status === 'pending') {
      // A valid free-access grant activates the account without manual approval.
      const redeemed = await redeemFreeGrantIfAny(userData);
      if (redeemed) {
        userData = { ...userData, ...redeemed };
      } else {
        await signOut(auth);
        throw new Error('Your registration is pending admin approval. You will be notified once approved.');
      }
    }
    if (userData.status === 'suspended') {
      await signOut(auth);
      throw new Error('Your account has been suspended. Please contact the administrator.');
    }
    if (userData.status === 'rejected') {
      await signOut(auth);
      throw new Error('Your registration was not approved. Please contact the administrator.');
    }
    if (userData.status === 'disabled') {
      await signOut(auth);
      throw new Error('Your account has been disabled. Please contact the administrator.');
    }
    if (!userData.isActive) {
      await signOut(auth);
      throw new Error('Account is deactivated.');
    }

    // Legacy migration: users created before the status field was introduced have isActive:true
    // but no status field. Set status:'active' so Firestore security rules can check it.
    if (!userData.status && userData.isActive) {
      try {
        await updateDoc(userDocRef, { status: 'active' });
        userData = { ...userData, status: 'active' };
      } catch { /* non-blocking — will retry on next login */ }
    }

    await logActivity(userData.id, 'LOGIN', 'User logged in', email, `${userData.firstName} ${userData.lastName}`);
    return userData;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// --- Social login (Google / Apple via Firebase popup) ---
// First-time social sign-in behaves like registration: a pending profile is
// created and the user is signed out until an admin approves — the same
// approval gate as email/password registration. Returning users pass through
// the same status checks as loginUser.
export const loginWithProvider = async (
  providerName: 'google' | 'apple',
  /** First-time social sign-ins are registrations: the caller shows the
   *  account/data-use terms popup and resolves on consent (rejects on cancel). */
  confirmTerms?: () => Promise<void>,
): Promise<'active' | 'pending-created'> => {
  const provider =
    providerName === 'google'
      ? new GoogleAuthProvider()
      : (() => {
          const p = new OAuthProvider('apple.com');
          p.addScope('email');
          p.addScope('name');
          return p;
        })();

  const cred = await signInWithPopup(auth, provider);
  const fbUser = cred.user;
  const uid = fbUser.uid;
  const email = fbUser.email || '';
  const providerLabel = providerName === 'google' ? 'Google' : 'Apple';

  // Registration pause — social sign-in is the one path that can create a
  // Firebase Auth account before we know whether the person is a new user: the
  // popup completes first, and only then do we look for a profile. So if the
  // popup just MINTED the account and registration is closed, delete it again
  // right here. Without this, a blocked social signup would leave exactly the
  // partial account we must not create: an Auth user with no Firestore profile.
  // Existing users are untouched (isNewUser is false for them), and the owner
  // bootstrap below still works.
  if (!REGISTRATION_OPEN && email !== OWNER_EMAIL && getAdditionalUserInfo(cred)?.isNewUser) {
    try {
      await deleteAuthAccount(fbUser);
    } catch {
      // Deletion needs a recent login; the popup we just completed IS recent, so
      // this should not happen. If it ever does, sign out so the half-made
      // account cannot be used — it has no profile, so login rejects it anyway.
      await signOut(auth);
    }
    throw new Error(REGISTRATION_CLOSED_ERROR);
  }

  const userDocRef = doc(db, 'users', uid);
  const userDoc = await getDoc(userDocRef);

  if (!userDoc.exists()) {
    if (email === OWNER_EMAIL) {
      const fallbackUser: User = {
        id: uid, email,
        firstName: 'Christopher', lastName: 'Sung',
        companyType: 'Private Individual', jobRole: 'General Public',
        isActive: true, status: 'active',
        registeredAt: new Date().toISOString(),
        role: 'owner', plan: 'standard',
      };
      await setDoc(userDocRef, fallbackUser);
      await logActivity(uid, 'LOGIN', `Owner logged in via ${providerLabel} (profile created)`, email, 'Christopher Sung');
      return 'active';
    }
    // A pre-existing Auth account with no profile (isNewUser was false, so it
    // was not minted just now) would otherwise register here — also blocked.
    if (!REGISTRATION_OPEN) {
      await signOut(auth);
      throw new Error(REGISTRATION_CLOSED_ERROR);
    }
    // New social user → registration. Consent to the account/data-use terms
    // is required before the profile is created (same gate as the signup form).
    if (confirmTerms) {
      try { await confirmTerms(); }
      catch { await signOut(auth); throw new Error('terms-declined'); }
    }
    const display = fbUser.displayName || email.split('@')[0] || 'New User';
    const [firstName, ...rest] = display.split(' ');
    const newUser: User = {
      id: uid, email,
      firstName: firstName || 'New',
      lastName: rest.join(' ') || '—',
      companyType: 'Private Individual',
      jobRole: 'General Public',
      companyName: '', companyCity: '',
      country: ACTIVE_COUNTRY.code,
      referralSource: `${providerLabel} Sign-In`,
      isActive: false, status: 'pending',
      registeredAt: new Date().toISOString(),
      termsAcceptedAt: new Date().toISOString(),
      role: 'user', plan: 'standard',
    };
    await setDoc(userDocRef, newUser);
    // Free-access grant (admin promotion): activate immediately, stay signed in.
    const redeemedNew = await redeemFreeGrantIfAny(newUser);
    if (redeemedNew) return 'active';
    await signOut(auth);
    await logActivity(uid, 'REGISTER_PENDING', `Social registration pending (${providerLabel}): ${email}`, email, display);
    return 'pending-created';
  }

  let userData = {
    ...userDoc.data() as User,
    role: email === OWNER_EMAIL ? 'owner' as const : (userDoc.data() as User).role || 'user' as const,
  };

  if (userData.status === 'pending') {
    // A valid free-access grant activates the account without manual approval.
    const redeemed = await redeemFreeGrantIfAny(userData);
    if (redeemed) {
      userData = { ...userData, ...redeemed };
    } else {
      await signOut(auth);
      throw new Error('Your registration is pending admin approval. You will be notified once approved.');
    }
  }
  if (userData.status === 'suspended') {
    await signOut(auth);
    throw new Error('Your account has been suspended. Please contact the administrator.');
  }
  if (userData.status === 'rejected') {
    await signOut(auth);
    throw new Error('Your registration was not approved. Please contact the administrator.');
  }
  if (userData.status === 'disabled') {
    await signOut(auth);
    throw new Error('Your account has been disabled. Please contact the administrator.');
  }
  if (!userData.isActive) {
    await signOut(auth);
    throw new Error('Account is deactivated.');
  }

  // Legacy migration (same as loginUser): backfill status for pre-status accounts.
  if (!userData.status && userData.isActive) {
    try {
      await updateDoc(userDocRef, { status: 'active' });
      userData = { ...userData, status: 'active' };
    } catch { /* non-blocking */ }
  }

  await logActivity(userData.id, 'LOGIN', `User logged in via ${providerLabel}`, email, `${userData.firstName} ${userData.lastName}`);
  return 'active';
};

export const logoutUser = async (userEmail = '', userName = '') => {
  const user = auth.currentUser;
  if (user) await logActivity(user.uid, 'LOGOUT', 'User logged out', userEmail, userName);
  await signOut(auth);
};

export const onUserChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        let userDoc = await getDoc(userDocRef);
        // Registration race: this listener fires the moment the Auth account
        // exists, which can be BEFORE registerUser/loginWithProvider has
        // written the Firestore profile. Signing out on a missing doc here
        // would abort the registration mid-flight (it broke free-grant
        // auto-activation), so give the profile write a moment to land.
        if (!userDoc.exists() && firebaseUser.email !== OWNER_EMAIL) {
          for (let i = 0; i < 6 && !userDoc.exists(); i++) {
            await new Promise(r => setTimeout(r, 800));
            if (!auth.currentUser) { callback(null); return; }  // signed out meanwhile (normal pending flow)
            userDoc = await getDoc(userDocRef);
          }
        }
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          let enriched = {
            ...userData,
            role: firebaseUser.email === OWNER_EMAIL ? 'owner' as const : userData.role || 'user' as const,
          };
          // Backfill: the owner role must exist ON THE DOCUMENT — Firestore
          // security rules read me().role, so an in-memory role alone leaves
          // every admin query (inbox, members, logs) permission-denied.
          if (firebaseUser.email === OWNER_EMAIL && userData.role !== 'owner') {
            updateDoc(userDocRef, { role: 'owner' }).catch(() => {});
          }
          // Team invitation: claim the seat on the first session after the
          // team admin invited this email (covers social login + restores).
          if (enriched.status === 'active' && !enriched.orgId) {
            try {
              const joined = await joinOrgIfInvited(enriched);
              if (joined) enriched = { ...enriched, orgId: joined.id, orgRole: 'member' };
            } catch { /* non-blocking */ }
          }
          callback(enriched);
        } else {
          // Only the owner gets an auto-created profile. All other Firebase Auth users without
          // a Firestore doc are treated as unauthorized — sign them out to force re-registration.
          if (firebaseUser.email !== OWNER_EMAIL) {
            await signOut(auth);
            callback(null);
            return;
          }
          const fallback: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            firstName: 'Christopher',
            lastName: 'Sung',
            companyType: 'Private Individual', jobRole: 'General Public',
            isActive: true, status: 'active',
            registeredAt: new Date().toISOString(),
            role: 'owner',
            plan: 'standard',
          };
          callback(fallback);
        }
      } catch (e) {
        console.error('Auth State Error', e);
        callback(null);
      }
    } else {
      callback(null);
    }
  });
};

// --- User CRUD ---
export const getUsers = async (): Promise<User[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    return snapshot.docs.map(d => d.data() as User);
  } catch (error) {
    console.error('Fetch Users Error', error);
    return [];
  }
};

export const approveUser = async (userId: string, adminName = 'Admin') => {
  await updateDoc(doc(db, 'users', userId), { status: 'active', isActive: true });
  await logActivity('ADMIN', 'APPROVE_USER', `User approved: ${userId}`, '', adminName);
};

export const rejectUser = async (userId: string, adminName = 'Admin') => {
  await updateDoc(doc(db, 'users', userId), { status: 'rejected', isActive: false });
  await logActivity('ADMIN', 'REJECT_USER', `User rejected: ${userId}`, '', adminName);
};

export const suspendUser = async (userId: string, adminName = 'Admin') => {
  await updateDoc(doc(db, 'users', userId), { status: 'suspended', isActive: false });
  await logActivity('ADMIN', 'SUSPEND_USER', `User suspended: ${userId}`, '', adminName);
};

export const disableUser = async (userId: string, adminName = 'Admin') => {
  await updateDoc(doc(db, 'users', userId), { status: 'disabled', isActive: false });
  await logActivity('ADMIN', 'DISABLE_USER', `User disabled: ${userId}`, '', adminName);
};

export const reactivateUser = async (userId: string, adminName = 'Admin') => {
  await updateDoc(doc(db, 'users', userId), { status: 'active', isActive: true });
  await logActivity('ADMIN', 'REACTIVATE_USER', `User reactivated: ${userId}`, '', adminName);
};

export const updateUserStatus = async (userId: string, isActive: boolean) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      isActive,
      status: isActive ? 'active' : 'suspended',
    });
  } catch (e) {
    console.error('Update Status Error', e);
  }
};

export const deleteUser = async (userId: string) => {
  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (e) {
    console.error('Delete Error', e);
  }
};
