/** News — curated market intelligence (featured card + 3 article cards).
 *  Original HeatpumpIQ editorial articles (item.original) open in an in-app
 *  reader modal with the full body and cited sources; aggregated items link out. */
import React, { useEffect, useState } from 'react';
import { HpApp } from '../appState';
import { NewsItem } from '../../types';
import { shortDate } from '../model';
import { tr } from '../i18n';
import { FD } from '../ui';

/** Editorial category badge — explicit category field first, keyword fallback. */
function categoryOf(item: NewsItem): string {
  if (item.category) return item.category;
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (/(bafa|kfw|beg|subsidy|funding|grant|zuschuss|förder)/.test(text)) return 'FUNDING';
  if (/(r290|r32|refrigerant|cop|scop|efficiency|innovation|technology)/.test(text)) return 'TECHNOLOGY';
  if (/(install|montage|handwerk|technician)/.test(text)) return 'INSTALLER INSIGHT';
  return 'MARKET';
}

/** Pick the stored translation of an article for the active language.
 *  Articles are generated bilingually (title/summary/body + *_de fields);
 *  falls back to English when a German field is missing. */
function localized(item: NewsItem, lang: string): { title: string; summary: string; body: string } {
  if (lang === 'de') {
    return {
      title: item.title_de ?? item.title,
      summary: item.summary_de ?? item.summary,
      body: item.body_de ?? item.body ?? '',
    };
  }
  return { title: item.title, summary: item.summary, body: item.body ?? '' };
}

function readTime(item: NewsItem, unit: string): string {
  const words = `${item.title} ${item.summary} ${item.body ?? ''}`.split(/\s+/).length;
  return `${Math.max(3, Math.min(8, Math.round(words / 120) + 2))} ${unit}`;
}

export const NewsPage: React.FC<{ app: HpApp }> = ({ app }) => {
  const t = tr(app.lang);
  const feed = app.news;
  const featured = feed[0] ?? null;
  const cards = feed.slice(1, 4);
  const [reader, setReader] = useState<NewsItem | null>(null);

  useEffect(() => {
    if (!reader) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setReader(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reader]);

  const openArticle = (item?: NewsItem | null) => {
    if (!item) { app.notify(t.news.notPublished); return; }
    if (item.body) { setReader(item); return; }               // original article → in-app reader
    if (item.sourceUrl) { window.open(item.sourceUrl, '_blank', 'noopener'); return; }
    app.notify(t.news.noLink);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 1160, width: '100%', margin: '0 auto', padding: '40px 48px 48px', display: 'flex', flexDirection: 'column', gap: 26, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span style={{ fontFamily: FD, fontSize: 34, fontWeight: 600, letterSpacing: '-0.374px' }}>{t.news.title}</span>
          <span style={{ fontSize: 12.5, color: '#7a7a7a', border: '1px solid #e0e0e0', borderRadius: 999, padding: '4px 13px' }}>{t.news.pill}</span>
        </div>

        {/* featured */}
        <div style={{ background: '#272729', color: '#fff', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {featured?.imageUrl && (
            <img src={featured.imageUrl} alt="" style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block' }} />
          )}
          <div style={{ padding: '30px 36px 34px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.05em', border: '1px solid rgba(255,255,255,.3)', borderRadius: 999, padding: '3px 11px' }}>
                {featured ? (t.news.categories[categoryOf(featured)] ?? categoryOf(featured)) : (t.news.categories[t.news.fallbackFeatured.badge] ?? t.news.fallbackFeatured.badge)}
              </span>
              <span style={{ fontSize: 12, color: '#ccc' }}>
                {featured ? `${shortDate(featured.date, t.locale)} ${t.news.briefing}${featured.author ? ` · ${featured.author}` : ''}` : t.news.fallbackFeatured.kicker}
              </span>
            </div>
            <span style={{ fontFamily: FD, fontSize: 28, fontWeight: 600, letterSpacing: '-0.28px', lineHeight: 1.15, maxWidth: 720 }}>
              {featured ? localized(featured, app.lang).title : t.news.fallbackFeatured.title}
            </span>
            <span style={{ fontSize: 15, color: '#ccc', lineHeight: 1.55, maxWidth: 680 }}>
              {featured ? localized(featured, app.lang).summary : t.news.fallbackFeatured.dek}
            </span>
            <span onClick={() => openArticle(featured)} style={{ fontSize: 14, color: '#2997ff', cursor: 'pointer' }}>{t.news.readBriefing}</span>
          </div>
        </div>

        {/* cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {(cards.length ? cards : null)?.map(item => (
            <div key={item.id} onClick={() => openArticle(item)} style={{ border: '1px solid #e0e0e0', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer', background: '#fff' }}>
              {item.imageUrl && <img src={item.imageUrl} alt="" style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />}
              <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.05em', border: '1px solid #e0e0e0', borderRadius: 999, padding: '3px 11px', width: 'fit-content' }}>{t.news.categories[categoryOf(item)] ?? categoryOf(item)}</span>
                <span style={{ fontFamily: FD, fontSize: 18, fontWeight: 600, letterSpacing: '-0.2px', lineHeight: 1.25 }}>{localized(item, app.lang).title}</span>
                <span style={{ fontSize: 13, color: '#7a7a7a', lineHeight: 1.55 }}>{localized(item, app.lang).summary}</span>
                <span style={{ fontSize: 12, color: '#7a7a7a', marginTop: 'auto' }}>{shortDate(item.date, t.locale)} · {readTime(item, t.news.minRead)}</span>
              </div>
            </div>
          )) ?? t.news.fallbackCards.map(card => (
            <div key={card.title} style={{ border: '1px solid #e0e0e0', borderRadius: 18, padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.05em', border: '1px solid #e0e0e0', borderRadius: 999, padding: '3px 11px', width: 'fit-content' }}>{t.news.categories[card.badge] ?? card.badge}</span>
              <span style={{ fontFamily: FD, fontSize: 18, fontWeight: 600, letterSpacing: '-0.2px', lineHeight: 1.25 }}>{card.title}</span>
              <span style={{ fontSize: 13, color: '#7a7a7a', lineHeight: 1.55 }}>{card.dek}</span>
              <span style={{ fontSize: 12, color: '#7a7a7a', marginTop: 'auto' }}>{card.meta}</span>
            </div>
          ))}
        </div>

        {/* subscribe */}
        <div style={{ background: '#f5f5f7', borderRadius: 18, padding: '26px 30px', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 600, letterSpacing: '-0.2px' }}>{t.news.subTitle}</span>
            <span style={{ fontSize: 13.5, color: '#7a7a7a' }}>{t.news.subText}</span>
          </div>
          <span
            className="hp-press"
            onClick={() => app.notify(t.news.subscribeSoon)}
            style={{ marginLeft: 'auto', background: '#0066cc', color: '#fff', borderRadius: 999, padding: '10px 22px', fontSize: 14, cursor: 'pointer', flex: 'none' }}
          >
            {t.news.subscribe}
          </span>
        </div>
      </div>

      {/* ── Article reader modal (original HeatpumpIQ articles) ── */}
      {reader && (
        <div
          onClick={() => setReader(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 18, width: 'min(760px, 100%)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.28)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 22px', borderBottom: '1px solid #e0e0e0', flex: 'none' }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.05em', border: '1px solid #e0e0e0', borderRadius: 999, padding: '3px 11px' }}>{t.news.categories[categoryOf(reader)] ?? categoryOf(reader)}</span>
              <span style={{ fontSize: 12, color: '#7a7a7a' }}>{shortDate(reader.date, t.locale)} · {reader.author ?? 'HeatpumpIQ Editorial'}</span>
              <span
                className="hp-press"
                onClick={() => setReader(null)}
                style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, background: '#1d1d1f', color: '#fff', borderRadius: 999, padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                {t.news.close}
              </span>
            </div>
            <div style={{ overflow: 'auto' }}>
              {reader.imageUrl && <img src={reader.imageUrl} alt="" style={{ width: '100%', height: 190, objectFit: 'cover', display: 'block' }} />}
              <div style={{ padding: '26px 32px 30px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <span style={{ fontFamily: FD, fontSize: 26, fontWeight: 600, letterSpacing: '-0.28px', lineHeight: 1.2 }}>{localized(reader, app.lang).title}</span>
                <span style={{ fontSize: 15, color: '#7a7a7a', lineHeight: 1.55 }}>{localized(reader, app.lang).summary}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {localized(reader, app.lang).body.split(/\n{2,}/).map((para, i) => (
                    <span key={i} style={{ fontSize: 14.5, lineHeight: 1.7, color: '#1d1d1f' }}>{para}</span>
                  ))}
                </div>
                {!!reader.sources?.length && (
                  <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: '#7a7a7a' }}>{t.news.sources}</span>
                    {reader.sources.map(s => (
                      <span
                        key={s.url}
                        onClick={() => window.open(s.url, '_blank', 'noopener')}
                        style={{ fontSize: 13, color: '#0066cc', cursor: 'pointer' }}
                      >
                        {s.title} ›
                      </span>
                    ))}
                  </div>
                )}
                <span style={{ fontSize: 11.5, color: '#7a7a7a', lineHeight: 1.5, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                  {t.news.editorialNote}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
