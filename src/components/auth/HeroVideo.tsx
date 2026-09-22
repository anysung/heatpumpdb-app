/**
 * HeroVideo — the product assembly/disassembly clip on the video cover.
 *
 * Rules it implements (owner brief 2026-09-22):
 *  - silent, inline, looping autoplay; the element is force-muted before every
 *    play() so a source with sound could never make noise;
 *  - native aspect, never cropped: the clip letterboxes inside whatever box
 *    the parent gives it (object-fit: contain);
 *  - a real play/pause button (a <button>, so keyboard-operable); the parent
 *    positions it (page corner on desktop, clip corner on phones);
 *  - paused when scrolled out of view or the tab is hidden, resumed after —
 *    but never over a pause the visitor made themselves;
 *  - prefers-reduced-motion: the poster is shown and nothing moves until the
 *    visitor presses play;
 *  - before load, when autoplay is blocked, and on load failure the poster
 *    (the assembled unit, first frame of the clip) is what the visitor sees;
 *  - the headline and the entry buttons live outside this component, so a
 *    slow clip never delays them.
 *
 * The edge vignette only touches the outermost few percent of the frame,
 * where the clip is plain studio background (measured: moving parts stay
 * ≥5 % from the left/right edges, ≥28 % from the top, ≥11 % from the bottom).
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

export const HeroVideo: React.FC<{
  s: HeroVideoStrings;
  /** Box the clip fills (letterboxed inside). */
  className?: string;
  /** Where the play/pause button sits inside that box. */
  buttonClassName?: string;
}> = ({ s, className = '', buttonClassName = 'bottom-3 right-3' }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playback, setPlayback] = useState<Playback>('idle');
  // Read once: a visitor who has motion reduced gets a still by default.
  const [reducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const userPaused = useRef(false);   // their pause — never auto-resumed
  const autoPaused = useRef(false);   // our pause (offscreen / hidden tab) — resumed
  const inView = useRef(true);

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
     deliberately paused. */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || reducedMotion) return;
    v.muted = true;
    v.defaultMuted = true;
    // Play as soon as possible; if the clip is actually offscreen the
    // IntersectionObserver below pauses it and resumes it later. (Deciding
    // here from a not-yet-delivered observer state left the clip idle.)
    const start = () => {
      v.removeEventListener('canplay', start);
      if (!document.hidden) tryPlay();
      else autoPaused.current = true;
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
    <div className={`relative overflow-hidden ${className}`} data-testid="hero-video" data-playback={playback}>
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
          src={HERO_VIDEO.src}
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

      {/* Edge vignette in the clip's own edge colour: the letterbox boundary
          melts into the page. Inset shadow only — nothing over the parts. */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{ boxShadow: `inset 0 0 7vw 1.6vw ${HERO_VIDEO.edge}` }}
      />
      {/* Top/bottom fades over empty studio only: the parts never rise above
          28 % of the frame and the floor reflection ends by ~89 %, so a 20 %
          fade at the top and a 6 % fade at the bottom touch no part. */}
      <div
        className="absolute inset-x-0 top-0 h-[20%] pointer-events-none"
        aria-hidden="true"
        style={{ background: `linear-gradient(to bottom, ${HERO_VIDEO.edge} 0%, rgba(6,23,22,0.55) 45%, rgba(6,23,22,0) 100%)` }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[6%] pointer-events-none"
        aria-hidden="true"
        style={{ background: `linear-gradient(to top, ${HERO_VIDEO.edge} 0%, rgba(6,23,22,0) 100%)` }}
      />

      {!failed && (
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? s.pause : s.play}
          aria-pressed={playing}
          className={`absolute ${buttonClassName} w-11 h-11 rounded-full grid place-items-center border border-white/30 bg-black/35 text-white/90 backdrop-blur-sm hover:bg-black/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 transition-colors`}
          data-testid="hero-video-toggle"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
      )}
    </div>
  );
};
