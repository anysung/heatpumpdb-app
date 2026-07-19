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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
export const deleteArticle = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'newsArticles', id));
};

/* ── Hero image upload (client resize/webp → default bucket) ───────────────── */
export interface UploadedHero { imageUrl: string; imageStoragePath: string }
/** Resize (max 1600px wide), convert to WebP, upload to news/manual/<id>/hero.webp. */
export const uploadHeroImage = async (articleId: string, file: File): Promise<UploadedHero> => {
  const webp = await toWebp(file, 1600, 0.82);
  const path = `news/manual/${articleId}/hero.webp`;
  const r = ref(defaultStorage, path);
  await uploadBytes(r, webp, { contentType: 'image/webp', cacheControl: 'public, max-age=86400' });
  const imageUrl = await getDownloadURL(r);
  return { imageUrl, imageStoragePath: path };
};

const SUPPORTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
async function toWebp(file: File, maxW: number, quality: number): Promise<Blob> {
  if (!SUPPORTED.includes(file.type)) throw new Error('unsupported-format');
  if (file.size > 15 * 1024 * 1024) throw new Error('file-too-large');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bitmap.width);
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-unavailable');
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
  if (!blob) throw new Error('encode-failed');
  return blob;
}

/* ── Server actions ───────────────────────────────────────────────────────── */
export const publishArticle = (id: string) => callServer('publish', id);
export const unpublishArticle = (id: string, countries?: string[]) => callServer('unpublish', id, { countries });
export const retargetArticle = (id: string, add: string[], remove: string[]) => callServer('retarget', id, { add, remove });
export const updatePublishedArticle = (id: string) => callServer('updatePublished', id);
