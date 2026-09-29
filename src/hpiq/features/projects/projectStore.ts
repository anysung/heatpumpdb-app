/**
 * Projects storage (Premium feature 4, 2026-09-29).
 *
 *   personal   users/{uid}/projects/{pid}             owner only
 *   team       organizations/{orgId}/projects/{pid}    every team member
 *
 * A team account (user.orgId set) works in the team's shared collection; a
 * Professional account in its own. Rules: firestore.rules "Projects" blocks
 * (shape + size validated there; createdBy must be the caller on create).
 *
 * Projects are listed per MARKET (product ids are market-specific), so a team
 * working on two editions sees each edition's projects on its own site.
 *
 * The dev `?preview=hpiq` user ('preview') cannot write Firestore, so in DEV
 * builds it gets an in-memory backend instead — tree-shaken from production.
 */
import {
  collection, doc, onSnapshot, query, where, setDoc, updateDoc, deleteDoc,
  runTransaction, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { ACTIVE_COUNTRY } from '../../../config/countryProfiles';
import type { User } from '../../../types';
import {
  Project, ProjectItem, mergeItems, MergeResult, clip, byUpdatedDesc,
  MAX_NAME, MAX_CUSTOMER, MAX_NOTES, MAX_ITEM_NOTE,
} from './projectModel';

export interface ProjectInput { name: string; customer?: string; notes?: string }

export interface ProjectBackend {
  /** True when projects live in the team's shared collection. */
  shared: boolean;
  /** True for the in-memory dev-preview backend. */
  memory: boolean;
  subscribe(onData: (list: Project[]) => void, onError: (e: unknown) => void): () => void;
  create(input: ProjectInput, ids?: string[]): Promise<{ id: string; merge: MergeResult }>;
  update(pid: string, patch: Partial<ProjectInput>): Promise<void>;
  addItems(pid: string, ids: string[]): Promise<MergeResult>;
  removeItem(pid: string, itemId: string): Promise<void>;
  setItemNote(pid: string, itemId: string, note: string): Promise<void>;
  remove(pid: string): Promise<void>;
}

const MARKET = ACTIVE_COUNTRY.code;
const nowIso = () => new Date().toISOString();

const tsMs = (v: unknown): number | null =>
  v instanceof Timestamp ? v.toMillis() : typeof v === 'number' ? v : null;

function fromDoc(id: string, d: Record<string, unknown>): Project {
  return {
    id,
    name: typeof d.name === 'string' ? d.name : '',
    customer: typeof d.customer === 'string' ? d.customer : '',
    notes: typeof d.notes === 'string' ? d.notes : '',
    market: typeof d.market === 'string' ? d.market : MARKET,
    items: Array.isArray(d.items)
      ? (d.items as ProjectItem[]).filter(i => i && typeof i.id === 'string')
      : [],
    createdBy: typeof d.createdBy === 'string' ? d.createdBy : '',
    createdAt: tsMs(d.createdAt),
    updatedAt: tsMs(d.updatedAt),
  };
}

const cleanItems = (items: ProjectItem[]): ProjectItem[] =>
  // Firestore rejects `undefined` values — drop an empty note key entirely.
  items.map(i => (i.note ? { id: i.id, note: i.note, addedAt: i.addedAt } : { id: i.id, addedAt: i.addedAt }));

/* ── Firestore backend ─────────────────────────────────────────────────── */

function firestoreBackend(uid: string, orgId: string | null): ProjectBackend {
  const col = orgId
    ? collection(db, 'organizations', orgId, 'projects')
    : collection(db, 'users', uid, 'projects');
  const ref = (pid: string) => doc(col, pid);

  const mutateItems = (pid: string, fn: (items: ProjectItem[]) => ProjectItem[]) =>
    runTransaction(db, async tx => {
      const snap = await tx.get(ref(pid));
      if (!snap.exists()) throw new Error('project-missing');
      const items = fromDoc(pid, snap.data()).items;
      tx.update(ref(pid), { items: cleanItems(fn(items)), updatedAt: serverTimestamp() });
    });

  return {
    shared: !!orgId,
    memory: false,
    subscribe(onData, onError) {
      return onSnapshot(
        query(col, where('market', '==', MARKET)),
        snap => onData(snap.docs.map(d => fromDoc(d.id, d.data())).sort(byUpdatedDesc)),
        onError,
      );
    },
    async create(input, ids = []) {
      const r = doc(col);
      const merge = mergeItems([], ids, nowIso());
      await setDoc(r, {
        name: clip(input.name, MAX_NAME),
        customer: clip(input.customer, MAX_CUSTOMER),
        notes: clip(input.notes, MAX_NOTES),
        market: MARKET,
        items: cleanItems(merge.items),
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { id: r.id, merge };
    },
    async update(pid, patch) {
      const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (patch.name != null) data.name = clip(patch.name, MAX_NAME);
      if (patch.customer != null) data.customer = clip(patch.customer, MAX_CUSTOMER);
      if (patch.notes != null) data.notes = clip(patch.notes, MAX_NOTES);
      await updateDoc(ref(pid), data);
    },
    async addItems(pid, ids) {
      let result: MergeResult = { items: [], added: 0, duplicates: 0, overCap: 0 };
      await runTransaction(db, async tx => {
        const snap = await tx.get(ref(pid));
        if (!snap.exists()) throw new Error('project-missing');
        result = mergeItems(fromDoc(pid, snap.data()).items, ids, nowIso());
        if (result.added) tx.update(ref(pid), { items: cleanItems(result.items), updatedAt: serverTimestamp() });
      });
      return result;
    },
    removeItem: (pid, itemId) => mutateItems(pid, items => items.filter(i => i.id !== itemId)),
    setItemNote: (pid, itemId, note) =>
      mutateItems(pid, items => items.map(i => (i.id === itemId ? { ...i, note: clip(note, MAX_ITEM_NOTE) } : i))),
    remove: pid => deleteDoc(ref(pid)),
  };
}

/* ── In-memory backend (DEV preview only) ──────────────────────────────── */

const memDb = new Map<string, Map<string, Project>>();
const memListeners = new Map<string, Set<() => void>>();

function memoryBackend(uid: string, orgId: string | null): ProjectBackend {
  const key = orgId ? `org:${orgId}` : `user:${uid}`;
  if (!memDb.has(key)) memDb.set(key, new Map());
  const store = memDb.get(key)!;
  const emit = () => memListeners.get(key)?.forEach(fn => fn());
  const touch = (p: Project): Project => ({ ...p, updatedAt: Date.now() });
  const get = (pid: string) => {
    const p = store.get(pid);
    if (!p) throw new Error('project-missing');
    return p;
  };
  let seq = 0;
  return {
    shared: !!orgId,
    memory: true,
    subscribe(onData) {
      const push = () => onData([...store.values()].filter(p => p.market === MARKET).sort(byUpdatedDesc));
      if (!memListeners.has(key)) memListeners.set(key, new Set());
      memListeners.get(key)!.add(push);
      queueMicrotask(push);
      return () => { memListeners.get(key)?.delete(push); };
    },
    async create(input, ids = []) {
      const id = `mem-${Date.now().toString(36)}-${seq++}`;
      const merge = mergeItems([], ids, nowIso());
      store.set(id, {
        id, name: clip(input.name, MAX_NAME), customer: clip(input.customer, MAX_CUSTOMER),
        notes: clip(input.notes, MAX_NOTES), market: MARKET, items: merge.items,
        createdBy: uid, createdAt: Date.now(), updatedAt: Date.now(),
      });
      emit();
      return { id, merge };
    },
    async update(pid, patch) {
      const p = get(pid);
      store.set(pid, touch({
        ...p,
        ...(patch.name != null ? { name: clip(patch.name, MAX_NAME) } : {}),
        ...(patch.customer != null ? { customer: clip(patch.customer, MAX_CUSTOMER) } : {}),
        ...(patch.notes != null ? { notes: clip(patch.notes, MAX_NOTES) } : {}),
      }));
      emit();
    },
    async addItems(pid, ids) {
      const p = get(pid);
      const merge = mergeItems(p.items, ids, nowIso());
      if (merge.added) { store.set(pid, touch({ ...p, items: merge.items })); emit(); }
      return merge;
    },
    async removeItem(pid, itemId) {
      const p = get(pid);
      store.set(pid, touch({ ...p, items: p.items.filter(i => i.id !== itemId) }));
      emit();
    },
    async setItemNote(pid, itemId, note) {
      const p = get(pid);
      store.set(pid, touch({ ...p, items: p.items.map(i => (i.id === itemId ? { ...i, note: clip(note, MAX_ITEM_NOTE) } : i)) }));
      emit();
    },
    async remove(pid) { store.delete(pid); emit(); },
  };
}

/* ── Selection ─────────────────────────────────────────────────────────── */

const cache = new Map<string, ProjectBackend>();

export function projectBackend(user: Pick<User, 'id' | 'orgId'>): ProjectBackend {
  const orgId = user.orgId ? user.orgId : null;
  const memory = import.meta.env.DEV && user.id === 'preview';
  const key = `${memory ? 'mem' : 'fs'}|${user.id}|${orgId ?? ''}`;
  let b = cache.get(key);
  if (!b) {
    b = memory ? memoryBackend(user.id, orgId) : firestoreBackend(user.id, orgId);
    cache.set(key, b);
  }
  return b;
}
