/**
 * Special Report — the monthly European report as its own destination
 * (owner, 2026-09-27). Until then it rode the top of the News feed as a pinned
 * announcement; News now leaves those announcements out (isSpecialReportItem)
 * and this page is where the report lives in the app.
 *
 * One content source, two surfaces: scripts/build-special-report.mjs writes the
 * public /special-report/ pages AND /special-report/feed.json, which this page
 * renders natively — the same pattern as Market & Trends. The report itself is
 * the owner's self-contained interactive HTML; we open or download it as is,
 * never re-render it.
 *
 * Tiering: the Free/Premium program (2026-09 plan) puts this menu in Premium.
 * The lock is added with the tier layer itself (entitlement tiers + upgrade
 * prompt), not here ad hoc — until then every entitled member sees it.
 *
 * The dev server has no built feed; the page then shows the quiet empty state.
 */
import React, { useEffect, useState } from 'react';
import { HpApp } from '../appState';
import { tr } from '../i18n';
import { FD } from '../ui';

interface ReportCopy {
  eyebrow?: string;
  title: string;
  standfirst?: string;
  lead?: string[];
  bulletsTitle?: string;
  bullets?: { cc: string; label: string; text: string }[];
  byline?: string;
  openLabel?: string;
  downloadLabel?: string;
  downloadNote?: string;
  editionLabel?: string;
  langNote?: string;
}

interface ReportEdition {
  id: string;            // YYYY-MM
  published: string;     // YYYY-MM-DD
  pages: number | null;
  reportUrl: string;     // root-relative, same origin
  downloadName: string;
  cover: Record<string, string>;
  copy: Record<string, ReportCopy>;
}

interface ReportFeed {
  series: Record<string, { title: string; sub: string }>;
  items: ReportEdition[];
}

const PAGE: React.CSSProperties = { flex: 1, background: '#fff' };
const WRAP: React.CSSProperties = {
  maxWidth: 1160, width: '100%', margin: '0 auto',
  padding: '24px clamp(16px, 4vw, 48px) 56px', boxSizing: 'border-box',
};
/** Same page-title type as News and Market & Trends. */
const PAGE_TITLE: React.CSSProperties = {
  fontFamily: FD, fontSize: 'clamp(25px, 4vw, 34px)', fontWeight: 600, letterSpacing: '-0.374px', color: '#1d1d1f',
};
const BTN: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 999,
  fontSize: 14, fontWeight: 600, textDecoration: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
};

/** The copy in the reader's language, else the feed's first language. */
const pickLang = <T,>(m: Record<string, T>, lang: string): T | undefined =>
  m[lang] ?? m.en ?? Object.values(m)[0];

export const ReportPage: React.FC<{ app: HpApp }> = ({ app }) => {
  const t = tr(app.lang);
  const [feed, setFeed] = useState<ReportFeed | null>(null);
  const [selId, setSelId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/special-report/feed.json')
      .then(r => (r.ok ? r.json() : null))
      .then(f => { if (alive && f?.items) setFeed(f); })
      .catch(() => { /* dev server / offline — quiet state below */ });
    return () => { alive = false; };
  }, []);

  const series = feed ? pickLang(feed.series, app.lang) : undefined;
  const items = feed?.items ?? [];
  const sel = items.find(e => e.id === selId) ?? items[0] ?? null;
  const earlier = items.filter(e => e !== sel);

  return (
    <div style={PAGE}>
      <div style={WRAP}>
        <div style={PAGE_TITLE}>{t.nav.report}</div>
        {series?.sub && <p style={{ color: '#6e6e73', fontSize: 15.5, margin: '10px 0 28px', maxWidth: 720 }}>{series.sub}</p>}

        {!sel && (
          <div style={{ border: '1px solid #e8e8ed', borderRadius: 18, padding: '26px 30px', maxWidth: 620, color: '#6e6e73', fontSize: 15, marginTop: 20 }}>
            {t.report.empty}
          </div>
        )}

        {sel && (() => {
          const c = pickLang(sel.copy, app.lang)!;
          const cover = pickLang(sel.cover, app.lang);
          return (
            <div data-testid="report-featured" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 'clamp(20px, 3vw, 40px)', alignItems: 'start' }}>
              {cover && (
                <a href={sel.reportUrl} target="_blank" rel="noopener" style={{ display: 'block' }}>
                  <img src={cover} alt={c.title} style={{ width: '100%', borderRadius: 14, border: '1px solid #e8e8ed', display: 'block' }} />
                </a>
              )}
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '.04em', color: '#86868b', textTransform: 'uppercase' }}>
                  {sel === items[0] ? t.report.latest : c.editionLabel ?? sel.id}
                  {sel.pages ? ` · ${t.report.pages(sel.pages)}` : ''}
                </div>
                <h1 style={{ fontFamily: FD, fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.3px', margin: '8px 0 10px', color: '#1d1d1f' }}>
                  {c.title}
                </h1>
                {c.standfirst && <p style={{ fontSize: 17, lineHeight: 1.5, color: '#3a3a3c', margin: '0 0 16px' }}>{c.standfirst}</p>}
                {(c.lead ?? []).slice(0, 2).map((p, i) => (
                  <p key={i} style={{ fontSize: 15, lineHeight: 1.65, color: '#2a2a2c', margin: '0 0 12px' }}>{p}</p>
                ))}
                {c.bullets && c.bullets.length > 0 && (
                  <div style={{ border: '1px solid #e8e8ed', borderRadius: 14, padding: '14px 18px', margin: '16px 0 20px' }}>
                    {c.bulletsTitle && <div style={{ fontWeight: 650, fontSize: 14.5, marginBottom: 8, color: '#1d1d1f' }}>{c.bulletsTitle}</div>}
                    {c.bullets.map(b => (
                      <div key={b.cc} style={{ fontSize: 13.5, lineHeight: 1.55, color: '#3a3a3c', padding: '3px 0' }}>
                        <strong style={{ color: '#1d1d1f' }}>{b.label}</strong> — {b.text}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <a href={sel.reportUrl} target="_blank" rel="noopener" data-testid="report-open"
                    style={{ ...BTN, background: '#0071e3', color: '#fff' }}>
                    {c.openLabel ?? c.title} ›
                  </a>
                  <a href={sel.reportUrl} download={sel.downloadName}
                    style={{ ...BTN, background: '#f5f5f7', color: '#1d1d1f', border: '1px solid #e0e0e0' }}>
                    ⬇ {c.downloadLabel ?? sel.downloadName}
                  </a>
                </div>
                {(c.downloadNote || c.langNote) && (
                  <p style={{ fontSize: 12.5, color: '#86868b', margin: '12px 0 0', lineHeight: 1.5 }}>
                    {[c.langNote, c.downloadNote].filter(Boolean).join(' ')}
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        {earlier.length > 0 && (
          <>
            <div style={{ fontWeight: 650, fontSize: 18, color: '#1d1d1f', margin: '44px 0 16px' }}>{t.report.earlier}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))', gap: 20 }}>
              {earlier.map(e => {
                const c = pickLang(e.copy, app.lang)!;
                const cover = pickLang(e.cover, app.lang);
                return (
                  <div key={e.id} className="hp-press" onClick={() => { setSelId(e.id); window.scrollTo({ top: 0 }); }}
                    style={{ cursor: 'pointer', border: '1px solid #e8e8ed', borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
                    {cover && <img src={cover} alt={c.title} loading="lazy" style={{ width: '100%', display: 'block', aspectRatio: '16 / 10', objectFit: 'cover' }} />}
                    <div style={{ padding: '12px 14px 16px' }}>
                      <div style={{ fontSize: 12.5, color: '#86868b', marginBottom: 4 }}>{c.editionLabel ?? e.id}</div>
                      <div style={{ fontWeight: 650, fontSize: 15.5, color: '#1d1d1f', lineHeight: 1.3 }}>{c.title}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
