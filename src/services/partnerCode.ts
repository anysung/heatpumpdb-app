/**
 * partnerCode — keeps a creator's discount code from their link until the
 * viewer actually pays (creator partner programme, 2026-10-18).
 *
 * WHY THIS EXISTS. A viewer clicks a creator's link (?coupon=RHH30&ref=p-rhh),
 * signs up and starts the 30-day Premium trial. Weeks later — often on another
 * device — they pay. The original campaign stash (paddleService, sessionStorage)
 * is gone by then, so the discount was lost, and with it the creator's
 * commission: the terms (§2) attribute a subscription to the code used AT
 * CHECKOUT. So the code is kept twice:
 *   - localStorage on this browser (until sign-up), and
 *   - the member's profile (partnerCode), which follows them to any device.
 *
 * SAFETY. The stored code only PRE-FILLS the checkout; Paddle decides whether
 * it applies, and the webhook attributes from the discount Paddle actually
 * used. Before pre-filling a stored code we ask the server whether it is still
 * redeemable (couponStatus), so an archived code can never sit between a
 * member and a purchase. A returning customer (paid before) gets no pre-fill —
 * a partner code is for new customers (terms §2); they can still type one.
 */
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from '../types';
import { couponStatusFn, TRIAL_FLOW_ENABLED } from './billingFnService';

const KEY = 'hpdb-partner-code';
const KEEP_DAYS = 120;
const CODE_RE = /^[A-Z0-9]{3,32}$/;
const REF_RE = /^p-[a-z0-9-]{1,20}$/;

interface Stored { code: string; ref: string; at: string }

function readLocal(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (!s || !CODE_RE.test(s.code || '')) return null;
    if (Date.now() - Date.parse(s.at) > KEEP_DAYS * 86400000) { localStorage.removeItem(KEY); return null; }
    return s;
  } catch { return null; }
}

/** Call once on boot (next to captureCouponFromUrl). Never throws. */
export function capturePartnerCodeFromUrl(): void {
  try {
    const q = new URLSearchParams(window.location.search);
    const code = (q.get('coupon') || '').toUpperCase();
    if (!CODE_RE.test(code)) return;
    const refRaw = (q.get('ref') || '').toLowerCase().slice(0, 22);
    const ref = REF_RE.test(refRaw) ? refRaw : '';
    // The latest link a viewer followed wins — it is the creator they listened to last.
    localStorage.setItem(KEY, JSON.stringify({ code, ref, at: new Date().toISOString() }));
  } catch { /* storage blocked — the checkout field still accepts the code */ }
}

/** Fields for a NEW profile (spread via compact at registration). */
export function pendingPartnerFields(): { partnerCode?: string; partnerCodeAt?: string; partnerRef?: string } {
  const s = readLocal();
  return s ? { partnerCode: s.code, partnerCodeAt: s.at, ...(s.ref ? { partnerRef: s.ref } : {}) } : {};
}

/** An existing member followed a creator link: copy the code onto the profile. */
export async function syncPartnerCodeToProfile(user: User | null): Promise<void> {
  if (!user?.id) return;
  const s = readLocal();
  if (!s || (user as any).partnerCode === s.code) return;
  if (hasPaidBefore(user)) return;        // no pre-fill for returning customers anyway
  try {
    await updateDoc(doc(db, 'users', user.id), {
      partnerCode: s.code, partnerCodeAt: s.at, partnerRef: s.ref || '',
    });
  } catch { /* best effort — the local copy still works on this device */ }
}

/** Paid history on the profile (Paddle subscription, past or present). */
export function hasPaidBefore(user: User | null): boolean {
  const u = user as any;
  return !!(u?.paddleSubscriptionId || u?.paddleCustomerId || u?.subscription?.source === 'paddle');
}

/** The code this member carries (local first: it is the most recent link). */
export function storedPartnerCode(user: User | null): string | null {
  const s = readLocal();
  if (s) return s.code;
  const c = String((user as any)?.partnerCode || '');
  return CODE_RE.test(c) ? c : null;
}

/** Is a stored code still redeemable? null = unknown (then we do not pre-fill). */
async function isActive(code: string): Promise<boolean | null> {
  if (!TRIAL_FLOW_ENABLED) return null;
  try {
    const r = await Promise.race([
      couponStatusFn(code),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
    return r && r.ok ? (r.active ?? null) : null;
  } catch { return null; }
}

/** Stored code to pre-fill at checkout, or null. Never blocks a checkout. */
export async function checkoutPartnerCode(user: User | null): Promise<string | null> {
  if (hasPaidBefore(user)) return null;
  const code = storedPartnerCode(user);
  if (!code) return null;
  return (await isActive(code)) === true ? code : null;
}
