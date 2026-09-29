/**
 * Account → Branded documents (Premium, 2026-09-29). Logo (downscaled on a
 * canvas, ≤ 600×200 px PNG, ≤ 150 KB), company name and one contact line,
 * saved to `users/{uid}.branding` and printed as the "Prepared by" band on the
 * generated data sheet and comparison PDFs. Standard users see the card locked.
 */
import React, { useEffect, useRef, useState } from 'react';
import { HpApp } from '../../appState';
import { Card, CardTitle } from '../../pages/accountParts';
import { PremiumPill } from '../../Premium';
import { brandingStrings } from './strings';
import { COMPANY_MAX, CONTACT_MAX, saveBranding, savedBranding } from './brandingState';
import { LOGO_ACCEPT, processLogo } from './logoImage';
import { BrandingBandView, LockIcon } from './BrandingBandView';
import type { UserBranding } from '../../../types';

const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1px solid #d2d2d7', borderRadius: 10,
  padding: '9px 12px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit', background: '#fff',
};
const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #d2d2d7', borderRadius: 999,
  padding: '7px 14px', fontSize: 12.5, fontWeight: 600, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap',
};
const label: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: '#555' };

export const BrandingCard: React.FC<{ app: HpApp }> = ({ app }) => {
  const s = brandingStrings(app.lang);
  const { user } = app;
  const saved = savedBranding(user);
  const defaults = (): Omit<UserBranding, 'updatedAt'> => ({
    logo: saved?.logo,
    company: saved?.company ?? user.companyName ?? '',
    contact: saved?.contact ?? [user.email, user.companyWebsite].filter(Boolean).join(' · '),
  });
  const [draft, setDraft] = useState(defaults);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  // Re-seed when the stored branding changes elsewhere (another device / save).
  useEffect(() => { setDraft(defaults()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user.branding?.updatedAt]);

  if (!app.premium) {
    return (
      <Card style={{ gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CardTitle>{s.cardTitle}</CardTitle><PremiumPill app={app} />
        </span>
        <span style={{ fontSize: 13, color: '#555', lineHeight: 1.55 }}>{s.cardIntro}</span>
        <span style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: '#7a7a7a', lineHeight: 1.5 }}>
          <span style={{ marginTop: 1 }}><LockIcon /></span>{s.locked}
        </span>
        <span className="hp-press" data-testid="branding-upsell" onClick={app.upsell} style={{ ...btn, alignSelf: 'flex-start', background: '#1d1d1f', color: '#fff', border: '1px solid #1d1d1f' }}>{s.unlock}</span>
      </Card>
    );
  }

  const dirty = (draft.logo ?? '') !== (saved?.logo ?? '')
    || draft.company !== (saved?.company ?? user.companyName ?? '')
    || draft.contact !== (saved?.contact ?? [user.email, user.companyWebsite].filter(Boolean).join(' · '))
    || !saved;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setErr('');
    try {
      const logo = await processLogo(f);
      setDraft(d => ({ ...d, logo }));
    } catch (e: any) {
      setErr(e?.message === 'type' ? s.badType : e?.message === 'large' ? s.tooLarge : s.readFailed);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async () => {
    setBusy(true); setErr('');
    const next: UserBranding = {
      ...(draft.logo ? { logo: draft.logo } : {}),
      company: (draft.company ?? '').trim().slice(0, COMPANY_MAX),
      contact: (draft.contact ?? '').trim().slice(0, CONTACT_MAX),
      updatedAt: new Date().toISOString(),
    };
    try {
      // Preview mode has no Firestore profile — reflect locally only.
      if (user.id !== 'preview') await saveBranding(user.id, next);
      app.patchUser({ branding: next });
      app.notify(s.saved);
    } catch {
      setErr(s.saveFailed);
    } finally { setBusy(false); }
  };

  const previewBranding = {
    logo: draft.logo, company: draft.company, contact: draft.contact,
    labels: { preparedBy: s.pdfPreparedBy, preparedFor: s.pdfPreparedFor },
  };

  return (
    <Card style={{ gap: 14 }}>
      <div data-testid="branding-card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CardTitle>{s.cardTitle}</CardTitle><PremiumPill app={app} />
        </span>
        <span style={{ fontSize: 13, color: '#555', lineHeight: 1.55 }}>{s.cardIntro}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ width: 168, height: 60, borderRadius: 10, border: '1px dashed #d2d2d7', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', overflow: 'hidden' }}>
          {draft.logo
            ? <img src={draft.logo} alt={s.logo} data-testid="branding-logo" style={{ maxWidth: 152, maxHeight: 48, objectFit: 'contain' }} />
            : <span style={{ fontSize: 11.5, color: '#9a9aa0' }}>{s.logo}</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="hp-press" onClick={() => fileRef.current?.click()} style={btn}>{draft.logo ? s.replace : s.upload}</span>
            {draft.logo && (
              <span className="hp-press" data-testid="branding-remove-logo" onClick={() => setDraft(d => ({ ...d, logo: undefined }))} style={{ ...btn, color: '#b3261e' }}>{s.removeLogo}</span>
            )}
          </span>
          <span style={{ fontSize: 11.5, color: '#7a7a7a' }}>{s.logoHint}</span>
        </div>
        <input ref={fileRef} type="file" accept={LOGO_ACCEPT} data-testid="branding-file" style={{ display: 'none' }} onChange={e => void onFile(e.target.files?.[0])} />
      </div>

      <label style={label}>
        {s.company}
        <input value={draft.company ?? ''} maxLength={COMPANY_MAX} onChange={e => setDraft(d => ({ ...d, company: e.target.value }))} style={input} data-testid="branding-company" />
      </label>
      <label style={label}>
        {s.contact}
        <input value={draft.contact ?? ''} maxLength={CONTACT_MAX} placeholder={s.contactPh} onChange={e => setDraft(d => ({ ...d, contact: e.target.value }))} style={input} data-testid="branding-contact" />
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: '#7a7a7a', textTransform: 'uppercase' }}>{s.preview}</span>
        <div style={{ border: '1px solid #ececf0', borderRadius: 10, padding: 12, background: '#fff' }}>
          <BrandingBandView b={previewBranding} placeholderFor={s.preparedForPh} />
        </div>
      </div>

      {err && <span style={{ fontSize: 12.5, color: '#b3261e' }} role="alert">{err}</span>}
      <span
        className="hp-press"
        data-testid="branding-save"
        onClick={busy || !dirty ? undefined : () => void save()}
        style={{ ...btn, alignSelf: 'flex-start', padding: '9px 20px', fontSize: 13.5, background: '#1d1d1f', color: '#fff', border: '1px solid #1d1d1f', opacity: busy || !dirty ? 0.45 : 1, cursor: busy || !dirty ? 'default' : 'pointer' }}
      >
        {busy ? s.saving : s.save}
      </span>
    </Card>
  );
};
