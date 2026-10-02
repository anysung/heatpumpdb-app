/**
 * Projects — the PURE part (types, item merge, task/status helpers), no
 * Firebase, so the unit test runs the real source. Storage lives in
 * projectStore.ts.
 *
 * v2 (owner 2026-10-02): a project is a small job file, not just a shortlist —
 * customer + site, building + system (drop-downs), status, target date,
 * up to FOUR candidate models, to-dos with due dates and a change history.
 * Every v2 field is optional in storage, so v1 documents stay valid.
 */

/** Storage cap per project — mirrored in firestore.rules (items.size() <= 50).
 *  Kept at 50 so projects written before v2 remain valid. */
export const MAX_PROJECT_ITEMS = 50;
/** Candidate models per project (UI + merge cap): the comparison shows four. */
export const MAX_CANDIDATES = 4;
export const MAX_NAME = 120;
export const MAX_CUSTOMER = 120;
export const MAX_NOTES = 2000;
export const MAX_ITEM_NOTE = 500;
/** Mirrored in firestore.rules (tasks.size() <= 40, history.size() <= 60). */
export const MAX_TASKS = 40;
export const MAX_TASK_TEXT = 200;
export const MAX_HISTORY = 60;
export const MAX_DETAIL = 160;

export interface ProjectItem {
  id: string;
  note?: string;
  /** ISO timestamp (serverTimestamp() is not allowed inside arrays). */
  addedAt: string;
}

/* ── Status ─────────────────────────────────────────────────────────────── */
export const STATUSES = ['lead', 'survey', 'quote', 'won', 'install', 'done', 'hold', 'lost'] as const;
export type ProjectStatus = typeof STATUSES[number];
/** Closed = no further work expected. Everything else is "open". */
export const CLOSED_STATUSES: readonly ProjectStatus[] = ['done', 'lost'];
export const isStatus = (s: unknown): s is ProjectStatus => (STATUSES as readonly string[]).includes(String(s));
export const isOpen = (p: Pick<Project, 'status'>): boolean => !CLOSED_STATUSES.includes(p.status);

/* ── Details (all strings; '' = not set). Drop-down fields store option ids. ── */
export const DETAIL_TEXT = ['phone', 'email', 'address', 'postcode', 'city', 'area', 'buildYear', 'heatLoad'] as const;
export const DETAIL_CHOICE = ['buildingType', 'projectType', 'existing', 'distribution', 'dhw', 'supply', 'funding'] as const;
export type DetailTextKey = typeof DETAIL_TEXT[number];
export type DetailChoiceKey = typeof DETAIL_CHOICE[number];
export type ProjectDetails = Record<DetailTextKey | DetailChoiceKey, string>;

export const CHOICES: Record<DetailChoiceKey, readonly string[]> = {
  buildingType: ['detached', 'semi', 'terraced', 'apartment', 'multi', 'commercial', 'other'],
  projectType: ['replacement', 'newbuild', 'hybrid', 'extension', 'other'],
  existing: ['gas', 'oil', 'electric', 'solid', 'district', 'heatpump', 'none'],
  distribution: ['underfloor', 'radiators', 'mixed', 'air'],
  dhw: ['integrated', 'separate', 'none'],
  supply: ['1ph', '3ph', 'unknown'],
  funding: ['none', 'check', 'applied', 'approved', 'paid'],
};

export const emptyDetails = (): ProjectDetails =>
  Object.fromEntries([...DETAIL_TEXT, ...DETAIL_CHOICE].map(k => [k, ''])) as ProjectDetails;

/** Tolerant read of a stored details map: unknown keys dropped, bad option ids → ''. */
export function readDetails(raw: unknown): ProjectDetails {
  const d = emptyDetails();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  for (const k of DETAIL_TEXT) if (typeof r[k] === 'string') d[k] = clip(r[k] as string, MAX_DETAIL);
  for (const k of DETAIL_CHOICE) if (typeof r[k] === 'string' && CHOICES[k].includes(r[k] as string)) d[k] = r[k] as string;
  return d;
}

/** What goes to storage: only the keys that carry a value (Firestore rejects
 *  `undefined`, and an all-empty map is just noise). */
export function cleanDetails(d: ProjectDetails): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of DETAIL_TEXT) { const v = clip(d[k], MAX_DETAIL); if (v) out[k] = v; }
  for (const k of DETAIL_CHOICE) if (CHOICES[k].includes(d[k])) out[k] = d[k];
  return out;
}

/* ── Tasks ──────────────────────────────────────────────────────────────── */
export interface ProjectTask {
  id: string;
  text: string;
  /** YYYY-MM-DD, or '' for "no date". */
  due: string;
  done: boolean;
  /** ISO timestamp when it was ticked. */
  doneAt?: string;
}
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
export const isIsoDay = (s: unknown): s is string => typeof s === 'string' && ISO_DAY.test(s);

export function readTasks(raw: unknown): ProjectTask[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(t => t && typeof t.id === 'string' && typeof t.text === 'string')
    .slice(0, MAX_TASKS)
    .map(t => ({
      id: t.id, text: clip(t.text, MAX_TASK_TEXT), due: isIsoDay(t.due) ? t.due : '', done: t.done === true,
      ...(typeof t.doneAt === 'string' ? { doneAt: t.doneAt } : {}),
    }));
}

/** Open tasks first (dated by due date, undated last), then finished ones (newest tick first). */
export function sortTasks(tasks: readonly ProjectTask[]): ProjectTask[] {
  const open = tasks.filter(t => !t.done).sort((a, b) =>
    (a.due || '9999-99-99').localeCompare(b.due || '9999-99-99') || a.text.localeCompare(b.text));
  const done = tasks.filter(t => t.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));
  return [...open, ...done];
}

/** The next thing to do: the earliest dated open task, else the first undated one. */
export const nextTask = (tasks: readonly ProjectTask[]): ProjectTask | null =>
  sortTasks(tasks).find(t => !t.done) ?? null;

export type DueState = 'overdue' | 'today' | 'soon' | 'later' | 'none';
/** `today` is the viewer's local YYYY-MM-DD. "soon" = within the next 7 days. */
export function dueState(due: string, today: string): DueState {
  if (!isIsoDay(due)) return 'none';
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  const d = (Date.parse(`${due}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000;
  return d <= 7 ? 'soon' : 'later';
}

/** Local calendar day as YYYY-MM-DD (not UTC — a task due "today" is the user's today). */
export function localDay(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ── History (structured, rendered in the viewer's language) ─────────────── */
export type LogKind = 'created' | 'status' | 'add' | 'remove' | 'select' | 'unselect' | 'details' | 'task' | 'taskDone' | 'taskUndone' | 'taskRemoved';
export interface ProjectLogEntry {
  at: string;          // ISO
  by: string;          // display name of the member who did it
  k: LogKind;
  a?: string;
  b?: string;
}
export function readHistory(raw: unknown): ProjectLogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(e => e && typeof e.at === 'string' && typeof e.k === 'string')
    .slice(-MAX_HISTORY)
    .map(e => ({
      at: e.at, by: typeof e.by === 'string' ? e.by : '', k: e.k as LogKind,
      ...(typeof e.a === 'string' ? { a: e.a } : {}), ...(typeof e.b === 'string' ? { b: e.b } : {}),
    }));
}
/** Append entries, keeping the newest MAX_HISTORY. */
export const appendHistory = (h: readonly ProjectLogEntry[], add: readonly ProjectLogEntry[]): ProjectLogEntry[] =>
  [...h, ...add].slice(-MAX_HISTORY);

/* ── Project ────────────────────────────────────────────────────────────── */
export interface Project {
  id: string;
  name: string;
  customer: string;
  notes: string;
  /** ACTIVE_COUNTRY.code at creation — product ids are market-specific. */
  market: string;
  items: ProjectItem[];
  status: ProjectStatus;
  details: ProjectDetails;
  /** Target installation date, YYYY-MM-DD or ''. */
  targetDate: string;
  /** The candidate chosen for the job ('' = not decided). */
  selectedId: string;
  tasks: ProjectTask[];
  history: ProjectLogEntry[];
  createdBy: string;
  createdAt: number | null;
  updatedAt: number | null;
}

export interface MergeResult {
  items: ProjectItem[];
  added: number;
  duplicates: number;
  /** Ids refused because the project reached the cap. */
  overCap: number;
}

/** Append ids to a project's items: dedupe (existing + within the batch), cap
 *  at `cap` (four candidates; the storage rule allows more for v1 projects). */
export function mergeItems(items: readonly ProjectItem[], ids: readonly string[], nowIso: string, cap = MAX_CANDIDATES): MergeResult {
  const out = [...items];
  const have = new Set(items.map(i => i.id));
  let added = 0, duplicates = 0, overCap = 0;
  for (const id of ids) {
    if (!id) continue;
    if (have.has(id)) { duplicates++; continue; }
    if (out.length >= cap) { overCap++; continue; }
    have.add(id);
    out.push({ id, addedAt: nowIso });
    added++;
  }
  return { items: out, added, duplicates, overCap };
}

export const clip = (s: string | null | undefined, max: number): string => (s ?? '').trim().slice(0, max);

/** Newest activity first. */
export const byUpdatedDesc = (a: Project, b: Project) =>
  // A pending serverTimestamp (null) is "just now" → first.
  (b.updatedAt ?? Number.MAX_SAFE_INTEGER) - (a.updatedAt ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name);

/** One-line dashboard numbers for the page header. */
export function summarize(projects: readonly Project[], today: string): { open: number; dueSoon: number; overdue: number } {
  let open = 0, dueSoon = 0, overdue = 0;
  for (const p of projects) {
    if (!isOpen(p)) continue;
    open++;
    for (const t of p.tasks) {
      if (t.done) continue;
      const st = dueState(t.due, today);
      if (st === 'overdue') overdue++;
      else if (st === 'today' || st === 'soon') dueSoon++;
    }
  }
  return { open, dueSoon, overdue };
}

/** RFC 4180 CSV of every project (record keeping / own backups). */
export function projectsCsv(
  projects: readonly Project[],
  header: readonly string[],
  row: (p: Project) => readonly (string | number)[],
): string {
  const cell = (v: string | number) => {
    const s = String(v ?? '');
    return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...projects.map(row)].map(r => r.map(cell).join(';')).join('\r\n');
}
