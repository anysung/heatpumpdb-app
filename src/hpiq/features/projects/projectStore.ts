/**
 * Projects storage (Premium feature 4, 2026-09-29; job file v2 2026-10-02).
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
 * Every change goes through ONE transactional `mutate`: read the current
 * document, compute the patch from it, append the history entries, write. Two
 * team members editing the same project therefore never overwrite each
 * other's tasks or candidates with a stale copy.
 *
 * The dev `?preview=hpiq` user ('preview') cannot write Firestore, so in DEV
 * builds it gets an in-memory backend instead — tree-shaken from production.
 */
import {
  collection, doc, onSnapshot, query, where, setDoc, deleteDoc,
  runTransaction, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { ACTIVE_COUNTRY } from '../../../config/countryProfiles';
import type { User } from '../../../types';
import {
  Project, ProjectItem, ProjectTask, ProjectLogEntry, ProjectDetails, ProjectStatus,
  mergeItems, MergeResult, clip, byUpdatedDesc, readDetails, cleanDetails, readTasks, readHistory,
  appendHistory, isStatus, isIsoDay, emptyDetails,
  MAX_NAME, MAX_CUSTOMER, MAX_NOTES, MAX_ITEM_NOTE, MAX_TASKS, MAX_TASK_TEXT,
} from './projectModel';

export interface ProjectInput {
  name: string;
  customer?: string;
  notes?: string;
  status?: ProjectStatus;
  details?: ProjectDetails;
  targetDate?: string;
}

/** What a mutation may change. Anything left out stays as it is. */
export interface ProjectPatch {
  name?: string;
  customer?: string;
  notes?: string;
  status?: ProjectStatus;
  details?: ProjectDetails;
  targetDate?: string;
  selectedId?: string;
  items?: ProjectItem[];
  tasks?: ProjectTask[];
}
export type LogDraft = Omit<ProjectLogEntry, 'at' | 'by'>;
export type Mutation = (p: Project) => { patch: ProjectPatch; log?: LogDraft[] } | null;

export interface ProjectBackend {
  /** True when projects live in the team's shared collection. */
  shared: boolean;
  /** True for the in-memory dev-preview backend. */
  memory: boolean;
  subscribe(onData: (list: Project[]) => void, onError: (e: unknown) => void): () => void;
  create(input: ProjectInput, ids?: string[]): Promise<{ id: string; merge: MergeResult }>;
  /** Transactional read-modify-write. Returns the project as written. */
  mutate(pid: string, fn: Mutation): Promise<Project>;
  addItems(pid: string, ids: string[], labels?: Record<string, string>): Promise<MergeResult>;
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
    // v1 documents have none of these — a v1 project reads as an open lead.
    status: isStatus(d.status) ? d.status : 'lead',
    details: readDetails(d.details),
    targetDate: isIsoDay(d.targetDate) ? d.targetDate : '',
    selectedId: typeof d.selectedId === 'string' ? d.selectedId : '',
    tasks: readTasks(d.tasks),
    history: readHistory(d.history),
    createdBy: typeof d.createdBy === 'string' ? d.createdBy : '',
    createdAt: tsMs(d.createdAt),
    updatedAt: tsMs(d.updatedAt),
  };
}

// Firestore rejects `undefined` values — drop empty optional keys entirely.
const cleanItems = (items: ProjectItem[]): ProjectItem[] =>
  items.map(i => (i.note ? { id: i.id, note: clip(i.note, MAX_ITEM_NOTE), addedAt: i.addedAt } : { id: i.id, addedAt: i.addedAt }));
const cleanTasks = (tasks: ProjectTask[]): ProjectTask[] =>
  tasks.slice(0, MAX_TASKS).map(t => ({
    id: t.id, text: clip(t.text, MAX_TASK_TEXT), due: isIsoDay(t.due) ? t.due : '', done: !!t.done,
    ...(t.done && t.doneAt ? { doneAt: t.doneAt } : {}),
  }));
const cleanLog = (h: ProjectLogEntry[]) =>
  h.map(e => ({ at: e.at, by: clip(e.by, 80), k: e.k, ...(e.a ? { a: clip(e.a, 160) } : {}), ...(e.b ? { b: clip(e.b, 160) } : {}) }));

/** The storable fields of a patch (shared by both backends). */
function applyPatch(p: Project, patch: ProjectPatch): Project {
  const items = patch.items ?? p.items;
  let selectedId = patch.selectedId ?? p.selectedId;
  if (selectedId && !items.some(i => i.id === selectedId)) selectedId = '';
  return {
    ...p,
    ...(patch.name != null ? { name: clip(patch.name, MAX_NAME) || p.name } : {}),
    ...(patch.customer != null ? { customer: clip(patch.customer, MAX_CUSTOMER) } : {}),
    ...(patch.notes != null ? { notes: clip(patch.notes, MAX_NOTES) } : {}),
    ...(patch.status && isStatus(patch.status) ? { status: patch.status } : {}),
    ...(patch.details ? { details: readDetails(patch.details) } : {}),
    ...(patch.targetDate != null ? { targetDate: isIsoDay(patch.targetDate) ? patch.targetDate : '' } : {}),
    ...(patch.tasks ? { tasks: readTasks(cleanTasks(patch.tasks)) } : {}),
    items,
    selectedId,
  };
}

const storable = (p: Project) => ({
  name: p.name,
  customer: p.customer,
  notes: p.notes,
  status: p.status,
  details: cleanDetails(p.details),
  targetDate: p.targetDate,
  selectedId: p.selectedId,
  items: cleanItems(p.items),
  tasks: cleanTasks(p.tasks),
  history: cleanLog(p.history),
});

function newProject(uid: string, input: ProjectInput, ids: string[], by: string): { p: Project; merge: MergeResult } {
  const merge = mergeItems([], ids, nowIso());
  const p: Project = {
    id: '', market: MARKET, createdBy: uid, createdAt: null, updatedAt: null,
    name: clip(input.name, MAX_NAME),
    customer: clip(input.customer, MAX_CUSTOMER),
    notes: clip(input.notes, MAX_NOTES),
    status: input.status && isStatus(input.status) ? input.status : 'lead',
    details: readDetails(input.details ?? emptyDetails()),
    targetDate: isIsoDay(input.targetDate) ? input.targetDate : '',
    selectedId: '',
    items: merge.items,
    tasks: [],
    history: [{ at: nowIso(), by, k: 'created' }],
  };
  return { p, merge };
}

/** `addItems` as a mutation — shared by both backends. */
function addItemsMutation(ids: string[], labels: Record<string, string> | undefined, out: { result: MergeResult }): Mutation {
  return p => {
    out.result = mergeItems(p.items, ids, nowIso());
    if (!out.result.added) return null;
    const before = new Set(p.items.map(i => i.id));
    return {
      patch: { items: out.result.items },
      log: out.result.items.filter(i => !before.has(i.id)).map(i => ({ k: 'add' as const, a: labels?.[i.id] ?? i.id })),
    };
  };
}

/* ── Firestore backend ─────────────────────────────────────────────────── */

function firestoreBackend(uid: string, orgId: string | null, by: string): ProjectBackend {
  const col = orgId
    ? collection(db, 'organizations', orgId, 'projects')
    : collection(db, 'users', uid, 'projects');
  const ref = (pid: string) => doc(col, pid);

  const mutate: ProjectBackend['mutate'] = (pid, fn) =>
    runTransaction(db, async tx => {
      const snap = await tx.get(ref(pid));
      if (!snap.exists()) throw new Error('project-missing');
      const cur = fromDoc(pid, snap.data());
      const m = fn(cur);
      if (!m) return cur;
      const next = applyPatch(cur, m.patch);
      next.history = appendHistory(cur.history, (m.log ?? []).map(e => ({ ...e, at: nowIso(), by })));
      tx.update(ref(pid), { ...storable(next), updatedAt: serverTimestamp() });
      return next;
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
      const { p, merge } = newProject(uid, input, ids, by);
      await setDoc(r, {
        ...storable(p),
        market: MARKET,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { id: r.id, merge };
    },
    mutate,
    async addItems(pid, ids, labels) {
      const out = { result: { items: [], added: 0, duplicates: 0, overCap: 0 } as MergeResult };
      await mutate(pid, addItemsMutation(ids, labels, out));
      return out.result;
    },
    remove: pid => deleteDoc(ref(pid)),
  };
}

/* ── In-memory backend (DEV preview only) ──────────────────────────────── */

const memDb = new Map<string, Map<string, Project>>();
const memListeners = new Map<string, Set<() => void>>();

function memoryBackend(uid: string, orgId: string | null, by: string): ProjectBackend {
  const key = orgId ? `org:${orgId}` : `user:${uid}`;
  if (!memDb.has(key)) memDb.set(key, new Map());
  const store = memDb.get(key)!;
  const emit = () => memListeners.get(key)?.forEach(fn => fn());
  let seq = 0;

  const mutate: ProjectBackend['mutate'] = async (pid, fn) => {
    const cur = store.get(pid);
    if (!cur) throw new Error('project-missing');
    const m = fn(cur);
    if (!m) return cur;
    const next = applyPatch(cur, m.patch);
    next.history = appendHistory(cur.history, (m.log ?? []).map(e => ({ ...e, at: nowIso(), by })));
    next.updatedAt = Date.now();
    store.set(pid, next);
    emit();
    return next;
  };

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
      const { p, merge } = newProject(uid, input, ids, by);
      store.set(id, { ...p, id, createdAt: Date.now(), updatedAt: Date.now() });
      emit();
      return { id, merge };
    },
    mutate,
    async addItems(pid, ids, labels) {
      const out = { result: { items: [], added: 0, duplicates: 0, overCap: 0 } as MergeResult };
      await mutate(pid, addItemsMutation(ids, labels, out));
      return out.result;
    },
    async remove(pid) { store.delete(pid); emit(); },
  };
}

/* ── Selection ─────────────────────────────────────────────────────────── */

const cache = new Map<string, ProjectBackend>();

type Actor = Pick<User, 'id' | 'orgId'> & Partial<Pick<User, 'firstName' | 'lastName' | 'email'>>;

export function projectBackend(user: Actor): ProjectBackend {
  const orgId = user.orgId ? user.orgId : null;
  const memory = import.meta.env.DEV && user.id === 'preview';
  // Who did it, for the history line — the name the team knows the member by.
  const by = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || '';
  const key = `${memory ? 'mem' : 'fs'}|${user.id}|${orgId ?? ''}|${by}`;
  let b = cache.get(key);
  if (!b) {
    b = memory ? memoryBackend(user.id, orgId, by) : firestoreBackend(user.id, orgId, by);
    cache.set(key, b);
  }
  return b;
}
