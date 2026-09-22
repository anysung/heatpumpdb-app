/**
 * VideoBackdrop — the landing clip as a dimmed, fixed backdrop behind the
 * login / signup pages of a video-cover market. Same clip, same studio
 * continuation (StageCanvas), no control, darkened so the form reads first.
 * Decorative: aria-hidden, no pointer events. Reduced motion → still poster.
 */
import React, { useLayoutEffect, useState } from 'react';
import { HERO_ASPECT, StageBox } from '../../config/landingHero';
import { StageCanvas } from './StageCanvas';
import { HeroVideo } from './HeroVideo';

export const VideoBackdrop: React.FC = () => {
  const [box, setBox] = useState<StageBox | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const W = window.innerWidth, H = window.innerHeight;
      const height = Math.min(H, W / HERO_ASPECT);
      const width = height * HERO_ASPECT;
      setBox({
        top: Math.round((H - height) / 2),
        left: Math.round((W - width) / 2),
        width: Math.round(width),
        height: Math.round(height),
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true" data-testid="video-backdrop">
      <StageCanvas box={box} />
      {box && (
        <div className="absolute" style={{ top: box.top, left: box.left, width: box.width, height: box.height }}>
          <HeroVideo s={{ play: '', pause: '', alt: '' }} className="w-full h-full" control={false} edgeFade={false} />
        </div>
      )}
      {/* Dim so the card, not the clip, is what the eye lands on. */}
      <div className="absolute inset-0" style={{ background: 'rgba(3, 13, 12, 0.58)' }} />
    </div>
  );
};
