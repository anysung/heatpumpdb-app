/**
 * BulkMemberEmail — one message to a named audience.
 *
 * The console never hands the server a list of addresses. It names an
 * AUDIENCE ("opted in to product news", "all active accounts") and the server
 * resolves that rule against the accounts, so a browser cannot mail anyone the
 * rule excludes — suspended, deleted, or without a usable address.
 *
 * Three deliberate frictions, because a bulk send cannot be recalled:
 *   1. the count and the exclusions are shown BEFORE the composer will send,
 *      and the same count travels with the run — a list that changed while the
 *      message was being written is a refusal, not a surprise;
 *   2. the confirm dialog asks for the recipient COUNT to be typed, not "OK";
 *   3. the run is sent in chunks under one batch id, so a dropped call is a
 *      retry rather than a second copy in someone's inbox.
 *
 * Marketing (kind = announcement) reaches only the accounts that ticked the
 * product-news box at signup and carries an unsubscribe route; the other
 * audiences are for service messages about the member's own account.
 */
import React, { useEffect, useState } from 'react';
import {
  previewBulkAudience, sendBulkChunk, newBatchId,
  BULK_AUDIENCES, BULK_EMAIL_KINDS,
  type BulkAudience, type BulkAudiencePreview, type MemberEmailKind,
} from '../../services/memberMailService';
import { COUNTRY_PROFILES } from '../../config/countryProfiles';
import { AdminLang, ADMIN_I18N } from './adminI18n';

interface Props {
  al: AdminLang;
  /** Pre-selected market when opened from a market workspace. */
  country?: string;
  onClose: () => void;
}

export const BulkMemberEmail: React.FC<Props> = ({ al, country, onClose }) => {
  const A = ADMIN_I18N[al];
  const [audience, setAudience] = useState<BulkAudience>('marketing');
  const [market, setMarket] = useState<string>(country ?? '');
  const [kind, setKind] = useState<MemberEmailKind>('announcement');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audienceInfo, setAudienceInfo] = useState<BulkAudiencePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
  const [msg, setMsg] = useState('');
  const [failedEmails, setFailedEmails] = useState<string[]>([]);

  // The count is never cached across a change of audience or market: an
  // operator must be looking at the number that will actually be mailed.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setAudienceInfo(null);
    previewBulkAudience(audience, market || undefined)
      .then(r => { if (!cancelled) setAudienceInfo(r); })
      .catch(e => { if (!cancelled) setMsg(String(e?.message ?? e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [audience, market]);

  const count = audienceInfo?.count ?? 0;
  const ready = count > 0 && subject.trim().length >= 3 && body.trim().length >= 10 && !busy;

  const run = async () => {
    if (!audienceInfo) return;
    const typed = prompt(A.bkConfirm(count, subject.trim()), '');
    if (typed === null) return;
    if (typed.trim() !== String(count)) { setMsg(A.bkConfirmNum); return; }

    setBusy(true); setMsg(''); setFailedEmails([]);
    const batchId = newBatchId();
    let sentTotal = 0, failedTotal = 0;
    setProgress({ sent: 0, total: count });
    try {
      for (;;) {
        const r = await sendBulkChunk({
          audience, country: market || undefined, subject: subject.trim(),
          body: body.trim(), kind, batchId, expectedCount: count,
        });
        sentTotal += r.sent; failedTotal += r.failed;
        setProgress({ sent: sentTotal + failedTotal, total: r.total });
        if (r.done) { setFailedEmails(r.failedEmails ?? []); break; }
      }
      setMsg(A.bkDone(sentTotal, failedTotal));
    } catch (e: any) {
      const err = String(e?.message ?? e);
      setMsg(
        err === 'audience-changed' ? A.bkChanged
          : err === 'no-recipients' ? A.bkNoRecipients
            : err === 'audience-too-large' ? A.bkTooLarge
              : err === 'smtp-not-configured' ? A.meNotConfigured
                : `${A.meFailed} ${err}`,
      );
    } finally { setBusy(false); }
  };

  const sk = audienceInfo?.skipped;
  const AUD_LABEL: Record<BulkAudience, string> = {
    marketing: A.bkAud_marketing, active: A.bkAud_active,
    trialing: A.bkAud_trialing, pending: A.bkAud_pending,
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-6 overflow-auto">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-3xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="font-bold text-gray-800">{A.bkTitle}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Audience */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs font-bold text-gray-500 uppercase">
              {A.bkAudience}
              <select
                value={audience} onChange={e => setAudience(e.target.value as BulkAudience)}
                className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white font-normal normal-case text-gray-800"
              >
                {BULK_AUDIENCES.map(a => (
                  <option key={a} value={a}>{AUD_LABEL[a]}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-gray-500 uppercase">
              {A.bkMarket}
              <select
                value={market} onChange={e => setMarket(e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white font-normal normal-case text-gray-800"
              >
                <option value="">{A.bkMarketAll}</option>
                {Object.keys(COUNTRY_PROFILES).map(cc => <option key={cc} value={cc}>{cc}</option>)}
              </select>
            </label>
          </div>

          {/* What that audience resolves to right now */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
            {loading ? (
              <span className="text-gray-500">…</span>
            ) : audienceInfo ? (
              <>
                <div className="font-bold text-gray-800">{A.bkRecipients(count)}</div>
                {sk && (
                  <div className="text-xs text-gray-500 mt-1">
                    {A.bkSkipped}: {sk.notInAudience} {A.bkSkNotInAudience}
                    {audience === 'marketing' ? ` · ${sk.noConsent} ${A.bkSkNoConsent}` : ''}
                    {sk.noEmail ? ` · ${sk.noEmail} ${A.bkSkNoEmail}` : ''}
                    {sk.duplicate ? ` · ${sk.duplicate} ${A.bkSkDuplicate}` : ''}
                    {sk.otherMarket ? ` · ${sk.otherMarket} ${A.bkSkOtherMarket}` : ''}
                  </div>
                )}
                {audienceInfo.sample.length > 0 && (
                  <div className="text-xs text-gray-400 mt-1 truncate">
                    {A.bkSample}: {audienceInfo.sample.slice(0, 6).join(', ')}
                    {count > 6 ? ' …' : ''}
                  </div>
                )}
              </>
            ) : null}
          </div>

          <p className="text-xs text-gray-500 leading-relaxed">{A.bkConsentNote}</p>

          {/* Message */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-3">
            <label className="text-xs font-bold text-gray-500 uppercase">
              {A.meSubject}
              <input
                value={subject} onChange={e => setSubject(e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded-lg text-sm font-normal normal-case text-gray-800"
              />
            </label>
            <label className="text-xs font-bold text-gray-500 uppercase">
              {A.meKind}
              <select
                value={kind} onChange={e => setKind(e.target.value as MemberEmailKind)}
                className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white font-normal normal-case text-gray-800"
              >
                {BULK_EMAIL_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
          </div>

          <label className="block text-xs font-bold text-gray-500 uppercase">
            {A.meBody}
            <textarea
              value={body} onChange={e => setBody(e.target.value)}
              rows={10}
              className="mt-1 w-full px-3 py-2 border rounded-lg text-sm font-normal normal-case text-gray-800 resize-y"
            />
          </label>
          <p className="text-xs text-gray-500">{A.bkPlaceholders}</p>
          <p className="text-xs text-gray-500">{A.meHint}</p>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">{A.bkTestFirst}</p>

          {progress && (
            <div className="text-sm text-gray-700">
              {progress.sent >= progress.total ? null : A.bkProgress(progress.sent, progress.total)}
              <div className="h-1.5 bg-gray-200 rounded mt-1 overflow-hidden">
                <div className="h-full bg-blue-600 transition-all"
                  style={{ width: `${Math.round((progress.sent / Math.max(progress.total, 1)) * 100)}%` }} />
              </div>
            </div>
          )}
          {msg && <div className="text-sm font-medium text-gray-800">{msg}</div>}
          {failedEmails.length > 0 && (
            <div className="text-xs text-red-700">
              {A.bkFailedList} {failedEmails.join(', ')}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
            {A.cCancel}
          </button>
          <button
            onClick={run} disabled={!ready}
            className="px-4 py-2 text-sm font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300"
          >
            {busy ? A.meSending : A.bkSend}
          </button>
        </div>
      </div>
    </div>
  );
};
