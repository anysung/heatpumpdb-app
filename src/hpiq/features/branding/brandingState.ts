/**
 * Branded documents — state + persistence (Premium, 2026-09-29).
 *
 * - The SAVED branding lives on the user doc (`users/{uid}.branding`), written
 *   only by the owner (firestore.rules: own doc, key allowlist, logo size cap).
 * - The per-document choices (use branding on this sheet? prepared for whom?)
 *   are session state shared by the data-sheet studio, the on-screen preview
 *   (DataSheetDoc, desktop + phone) and the PDF build in HpiqApp. They live in
 *   this tiny module store instead of growing HpiqApp's state.
 */
import { useSyncExternalStore } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import type { User, UserBranding } from '../../../types';
import type { PdfBranding } from '../../pdf/brandingBand';
import { brandingStrings } from './strings';

/** Client-side cap on the stored data URL (rules allow a little headroom). */
export const LOGO_MAX_CHARS = 150_000;
export const LOGO_MAX_W = 600;
export const LOGO_MAX_H = 200;
export const COMPANY_MAX = 120;
export const CONTACT_MAX = 200;
export const PREPARED_FOR_MAX = 120;

/** The user's saved branding, or null when nothing usable is stored. */
export function savedBranding(user: User | null | undefined): UserBranding | null {
  const b = user?.branding;
  if (!b) return null;
  return b.logo || b.company?.trim() || b.contact?.trim() ? b : null;
}

/** Persist (or clear, with null) the branding on the user's own doc. */
export async function saveBranding(uid: string, b: UserBranding | null): Promise<void> {
  // Firestore rejects `undefined` — send only the keys that carry a value.
  const clean: Record<string, string> = {};
  if (b) for (const [k, v] of Object.entries(b)) if (typeof v === 'string' && v !== '') clean[k] = v;
  await updateDoc(doc(db, 'users', uid), { branding: clean });
}

/* ── Per-document options (session) ──────────────────────────────────────── */
export interface DocBrandingOptions {
  /** "Add my company branding" — on by default once branding is saved. */
  enabled: boolean;
  preparedFor: string;
}

let opts: DocBrandingOptions = { enabled: true, preparedFor: '' };
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => opts;

export function setDocBrandingOptions(patch: Partial<DocBrandingOptions>): void {
  opts = { ...opts, ...patch };
  listeners.forEach(l => l());
}
export const getDocBrandingOptions = (): DocBrandingOptions => opts;
export function useDocBrandingOptions(): DocBrandingOptions {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * What a generated document should carry: null for Standard users, when no
 * branding is saved, or when the toggle is off. `preparedFor` alone (no saved
 * branding) is still printed — it is a customer label, not branding.
 */
export function pdfBrandingFor(
  user: User, premium: boolean, lang: string,
  o: DocBrandingOptions = opts,
): PdfBranding | null {
  if (!premium) return null;
  const s = brandingStrings(lang);
  const labels = { preparedBy: s.pdfPreparedBy, preparedFor: s.pdfPreparedFor };
  const preparedFor = o.preparedFor.trim().slice(0, PREPARED_FOR_MAX) || undefined;
  const b = o.enabled ? savedBranding(user) : null;
  if (!b && !preparedFor) return null;
  return {
    logo: b?.logo,
    company: b ? (b.company?.trim() || user.companyName || '') : undefined,
    contact: b?.contact,
    preparedFor,
    labels,
  };
}
