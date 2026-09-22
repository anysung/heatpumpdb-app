/**
 * StageCanvas — continues the clip's studio beyond the clip's own edges.
 *
 * The clip is shown at its native aspect, so on most screens it does not
 * fill the page. A CSS gradient behind it never quite matched the studio
 * (the floor's glow ended in a visible line under the stage). Instead, this
 * canvas paints the poster frame in the stage box and STRETCHES its outer
 * 2 % rows/columns — plain studio, no part — outward to the page edges, then
 * a blur smooths the join. The result is one continuous studio whatever the
 * viewport, and the video sits exactly on top of its own frame.
 *
 * Cheap: drawn once per stage-box change (and once when frames arrive) at
 * half resolution.
 */
import React, { useEffect, useRef } from 'react';
import { HERO_VIDEO, StageBox } from '../../config/landingHero';

let posterPromise: Promise<HTMLImageElement> | null = null;
const loadPoster = () => {
  if (!posterPromise) {
    posterPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = HERO_VIDEO.poster;
    });
  }
  return posterPromise;
};

export const StageCanvas: React.FC<{ box: StageBox | null; className?: string }> = ({ box, className = '' }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c || !box) return;
    const root = c.parentElement;
    // The clip itself is the preferred source: a browser does not render a
    // video and a JPEG of the same frame identically (colour range / matrix
    // differ per browser), and even a few levels of mismatch redraw the box
    // outline. Painting from the decoded video frame matches exactly; the
    // poster is only the fallback until frames exist (or under reduced
    // motion, where the poster is also what the <video> shows).
    const video = root ? (root.querySelector('video') as HTMLVideoElement | null) : null;
    let cancelled = false;

    const paint = (src: CanvasImageSource, sw: number, sh: number) => {
      if (cancelled || !root) return;
      const W = root.clientWidth, H = root.clientHeight;
      if (!W || !H || !sw || !sh) return;
      const scale = 0.5;
      c.width = Math.max(1, Math.round(W * scale));
      c.height = Math.max(1, Math.round(H * scale));
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.scale(scale, scale);
      ctx.fillStyle = HERO_VIDEO.edge;
      ctx.fillRect(0, 0, W, H);
      const ex = Math.max(2, Math.round(sw * 0.02)), ey = Math.max(2, Math.round(sh * 0.02));
      const { top, left, width, height } = box;
      const bottom = top + height, right = left + width;
      try {
        // Edges: stretch the outermost strips outward.
        if (top > 0) ctx.drawImage(src, 0, 0, sw, ey, left, 0, width, top);
        if (bottom < H) ctx.drawImage(src, 0, sh - ey, sw, ey, left, bottom, width, H - bottom);
        if (left > 0) ctx.drawImage(src, 0, 0, ex, sh, 0, top, left, height);
        if (right < W) ctx.drawImage(src, sw - ex, 0, ex, sh, right, top, W - right, height);
        // Corners: the corner patches.
        if (left > 0 && top > 0) ctx.drawImage(src, 0, 0, ex, ey, 0, 0, left, top);
        if (right < W && top > 0) ctx.drawImage(src, sw - ex, 0, ex, ey, right, 0, W - right, top);
        if (left > 0 && bottom < H) ctx.drawImage(src, 0, sh - ey, ex, ey, 0, bottom, left, H - bottom);
        if (right < W && bottom < H) ctx.drawImage(src, sw - ex, sh - ey, ex, ey, right, bottom, W - right, H - bottom);
        // The frame itself, under the video.
        ctx.drawImage(src, left, top, width, height);
      } catch { /* a frame that cannot be drawn yet: the solid edge colour stays */ }
    };

    const draw = () => {
      if (video && video.readyState >= 2 && video.videoWidth) {
        paint(video, video.videoWidth, video.videoHeight);
        return;
      }
      loadPoster().then((img) => paint(img, img.naturalWidth, img.naturalHeight)).catch(() => {});
    };
    draw();
    const onFrames = () => draw();
    video?.addEventListener('loadeddata', onFrames);
    video?.addEventListener('playing', onFrames, { once: true });
    return () => {
      cancelled = true;
      video?.removeEventListener('loadeddata', onFrames);
      video?.removeEventListener('playing', onFrames);
    };
  }, [box]);

  return (
    <canvas
      ref={ref}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      // No transform: the painted frame must sit exactly under the video —
      // a scale to hide the blurred border shifted it and drew the box back in.
      style={{ filter: 'blur(14px)' }}
      aria-hidden="true"
      data-testid="stage-canvas"
    />
  );
};
