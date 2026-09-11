/**
 * Market & Trends — the in-app view of the public /market-trends/ card feed.
 *
 * The cards (owner-shipped infographics + market-language articles) are
 * published as static pages for SEO and social landings; the app renders the
 * SAME feed natively from /market-trends/feed.json (written by
 * scripts/build-market-trends.mjs into the hosting build), so members read a
 * card without leaving the app. One content source, two surfaces — the feed
 * is market-language by design, so no i18n dictionary is involved beyond the
 * nav label.
 *
 * The dev server has no built feed file; the page then shows the roadmap-less
 * quiet state rather than an error — an empty feed and a missing feed look
 * the same to a member, and neither is a failure.
 */
import React, { useEffect, useState } from 'react';
import { HpApp } from '../appState';
import { tr } from '../i18n';
import { FD, SubTabs } from '../ui';

/** The article text in one language. The infographic is NOT part of this:
 *  the card image ships in the market language and is never translated
 *  (owner 2026-08-11) — only the description below it switches. */
interface TrendsText {
  title: string;
  excerpt: string;
  body: string[];
  sourceNote: string;
}

interface TrendsCard extends TrendsText {
  slug: string;
  date: string;      // YYYY-MM-DD
  image: string;     // root-relative WebP, market language — the feed thumbnail
  /** A DECK: the same story told over several cards, paged with arrows.
   *  Card 1 carries the headline and the key figure; the rest carry one idea
   *  each. Absent on a single-card entry, and the reader falls back to `image`. */
  images?: string[];
  en: TrendsText;    // falls back to the market-language text if untranslated
}

interface TrendsFeed {
  h1: string;
  sub: string;
  h1En: string;
  subEn: string;
  pill: string;
  pillEn: string;
  coming: string;
  roadmap: string[];
  items: TrendsCard[];
}

/* Natural document flow (2026-09-02): the fixed calc(100vh-60px) box made the
   page double-scroll inside the mobile shell, and a plain scroll page never
   needed it on desktop either — Bafa and Guide flow the same way. */
const PAGE: React.CSSProperties = {
  flex: 1, background: '#fff',
};

/** Page title, typed exactly as the News page types "Market intelligence." —
 *  same family, size and weight, so a page name reads as a page name and not
 *  as the first line of the article. (Do not fold these into the `font`
 *  shorthand: `font: 700 34px/1.15 inherit` is invalid CSS and the browser
 *  drops the whole declaration, which is how this page shipped looking like
 *  body text.) */
const PAGE_TITLE: React.CSSProperties = {
  fontFamily: FD, fontSize: 'clamp(25px, 4vw, 34px)', fontWeight: 600, letterSpacing: '-0.374px', color: '#1d1d1f',
};
const PILL: React.CSSProperties = {
  fontSize: 12.5, color: '#7a7a7a', border: '1px solid #e0e0e0', borderRadius: 999,
  padding: '4px 13px', whiteSpace: 'nowrap',
};

/**
 * CardDeck — the card reader: one card at a time, centred.
 *
 * A deck is 3 to 6 cards (8 at the most), so the reader has to make where it
 * is obvious. The cards sit on one track and the SELECTED card is centred in
 * the frame, with its neighbours showing at the edges — that peek is what
 * tells a reader there is more without a caption saying so. The arrows move
 * the selection; the track scrolls itself to centre it.
 *
 * Native scrolling does the work rather than a transform: a phone then gets
 * its own momentum and snapping for free, and dragging the track by hand
 * updates the selection the same way the arrows do.
 *
 * A one-card entry renders as a plain image with no furniture at all, which
 * is what every card published before decks existed is.
 */
const CardDeck: React.FC<{ images: string[]; alt: string }> = ({ images, alt }) => {
  const [i, setI] = useState(0);
  const track = React.useRef<HTMLDivElement>(null);
  const n = images.length;

  const centre = (k: number) => {
    const el = track.current?.children[k] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };
  const go = (d: number) => {
    const k = Math.min(Math.max(i + d, 0), n - 1);
    setI(k); centre(k);
  };

  // A new story resets the deck: reading card 3 of one and opening the next
  // should not land on its card 3.
  const first = images[0];
  useEffect(() => { setI(0); track.current?.scrollTo({ left: 0 }); }, [first]);

  if (n === 1) {
    return <img src={images[0]} alt={alt} style={{ width: '100%', borderRadius: 18, display: 'block', marginBottom: 26 }} />;
  }

  /** Which card is nearest the centre — the selection follows a hand-drag as
   *  well as the arrows, so the dots never disagree with what is on screen. */
  const onScroll = () => {
    const t = track.current; if (!t) return;
    const mid = t.scrollLeft + t.clientWidth / 2;
    let best = 0, bestD = Infinity;
    [...t.children].forEach((c, k) => {
      const el = c as HTMLElement;
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
      if (d < bestD) { bestD = d; best = k; }
    });
    if (best !== i) setI(best);
  };

  const ARROW: React.CSSProperties = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 2,
    width: 46, height: 46, borderRadius: '50%', border: '1px solid #e0e0e0',
    background: 'rgba(255,255,255,.94)', color: '#1d1d1f', fontSize: 22, lineHeight: 1,
    display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,.14)',
  };

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ position: 'relative' }}>
        <div
          ref={track}
          onScroll={onScroll}
          onKeyDown={e => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); }}
          tabIndex={0}
          className="hp-deck-track"
          style={{
            display: 'flex', gap: 14, overflowX: 'auto', scrollSnapType: 'x mandatory',
            // The side padding is what lets the FIRST and LAST card reach the
            // centre; without it the deck would stop one half-card short.
            padding: '4px 13% 10px', outline: 'none', scrollbarWidth: 'none',
          }}
        >
          {images.map((src, k) => (
            <img
              key={src}
              src={src}
              alt={`${alt} — ${k + 1}/${n}`}
              onClick={() => { setI(k); centre(k); }}
              style={{
                flex: 'none', width: '74%', maxWidth: 560, borderRadius: 18, display: 'block',
                scrollSnapAlign: 'center', cursor: k === i ? 'default' : 'pointer',
                opacity: k === i ? 1 : 0.5, transition: 'opacity .25s, transform .25s',
                transform: k === i ? 'none' : 'scale(.965)',
              }}
            />
          ))}
        </div>
        {i > 0 && <div className="hp-press" onClick={() => go(-1)} style={{ ...ARROW, left: 6 }}>‹</div>}
        {i < n - 1 && <div className="hp-press" onClick={() => go(1)} style={{ ...ARROW, right: 6 }}>›</div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginTop: 10 }}>
        {images.map((_, k) => (
          <span
            key={k}
            onClick={() => { setI(k); centre(k); }}
            className="hp-press"
            style={{
              width: k === i ? 22 : 8, height: 8, borderRadius: 4, cursor: 'pointer',
              background: k === i ? '#1d1d1f' : '#d2d2d7', transition: 'width .18s, background .18s',
            }}
          />
        ))}
      </div>
    </div>
  );
};

export const TrendsPage: React.FC<{ app: HpApp }> = ({ app }) => {
  const [feed, setFeed] = useState<TrendsFeed | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  /** The nav's language toggle drives the article text. Keeping the OPEN card
   *  as a slug (not a snapshot) is what lets a switch mid-read re-render the
   *  same card in the other language instead of freezing the first one. */
  const en = app.lang === 'en';
  const textOf = (c: TrendsCard): TrendsText => (en && c.en ? c.en : c);
  /**
   * In the app the title is the PAGE NAME — the same words as the nav item —
   * so it reads as a destination, exactly like News. The long market headline
   * ("Wärmepumpen-Markt Deutschland: Zahlen & Trends") belongs to the public
   * page, where it is the SEO H1; repeating it here only buried the page name
   * in a two-line sentence.
   */
  const t = tr(app.lang);
  const pageName = t.nav.trends;
  const subhead = feed ? (en ? feed.subEn || feed.sub : feed.sub) : '';
  const pill = feed ? (en ? feed.pillEn || feed.pill : feed.pill) : '';

  useEffect(() => {
    let alive = true;
    fetch('/market-trends/feed.json')
      .then(r => (r.ok ? r.json() : null))
      .then(f => { if (alive && f) setFeed(f); })
      .catch(() => { /* dev server / offline — quiet state below */ });
    return () => { alive = false; };
  }, []);

  const fmtDate = (iso: string) => {
    try { return new Date(`${iso}T00:00:00`).toLocaleDateString(en ? 'en-GB' : undefined, { year: 'numeric', month: 'long', day: 'numeric' }); }
    catch { return iso; }
  };

  /* ── Card reader ── */
  const open = feed?.items.find(c => c.slug === openSlug) ?? null;
  if (open) {
    const v = textOf(open);
    return (
      <div style={PAGE}>
        <div style={{ maxWidth: 1160, width: '100%', margin: '0 auto', padding: '24px clamp(16px, 4vw, 48px) 56px', boxSizing: 'border-box' }}>
          <SubTabs
            group="newsTrends"
            tabs={[{ id: 'news', label: t.nav.news }, { id: 'trends', label: t.nav.trends }]}
            active="trends"
            onSelect={id => app.go(id as 'news' | 'trends')}
            style={{ marginBottom: 18 }}
          />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px 14px', flexWrap: 'wrap', marginBottom: 22 }}>
            <span style={PAGE_TITLE}>{pageName}</span>
            {pill && <span style={PILL}>{pill}</span>}
          </div>
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 18, padding: '30px 40px 38px', maxWidth: 820 }}>
            <span
              className="hp-press"
              onClick={() => setOpenSlug(null)}
              style={{ color: '#0066cc', fontSize: 13.5, cursor: 'pointer', fontWeight: 500 }}
            >
              ← {pageName}
            </span>
            <h1 style={{ fontFamily: FD, fontSize: 28, fontWeight: 600, lineHeight: 1.25, letterSpacing: '-0.3px', margin: '14px 0 6px', color: '#1d1d1f' }}>
              {v.title}
            </h1>
            <div style={{ color: '#7a7a7a', fontSize: 13.5, marginBottom: 22 }}>
              {fmtDate(open.date)} · HeatPump DB
            </div>
            <CardDeck images={open.images?.length ? open.images : [open.image]} alt={v.title} />
            {v.body.map((p, i) => (
              <p key={i} style={{ fontSize: 16, lineHeight: 1.7, color: '#2a2a2c', margin: '0 0 15px' }}>{p}</p>
            ))}
            {v.sourceNote && (
              <p style={{ fontSize: 12.5, color: '#7a7a7a', borderTop: '1px solid #f0f0f0', paddingTop: 14, marginTop: 22 }}>
                {v.sourceNote}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Feed grid ── */
  return (
    <div style={PAGE}>
      <div style={{ maxWidth: 1160, width: '100%', margin: '0 auto', padding: '24px clamp(16px, 4vw, 48px) 56px', boxSizing: 'border-box' }}>
        <SubTabs
          group="newsTrends"
          tabs={[{ id: 'news', label: t.nav.news }, { id: 'trends', label: t.nav.trends }]}
          active="trends"
          onSelect={id => app.go(id as 'news' | 'trends')}
          style={{ marginBottom: 18 }}
        />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px 14px', flexWrap: 'wrap' }}>
          <span style={PAGE_TITLE}>{pageName}</span>
          {pill && <span style={PILL}>{pill}</span>}
        </div>
        {subhead && <p style={{ color: '#6e6e73', fontSize: 15.5, margin: '10px 0 30px', maxWidth: 720 }}>{subhead}</p>}

        {feed && feed.items.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: 24 }}>
            {feed.items.map(c => {
              const v = textOf(c);
              return (
                <div
                  key={c.slug}
                  className="hp-press"
                  onClick={() => { setOpenSlug(c.slug); }}
                  style={{ cursor: 'pointer', border: '1px solid #e8e8ed', borderRadius: 18, overflow: 'hidden', background: '#fff' }}
                >
                  <img src={c.image} alt={v.title} loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '14px 16px 18px' }}>
                    <div style={{ fontSize: 12.5, color: '#86868b', marginBottom: 5 }}>{fmtDate(c.date)}</div>
                    <div style={{ fontWeight: 650, fontSize: 16.5, color: '#1d1d1f', lineHeight: 1.3 }}>{v.title}</div>
                    {v.excerpt && <div style={{ fontSize: 13.5, color: '#6e6e73', marginTop: 6, lineHeight: 1.45 }}>{v.excerpt}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          feed && (
            <div style={{ border: '1px solid #e8e8ed', borderRadius: 18, padding: '26px 30px', maxWidth: 620 }}>
              <div style={{ fontWeight: 650, fontSize: 17, marginBottom: 12, color: '#1d1d1f' }}>{feed.coming}</div>
              <ul style={{ margin: 0, paddingLeft: 20, color: '#6e6e73', fontSize: 14.5, lineHeight: 2 }}>
                {feed.roadmap.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )
        )}
      </div>
    </div>
  );
};
