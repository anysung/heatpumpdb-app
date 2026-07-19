/**
 * newsAdminService.ts — the client half of the manual-news CMS.
 *
 * DRAFTS are written straight to Firestore `newsArticles/{id}` (admin rules
 * allow it) — saving a draft NEVER calls AI or touches the public site.
 *
 * TRANSLATION + PUBLISH always go through the authorization-checked server
 * function `newsAdmin` (Firebase ID token in the Authorization header; the
 * function re-verifies the caller is an admin). The AI key + prompt live only
 * on the server. This module never imports or knows the AI provider.
 */
import { doc, setDoc, getDoc, deleteDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, defaultStorage, auth } from '../firebase';
import { ManualNewsArticle } from '../types';

/** Server function endpoint (override per env; default = deployed gen2 URL). */
const NEWS_ADMIN_URL =
  (import.meta.env.VITE_NEWS_ADMIN_URL as string | undefined) ||
  'https://us-central1-gen-lang-client-0324244302.cloudfunctions.net/newsAdmin';

type Action = 'publish' | 'unpublish' | 'retarget' | 'updatePublished';
export interface NewsAdminResult {
  ok: boolean;
  status?: ManualNewsArticle['status'];
  publishedCountries?: string[];
  error?: string;
  failedLocale?: string;
  failedStep?: string;
}

async function callServer(action: Action, articleId: string, extra: Record<string, unknown> = {}): Promise<NewsAdminResult> {
  const user = auth.currentUser;
  if (!user) return { ok: false, error: 'not-signed-in' };
  const token = await user.getIdToken();
  const res = await fetch(NEWS_ADMIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, articleId, ...extra }),
  });
  const body = (await res.json().catch(() => ({}))) as NewsAdminResult;
  if (!res.ok) return { ok: false, error: body.error || `HTTP ${res.status}`, failedLocale: body.failedLocale, failedStep: body.failedStep };
  return { ok: true, ...body };
}

/* ── Draft CRUD (no AI, no public exposure) ───────────────────────────────── */
export const listArticles = async (): Promise<ManualNewsArticle[]> => {
  const snap = await getDocs(collection(db, 'newsArticles'));
  return snap.docs.map(d => d.data() as ManualNewsArticle)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
};
export const getArticle = async (id: string): Promise<ManualNewsArticle | null> => {
  const s = await getDoc(doc(db, 'newsArticles', id));
  return s.exists() ? (s.data() as ManualNewsArticle) : null;
};
/** Create or overwrite the English draft. Does not translate or publish. */
export const saveDraft = async (article: ManualNewsArticle): Promise<void> => {
  await setDoc(doc(db, 'newsArticles', article.id), article, { merge: true });
};
/** Mark a published article's source as edited (translations now outdated). */
export const markOutdated = async (id: string, uid: string): Promise<void> => {
  await updateDoc(doc(db, 'newsArticles', id), { translationOutdated: true, updatedBy: uid, updatedAt: new Date().toISOString() });
};
/**
 * Permanently delete a draft. Best-effort hero cleanup at the deterministic
 * path — but only when the article is NOT still published anywhere, because a
 * published article's public country docs reference the same image URL. Never
 * blocks the Firestore delete on the storage delete.
 */
export const deleteArticle = async (id: string): Promise<void> => {
  const existing = await getArticle(id);
  await deleteDoc(doc(db, 'newsArticles', id));
  const stillReferenced = Array.isArray(existing?.publishedCountries) && existing!.publishedCountries.length > 0;
  if (!stillReferenced) {
    try { await deleteObject(ref(defaultStorage, `news/manual/${id}/hero.webp`)); } catch { /* no image, ignore */ }
  }
};

/* ── Hero image upload (client resize/webp → default bucket) ───────────────── */
export interface UploadedHero { imageUrl: string; imageStoragePath: string }
/**
 * Optimize to WebP and upload to the STABLE path news/manual/<id>/hero.webp
 * (overwriting any previous hero — no timestamped duplicates). The optimizer
 * guarantees a final file strictly under 1 MB or throws; the fresh download URL
 * returned after overwrite carries a new token, so the browser never shows the
 * stale previous image.
 */
export const uploadHeroImage = async (articleId: string, file: File): Promise<UploadedHero> => {
  const webp = await optimizeToWebp(file);
  const path = `news/manual/${articleId}/hero.webp`;
  const r = ref(defaultStorage, path);
  try {
    await uploadBytes(r, webp, { contentType: 'image/webp', cacheControl: 'public, max-age=86400' });
    const imageUrl = await getDownloadURL(r);
    return { imageUrl, imageStoragePath: path };
  } catch (e) {
    // Re-throw with the Firebase Storage code preserved so the UI can explain
    // the REAL cause (e.g. storage/unauthorized = rules not deployed / not admin)
    // instead of a blank "try again".
    const code = (e as { code?: string })?.code;
    throw new Error(code ? `storage:${code}` : 'upload-failed');
  }
};

const SUPPORTED = ['image/jpeg', 'image/png', 'image/webp'];
const ONE_MB = 1024 * 1024;
const HARD_MAX = ONE_MB - 1;          // final file must be strictly < 1 MB
const PREFERRED_MAX = 250 * 1024;     // aim for ≤ 250 KB where practical
/**
 * Resize (longest side ≤ 1600 px, aspect preserved — no destructive crop) and
 * encode to WebP, stepping quality (0.82→0.5) then dimensions (×0.8) down until
 * the result is < 1 MB. Returns as soon as a candidate is ≤ 250 KB, otherwise
 * the highest-quality candidate under 1 MB. Throws 'image-too-large-after-
 * optimization' if nothing fits, so an oversized hero can never be stored.
 */
async function optimizeToWebp(file: File): Promise<Blob> {
  if (!SUPPORTED.includes(file.type)) throw new Error('unsupported-format');
  if (file.size > 15 * 1024 * 1024) throw new Error('file-too-large');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }   // decodes → also our "is it really an image" check
  catch { throw new Error('encode-failed'); }
  try {
    let maxSide = 1600;
    for (let attempt = 0; attempt < 4; attempt++) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas-unavailable');
      ctx.drawImage(bitmap, 0, 0, w, h);
      let underLimit: Blob | null = null;
      for (const q of [0.82, 0.74, 0.66, 0.58, 0.5]) {
        const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', q));
        if (!blob) continue;
        if (blob.size <= PREFERRED_MAX) return blob;             // ideal size — ship immediately
        if (blob.size < HARD_MAX) { underLimit = blob; break; }  // best quality that fits under 1 MB
      }
      if (underLimit) return underLimit;
      maxSide = Math.round(maxSide * 0.8);                       // still too big — shrink and retry
    }
    throw new Error('image-too-large-after-optimization');
  } finally {
    bitmap.close?.();
  }
}

/* ── Server actions ───────────────────────────────────────────────────────── */
export const publishArticle = (id: string) => callServer('publish', id);
export const unpublishArticle = (id: string, countries?: string[]) => callServer('unpublish', id, { countries });
export const retargetArticle = (id: string, add: string[], remove: string[]) => callServer('retarget', id, { add, remove });
export const updatePublishedArticle = (id: string) => callServer('updatePublished', id);
