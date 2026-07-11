/**
 * Compact-device shell (phone + tablet) — a curated subset of the desktop app.
 *
 * Feature matrix (deliberate, per device class):
 *   phone   — bottom tab bar: Search · Products · Funding · News · Account;
 *             product detail as full-screen sheet. Excluded: data-sheet studio,
 *             EU label records, 4-way compare (desktop-only note shown).
 *   tablet  — same feature set, top tab bar, 2-column grids, persistent side
 *             detail panel.
 *   desktop — the full dense UI in HpiqApp.tsx (unchanged).
 */
import React, { useState } from 'react';
import { HpApp, HpPage } from '../appState';
import { tr } from '../i18n';
import { UI_LANGUAGES, FUNDING_SOURCE_LINKS, MARKET_ENTER_URL } from '../market';
import { FD, SignOutIcon, VideoExplainer, sectionLabel } from '../ui';
import { GUIDE_VIDEO_ID } from '../market';
import { BrandLogo, WavingFlag } from '../../components/BrandLogo';
import { NewsItem, Language } from '../../types';
import type { Viewport } from '../useViewport';
import { MobileFind, MobileProducts, MobileDetail } from './MobileCatalog';

type MTab = Extract<HpPage, 'find' | 'products' | 'bafa' | 'news' | 'account'> | 'guide';

/* ── Tiny tab icons (stroke style matching the desktop icon set) ─────────── */

const Ic: React.FC<{ d: string; active: boolean }> = ({ d, active }) => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active ? '#1d1d1f' : '#9a9aa0'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const ICONS: Record<MTab, string> = {
  find: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  products: 'M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z',
  bafa: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v10M9.5 9.5h3.8a1.8 1.8 0 0 1 0 3.6H9.5',
  news: 'M4 4h13v16H4zM17 8h3v12H6M7.5 8h6M7.5 12h6M7.5 16h6',
  guide: 'M4 5h16M4 12h16M4 19h10',
  account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6',
};

/* ── Funding page (t.bafa content, stacked) ──────────────────────────────── */

const MobileFunding: React.FC<{ app: HpApp; goGuide: (tab: 'home' | 'pro') => void }> = ({ app, goGuide }) => {
  const t = tr(app.lang);
  const totalText = app.totalListed ? app.totalListed.toLocaleString(t.locale) : '—';
  const card: React.CSSProperties = { border: '1px solid #e0e0e0', borderRadius: 14, padding: '15px 17px', display: 'flex', flexDirection: 'column', gap: 5, background: '#fff' };
  return (
    <div style={{ padding: '20px 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontFamily: FD, fontSize: 25, fontWeight: 600, letterSpacing: '-0.3px' }}>{t.bafa.heroTitle}</span>
        <span style={{ fontSize: 13.5, color: '#7a7a7a', lineHeight: 1.5 }}>{t.bafa.heroSub}</span>
      </div>

      {[
        [t.bafa.card1Title, t.bafa.card1Head, t.bafa.card1Text],
        [t.bafa.card2Title, t.bafa.card2Head, t.bafa.card2Text],
        [t.bafa.card3Title, t.bafa.card3Head(totalText), t.bafa.card3Text],
      ].map(([title, head, text]) => (
        <div key={title as string} style={card}>
          <span style={sectionLabel}>{title}</span>
          <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 600 }}>{head}</span>
          <span style={{ fontSize: 12.5, color: '#7a7a7a', lineHeight: 1.5 }}>{text}</span>
        </div>
      ))}

      <span style={{ fontFamily: FD, fontSize: 18, fontWeight: 600, paddingTop: 4 }}>{t.bafa.recentChanges}</span>
      <div style={{ border: '1px solid #e0e0e0', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
        {t.bafa.timeline.map((e, i) => (
          <div key={e.date + e.strong} style={{ padding: '13px 16px', display: 'flex', flexDirection: 'column', gap: 5, borderBottom: i < t.bafa.timeline.length - 1 ? '1px solid #f0f0f0' : undefined }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#7a7a7a' }}>{e.date}</span>
              <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.05em', border: '1px solid #e0e0e0', borderRadius: 999, padding: '2px 8px', ...(e.badge === 'GUIDANCE' ? { color: '#7a7a7a' } : {}) }}>
                {e.badge === 'GUIDANCE' ? t.bafa.guidance : t.bafa.confirmed}
              </span>
            </div>
            <span style={{ fontSize: 13, lineHeight: 1.5 }}><strong style={{ fontWeight: 600 }}>{e.strong}</strong>{e.rest}</span>
          </div>
        ))}
      </div>

      <div style={{ ...card, background: '#272729', border: 'none', color: '#fff' }}>
        <span style={{ ...sectionLabel, color: '#ccc' }}>{t.bafa.installerTitle}</span>
        <span style={{ fontSize: 13, lineHeight: 1.55 }}>{t.bafa.installerText}</span>
        <span onClick={() => goGuide('pro')} style={{ fontSize: 13, color: '#2997ff', cursor: 'pointer' }}>{t.bafa.installerLink}</span>
      </div>
      <div style={card}>
        <span style={sectionLabel}>{t.bafa.homeownerTitle}</span>
        <span style={{ fontSize: 13, lineHeight: 1.55 }}>{t.bafa.homeownerText}</span>
        <span onClick={() => goGuide('home')} style={{ fontSize: 13, color: '#0066cc', cursor: 'pointer' }}>{t.bafa.homeownerLink}</span>
      </div>

      <span style={{ fontFamily: FD, fontSize: 18, fontWeight: 600, paddingTop: 4 }}>{t.bafa.sourcesTitle}</span>
      {FUNDING_SOURCE_LINKS.map((s, i) => (
        <div key={s.href} style={card} onClick={() => window.open(s.href, '_blank', 'noopener')}>
          <span style={{ fontWeight: 600, fontSize: 13.5 }}>{t.bafa.sources[i].title}</span>
          <span style={{ fontSize: 11.5, color: '#7a7a7a' }}>{t.bafa.sources[i].sub}</span>
          <span style={{ fontSize: 12.5, color: '#0066cc' }}>{s.link}</span>
        </div>
      ))}
      <span style={{ fontSize: 11, color: '#b6b6bc' }}>{t.bafa.sourcesNote}</span>
    </div>
  );
};

/* ── Guide (steps, checklist, FAQ) ───────────────────────────────────────── */

const MobileGuide: React.FC<{ app: HpApp }> = ({ app }) => {
  const t = tr(app.lang);
  const pro = app.guideTab === 'pro';
  const steps = pro ? t.guide.stepsPro : t.guide.stepsHome;
  const checks = pro ? t.guide.checkPro : t.guide.checkHome;
  return (
    <div style={{ padding: '20px 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <span style={{ fontFamily: FD, fontSize: 25, fontWeight: 600, letterSpacing: '-0.3px' }}>{t.guide.heroTitle}</span>
      <div style={{ display: 'flex', border: '1px solid #d2d2d7', borderRadius: 999, overflow: 'hidden', fontSize: 13, width: 'fit-content' }}>
        {([['home', t.guide.tabHome], ['pro', t.guide.tabPro]] as const).map(([id, label]) => (
          <span key={id} onClick={() => app.setGuideTab(id)} style={{ padding: '8px 16px', cursor: 'pointer', ...(app.guideTab === id ? { background: '#1d1d1f', color: '#fff', fontWeight: 600 } : {}) }}>
            {label}
          </span>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 14, overflow: 'hidden' }}>
        {steps.map(([n, head, text], i) => (
          <div key={n} style={{ display: 'flex', gap: 12, padding: '13px 16px', borderBottom: i < steps.length - 1 ? '1px solid #f0f0f0' : undefined }}>
            <span style={{ flex: 'none', width: 26, height: 26, borderRadius: '50%', background: '#1d1d1f', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 600 }}>{n}</span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{head}</span>
              <span style={{ fontSize: 12, color: '#7a7a7a', lineHeight: 1.5 }}>{text}</span>
            </span>
          </div>
        ))}
      </div>

      <span style={{ fontFamily: FD, fontSize: 18, fontWeight: 600 }}>{t.guide.checklistTitle}</span>
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 14, padding: '6px 16px' }}>
        {checks.map(item => {
          const key = `${app.guideTab}:${item}`;
          const on = !!app.checked[key];
          return (
            <span key={key} onClick={() => app.toggleChecked(key)} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '10px 0', fontSize: 13, lineHeight: 1.45, cursor: 'pointer', color: on ? '#b6b6bc' : '#1d1d1f', textDecoration: on ? 'line-through' : 'none' }}>
              <span style={{ flex: 'none', width: 18, height: 18, marginTop: 1, borderRadius: 5, border: on ? 'none' : '1.5px solid #d2d2d7', background: on ? '#0066cc' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11 }}>{on ? '✓' : ''}</span>
              {item}
            </span>
          );
        })}
      </div>
      <span style={{ fontSize: 11, color: '#b6b6bc' }}>{t.guide.checklistNote}</span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={sectionLabel}>{t.guide.explainer}</span>
        <VideoExplainer videoId={GUIDE_VIDEO_ID} onUnavailable={() => app.notify(t.guide.videoSoon)} />
        <span style={{ fontSize: 12.5, color: '#555', lineHeight: 1.5 }}>{t.guide.explainerText}</span>
      </div>

      <div style={{ background: '#f0f6ff', borderRadius: 14, padding: '13px 16px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={sectionLabel}>{t.guide.goodToKnow}</span>
        <span style={{ fontSize: 12.5, lineHeight: 1.5 }}>{t.guide.goodToKnowText}</span>
        <span onClick={app.goProductsR290} style={{ fontSize: 13, color: '#0066cc', cursor: 'pointer' }}>{t.guide.showR290}</span>
      </div>

      <span style={{ fontFamily: FD, fontSize: 18, fontWeight: 600 }}>{t.guide.faqTitle}</span>
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 14, overflow: 'hidden' }}>
        {t.guide.faqs.map(([q, a], i) => (
          <div key={q} style={{ borderBottom: i < t.guide.faqs.length - 1 ? '1px solid #f0f0f0' : undefined }}>
            <div onClick={() => app.setFaqOpen(app.faqOpen === i ? -1 : i)} style={{ padding: '13px 16px', display: 'flex', justifyContent: 'space-between', gap: 10, cursor: 'pointer' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.4 }}>{q}</span>
              <span style={{ color: '#7a7a7a' }}>{app.faqOpen === i ? '−' : '+'}</span>
            </div>
            {app.faqOpen === i && <div style={{ padding: '0 16px 13px', fontSize: 12.5, color: '#555', lineHeight: 1.55 }}>{a}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── News (list + full-screen reader) ────────────────────────────────────── */

function localized(item: NewsItem, lang: Language): { title: string; summary: string; body: string } {
  if (lang === 'de') return { title: item.title_de ?? item.title, summary: item.summary_de ?? item.summary, body: item.body_de ?? item.body ?? '' };
  if (lang === 'fr') return { title: item.title_fr ?? item.title, summary: item.summary_fr ?? item.summary, body: item.body_fr ?? item.body ?? '' };
  return { title: item.title, summary: item.summary, body: item.body ?? '' };
}

const MobileNews: React.FC<{ app: HpApp }> = ({ app }) => {
  const t = tr(app.lang);
  const [openId, setOpenId] = useState<string | null>(null);
  const items = app.news;
  const open = items.find(n => n.id === openId) ?? null;

  if (open) {
    const loc = localized(open, app.lang);
    return (
      <div style={{ padding: '18px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span onClick={() => setOpenId(null)} style={{ fontSize: 13, color: '#0066cc', cursor: 'pointer' }}>‹ {t.nav.news}</span>
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', color: '#7a7a7a' }}>{t.news.categories[open.category ?? 'MARKET'] ?? open.category}</span>
        <span style={{ fontFamily: FD, fontSize: 22, fontWeight: 600, lineHeight: 1.25, letterSpacing: '-0.24px' }}>{loc.title}</span>
        <span style={{ fontSize: 13.5, color: '#555', lineHeight: 1.55 }}>{loc.summary}</span>
        {open.imageUrl && <img src={open.imageUrl} alt="" style={{ width: '100%', borderRadius: 12 }} />}
        {loc.body.split(/\n\s*\n/).map((p, i) => (
          <p key={i} style={{ fontSize: 14.5, lineHeight: 1.65, margin: 0 }}>{p}</p>
        ))}
        {(open.sources?.length ?? 0) > 0 && (
          <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={sectionLabel}>{t.news.sources}</span>
            {open.sources!.map(s => (
              <span key={s.url} onClick={() => window.open(s.url, '_blank', 'noopener')} style={{ fontSize: 12.5, color: '#0066cc', cursor: 'pointer', overflowWrap: 'anywhere' }}>{s.title}</span>
            ))}
          </div>
        )}
        <span style={{ fontSize: 10.5, color: '#b6b6bc', lineHeight: 1.5 }}>{t.news.editorialNote}</span>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={{ fontFamily: FD, fontSize: 25, fontWeight: 600, letterSpacing: '-0.3px' }}>{t.news.title}</span>
      <span style={{ fontSize: 11.5, color: '#7a7a7a' }}>{t.news.pill}</span>
      {items.length === 0 && (
        <div style={{ border: '1px solid #e0e0e0', borderRadius: 14, padding: '15px 17px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', color: '#7a7a7a' }}>{t.news.fallbackFeatured.kicker}</span>
          <span style={{ fontFamily: FD, fontSize: 17, fontWeight: 600, lineHeight: 1.3 }}>{t.news.fallbackFeatured.title}</span>
          <span style={{ fontSize: 12.5, color: '#7a7a7a', lineHeight: 1.5 }}>{t.news.fallbackFeatured.dek}</span>
          <span style={{ fontSize: 11.5, color: '#b6b6bc' }}>{t.news.notPublished}</span>
        </div>
      )}
      {items.map(n => {
        const loc = localized(n, app.lang);
        return (
          <div key={n.id} onClick={() => setOpenId(n.id)} style={{ border: '1px solid #e0e0e0', borderRadius: 14, background: '#fff', overflow: 'hidden', cursor: 'pointer' }}>
            {n.imageUrl && <img src={n.imageUrl} alt="" style={{ width: '100%', display: 'block', maxHeight: 150, objectFit: 'cover' }} />}
            <div style={{ padding: '13px 16px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.06em', color: '#7a7a7a' }}>{t.news.categories[n.category ?? 'MARKET'] ?? n.category}</span>
              <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>{loc.title}</span>
              <span style={{ fontSize: 12.5, color: '#7a7a7a', lineHeight: 1.5 }}>{loc.summary}</span>
              <span style={{ fontSize: 12.5, color: '#0066cc' }}>{t.news.readBriefing}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ── Account (compact) ───────────────────────────────────────────────────── */

const MobileAccount: React.FC<{ app: HpApp }> = ({ app }) => {
  const t = tr(app.lang);
  const card: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: 14, padding: '15px 17px', display: 'flex', flexDirection: 'column', gap: 8 };
  return (
    <div style={{ padding: '20px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={{ fontFamily: FD, fontSize: 25, fontWeight: 600, letterSpacing: '-0.3px' }}>{t.account.heroTitle}</span>

      <div style={card}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{app.user.firstName} {app.user.lastName}</span>
        <span style={{ fontSize: 12.5, color: '#7a7a7a' }}>{app.user.email}</span>
        <span style={{ fontSize: 11.5, color: '#0a7a43', background: '#e7f6ee', borderRadius: 999, padding: '4px 12px', width: 'fit-content', fontWeight: 600 }}>{t.account.planBadge}</span>
        <span style={{ fontSize: 11.5, color: '#7a7a7a', lineHeight: 1.5 }}>{t.account.planStoreNote}</span>
      </div>

      {UI_LANGUAGES.length > 1 && (
        <div style={card}>
          <span style={sectionLabel}>{t.account.language}</span>
          <div style={{ display: 'flex', border: '1px solid #d2d2d7', borderRadius: 999, overflow: 'hidden', fontSize: 13, width: 'fit-content' }}>
            {(([['fr', 'Français'], ['de', 'Deutsch'], ['en', 'English']] as [Language, string][])
              .filter(([id]) => UI_LANGUAGES.includes(id))).map(([id, label]) => (
              <span key={id} onClick={() => app.setLang(id)} style={{ padding: '8px 16px', cursor: 'pointer', ...(app.lang === id ? { background: '#1d1d1f', color: '#fff', fontWeight: 600 } : {}) }}>
                {label}
              </span>
            ))}
          </div>
          <span style={{ fontSize: 11.5, color: '#7a7a7a' }}>{t.account.languageNote}</span>
        </div>
      )}

      <div style={card}>
        <span style={sectionLabel}>{t.account.web}</span>
        <span style={{ fontSize: 12.5, color: '#555', lineHeight: 1.5 }}>{t.account.webText}</span>
        <span style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12.5, background: '#f5f5f7', borderRadius: 8, padding: '8px 12px', width: 'fit-content' }}>{MARKET_ENTER_URL}</span>
        <span style={{ fontSize: 11.5, color: '#b6b6bc', lineHeight: 1.5 }}>{t.m.desktopNote}</span>
      </div>

      <div style={card}>
        <span style={sectionLabel}>{t.account.support}</span>
        <span style={{ fontSize: 12.5, color: '#555', lineHeight: 1.5 }}>{t.account.supportText}</span>
        <span
          onClick={() => { window.location.href = `mailto:?subject=${encodeURIComponent(t.account.supportSubject)}&body=${encodeURIComponent(t.account.supportBody(app.user.email))}`; }}
          style={{ fontSize: 13, color: '#0066cc', cursor: 'pointer' }}
        >
          {t.account.contactSupport}
        </span>
      </div>

      <span
        className="hp-press"
        onClick={app.onLogout}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px solid #d2d2d7', borderRadius: 999, padding: '12px 0', fontSize: 14, cursor: 'pointer', background: '#fff' }}
      >
        <SignOutIcon />
        {t.nav.signOut}
      </span>

      {/* ── Database rights / legal notice ── */}
      <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: '#7a7a7a', textTransform: 'uppercase' }}>{t.account.legalNoticeTitle}</span>
        <p style={{ fontSize: 10.5, color: '#9a9aa0', lineHeight: 1.6, margin: 0 }}>{t.account.legalNotice}</p>
        <span style={{ fontSize: 10.5, color: '#9a9aa0' }}>{t.footer.copyright(new Date().getFullYear())}</span>
      </div>
    </div>
  );
};

/* ── Shell ───────────────────────────────────────────────────────────────── */

export const MobileApp: React.FC<{ app: HpApp; viewport: Viewport }> = ({ app, viewport }) => {
  const t = tr(app.lang);
  const [detailOpen, setDetailOpen] = useState(false);

  // Map any desktop-only page state onto the mobile tab set.
  const MOBILE_TABS: MTab[] = ['find', 'products', 'bafa', 'news', 'account'];
  const page: MTab = (MOBILE_TABS as string[]).includes(app.page) || app.page === 'guide' ? (app.page as MTab) : 'find';
  const tabLabel: Record<MTab, string> = {
    find: t.m.tabSearch, products: t.products.title, bafa: t.m.tabFunding, news: t.nav.news, guide: t.nav.guide, account: t.nav.account,
  };

  const openProduct = (id: string) => {
    app.setSelectedId(id);
    if (viewport === 'phone') setDetailOpen(true);
    else app.go('products');
  };
  const sel = app.selectedId && app.store ? app.store.byId.get(app.selectedId) ?? null : null;

  const isTablet = viewport === 'tablet';

  return (
    <div className="hpiq-root" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f7' }}>
      {/* header */}
      <div style={{ background: '#000', color: '#fff', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 52, flex: 'none' }}>
        <BrandLogo height={24} theme="dark" />
        <WavingFlag height={20} />
        {isTablet && (
          <div style={{ display: 'flex', gap: 3, fontSize: 13, marginLeft: 10, overflowX: 'auto' }}>
            {(['find', 'products', 'bafa', 'guide', 'news'] as MTab[]).map(id => (
              <span key={id} onClick={() => { app.go(id as HpPage); }} style={{ padding: '6px 12px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap', ...(page === id ? { color: '#fff', fontWeight: 600, background: 'rgba(255,255,255,.12)' } : { color: 'rgba(255,255,255,.65)' }) }}>
                {tabLabel[id]}
              </span>
            ))}
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {UI_LANGUAGES.length > 1 && (
            <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,.3)', borderRadius: 999, overflow: 'hidden', fontSize: 11.5 }}>
              {UI_LANGUAGES.map(l => (
                <span key={l} onClick={() => app.setLang(l)} style={{ padding: '5px 10px', cursor: 'pointer', ...(app.lang === l ? { background: '#fff', color: '#1d1d1f', fontWeight: 600 } : { color: 'rgba(255,255,255,.75)' }) }}>
                  {l.toUpperCase()}
                </span>
              ))}
            </div>
          )}
          {isTablet && (
            <span onClick={() => app.go('account')} style={{ width: 26, height: 26, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, cursor: 'pointer', background: page === 'account' ? '#fff' : '#2a2a2c', color: page === 'account' ? '#1d1d1f' : '#fff', border: '1px solid rgba(255,255,255,.25)' }}>
              {(((app.user.firstName?.[0] ?? '') + (app.user.lastName?.[0] ?? '')) || app.user.email?.[0] || 'U').toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: page === 'products' ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column', maxWidth: isTablet ? 1100 : undefined, width: '100%', margin: '0 auto' }}>
        {page === 'find' && <MobileFind app={app} viewport={viewport} onOpen={openProduct} />}
        {page === 'products' && <MobileProducts app={app} viewport={viewport} onOpen={openProduct} />}
        {page === 'bafa' && <MobileFunding app={app} goGuide={tab => { app.setGuideTab(tab); app.go('guide'); }} />}
        {page === 'guide' && <MobileGuide app={app} />}
        {page === 'news' && <MobileNews app={app} />}
        {page === 'account' && <MobileAccount app={app} />}
      </div>

      {/* phone: full-screen detail sheet */}
      {viewport === 'phone' && detailOpen && sel && (
        <MobileDetail app={app} v={sel} viewport="phone" onClose={() => setDetailOpen(false)} />
      )}

      {/* phone: bottom tab bar */}
      {viewport === 'phone' && (
        <div style={{ flex: 'none', display: 'flex', background: 'rgba(255,255,255,.96)', borderTop: '1px solid rgba(0,0,0,.1)', paddingBottom: 'env(safe-area-inset-bottom)', zIndex: 85, position: 'relative' }}>
          {(['find', 'products', 'bafa', 'news', 'account'] as MTab[]).map(id => {
            const active = page === id || (id === 'bafa' && page === 'guide');
            return (
              <span key={id} onClick={() => { setDetailOpen(false); app.go(id as HpPage); }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 0 7px', cursor: 'pointer' }}>
                <Ic d={ICONS[id]} active={active} />
                <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, color: active ? '#1d1d1f' : '#9a9aa0' }}>{tabLabel[id]}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};
