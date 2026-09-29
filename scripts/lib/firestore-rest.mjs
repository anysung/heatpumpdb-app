/**
 * firestore-rest.mjs — the minimum Firestore REST surface the offline
 * pipeline scripts need, authenticated as the operator (gcloud
 * print-access-token → IAM, which bypasses security rules).
 *
 * Every request is time-bounded (AbortSignal.timeout): these helpers run inside
 * the unattended monthly window, where a hung socket must fail, not wait.
 */
import { execFileSync } from 'node:child_process';

export const PROJECT = 'gen-lang-client-0324244302';
export const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

let cached = null;
export function accessToken() {
  if (cached) return cached;
  cached = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', timeout: 30_000 }).trim();
  return cached;
}
const headers = () => ({
  Authorization: `Bearer ${accessToken()}`,
  'x-goog-user-project': PROJECT,
  'Content-Type': 'application/json',
});

/** JS → Firestore Value. */
export function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}
export const toFields = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, toValue(v)]));

/** Firestore Value → JS (timestamps stay ISO strings). */
export function fromValue(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue.fields ?? {});
  return null;
}
export const fromFields = (f) => Object.fromEntries(Object.entries(f ?? {}).map(([k, v]) => [k, fromValue(v)]));

export async function getDoc(path, { timeoutMs = 20_000 } = {}) {
  const res = await fetch(`${FS_BASE}/${path}`, { headers: headers(), signal: AbortSignal.timeout(timeoutMs) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  const doc = await res.json();
  return fromFields(doc.fields);
}

/** Replace (no mask) or merge (mask = the top-level keys of `data`, or the
 *  explicit field paths in `mask` — e.g. ['sent.`uid`'] to set ONE map entry). */
export async function setDoc(path, data, { merge = false, mask: paths = null, timeoutMs = 30_000 } = {}) {
  const keys = paths ?? (merge ? Object.keys(data) : null);
  const mask = keys ? '?' + keys.map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&') : '';
  const res = await fetch(`${FS_BASE}/${path}${mask}`, {
    method: 'PATCH', headers: headers(), signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status} ${(await res.text()).slice(0, 300)}`);
}

export async function addDoc(collection, data, { timeoutMs = 20_000 } = {}) {
  const res = await fetch(`${FS_BASE}/${collection}`, {
    method: 'POST', headers: headers(), signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error(`POST ${collection} → ${res.status} ${(await res.text()).slice(0, 300)}`);
}

/** runQuery at the database root; returns [{ path, id, data }]. */
export async function runQuery(structuredQuery, { timeoutMs = 60_000 } = {}) {
  const res = await fetch(`${FS_BASE}:runQuery`, {
    method: 'POST', headers: headers(), signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({ structuredQuery }),
  });
  if (!res.ok) throw new Error(`runQuery → ${res.status} ${(await res.text()).slice(0, 300)}`);
  return (await res.json()).filter(r => r.document).map(r => {
    const path = r.document.name.split('/documents/')[1];
    return { path, id: path.split('/').pop(), data: fromFields(r.document.fields) };
  });
}
