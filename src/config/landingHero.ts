import { CountryCode } from './countryProfiles';

/**
 * Which cover (landing) layout each market shows to signed-out visitors.
 *
 *  - 'classic' — the two-column story + entry card that shipped until 2026-09.
 *  - 'video'   — the product-video cover (owner brief 2026-09-22): the
 *                assembly/disassembly clip as the full-width stage, headline
 *                above it, the live model counts and a compact Sign up /
 *                Log in pair below.
 *
 * Both layouts stay in App.tsx, so switching a market back is this one line.
 * Only the German market is switched over for the owner's preview; the other
 * four stay classic until they are approved one by one — approval of DE is
 * never approval of the rest.
 */
export const LANDING_HERO: Record<CountryCode, 'classic' | 'video'> = {
  DE: 'video',
  GB: 'classic',
  FR: 'classic',
  PL: 'classic',
  IT: 'classic',
};

/** The one hero clip, shared by every market that uses the video cover.
 *  Owner's render `HeatPump_DB_Assembly_Loop.mp4` (dark studio, seamless
 *  loop: assembled → exploded → reassembled, 10.2 s). The original stays in
 *  the owner's Downloads folder; these are web derivatives made from it
 *  (docs/LANDING_VIDEO_HERO.md). Sizes are the clip's native pixels — the
 *  layout keeps this aspect and never crops. */
export const HERO_VIDEO = {
  src: '/media/hero/heatpump-assembly-loop-v2.mp4',
  poster: '/media/hero/heatpump-assembly-loop-v2-poster.jpg',
  width: 1998,
  height: 1038,
  /** Colour of the clip's outer edge — the page background and the edge
   *  vignette use it so the frame boundary disappears into the page. */
  edge: '#061716',
} as const;

/** Native aspect of the clip (width / height). */
export const HERO_ASPECT = HERO_VIDEO.width / HERO_VIDEO.height;

/** A stage box in page pixels: where the clip is shown, at its native aspect. */
export type StageBox = { top: number; left: number; width: number; height: number };
