/**
 * InstallerVideo — the installer USP clip on the signed-out cover
 * (owner brief 2026-10-01).
 *
 * Trigger: a transparent play ring + a quiet "For installers" label in the
 * market language, in the empty top-left of the video cover (desktop) or under
 * the hero line (phones). Hover: the ring beats like a pulse, a band of light
 * runs through the label (index.css .hp-iv-*).
 *
 * Popup: vertical (9:16), opening from the trigger's position and leaving
 * room below for the Close button. Starts MUTED (autoplay needs it and a
 * landing page must not talk unasked); one tap on the speaker turns sound on,
 * then a volume slider appears. Esc / backdrop / Close all dismiss it.
 *
 * On-screen copy is in the market language (one cut per market); the
 * narration is the source clip's English voice. File names are versioned —
 * /media/** is served immutable.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ACTIVE_COUNTRY } from '../../config/countryProfiles';

/** v3 (2026-10-01): one cut per market — on-screen copy in the market
 *  language and that market's own sample reports; 30 % slower than v2. */
const IV_CC = ACTIVE_COUNTRY.code.toLowerCase();
export const INSTALLER_VIDEO = {
  src: `/media/installer/usp-installer-v3-${IV_CC}.mp4`,
  poster: `/media/installer/usp-installer-v3-${IV_CC}-poster.jpg`,
};

export interface InstallerVideoStrings {
  label: string; open: string; close: string; unmute: string; mute: string;
  volume: string; replay: string; alt: string;
}

const PlayRing: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" className="hp-iv-ring">
    <circle cx="24" cy="24" r="21.5" stroke="currentColor" strokeWidth="2" />
    <path d="M20 16.2v15.6c0 .9 1 1.4 1.7.9l11.2-7.8c.6-.4.6-1.4 0-1.8l-11.2-7.8c-.7-.5-1.7 0-1.7.9Z" fill="currentColor" />
  </svg>
);

/** The trigger. `compact` = the phone/tablet variant under the hero line. */
export const InstallerVideoTrigger: React.FC<{ s: InstallerVideoStrings; compact?: boolean; className?: string }> = ({ s, compact, className = '' }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [origin, setOrigin] = useState<DOMRect | null>(null);
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOrigin(ref.current?.getBoundingClientRect() ?? null)}
        aria-label={s.open}
        aria-haspopup="dialog"
        className={`hp-iv-trigger group inline-flex items-center ${compact ? 'gap-2' : 'gap-2.5'} bg-transparent border-0 p-0 cursor-pointer text-emerald-300/90 ${className}`}
        data-testid="installer-video-trigger"
      >
        <PlayRing size={compact ? 22 : 28} />
        <span className={`hp-iv-label uppercase font-medium ${compact ? 'text-[8.5px] tracking-[0.22em]' : 'text-[9.5px] tracking-[0.26em]'}`}>
          {s.label}
        </span>
      </button>
      {/* Portal: the trigger sits inside animated (transformed) bands whose
          stacking context would otherwise trap the fixed popup under the page. */}
      {origin && createPortal(
        <InstallerVideoPopup s={s} origin={origin} onClose={() => { setOrigin(null); ref.current?.focus(); }} />,
        document.body,
      )}
    </>
  );
};

const CLOSE_ROW = 76;      // Close button + gap below the popup
const MARGIN = 16;

const InstallerVideoPopup: React.FC<{ s: InstallerVideoStrings; origin: DOMRect; onClose: () => void }> = ({ s, origin, onClose }) => {
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [ended, setEnded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [shown, setShown] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  // Geometry: the popup starts at the trigger (desktop) and keeps room for the
  // Close row; never taller than 720 px, never wider than the screen allows.
  useLayoutEffect(() => {
    const place = () => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const phone = vw < 1024;
      const top = phone ? Math.max(MARGIN, 56) : Math.max(MARGIN, Math.round(origin.top));
      let height = Math.min(720, vh - top - CLOSE_ROW - MARGIN);
      let width = Math.round(height * 9 / 16);
      const maxW = vw - 2 * MARGIN;
      if (width > maxW) { width = maxW; height = Math.round(width * 16 / 9); }
      const left = phone ? Math.round((vw - width) / 2) : Math.max(MARGIN, Math.round(origin.left));
      setBox({ top, left, width, height });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [origin]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const raf = requestAnimationFrame(() => setShown(true));
    const v = video.current;
    if (v) { v.muted = true; v.play().catch(() => {}); }
    return () => { window.removeEventListener('keydown', onKey); cancelAnimationFrame(raf); };
  }, [onClose]);

  const toggleSound = () => {
    const v = video.current; if (!v) return;
    const next = !muted;
    v.muted = next;
    if (!next) { if (v.volume === 0 || volume === 0) { v.volume = 0.8; setVolume(0.8); } else v.volume = volume; if (ended || v.paused) { void v.play(); } }
    setMuted(next);
  };
  const onVolume = (x: number) => {
    const v = video.current; if (!v) return;
    v.volume = x; setVolume(x);
    if (x === 0) { v.muted = true; setMuted(true); } else if (v.muted) { v.muted = false; setMuted(false); }
  };
  const replay = () => { const v = video.current; if (!v) return; v.currentTime = 0; setEnded(false); void v.play(); };

  if (!box) return null;
  const ox = origin.left + origin.width / 2 - box.left, oy = origin.top + origin.height / 2 - box.top;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={s.alt} data-testid="installer-video-dialog">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[3px] transition-opacity duration-300"
        style={{ opacity: shown ? 1 : 0 }}
        onClick={onClose}
      />
      <div
        className="absolute transition-[transform,opacity] duration-[380ms] ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{
          top: box.top, left: box.left, width: box.width,
          transformOrigin: `${ox}px ${oy}px`,
          transform: shown ? 'scale(1)' : 'scale(0.12)', opacity: shown ? 1 : 0,
        }}
      >
        <div
          className="relative overflow-hidden rounded-[22px] bg-black ring-1 ring-white/15 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85),0_0_0_1px_rgba(16,185,129,0.12)]"
          style={{ height: box.height }}
        >
          <video
            ref={video}
            src={INSTALLER_VIDEO.src}
            poster={INSTALLER_VIDEO.poster}
            muted
            autoPlay
            playsInline
            preload="auto"
            className="block w-full h-full object-cover"
            aria-label={s.alt}
            onEnded={() => setEnded(true)}
            onTimeUpdate={e => { const v = e.currentTarget; if (v.duration) setProgress(v.currentTime / v.duration); }}
            data-testid="installer-video"
          />
          {/* progress */}
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${progress * 100}%` }} />
          </div>
          {/* sound: mute toggle + volume (after sound is on) */}
          <div className="absolute right-3 bottom-4 flex items-center gap-2 rounded-full bg-black/45 backdrop-blur-md ring-1 ring-white/15 pl-1 pr-1 py-1">
            {!muted && (
              <input
                type="range" min={0} max={1} step={0.05} value={volume}
                onChange={e => onVolume(parseFloat(e.target.value))}
                aria-label={s.volume}
                className="hp-iv-volume w-20 ml-2"
                data-testid="installer-video-volume"
              />
            )}
            <button
              type="button"
              onClick={toggleSound}
              aria-label={muted ? s.unmute : s.mute}
              title={muted ? s.unmute : s.mute}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-white ${muted ? 'hp-iv-mute-hint' : ''}`}
              data-testid="installer-video-sound"
              aria-pressed={!muted}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
                {muted
                  ? <><path d="m22 9-6 6" /><path d="m16 9 6 6" /></>
                  : <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></>}
              </svg>
            </button>
          </div>
          {ended && (
            <button
              type="button"
              onClick={replay}
              className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-black/50 backdrop-blur-md ring-1 ring-white/25 text-white flex items-center justify-center"
              aria-label={s.replay}
              title={s.replay}
              data-testid="installer-video-replay"
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex justify-center mt-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[14px] font-semibold text-white bg-white/10 hover:bg-white/20 ring-1 ring-white/20 backdrop-blur-md transition-colors"
            data-testid="installer-video-close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            {s.close}
          </button>
        </div>
      </div>
    </div>
  );
};
