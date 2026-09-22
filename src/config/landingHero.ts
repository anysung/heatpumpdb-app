import { CountryCode } from './countryProfiles';

/**
 * Which cover (landing) layout each market shows to signed-out visitors.
 *
 *  - 'classic' — the two-column story + entry card that shipped until 2026-09.
 *  - 'video'   — the product-video cover (owner brief 2026-09-22): headline,
 *                the disassembly/assembly video at its native aspect, the live
 *                model counts and a compact Sign up / Log in pair.
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

/** The one hero clip, shared by every market that uses the video cover. The
 *  original render stays in the owner's Downloads folder; these are web
 *  derivatives made from it (docs/LANDING_VIDEO_HERO.md). Sizes are the
 *  clip's native pixels — the layout keeps this aspect and never crops. */
export const HERO_VIDEO = {
  src: '/media/hero/heatpump-hero-v1.mp4',
  /** Forward + reversed copy (10 s): the source ends fully exploded, so the
   *  plain loop is a hard cut back to the assembled unit. Offered for the
   *  owner to compare; not the default. */
  pingpongSrc: '/media/hero/heatpump-hero-v1-pingpong.mp4',
  poster: '/media/hero/heatpump-hero-v1-poster.jpg',
  width: 1864,
  height: 968,
} as const;
