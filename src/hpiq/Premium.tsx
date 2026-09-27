/**
 * Free + Premium program (owner, 2026-09-27) — the shared UI pieces.
 *
 *  · UpsellModal — the one upgrade prompt. Every Premium-only action (compare,
 *    commercial range, PDF / print, a Premium Special Report) opens THIS, so
 *    the offer reads the same everywhere and there is one place to change it.
 *  · DataNotice — the small data-protection line under every data view and
 *    in the footer. It is a deterrent, and it is also accurate: datasets
 *    travel over TLS from an auth-gated bucket, and the canary records are an
 *    unauthorised-use detection system. Never name or describe the canaries.
 *
 * The UI here is UX only. What a Free account can actually read is decided
 * server-side (basic vs full dataset objects, storage/firestore rules).
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HpApp } from './appState';
import { tr } from './i18n';
import { FD } from './ui';

export const UpsellModal: React.FC<{ app: HpApp; onClose: () => void }> = ({ app, onClose }) => {
  const t = tr(app.lang).tier;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="hpiq-root"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        data-testid="upsell-modal"
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 20, padding: '26px 26px 22px', maxWidth: 460, width: '100%', boxSizing: 'border-box', boxShadow: '0 20px 50px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <span style={{ alignSelf: 'flex-start', fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', color: '#0a6847', background: '#e8f5ee', borderRadius: 999, padding: '4px 11px', textTransform: 'uppercase' }}>
          {t.premium}
        </span>
        <span style={{ fontFamily: FD, fontSize: 21, fontWeight: 700, color: '#1d1d1f' }}>{t.lockTitle}</span>
        <span style={{ fontSize: 14, color: '#3a3a3c', lineHeight: 1.55 }}>{t.lockBody}</span>
        <ul style={{ listStyle: 'none', margin: '2px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {t.benefits.map(b => (
            <li key={b} style={{ display: 'flex', gap: 9, fontSize: 13.5, color: '#1d1d1f', lineHeight: 1.45 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0a6847" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', marginTop: 1 }}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              {b}
            </li>
          ))}
        </ul>
        <span style={{ fontSize: 13, color: '#6e6e73', marginTop: 2 }}>{t.price}</span>
        <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
          <span
            className="hp-press"
            data-testid="upsell-cta"
            onClick={() => { onClose(); app.go('upgrade'); }}
            style={{ flex: '1 1 200px', textAlign: 'center', borderRadius: 999, padding: '12px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', background: '#0071e3', color: '#fff' }}
          >
            {t.cta}
          </span>
          <span
            className="hp-press"
            onClick={onClose}
            style={{ flex: '0 1 auto', textAlign: 'center', border: '1px solid #d2d2d7', borderRadius: 999, padding: '12px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#1d1d1f' }}
          >
            {t.later}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/** Small "Premium" pill used on locked controls (segment tab, compare, buttons). */
export const PremiumPill: React.FC<{ app: HpApp; style?: React.CSSProperties }> = ({ app, style }) => (
  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.04em', color: '#0a6847', background: '#e8f5ee', borderRadius: 999, padding: '2px 7px', marginLeft: 6, verticalAlign: 'middle', textTransform: 'uppercase', ...style }}>
    {tr(app.lang).tier.premium}
  </span>
);

/** The data-protection line under data views and in the footer. */
export const DataNotice: React.FC<{ app: HpApp; style?: React.CSSProperties; dark?: boolean }> = ({ app, style, dark }) => (
  <div
    data-testid="data-notice"
    style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, lineHeight: 1.45, color: dark ? 'rgba(255,255,255,.55)' : '#9a9aa0', ...style }}
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', marginTop: 1 }}>
      <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />
    </svg>
    <span>{tr(app.lang).tier.notice}</span>
  </div>
);

/**
 * Trial welcome notice (owner, 2026-09-28). Shown ONCE per account (per
 * device) to every account in its Premium trial — at signup this is the
 * written notice of what was activated, until when, and that Standard stays
 * free afterwards with nothing charged automatically. The welcome MAIL
 * (billing function finalizeSignup) carries the same notice by email.
 */
export const WelcomeTrialModal: React.FC<{ app: HpApp; trialEndsMs: number; onClose: () => void }> = ({ app, trialEndsMs, onClose }) => {
  const t = tr(app.lang);
  const end = new Date(trialEndsMs).toLocaleDateString(t.locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const [l1, l2, l3] = t.tier.welcomeLines(end);
  return createPortal(
    <div className="hpiq-root" style={{ position: 'fixed', inset: 0, zIndex: 420, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div data-testid="trial-welcome" style={{ background: '#fff', borderRadius: 22, maxWidth: 470, width: '100%', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
        <div style={{ background: 'linear-gradient(135deg, #0a6847 0%, #0f8a5f 45%, #1fb57a 100%)', color: '#fff', padding: '26px 26px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 'none', width: 64, height: 64, borderRadius: 18, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: FD, fontSize: 26, fontWeight: 800, lineHeight: 1 }}>15</span>
            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', marginTop: 2 }}>{t.tier.premium.toUpperCase()}</span>
          </div>
          <span style={{ fontFamily: FD, fontSize: 21, fontWeight: 700, lineHeight: 1.25 }}>{t.tier.welcomeTitle}</span>
        </div>
        <div style={{ padding: '20px 26px 22px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          <span style={{ fontSize: 15.5, fontWeight: 650, color: '#1d1d1f' }}>{l1}</span>
          <span style={{ fontSize: 14, color: '#3a3a3c', lineHeight: 1.6 }}>{l2}</span>
          <span style={{ fontSize: 14, color: '#3a3a3c', lineHeight: 1.6 }}>{l3}</span>
          <span className="hp-press" data-testid="trial-welcome-ok" onClick={onClose}
            style={{ marginTop: 6, textAlign: 'center', borderRadius: 999, padding: '12px 18px', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', background: '#0071e3', color: '#fff' }}>
            {t.tier.welcomeOk}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/** Account-page pointer to the Upgrade page (it replaced "Choose your plan"). */
export const UpgradePromoCard: React.FC<{ app: HpApp; compact?: boolean }> = ({ app, compact }) => {
  const t = tr(app.lang);
  return (
    <div
      data-testid="upgrade-promo"
      className="hp-up-hero"
      style={{ borderRadius: 18, padding: compact ? '18px 16px' : '24px 26px', color: '#fff', display: 'flex', flexDirection: compact ? 'column' : 'row', alignItems: compact ? 'stretch' : 'center', gap: 16, justifyContent: 'space-between' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#86efac' }}>{t.up.heroEyebrow}</span>
        <span style={{ fontFamily: FD, fontSize: compact ? 18 : 21, fontWeight: 700, lineHeight: 1.25 }}>{t.up.heroTitle}</span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', lineHeight: 1.55 }}>{t.tier.price}</span>
      </div>
      <span
        className="hp-press hp-up-cta"
        onClick={() => app.go('upgrade')}
        style={{ flex: 'none', textAlign: 'center', borderRadius: 999, padding: '12px 22px', fontSize: 14, fontWeight: 800, cursor: 'pointer', background: 'linear-gradient(90deg,#22c55e 0%,#10b981 40%,#06b6d4 100%)', color: '#04120c', whiteSpace: 'nowrap' }}
      >
        {t.up.bottomCta} ›
      </span>
    </div>
  );
};
