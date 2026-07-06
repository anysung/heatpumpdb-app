/** News — curated market intelligence (featured card + 3 article cards). */
import React from 'react';
import { HpApp } from '../appState';
import { NewsItem } from '../../types';
import { shortDate } from '../model';
import { FD } from '../ui';

/** Editorial category badge derived from title/summary keywords. */
function categoryOf(item: NewsItem): string {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (/(bafa|kfw|beg|subsidy|funding|grant|zuschuss|förder)/.test(text)) return 'FUNDING';
  if (/(r290|r32|refrigerant|cop|scop|efficiency|innovation|technology)/.test(text)) return 'TECHNOLOGY';
  if (/(install|montage|handwerk|technician)/.test(text)) return 'INSTALLER INSIGHT';
  return 'MARKET';
}

function readTime(item: NewsItem): string {
  const words = `${item.title} ${item.summary}`.split(/\s+/).length;
  return `${Math.max(3, Math.min(8, Math.round(words / 40) + 3))} min`;
}

/** Approved-design editorial content, used when the curated feed is empty. */
const FALLBACK_FEATURED = {
  badge: 'MARKET',
  kicker: 'July 2026 briefing',
  title: 'German heat pump sales up 31% in H1 — R290 monoblocks now half of all new residential installs.',
  dek: 'What the shift means for installer stock planning, and which manufacturers gained BAFA list share this quarter.',
};
const FALLBACK_CARDS = [
  { badge: 'FUNDING', title: 'KfW processing times drop below three weeks', dek: 'Grant 458 commitments accelerated after the June portal update — what it changes for project timelines.', meta: '28 Jun 2026 · 4 min' },
  { badge: 'TECHNOLOGY', title: 'Sound power is the new spec battleground', dek: 'Sub-50 dB(A) units doubled year over year. How noise limits in dense housing are reshaping model lineups.', meta: '19 Jun 2026 · 6 min' },
  { badge: 'INSTALLER INSIGHT', title: 'Hydraulic balancing documentation, done right', dek: 'The proof most often missing from funding files — and a template that passes review the first time.', meta: '7 Jun 2026 · 5 min' },
];

export const NewsPage: React.FC<{ app: HpApp }> = ({ app }) => {
  const feed = app.news;
  const featured = feed[0] ?? null;
  const cards = feed.slice(1, 4);

  const openArticle = (url?: string | null) => {
    if (url) window.open(url, '_blank', 'noopener');
    else app.notify('The full briefing will be published soon — no source link yet.');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 1160, width: '100%', margin: '0 auto', padding: '40px 48px 48px', display: 'flex', flexDirection: 'column', gap: 26, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span style={{ fontFamily: FD, fontSize: 34, fontWeight: 600, letterSpacing: '-0.374px' }}>Market intelligence.</span>
          <span style={{ fontSize: 12.5, color: '#7a7a7a', border: '1px solid #e0e0e0', borderRadius: 999, padding: '4px 13px' }}>Curated · updated 2–3× monthly</span>
        </div>

        {/* featured */}
        <div style={{ background: '#272729', color: '#fff', borderRadius: 18, padding: '34px 36px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.05em', border: '1px solid rgba(255,255,255,.3)', borderRadius: 999, padding: '3px 11px' }}>
              {featured ? categoryOf(featured) : FALLBACK_FEATURED.badge}
            </span>
            <span style={{ fontSize: 12, color: '#ccc' }}>
              {featured ? `${shortDate(featured.date)} briefing` : FALLBACK_FEATURED.kicker}
            </span>
          </div>
          <span style={{ fontFamily: FD, fontSize: 28, fontWeight: 600, letterSpacing: '-0.28px', lineHeight: 1.15, maxWidth: 720 }}>
            {featured ? featured.title : FALLBACK_FEATURED.title}
          </span>
          <span style={{ fontSize: 15, color: '#ccc', lineHeight: 1.55, maxWidth: 680 }}>
            {featured ? featured.summary : FALLBACK_FEATURED.dek}
          </span>
          <span onClick={() => openArticle(featured?.sourceUrl)} style={{ fontSize: 14, color: '#2997ff', cursor: 'pointer' }}>Read the briefing ›</span>
        </div>

        {/* cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {(cards.length ? cards : null)?.map(item => (
            <div key={item.id} onClick={() => openArticle(item.sourceUrl)} style={{ border: '1px solid #e0e0e0', borderRadius: 18, padding: 24, display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer' }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.05em', border: '1px solid #e0e0e0', borderRadius: 999, padding: '3px 11px', width: 'fit-content' }}>{categoryOf(item)}</span>
              <span style={{ fontFamily: FD, fontSize: 18, fontWeight: 600, letterSpacing: '-0.2px', lineHeight: 1.25 }}>{item.title}</span>
              <span style={{ fontSize: 13, color: '#7a7a7a', lineHeight: 1.55 }}>{item.summary}</span>
              <span style={{ fontSize: 12, color: '#7a7a7a', marginTop: 'auto' }}>{shortDate(item.date)} · {readTime(item)}</span>
            </div>
          )) ?? FALLBACK_CARDS.map(card => (
            <div key={card.title} style={{ border: '1px solid #e0e0e0', borderRadius: 18, padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.05em', border: '1px solid #e0e0e0', borderRadius: 999, padding: '3px 11px', width: 'fit-content' }}>{card.badge}</span>
              <span style={{ fontFamily: FD, fontSize: 18, fontWeight: 600, letterSpacing: '-0.2px', lineHeight: 1.25 }}>{card.title}</span>
              <span style={{ fontSize: 13, color: '#7a7a7a', lineHeight: 1.55 }}>{card.dek}</span>
              <span style={{ fontSize: 12, color: '#7a7a7a', marginTop: 'auto' }}>{card.meta}</span>
            </div>
          ))}
        </div>

        {/* subscribe */}
        <div style={{ background: '#f5f5f7', borderRadius: 18, padding: '26px 30px', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 600, letterSpacing: '-0.2px' }}>The monthly briefing, in your inbox.</span>
            <span style={{ fontSize: 13.5, color: '#7a7a7a' }}>One email per month. Funding changes, list updates, market signals. No noise.</span>
          </div>
          <span
            className="hp-press"
            onClick={() => app.notify('The newsletter is launching soon — your account email will be invited first.')}
            style={{ marginLeft: 'auto', background: '#0066cc', color: '#fff', borderRadius: 999, padding: '10px 22px', fontSize: 14, cursor: 'pointer', flex: 'none' }}
          >
            Subscribe ›
          </span>
        </div>
      </div>
    </div>
  );
};
