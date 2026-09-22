/**
 * VideoCover — the signed-out cover built around the product clip
 * (owner brief + design reference 2026-09-22).
 *
 * Desktop (≥ lg): one viewport. The clip is the page's stage — full width,
 * native aspect, letterboxed on the page background (which is painted in the
 * clip's own studio tones so the frame edge disappears). The headline sits in
 * the top band and the counts + entry pair in the bottom band; both bands are
 * outside the region the moving parts ever reach (measured from the clip:
 * parts stay below 28 % and above the floor reflection). Bottom row: the
 * public pages on the left, the play/pause control on the right.
 *
 * Phones / tablets (< lg): ordinary flow — headline, the clip full width at
 * its aspect, counts, entry, links — nothing is forced into one screen.
 *
 * Header pieces are the same components the classic cover renders, so logo,
 * market badge, language switch and social links behave exactly as before.
 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import { Language } from '../../types';
import { HERO_VIDEO, HERO_ASPECT, StageBox } from '../../config/landingHero';
import { StageCanvas } from './StageCanvas';
import {
  Wordmark, MarketBadge, LanguagePill, SocialLinks, primaryBtn, ghostBtn,
} from './AuthShell';
import { HeroVideo } from './HeroVideo';

/** Page background in the clip's studio tones: a lit mist at the top centre,
 *  the floor glow at the bottom, near-black corners (sampled from the frames). */
const COVER_BG =
  `radial-gradient(60% 46% at 50% 20%, #1e423c 0%, #0f2b27 42%, rgba(9,25,24,0) 100%),` +
  ` radial-gradient(70% 38% at 50% 94%, #162928 0%, rgba(4,17,16,0) 100%),` +
  ` linear-gradient(180deg, #071c1a 0%, ${HERO_VIDEO.edge} 55%, #030d0c 100%)`;

/** Where the moving parts live inside the clip, as fractions of its height
 *  (measured across every frame: bright-pixel union 28.3 %–79.8 %, of which
 *  the last ~7 % is the front grille's floor reflection). The stage is sized
 *  so this band falls between the headline and the counts. */
const PARTS_TOP = 0.28;
const PARTS_BOTTOM = 0.73;
const ASPECT = HERO_ASPECT;

/** Desktop stage geometry: as large as the page allows, never cropped, and
 *  with the parts band clear of both text bands. Re-measured on resize. */
function useStageBox(
  root: React.RefObject<HTMLDivElement>,
  head: React.RefObject<HTMLDivElement>,
  entry: React.RefObject<HTMLDivElement>,
): StageBox | null {
  const [box, setBox] = useState<StageBox | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const r = root.current, h = head.current, e = entry.current;
      if (!r || !h || !e) return;
      if (!window.matchMedia('(min-width: 1024px)').matches) { setBox(null); return; }
      // Layout positions (offset*), not client rects: the fade-up entrance
      // animations translate these blocks for a moment and would otherwise
      // be measured mid-flight.
      const W = r.clientWidth, H = r.clientHeight;
      const headBottom = h.offsetTop + h.offsetHeight + 10;
      const entryTop = e.offsetTop - 6;
      const byText = (entryTop - headBottom) / (PARTS_BOTTOM - PARTS_TOP);
      let height = Math.max(240, Math.min(W / ASPECT, H, byText));
      let top = Math.max(0, headBottom - PARTS_TOP * height);
      if (top + height > H) height = Math.max(240, H - top);
      const width = height * ASPECT;
      setBox({ top: Math.round(top), left: Math.round((W - width) / 2), width: Math.round(width), height: Math.round(height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (root.current) ro.observe(root.current);
    if (entry.current) ro.observe(entry.current);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [root, head, entry]);
  return box;
}

export interface VideoCoverProps {
  t: any;
  language: Language;
  setLanguage: (l: Language) => void;
  stats: { res: number; com: number } | null;
  freeNote: string;
  links: { href: string; label: string }[];
  onSignup: () => void;
  onLogin: () => void;
  notice?: React.ReactNode;
}

export const VideoCover: React.FC<VideoCoverProps> = ({
  t, language, setLanguage, stats, freeNote, links, onSignup, onLogin, notice,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const entryRef = useRef<HTMLDivElement>(null);
  const stage = useStageBox(rootRef, headRef, entryRef);

  return (
  <div
    ref={rootRef}
    className="relative min-h-screen text-white font-sans flex flex-col overflow-hidden"
    style={{ background: COVER_BG }}
    data-testid="landing-video"
  >
    {/* Studio continuation behind the stage (desktop): the poster's edge
        strips stretched to the page edges, so the clip's floor and mist run
        on to the viewport border at every size instead of ending in a line. */}
    {stage && <StageCanvas box={stage} className="hidden lg:block z-0" />}
    {/* Stage — measured box behind everything on desktop, in flow on phones. */}
    <div
      className={`order-3 lg:order-none w-full px-3 sm:px-4 mt-4 lg:px-0 lg:mt-0 lg:z-0 ${stage ? 'lg:absolute' : 'relative'}`}
      style={stage ? { top: stage.top, left: stage.left, width: stage.width, height: stage.height } : undefined}
      data-testid="hero-stage"
    >
      <HeroVideo
        s={{ play: t.authVideoPlay, pause: t.authVideoPause, alt: t.authVideoAlt }}
        className={`w-full rounded-2xl ${stage ? 'h-full rounded-none' : 'aspect-[1998/1038]'}`}
        buttonClassName="bottom-3 right-3"
        edgeFade={!stage}
      />
    </div>

    {/* Floor darkening (owner 2026-09-23): the studio floor's lit sheen ends
        in a soft band at ~78 % of the frame that reads as a line on mid-size
        screens. A gradient from 70 % of the stage to the page bottom melts it
        and grounds the counts. Starts at zero where the parts end (73 %). */}
    {stage && (
      <div
        className="hidden lg:block absolute inset-x-0 bottom-0 z-[1] pointer-events-none"
        aria-hidden="true"
        style={{
          top: stage.top + stage.height * 0.70,
          background: 'linear-gradient(to bottom, rgba(3,13,12,0) 0%, rgba(3,13,12,0.32) 38%, rgba(3,13,12,0.62) 100%)',
        }}
        data-testid="floor-shade"
      />
    )}

    <header className="order-1 relative z-20 flex items-center justify-between gap-2 sm:gap-4 px-4 sm:px-6 md:px-10 py-4 sm:py-5">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <Wordmark />
        <MarketBadge t={t} />
      </div>
      <div className="flex items-center gap-2 sm:gap-3 md:gap-5 flex-none">
        <SocialLinks />
        <LanguagePill language={language} setLanguage={setLanguage} />
      </div>
    </header>

    {/* Headline band — top of the stage, above where any part travels. */}
    <div ref={headRef} className="order-2 relative z-10 pointer-events-none text-center px-4 pt-1 lg:pt-2 hp-fade-up">
      {notice && <div className="pointer-events-auto mb-3">{notice}</div>}
      <h1 className="text-[1.9rem] sm:text-4xl md:text-5xl lg:text-[3.35rem] font-bold tracking-tight leading-[1.08] drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]">
        {t.authHeadline}
        <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
          {t.authHeadlineAccent}
        </span>
      </h1>
      <p className="mt-2.5 text-white/75 text-[15px] sm:text-lg md:text-[1.35rem] drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)]">
        {t.authHeroLine}
      </p>
    </div>

    <div className="order-4 flex-1" aria-hidden="true" />

    {/* Counts + entry — one small block over the floor, never over a part. */}
    <div ref={entryRef} className="order-5 relative z-10 pointer-events-none flex flex-col items-center gap-3 px-4 pt-6 lg:pt-0 hp-fade-up-delay" data-testid="landing-entry">
      {stats && (
        <div className="text-center flex flex-col gap-1 drop-shadow-[0_1px_8px_rgba(0,0,0,0.55)]" data-testid="landing-stats">
          <p className="text-[11px] tracking-[0.2em] uppercase text-white/60">{t.authStatsTitle}</p>
          <p className="text-4xl md:text-[2.6rem] font-bold leading-none text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300">
            {t.authStatsTotal} {(stats.res + stats.com).toLocaleString()}
          </p>
          <p className="text-[12.5px] text-white/65">
            {t.tabResidential} <span className="font-semibold text-white/90">{stats.res.toLocaleString()}</span>
            <span className="mx-2 text-white/30">|</span>
            {t.tabCommercial} <span className="font-semibold text-white/90">{stats.com.toLocaleString()}</span>
          </p>
        </div>
      )}
      <div className="pointer-events-auto rounded-2xl border border-white/12 bg-black/25 backdrop-blur-sm p-2.5 flex flex-col sm:flex-row gap-2.5 w-full max-w-sm sm:max-w-none sm:w-auto">
        <button onClick={onSignup} className={`${primaryBtn} sm:w-auto sm:px-10`}>{t.signup}</button>
        <button onClick={onLogin} className={`${ghostBtn} sm:w-auto sm:px-10`}>{t.login}</button>
      </div>
      <p className="text-center text-[12.5px] leading-relaxed text-emerald-200/85 drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)]" data-testid="free-signup-note">
        {freeNote}
      </p>
    </div>

    {/* Bottom row: public pages left, copyright centre; the play/pause
        control (inside the stage) occupies the right corner on desktop. */}
    <div className="order-6 relative z-10 pointer-events-none flex flex-col sm:flex-row items-center sm:items-end justify-between gap-3 px-5 sm:px-8 pt-5 pb-5 lg:pb-6">
      <nav className="pointer-events-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] text-white/60" data-testid="public-pages">
        {links.map((l, i) => (
          <React.Fragment key={l.href}>
            {i > 0 && <span className="text-white/20" aria-hidden="true">|</span>}
            <a href={l.href} className="hover:text-white transition-colors">{l.label}</a>
          </React.Fragment>
        ))}
      </nav>
      <p className="text-[11px] text-white/35 text-center sm:pr-16 lg:pr-24">{t.authCopyright}</p>
    </div>

    {/* Indexable market keywords — visually quiet, still in the document. */}
    {t.authSeoLine && (
      <p className="order-7 relative z-10 sr-only">{t.authSeoLine}</p>
    )}
  </div>
  );
};
