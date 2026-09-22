/**
 * HeroVideo — the product disassembly clip on the video cover.
 *
 * Rules it implements (owner brief 2026-09-22):
 *  - silent, inline, looping autoplay; the element is force-muted before every
 *    play() so a source with sound could never make noise;
 *  - native aspect, never cropped: the box is sized by the parent, the clip
 *    letterboxes inside it (object-fit: contain);
 *  - a real play/pause button (a <button>, so keyboard-operable);
 *  - paused when scrolled out of view or the tab is hidden, resumed after —
 *    but never over a pause the visitor made themselves;
 *  - prefers-reduced-motion: the poster is shown and nothing moves until the
 *    visitor presses play;
 *  - before load, when autoplay is blocked, and on load failure the poster
 *    (the assembled unit, first frame of the clip) is what the visitor sees;
 *  - the headline and the entry buttons live outside this component, so a
 *    slow clip never delays them.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HERO_VIDEO } from '../../config/landingHero';

export interface HeroVideoStrings {
  play: string;
  pause: string;
  alt: string;
}

type Playback = 'idle' | 'playing' | 'paused' | 'error';

const PlayIcon = () => (
  <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor" aria-hidden="true">
    <path d="M6 4.5v11l9-5.5-9-5.5z" />
  </svg>
);
const PauseIcon = () => (
  <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor" aria-hidden="true">
    <path d="M6 4h3v12H6zM11 4h3v12h-3z" />
  </svg>
);

export const HeroVideo: React.FC<{ s: HeroVideoStrings }> = ({ s }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playback, setPlayback] = useState<Playback>('idle');
  // Read once: a visitor who has motion reduced gets a still by default.
  const [reducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const userPaused = useRef(false);   // their pause — never auto-resumed
  const autoPaused = useRef(false);   // our pause (offscreen / hidden tab) — resumed
  const inView = useRef(true);

  // Dev-only comparison switch for the owner's preview (?hero=pingpong).
  const src =
    import.meta.env.DEV && new URLSearchParams(window.location.search).get('hero') === 'pingpong'
      ? HERO_VIDEO.pingpongSrc
      : HERO_VIDEO.src;

  const tryPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    const p = v.play();
    if (p && typeof p.then === 'function') {
      // Autoplay refused (browser policy): stay on the poster with the play
      // button — never a broken-looking black box.
      p.then(() => setPlayback('playing')).catch(() => setPlayback((cur) => (cur === 'playing' ? cur : 'idle')));
    }
  }, []);

  const pauseAuto = useCallback(() => {
    const v = videoRef.current;
    if (v && !v.paused) { v.pause(); autoPaused.current = true; }
  }, []);
  const resumeAuto = useCallback(() => {
    if (!autoPaused.current || userPaused.current) return;
    if (!inView.current || document.hidden) return;
    autoPaused.current = false;
    tryPlay();
  }, [tryPlay]);

  /* Autoplay ONCE, when the clip can first play — unless motion is reduced.
     'canplay' also fires after every seek and buffer stall, so the listener
     removes itself: a later canplay must never restart a clip that is
     deliberately paused (verification caught seeks resuming playback). */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || reducedMotion) return;
    v.muted = true;
    v.defaultMuted = true;
    const start = () => {
      v.removeEventListener('canplay', start);
      if (inView.current && !document.hidden) tryPlay();
      else autoPaused.current = true;   // start later, when it scrolls into view
    };
    if (v.readyState >= 3) start();
    else v.addEventListener('canplay', start);
    return () => v.removeEventListener('canplay', start);
  }, [reducedMotion, tryPlay]);

  /* Offscreen + hidden tab. */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const io = new IntersectionObserver(([entry]) => {
      inView.current = entry.isIntersecting;
      if (entry.isIntersecting) resumeAuto(); else pauseAuto();
    }, { threshold: 0.15 });
    io.observe(v);
    const onVisibility = () => { if (document.hidden) pauseAuto(); else resumeAuto(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [pauseAuto, resumeAuto]);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (!v.paused) {
      v.pause();
      userPaused.current = true;
      autoPaused.current = false;
      setPlayback('paused');
    } else {
      userPaused.current = false;
      tryPlay();
    }
  };

  const playing = playback === 'playing';
  const failed = playback === 'error';

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#757a82]"
      style={{ aspectRatio: `${HERO_VIDEO.width} / ${HERO_VIDEO.height}` }}
      data-testid="hero-video"
      data-playback={playback}
    >
      {failed ? (
        <img
          src={HERO_VIDEO.poster}
          alt={s.alt}
          width={HERO_VIDEO.width}
          height={HERO_VIDEO.height}
          className="absolute inset-0 w-full h-full object-contain"
          data-testid="hero-video-fallback"
        />
      ) : (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain"
          src={src}
          poster={HERO_VIDEO.poster}
          width={HERO_VIDEO.width}
          height={HERO_VIDEO.height}
          muted
          loop
          playsInline
          // Reduced motion: nothing is fetched until the visitor asks for it.
          preload={reducedMotion ? 'none' : 'auto'}
          disablePictureInPicture
          controlsList="nodownload noremoteplayback"
          aria-label={s.alt}
          onPlaying={() => setPlayback('playing')}
          onPause={() => setPlayback((cur) => (cur === 'error' ? cur : 'paused'))}
          onError={() => setPlayback('error')}
        />
      )}

      {!failed && (
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? s.pause : s.play}
          aria-pressed={playing}
          className="absolute bottom-3 right-3 w-10 h-10 rounded-full grid place-items-center border border-white/25 bg-black/45 text-white/90 backdrop-blur-sm hover:bg-black/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 transition-colors"
          data-testid="hero-video-toggle"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
      )}
    </div>
  );
};
