# Landing video cover — change record & rollback (2026-09-22)

Status: **preview complete · NOT deployed · not merged**. Branch `feat/landing-video-de`,
baseline tag `landing-v1-before-video` (= `main` @ `1f85088`). Only the German
market is switched to the new cover; GB/FR/PL/IT still render the classic cover.

## What changed

| File | Kind | Purpose |
|---|---|---|
| `src/config/landingHero.ts` | new · common | Per-market switch `LANDING_HERO` (`'classic' \| 'video'`) + the shared clip paths/size. DE = `video`, others `classic`. |
| `src/components/auth/HeroVideo.tsx` | new · common | The clip: muted/inline/loop autoplay, native aspect (never cropped), play/pause `<button>` (keyboard-operable), pause when offscreen or tab hidden, never auto-resumes over the visitor's own pause, reduced-motion → poster until pressed, poster before load / autoplay refusal / load failure. |
| `src/App.tsx` | modified · common | New `LANDING` branch used only when the market's switch is `video`: headline + one service line, the clip, counts (Total / Residential \| Commercial), compact Sign up / Log in pair, the three public-page links, the indexable keyword line. The classic branch is untouched. |
| `src/translations.ts` | modified · 5 languages | `authHeroLine`, `authVideoPlay`, `authVideoPause`, `authVideoAlt` in EN/DE/FR/PL/IT. |
| `public/media/hero/heatpump-hero-v1.mp4` | new asset | Web copy of the owner's clip (H.264, crf 22, faststart, no audio track) — 378 KB, 5 s, 1864×968. |
| `public/media/hero/heatpump-hero-v1-pingpong.mp4` | new asset | Forward + reversed concatenation (10 s, 733 KB) for comparison only; dev preview `?hero=pingpong`. Not used in production. |
| `public/media/hero/heatpump-hero-v1-poster.jpg` | new asset | First frame (assembled unit), 27 KB. |
| `docs/LANDING_VIDEO_HERO.md` | new | This record. |

Source: `/Users/christophersung/Downloads/3d-jutsu-heatpump-hero-de-v1-2026-09-22-00-53-54.mp4`
(1,026,061 bytes, H.264 1864×968, 30 fps, 150 frames, 5.000 s, **no audio stream**,
opaque background `#757a82`). Untouched; all three assets above were generated
from it with ffmpeg.

Removed from the DE cover (still present on the classic cover): tagline pill,
the large Residential/Commercial tiles and their descriptions, the three chips,
the "Willkommen" card. The tiles had no handlers — they were decorative — so no
access path was lost. Legal links were never on the landing page (they live on
the login/signup pages); nothing removed there.

## Counts

`__MARKET_STATS__` is injected at build time by `vite.config.ts → marketStats()`
from the market's two dataset files (`res` = residential file length, `com` =
commercial file length). Total is `res + com` — there is no separate total
source, so the total and the two parts cannot disagree. Values are build-time
constants (no loading state); the block is hidden when `res` is 0 (datasets
absent). Number formatting is the existing `toLocaleString()` (browser locale),
unchanged from the classic cover. DE at build: 7,336 = 5,330 + 2,006.

## Rollback

*Preview stage (now):* nothing is on `main`. `git checkout main` shows the
untouched site; delete the branch with `git branch -D feat/landing-video-de`
and the tag with `git tag -d landing-v1-before-video` if the work is dropped.
The assets live only on the branch.

*One market back to classic (before or after deploy):* set that market to
`'classic'` in `src/config/landingHero.ts`, build and deploy that market's
target (`npm run build:de && npm run deploy:de`, etc.). Nothing else changes.

*Whole change back after a merge:* `git revert <merge or squash commit>` on
`main` and redeploy the affected market(s). Assets under `public/media/hero/`
are removed by the revert; leaving them would be harmless (public static files,
~1.1 MB).

*Unrelated work:* the branch was cut from `main` @ `1f85088` with a clean tree;
no other work is on it, so removing it touches nothing else.

## Known limitations (source clip)

1. **Background is opaque mid-grey (`#757a82`)**, not the dark studio of the
   design reference. The product is rendered near-black, so it reads as a dark
   object on a light-grey slab; the page frames it as a rounded stage with a
   1 px border (the "deliberate boundary" the brief allows). A key-out would not
   help: the near-black parts would vanish into the dark page. The clean fix is a
   re-export from the 3D tool with a dark (or transparent) background and
   brighter product lighting — nothing in this implementation would change.
2. **The clip does not reassemble.** 0–2 s explode, 2–5 s hold with a slow
   rotation; the loop is a hard cut from exploded back to assembled. A
   forward+reverse comparison copy is provided (`?hero=pingpong` in dev); it is a
   presentation derivative, no new motion.
3. **The clip's own framing crops parts** in the exploded phase (top panel at
   the top edge, fan blade at the left edge from ~1.5 s). The layout shows the
   full frame; the cropping is inside the source.
4. At 1280×720 the clip floors at 560×291 and the Sign up / Log in pair sits
   ~80 px below the fold (visible at the slightest scroll); at ≥900 px height
   everything is on the first screen.
