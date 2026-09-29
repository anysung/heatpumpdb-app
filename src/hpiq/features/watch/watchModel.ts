/**
 * Watchlist data layer (Premium, 2026-09-29).
 *
 *   users/{uid}/watch/{cc}_m_{productId}   a watched model
 *   users/{uid}/watch/{cc}_f_{mfrSlug}     a watched manufacturer
 *   users/{uid}/watch/_settings            { emailAlerts, lang, updatedAt }
 *   countries/{cc}/changes/latest          what the last monthly update changed
 *                                          (scripts/compute-dataset-changes.mjs)
 *
 * firestore.rules validates every field; creating a watch needs Premium
 * (isEntitled), removing one and the settings never do — a lapsed member can
 * always clean up and switch the mails off. The 200 cap is enforced here (UX);
 * the alert script tolerates any count.
 */
import { useEffect, useState } from 'react';
import {
  collection, doc, onSnapshot, setDoc, deleteDoc, getDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { ACTIVE_COUNTRY } from '../../../config/countryProfiles';

export const WATCH_LIMIT = 200;
export const MARKET = ACTIVE_COUNTRY.code;

export type WatchType = 'model' | 'manufacturer';
export interface WatchDoc {
  docId: string;
  type: WatchType;
  market: string;
  key: string;
  label: string;
}
export interface WatchSettings { emailAlerts: boolean; lang?: string }

/**
 * MUST stay identical to mfrSlug() in scripts/lib/dataset-diff.mjs — the alert
 * mails match a watched manufacturer by it (tests/dataset-diff.unit.mjs pins
 * shared vectors against this file's copy).
 */
export function mfrSlug(name: string): string {
  return String(name ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Firestore ids cannot contain '/', so it is escaped; `key` keeps the raw id. */
export const watchDocId = (type: WatchType, key: string, market = MARKET): string =>
  `${market}_${type === 'model' ? 'm' : 'f'}_${key.replace(/\//g, '%2F')}`.slice(0, 300);

const watchCol = (uid: string) => collection(db, 'users', uid, 'watch');

/** Live watch list (all markets) + settings for one account. */
export function useWatchlist(uid: string | null | undefined): {
  items: WatchDoc[]; settings: WatchSettings; ready: boolean;
} {
  const [items, setItems] = useState<WatchDoc[]>([]);
  const [settings, setSettings] = useState<WatchSettings>({ emailAlerts: true });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!uid) { setItems([]); setReady(true); return; }
    const unsub = onSnapshot(watchCol(uid), (snap) => {
      const list: WatchDoc[] = [];
      let s: WatchSettings = { emailAlerts: true };
      snap.forEach(d => {
        const x = d.data() as Record<string, unknown>;
        if (d.id === '_settings') { s = { emailAlerts: x.emailAlerts !== false, lang: typeof x.lang === 'string' ? x.lang : undefined }; return; }
        if ((x.type === 'model' || x.type === 'manufacturer') && typeof x.key === 'string') {
          list.push({ docId: d.id, type: x.type, market: String(x.market ?? ''), key: x.key, label: String(x.label ?? x.key) });
        }
      });
      list.sort((a, b) => a.label.localeCompare(b.label));
      setItems(list); setSettings(s); setReady(true);
    }, () => { setReady(true); });
    return unsub;
  }, [uid]);
  return { items, settings, ready };
}

export async function addWatch(uid: string, type: WatchType, key: string, label: string, lang: string): Promise<void> {
  await setDoc(doc(watchCol(uid), watchDocId(type, key)), {
    type, market: MARKET, key: key.slice(0, 200), label: label.slice(0, 200), createdAt: serverTimestamp(),
  });
  // Remember the UI language for the alert mail (best effort; never blocks the watch).
  setDoc(doc(watchCol(uid), '_settings'), { lang, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
}

export const removeWatch = (uid: string, docId: string): Promise<void> => deleteDoc(doc(watchCol(uid), docId));

export const setEmailAlerts = (uid: string, on: boolean, lang: string): Promise<void> =>
  setDoc(doc(watchCol(uid), '_settings'), { emailAlerts: on, lang, updatedAt: serverTimestamp() }, { merge: true });

/* ── Latest changes ─────────────────────────────────────────────────────── */

export interface ChangeEntry { id: string; mfr: string; model: string }
export interface ListingChange extends ChangeEntry { field: string; from: string | null; to: string | null }
export interface SpecChange extends ChangeEntry { changes: { f: string; a: unknown; b: unknown }[] }
export interface ChangesDoc {
  month: string;
  counts?: { listing: number; added: number; removed: number; specs: number };
  listing: ListingChange[];
  added: ChangeEntry[];
  removed: ChangeEntry[];
  specs: SpecChange[];
}
export type ChangeKind = 'listing' | 'added' | 'removed' | 'specs';
export interface ChangeInfo { kinds: ChangeKind[]; listing?: ListingChange; specFields?: string[] }

/** id → what changed (models); mfr slug → count (manufacturers). */
export function indexChanges(c: ChangesDoc | null): { byId: Map<string, ChangeInfo>; byMfr: Map<string, number> } {
  const byId = new Map<string, ChangeInfo>();
  const byMfr = new Map<string, number>();
  if (!c) return { byId, byMfr };
  const touch = (e: ChangeEntry, k: ChangeKind) => {
    const cur = byId.get(e.id) ?? { kinds: [] };
    if (!cur.kinds.includes(k)) cur.kinds.push(k);
    byId.set(e.id, cur);
    return cur;
  };
  for (const e of c.listing ?? []) { const cur = touch(e, 'listing'); if (e.field?.endsWith('_status')) cur.listing = e; }
  for (const e of c.added ?? []) touch(e, 'added');
  for (const e of c.removed ?? []) touch(e, 'removed');
  for (const e of c.specs ?? []) touch(e, 'specs').specFields = (e.changes ?? []).map(x => x.f);
  const seen = new Set<string>();
  for (const list of [c.listing, c.added, c.removed, c.specs]) {
    for (const e of list ?? []) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      const s = mfrSlug(e.mfr);
      byMfr.set(s, (byMfr.get(s) ?? 0) + 1);
    }
  }
  return { byId, byMfr };
}

/** countries/{cc}/changes/latest — Premium-readable only (rules); null otherwise. */
export function useLatestChanges(enabled: boolean): { changes: ChangesDoc | null; ready: boolean } {
  const [changes, setChanges] = useState<ChangesDoc | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) { setReady(true); return; }
    let alive = true;
    getDoc(doc(db, 'countries', MARKET, 'changes', 'latest'))
      .then(s => { if (alive) setChanges(s.exists() ? (s.data() as ChangesDoc) : null); })
      .catch(() => { /* not published yet / not entitled — the page says so */ })
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [enabled]);
  return { changes, ready };
}
