/**
 * Projects — the PURE part (types + item merge), no Firebase, so the unit test
 * runs the real source. Storage lives in projectStore.ts.
 */

/** Hard cap per project — mirrored in firestore.rules (items.size() <= 50). */
export const MAX_PROJECT_ITEMS = 50;
export const MAX_NAME = 120;
export const MAX_CUSTOMER = 120;
export const MAX_NOTES = 2000;
export const MAX_ITEM_NOTE = 500;

export interface ProjectItem {
  id: string;
  note?: string;
  /** ISO timestamp (serverTimestamp() is not allowed inside arrays). */
  addedAt: string;
}

export interface Project {
  id: string;
  name: string;
  customer: string;
  notes: string;
  /** ACTIVE_COUNTRY.code at creation — product ids are market-specific. */
  market: string;
  items: ProjectItem[];
  createdBy: string;
  createdAt: number | null;
  updatedAt: number | null;
}

export interface MergeResult {
  items: ProjectItem[];
  added: number;
  duplicates: number;
  /** Ids refused because the project reached MAX_PROJECT_ITEMS. */
  overCap: number;
}

/** Append ids to a project's items: dedupe (existing + within the batch), cap at 50. */
export function mergeItems(items: readonly ProjectItem[], ids: readonly string[], nowIso: string): MergeResult {
  const out = [...items];
  const have = new Set(items.map(i => i.id));
  let added = 0, duplicates = 0, overCap = 0;
  for (const id of ids) {
    if (!id) continue;
    if (have.has(id)) { duplicates++; continue; }
    if (out.length >= MAX_PROJECT_ITEMS) { overCap++; continue; }
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
