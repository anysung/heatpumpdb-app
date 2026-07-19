/**
 * NewsManagementPage — the manual news CMS for the admin console.
 *
 * One page component with three internal sub-views:
 *   • list    — All Articles / Drafts / Published (a filtered table)
 *   • editor  — English-only source editor (create + edit)
 *   • preview — the public press-article look, rendered from the English source
 *
 * Drafts are written straight to Firestore (no AI). Translate + publish always
 * go through the authorization-checked server function via newsAdminService.
 * This page NEVER asks for translations — the English source is the only input.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ManualNewsArticle } from '../../types';
import {
  listArticles, saveDraft, markOutdated, deleteArticle, uploadHeroImage,
  publishArticle, unpublishArticle, retargetArticle, updatePublishedArticle,
  NewsAdminResult,
} from '../../services/newsAdminService';
import {
  NEWS_TARGETS, NEWS_TARGET_BY_COUNTRY, NEWS_CATEGORIES,
  parseYouTubeId, youTubeWatchUrl, sanitizeNewsText, safeHttpUrl,
} from '../../config/newsLocales';
import { auth } from '../../firebase';
import { AdminLang, ADMIN_I18N } from './adminI18n';
import { PageHeader, SectionCard, EmptyState } from './shared';
import { VideoExplainer } from '../../hpiq/ui';

/* ── helpers ─────────────────────────────────────────────────────────────── */

const flagEmoji = (code: string) =>
  code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));

const NEWS_SERIF = 'Georgia, "Times New Roman", "Noto Serif", serif';

/** Tiny keyword → country map for the non-blocking national-flag/policy warning. */
const FLAG_KEYWORDS: { cc: string; re: RegExp }[] = [
  { cc: 'DE', re: /\b(BAFA|German(?:y)?|Deutschland|German\s+flag)\b/i },
  { cc: 'GB', re: /\b(Ofgem|BUS|Boiler\s+Upgrade|United\s+Kingdom|UK|British|Union\s+Jack)\b/i },
  { cc: 'FR', re: /\b(MaPrimeR[eé]nov|France|French|Tricolore)\b/i },
  { cc: 'PL', re: /\b(Czyste\s+Powietrze|Poland|Polish)\b/i },
  { cc: 'IT', re: /\b(Conto\s+Termico|GSE|Italy|Italian)\b/i },
];
/** Return the first country a flag/policy keyword resolves to, or null. */
function detectFlagCountry(text: string): string | null {
  for (const { cc, re } of FLAG_KEYWORDS) if (re.test(text)) return cc;
  return null;
}

function newDraftId(): string {
  return `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyDraft(uid: string): ManualNewsArticle {
  const now = new Date().toISOString();
  return {
    id: newDraftId(),
    sourceType: 'manual',
    sourceLanguage: 'en',
    status: 'draft',
    category: NEWS_CATEGORIES[0],
    targetCountries: [],
    title: '',
    summary: '',
    body: '',
    imageAlt: '',
    createdAt: now,
    updatedAt: now,
    createdBy: uid,
    updatedBy: uid,
  };
}

/** True when any English-source field differs between two articles. */
function sourceChanged(a: ManualNewsArticle, b: ManualNewsArticle): boolean {
  const keys: (keyof ManualNewsArticle)[] = [
    'title', 'summary', 'body', 'imageAlt', 'category', 'imageUrl',
    'youtubeVideoId', 'sourceName', 'sourceUrl', 'author', 'publicationDate',
  ];
  if (keys.some(k => (a[k] ?? '') !== (b[k] ?? ''))) return true;
  return JSON.stringify(a.targetCountries ?? []) !== JSON.stringify(b.targetCountries ?? []);
}

type N = typeof ADMIN_I18N['en']['news'];

/* ── status badge ────────────────────────────────────────────────────────── */

function NewsStatusBadge({ a, N }: { a: ManualNewsArticle; N: N }) {
  let label: string, cls: string;
  if (a.status === 'published' && a.translationOutdated) {
    label = N.stOutdated; cls = 'bg-amber-100 text-amber-800 border-amber-200';
  } else if (a.status === 'published') {
    label = N.stPublished; cls = 'bg-green-100 text-green-800 border-green-200';
  } else if (a.status === 'translating') {
    label = N.stTranslating; cls = 'bg-blue-100 text-blue-800 border-blue-200';
  } else if (a.status === 'translation_failed') {
    label = N.stFailed; cls = 'bg-red-100 text-red-800 border-red-200';
  } else {
    label = N.stDraft; cls = 'bg-gray-100 text-gray-700 border-gray-200';
  }
  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full whitespace-nowrap border ${cls}`}>
      {label}
    </span>
  );
}

/* ── confirm modal ───────────────────────────────────────────────────────── */

interface Dialog {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}

function ConfirmModal({ dialog, onClose, cancelLabel }: { dialog: Dialog | null; onClose: () => void; cancelLabel: string }) {
  if (!dialog) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-800">{dialog.title}</h3>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">{dialog.body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
            {cancelLabel}
          </button>
          <button
            onClick={() => { dialog.onConfirm(); onClose(); }}
            className={`px-4 py-2 text-sm font-semibold rounded-lg text-white ${dialog.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── toast ───────────────────────────────────────────────────────────────── */

function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg">
      {msg}
    </div>
  );
}

/* ── main page ───────────────────────────────────────────────────────────── */

type ListFilter = 'all' | 'drafts' | 'published';
type View = 'list' | 'editor' | 'preview';

export const NewsManagementPage: React.FC<{ al: AdminLang }> = ({ al }) => {
  const A = ADMIN_I18N[al];
  const N = A.news;
  const locale = al === 'ko' ? 'ko-KR' : 'en-GB';
  const uid = auth.currentUser?.uid ?? 'admin';

  const [view, setView] = useState<View>('list');
  const [filter, setFilter] = useState<ListFilter>('all');
  const [articles, setArticles] = useState<ManualNewsArticle[] | null>(null);

  // editor state
  const [draft, setDraft] = useState<ManualNewsArticle | null>(null);
  const [original, setOriginal] = useState<ManualNewsArticle | null>(null);
  const [dirty, setDirty] = useState(false);

  // async / feedback state
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);   // in-flight server action guard
  const [busyPhase, setBusyPhase] = useState<string>('');       // "Publishing…" etc.
  const [serverError, setServerError] = useState<{ msg: string; retry: () => void } | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const refresh = useCallback(() => {
    listArticles().then(setArticles).catch(() => setArticles([]));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Unsaved-changes guard (best-effort) — only while editing with pending edits.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (view === 'editor' && dirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [view, dirty]);

  /* ── editor lifecycle ──────────────────────────────────────────────────── */

  const openCreate = () => {
    const d = emptyDraft(uid);
    setDraft(d); setOriginal(null); setDirty(false);
    setValidationErrors([]); setUploadError(null); setServerError(null);
    setView('editor');
  };

  const openEdit = (a: ManualNewsArticle) => {
    setDraft({ ...a }); setOriginal(a); setDirty(false);
    setValidationErrors([]); setUploadError(null); setServerError(null);
    setView('editor');
  };

  const openPreview = (a: ManualNewsArticle) => { setDraft({ ...a }); setView('preview'); };

  const backToList = () => {
    if (view === 'editor' && dirty && !window.confirm(N.unsavedWarn)) return;
    setDraft(null); setOriginal(null); setDirty(false); setServerError(null);
    setView('list');
  };

  /** Update a draft field and flag the editor dirty. */
  const patch = (p: Partial<ManualNewsArticle>) => {
    setDraft(d => (d ? { ...d, ...p } : d));
    setDirty(true);
  };

  /* ── hero image upload ─────────────────────────────────────────────────── */

  const onHeroFile = async (file: File | undefined) => {
    if (!file || !draft) return;
    setUploading(true); setUploadError(null);
    try {
      const { imageUrl, imageStoragePath } = await uploadHeroImage(draft.id, file);
      patch({ imageUrl, imageStoragePath });
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setUploadError(
        code === 'unsupported-format' ? N.upUnsupported :
        code === 'file-too-large' ? N.upTooLarge :
        code === 'encode-failed' || code === 'canvas-unavailable' ? N.upEncode :
        N.upGeneric,
      );
    } finally {
      setUploading(false);
    }
  };

  /* ── YouTube + source URL live validation ──────────────────────────────── */

  const [ytRaw, setYtRaw] = useState('');
  useEffect(() => {
    // seed the raw field when (re)entering the editor
    if (view === 'editor') setYtRaw(draft?.youtubeVideoId ? youTubeWatchUrl(draft.youtubeVideoId) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, draft?.id]);

  const ytId = ytRaw.trim() ? parseYouTubeId(ytRaw) : null;
  const ytInvalid = !!ytRaw.trim() && !ytId;
  useEffect(() => {
    if (!draft) return;
    const next = ytId ?? undefined;
    if (draft.youtubeVideoId !== next) patch({ youtubeVideoId: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytId]);

  const srcInvalid = !!draft?.sourceUrl?.trim() && !safeHttpUrl(draft.sourceUrl);

  /* ── flag warning ──────────────────────────────────────────────────────── */

  const flagWarnCountry = useMemo(() => {
    if (!draft) return null;
    const text = `${draft.imageAlt} ${draft.title} ${draft.body}`;
    const cc = detectFlagCountry(text);
    if (cc && !draft.targetCountries.includes(cc)) return cc;
    return null;
  }, [draft]);

  /* ── target toggles ────────────────────────────────────────────────────── */

  const toggleTarget = (cc: string) => {
    if (!draft) return;
    const has = draft.targetCountries.includes(cc);
    patch({ targetCountries: has ? draft.targetCountries.filter(c => c !== cc) : [...draft.targetCountries, cc] });
  };

  /* ── save draft ────────────────────────────────────────────────────────── */

  const doSaveDraft = async (): Promise<ManualNewsArticle | null> => {
    if (!draft) return null;
    setSaving(true);
    const cc = detectFlagCountry(`${draft.imageAlt} ${draft.title} ${draft.body}`);
    const cleaned: ManualNewsArticle = {
      ...draft,
      title: sanitizeNewsText(draft.title),
      summary: sanitizeNewsText(draft.summary),
      body: sanitizeNewsText(draft.body),
      imageAlt: sanitizeNewsText(draft.imageAlt),
      sourceUrl: draft.sourceUrl ? safeHttpUrl(draft.sourceUrl) : draft.sourceUrl,
      imageFlagCountry: cc,
      updatedAt: new Date().toISOString(),
      updatedBy: uid,
    };
    try {
      await saveDraft(cleaned);
      // Editing a PUBLISHED article's source marks translations outdated; the
      // live version stays until the admin explicitly updates it.
      if (original?.status === 'published' && sourceChanged(cleaned, original)) {
        await markOutdated(cleaned.id, uid);
        cleaned.translationOutdated = true;
      }
      setDraft(cleaned); setOriginal(cleaned); setDirty(false);
      showToast(N.tSaved);
      refresh();
      return cleaned;
    } catch {
      setUploadError(N.upGeneric); // reuse generic error surface
      return null;
    } finally {
      setSaving(false);
    }
  };

  /* ── publish validation ────────────────────────────────────────────────── */

  const validate = (a: ManualNewsArticle): string[] => {
    const missing: string[] = [];
    if (!a.title.trim()) missing.push(N.vTitle);
    if (!a.summary.trim()) missing.push(N.vSummary);
    if (!a.body.trim()) missing.push(N.vBody);
    if (!a.category) missing.push(N.vCategory);
    if (!a.targetCountries.length) missing.push(N.vTargets);
    if (!a.imageUrl) missing.push(N.fHero);
    if (!a.imageAlt.trim()) missing.push(N.vHeroAlt);
    return missing;
  };

  /* ── generic server action runner (publish / unpublish / update / retarget) */

  const runServer = useCallback((
    id: string, phase: string, fn: () => Promise<NewsAdminResult>, successToast: string,
  ) => {
    if (busyId) return; // in-flight guard — prevent double-clicks
    setBusyId(id); setBusyPhase(phase); setServerError(null);
    fn().then(r => {
      if (r.ok) {
        showToast(successToast);
        refresh();
        setView('list');
      } else {
        setServerError({
          msg: N.pubFailed(r.failedStep ?? '', r.failedLocale ?? '') + (r.error ? ` — ${r.error}` : ''),
          retry: () => runServer(id, phase, fn, successToast),
        });
      }
    }).catch(err => {
      setServerError({
        msg: `${N.pubFailed('', '')} ${err instanceof Error ? err.message : ''}`.trim(),
        retry: () => runServer(id, phase, fn, successToast),
      });
    }).finally(() => { setBusyId(null); setBusyPhase(''); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busyId, showToast, refresh, N]);

  /* ── publish (with save + validation + confirm) ────────────────────────── */

  const requestPublish = async (fromEditor: boolean) => {
    if (!draft) return;
    // From the editor, persist the latest edits first so we publish what's shown.
    const target = fromEditor ? (await doSaveDraft()) : draft;
    if (!target) return;
    const missing = validate(target);
    if (missing.length) { setValidationErrors(missing); return; }
    setValidationErrors([]);
    setDialog({
      title: N.cfPublishT, body: N.cfPublishB, confirmLabel: N.actPublish,
      onConfirm: () => runServer(target.id, N.pubPublishing, () => publishArticle(target.id), N.tPublished),
    });
  };

  const requestPublishFromRow = (a: ManualNewsArticle) => {
    const missing = validate(a);
    if (missing.length) {
      // Row publish on an incomplete article: open the editor so it can be fixed.
      openEdit(a); setValidationErrors(missing); return;
    }
    setDialog({
      title: N.cfPublishT, body: N.cfPublishB, confirmLabel: N.actPublish,
      onConfirm: () => runServer(a.id, N.pubPublishing, () => publishArticle(a.id), N.tPublished),
    });
  };

  const requestUnpublish = (a: ManualNewsArticle) => setDialog({
    title: N.cfUnpublishT, body: N.cfUnpublishB, confirmLabel: N.actUnpublish, danger: true,
    onConfirm: () => runServer(a.id, N.pubPublishing, () => unpublishArticle(a.id), N.tUnpublished),
  });

  const requestDelete = (a: ManualNewsArticle) => setDialog({
    title: N.cfDeleteT, body: N.cfDeleteB, confirmLabel: N.actDelete, danger: true,
    onConfirm: () => {
      deleteArticle(a.id).then(() => { showToast(N.tDeleted); refresh(); setView('list'); }).catch(() => {});
    },
  });

  const requestUpdatePublished = () => {
    if (!draft) return;
    setDialog({
      title: N.cfUpdateT, body: N.cfUpdateB, confirmLabel: N.btnUpdatePublished,
      onConfirm: () => runServer(draft.id, N.pubPublishing, () => updatePublishedArticle(draft.id), N.tUpdated),
    });
  };

  const requestRetarget = () => {
    if (!draft || !original) return;
    const live = original.publishedCountries ?? original.targetCountries ?? [];
    const desired = draft.targetCountries;
    const add = desired.filter(c => !live.includes(c));
    const remove = live.filter(c => !desired.includes(c));
    if (!add.length && !remove.length) return;
    setDialog({
      title: N.cfRetargetT, body: N.cfRetargetB, confirmLabel: N.btnApplyTargeting,
      onConfirm: () => runServer(draft.id, N.pubPublishing, async () => {
        // Persist the source (incl. new target list) first, then retarget.
        await doSaveDraft();
        return retargetArticle(draft.id, add, remove);
      }, N.tRetargeted),
    });
  };

  /* ── derived list ──────────────────────────────────────────────────────── */

  const visible = useMemo(() => {
    const all = articles ?? [];
    if (filter === 'drafts') return all.filter(a => a.status !== 'published');
    if (filter === 'published') return all.filter(a => a.status === 'published');
    return all;
  }, [articles, filter]);

  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  /* ── RENDER: preview ───────────────────────────────────────────────────── */

  if (view === 'preview' && draft) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => setView(original ? 'editor' : 'list')} className="text-sm text-blue-600 hover:underline">
            {N.btnBack}
          </button>
          <span className="text-xs font-semibold tracking-wide text-gray-400 uppercase">{N.previewTitle}</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 mx-auto" style={{ maxWidth: 860 }}>
          <div style={{ padding: '36px 48px 56px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: '#0066cc', textTransform: 'uppercase' }}>
              {draft.category}
            </div>
            <h1 style={{ fontFamily: NEWS_SERIF, fontSize: 40, fontWeight: 700, lineHeight: 1.12, letterSpacing: '-0.01em', color: '#1d1d1f', margin: '12px 0 0' }}>
              {draft.title || '—'}
            </h1>
            <p style={{ fontSize: 19, color: '#6e6e73', lineHeight: 1.5, margin: '16px 0 0' }}>{draft.summary}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, flexWrap: 'wrap', fontSize: 13, color: '#7a7a7a' }}>
              {draft.author && <span style={{ fontWeight: 600, color: '#1d1d1f' }}>{draft.author}</span>}
              {draft.author && <span>·</span>}
              <span>{fmtDate(draft.publicationDate ?? draft.updatedAt)}</span>
              {draft.targetCountries.map(cc => (
                <span key={cc} title={NEWS_TARGET_BY_COUNTRY[cc]?.name}>{flagEmoji(cc)}</span>
              ))}
            </div>
            {draft.imageUrl && (
              <img src={draft.imageUrl} alt={draft.imageAlt} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 4, marginTop: 24 }} />
            )}
            {draft.youtubeVideoId && (
              <div style={{ marginTop: 22 }}>
                <VideoExplainer videoId={draft.youtubeVideoId} onUnavailable={() => {}} />
              </div>
            )}
            <div style={{ maxWidth: 700, margin: '30px auto 0', display: 'flex', flexDirection: 'column', gap: 22 }}>
              {draft.body.split(/\n\s*\n/).filter(Boolean).map((para, i) => (
                <p key={i} style={{ fontFamily: NEWS_SERIF, fontSize: 17.5, lineHeight: 1.75, color: '#1d1d1f', margin: 0 }}>{para}</p>
              ))}
              {(draft.sourceName || draft.sourceUrl) && (
                <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: 16, fontSize: 13.5 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: '#7a7a7a', display: 'block', marginBottom: 6 }}>SOURCE</span>
                  {draft.sourceUrl ? (
                    <a href={safeHttpUrl(draft.sourceUrl)} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc' }}>
                      {draft.sourceName || draft.sourceUrl} ›
                    </a>
                  ) : (
                    <span style={{ color: '#1d1d1f' }}>{draft.sourceName}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <Toast msg={toast} />
      </div>
    );
  }

  /* ── RENDER: editor ────────────────────────────────────────────────────── */

  if (view === 'editor' && draft) {
    const isPublished = original?.status === 'published';
    const outdated = isPublished && sourceChanged(draft, original!);
    const label = 'block text-xs font-semibold text-gray-600 mb-1';
    const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400';

    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <button onClick={backToList} className="text-sm text-blue-600 hover:underline">{N.btnBack}</button>
          <NewsStatusBadge a={draft} N={N} />
        </div>
        <PageHeader title={original ? N.edEditTitle : N.edCreateTitle} subtitle={N.edSourceNote} />

        {/* validation + errors */}
        {validationErrors.length > 0 && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
            <div className="font-semibold mb-1">{N.valErrors}</div>
            <ul className="list-disc list-inside">{validationErrors.map(v => <li key={v}>{v}</li>)}</ul>
          </div>
        )}
        {serverError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex items-center justify-between gap-3">
            <span>{serverError.msg}</span>
            <button onClick={serverError.retry} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 whitespace-nowrap">
              {N.actRetry}
            </button>
          </div>
        )}
        {outdated && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            {N.updatedSourceNote}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <SectionCard title={N.secEnglish} icon="📝">
              <div className="space-y-4">
                <div>
                  <label className={label}>{N.fTitle}</label>
                  <input className={input} value={draft.title} onChange={e => patch({ title: e.target.value })} />
                </div>
                <div>
                  <label className={label}>{N.fSummary}</label>
                  <textarea className={input} rows={2} value={draft.summary} onChange={e => patch({ summary: e.target.value })} />
                </div>
                <div>
                  <label className={label}>{N.fBody}</label>
                  <textarea className={`${input} font-mono`} rows={12} value={draft.body} onChange={e => patch({ body: e.target.value })} />
                  <div className="text-xs text-gray-400 mt-1">{N.fBodyHint}</div>
                </div>
                <div>
                  <label className={label}>{N.fCategory}</label>
                  <select className={input} value={draft.category} onChange={e => patch({ category: e.target.value })}>
                    {NEWS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </SectionCard>

            <SectionCard title={N.secMedia} icon="🖼️">
              <div className="space-y-4">
                <div>
                  <label className={label}>{N.fHero}</label>
                  {draft.imageUrl ? (
                    <div className="space-y-2">
                      <img src={draft.imageUrl} alt={draft.imageAlt} className="w-full max-h-56 object-cover rounded-lg border border-gray-200" />
                      <button onClick={() => patch({ imageUrl: undefined, imageStoragePath: undefined })} className="text-xs text-red-600 hover:underline">
                        {N.btnRemoveHero}
                      </button>
                    </div>
                  ) : (
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 cursor-pointer hover:bg-gray-50">
                      {uploading ? N.btnUploading : N.btnUploadHero}
                      <input type="file" accept="image/*" className="hidden" disabled={uploading}
                        onChange={e => onHeroFile(e.target.files?.[0])} />
                    </label>
                  )}
                  {uploadError && <div className="text-xs text-red-600 mt-1">{uploadError}</div>}
                </div>
                <div>
                  <label className={label}>{N.fHeroAlt}</label>
                  <input className={input} value={draft.imageAlt} onChange={e => patch({ imageAlt: e.target.value })} />
                </div>
                {flagWarnCountry && (
                  <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-sm text-yellow-800 flex items-start gap-2">
                    <span>⚠️</span>
                    <span>{N.flagWarn(NEWS_TARGET_BY_COUNTRY[flagWarnCountry]?.name ?? flagWarnCountry)}</span>
                  </div>
                )}
                <div>
                  <label className={label}>{N.fYoutube}</label>
                  <input className={input} value={ytRaw} onChange={e => setYtRaw(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
                  {ytInvalid
                    ? <div className="text-xs text-red-600 mt-1">{N.ytInvalid}</div>
                    : ytId && <div className="text-xs text-green-600 mt-1">{N.ytValid(ytId)}</div>}
                  {ytId && (
                    <div className="mt-3" style={{ maxWidth: 420 }}>
                      <VideoExplainer videoId={ytId} onUnavailable={() => {}} />
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard title={N.secOptional} icon="ℹ️">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={label}>{N.fSource}</label>
                  <input className={input} value={draft.sourceName ?? ''} onChange={e => patch({ sourceName: e.target.value })} />
                </div>
                <div>
                  <label className={label}>{N.fSourceUrl}</label>
                  <input className={input} value={draft.sourceUrl ?? ''} onChange={e => patch({ sourceUrl: e.target.value })} />
                  {srcInvalid && <div className="text-xs text-red-600 mt-1">{N.srcInvalid}</div>}
                </div>
                <div>
                  <label className={label}>{N.fAuthor}</label>
                  <input className={input} value={draft.author ?? ''} onChange={e => patch({ author: e.target.value })} />
                </div>
                <div>
                  <label className={label}>{N.fPubDate}</label>
                  <input type="date" className={input} value={(draft.publicationDate ?? '').slice(0, 10)}
                    onChange={e => patch({ publicationDate: e.target.value })} />
                </div>
              </div>
            </SectionCard>
          </div>

          {/* right rail: targets + actions */}
          <div className="space-y-6">
            <SectionCard title={N.secTargets} icon="🌍">
              <div className="text-xs text-gray-400 mb-3">{N.fTargetsHint}</div>
              <div className="space-y-2">
                {NEWS_TARGETS.map(t => (
                  <label key={t.country} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={draft.targetCountries.includes(t.country)} onChange={() => toggleTarget(t.country)} />
                    <span>{flagEmoji(t.country)} {t.name}</span>
                  </label>
                ))}
              </div>
              {isPublished && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <div className="text-xs text-gray-400 mb-2">{N.targetingNote}</div>
                  <button onClick={requestRetarget} disabled={!!busyId}
                    className="w-full px-3 py-2 rounded-lg border border-blue-300 text-blue-700 text-sm font-medium hover:bg-blue-50 disabled:opacity-50">
                    {N.btnApplyTargeting}
                  </button>
                </div>
              )}
            </SectionCard>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-2 sticky top-4">
              <button onClick={doSaveDraft} disabled={saving || !!busyId}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 disabled:opacity-50">
                {saving ? N.btnSaving : N.btnSaveDraft}
              </button>
              <button onClick={() => setView('preview')}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">
                {N.btnPreview}
              </button>
              {isPublished ? (
                <button onClick={requestUpdatePublished} disabled={!!busyId || !outdated}
                  className="w-full px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                  {busyId === draft.id ? busyPhase : N.btnUpdatePublished}
                </button>
              ) : (
                <button onClick={() => requestPublish(true)} disabled={!!busyId}
                  className="w-full px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                  {busyId === draft.id ? busyPhase : N.btnPublish}
                </button>
              )}
              {isPublished && (
                <button onClick={() => requestUnpublish(draft)} disabled={!!busyId}
                  className="w-full px-4 py-2 rounded-lg text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50">
                  {N.actUnpublish}
                </button>
              )}
            </div>
          </div>
        </div>

        <ConfirmModal dialog={dialog} onClose={() => setDialog(null)} cancelLabel={N.dlgCancel} />
        <Toast msg={toast} />
      </div>
    );
  }

  /* ── RENDER: list ──────────────────────────────────────────────────────── */

  const tab = (id: ListFilter | 'create', label: string) => {
    const active = id === 'create' ? false : filter === id;
    return (
      <button
        key={id}
        onClick={() => id === 'create' ? openCreate() : setFilter(id)}
        className={`px-4 py-2 text-sm font-medium ${
          id === 'create'
            ? 'bg-blue-600 text-white rounded-lg ml-2 hover:bg-blue-700'
            : active ? 'bg-slate-800 text-white' : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div>
      <PageHeader title={N.title} subtitle={N.subtitle} />

      <div className="mb-5 flex items-center">
        <div className="flex rounded-lg overflow-hidden border border-gray-300 bg-white">
          {tab('all', N.tabAll)}
          {tab('drafts', N.tabDrafts)}
          {tab('published', N.tabPublished)}
        </div>
        {tab('create', `＋ ${N.tabCreate}`)}
      </div>

      {serverError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex items-center justify-between gap-3">
          <span>{serverError.msg}</span>
          <button onClick={serverError.retry} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 whitespace-nowrap">
            {N.actRetry}
          </button>
        </div>
      )}

      {articles === null ? (
        <div className="text-sm text-gray-400 py-12 text-center">{N.loading}</div>
      ) : visible.length === 0 ? (
        <EmptyState icon="📰" message={N.emptyList} />
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <th className="px-4 py-3 font-semibold">{N.colTitle}</th>
                <th className="px-4 py-3 font-semibold">{N.colStatus}</th>
                <th className="px-4 py-3 font-semibold">{N.colCreated}</th>
                <th className="px-4 py-3 font-semibold">{N.colPublished}</th>
                <th className="px-4 py-3 font-semibold">{N.colTargets}</th>
                <th className="px-4 py-3 font-semibold text-center">{N.colHero}</th>
                <th className="px-4 py-3 font-semibold text-center">{N.colVideo}</th>
                <th className="px-4 py-3 font-semibold text-right">{N.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(a => {
                const busy = busyId === a.id;
                return (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/60 align-top">
                    <td className="px-4 py-3 max-w-xs">
                      <div className="font-medium text-gray-800 line-clamp-2">{a.title || <span className="text-gray-400">—</span>}</div>
                    </td>
                    <td className="px-4 py-3"><NewsStatusBadge a={a} N={N} /></td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(a.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(a.publishedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {a.targetCountries.length
                          ? a.targetCountries.map(cc => (
                              <span key={cc} title={NEWS_TARGET_BY_COUNTRY[cc]?.name}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-100 text-xs text-gray-600">
                                {flagEmoji(cc)} {cc}
                              </span>
                            ))
                          : <span className="text-gray-300">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">{a.imageUrl ? '✓' : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-center">{a.youtubeVideoId ? '✓' : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                        <button onClick={() => openEdit(a)} className="text-blue-600 hover:underline">{N.actEdit}</button>
                        <button onClick={() => openPreview(a)} className="text-gray-600 hover:underline">{N.actPreview}</button>
                        {a.status === 'published' ? (
                          <button onClick={() => requestUnpublish(a)} disabled={busy} className="text-red-600 hover:underline disabled:opacity-40">
                            {busy ? busyPhase : N.actUnpublish}
                          </button>
                        ) : (
                          <button onClick={() => requestPublishFromRow(a)} disabled={busy} className="text-green-700 hover:underline disabled:opacity-40">
                            {busy ? busyPhase : N.actPublish}
                          </button>
                        )}
                        <button onClick={() => requestDelete(a)} disabled={busy} className="text-gray-400 hover:text-red-600 disabled:opacity-40">{N.actDelete}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal dialog={dialog} onClose={() => setDialog(null)} cancelLabel={N.dlgCancel} />
      <Toast msg={toast} />
    </div>
  );
};
