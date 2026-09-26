# Landing video cover — change record & rollback (2026-09-22)

Status: **approved by the owner 2026-09-23 for all five markets; merged to `main`
and deployed to DE/GB/FR/PL/IT the same day** (deploy log in the final report).
Baseline tag `landing-v1-before-video` (= `main` @ `1f85088`) marks the last
classic-cover state. Per-market verification before deploy: clip plays muted,
headline/service line/counts/links in each language, one screen at 1440×900,
no horizontal overflow on phones, no BAFA wording outside DE, header-fit e2e
36/36 in every market.

## What changed

| File | Kind | Purpose |
|---|---|---|
| `src/config/landingHero.ts` | new · common | Per-market switch `LANDING_HERO` (`'classic' \| 'video'`) + the shared clip paths, native size and edge colour. DE = `video`, others `classic`. |
| `src/components/auth/VideoCover.tsx` (floor shade, 2026-09-23) | — | A gradient from 70 % of the stage to the page bottom darkens the floor progressively: the studio's lit sheen ends in a soft band (~78 % of the frame) that read as a line on mid-size screens, and the counts/buttons sit on a calmer ground. Starts at zero opacity where the parts end (73 %). |
| `src/components/auth/VideoCover.tsx` | new · common | The cover itself (design reference: headline on top, the clip as the full-width stage, counts + compact Sign up / Log in below, public-page links bottom-left, play/pause bottom-right). Desktop: one viewport; the stage box is **measured** so the band the moving parts occupy (28 %–73 % of the clip height) always lies between the headline and the counts, at every viewport height — no overlay ever sits on a part. Phones/tablets: ordinary flow (headline → clip at its aspect → counts → entry → links). Reuses the classic header pieces (logo, market badge, language pill, social links). |
| `src/components/auth/StageCanvas.tsx` | new · common | Studio continuation (2026-09-23): paints the **decoded video frame** (not the poster JPEG — browsers render the two with different colour ranges) in the stage box and stretches its outermost rows/columns (plain studio) to the page edges, unblurred — so the clip's floor and mist run on to the viewport border at every window size with no visible step (boundary pixels measured equal). Redrawn on resize and when frames arrive; poster only as fallback. |
| `src/components/auth/VideoBackdrop.tsx` | new · common | Login / signup backdrop (2026-09-23): the same clip, fixed full-viewport, contained + centred, StageCanvas behind, no control, dimmed (`rgba(3,13,12,.45)` — 58 % until owner asked for more of the clip to show, 2026-09-23). Decorative (`aria-hidden`), reduced motion → still poster. |
| `src/components/auth/HeroVideo.tsx` | new · common | The clip: muted/inline/loop autoplay (force-muted before every play), object-fit contain (never cropped), keyboard-operable play/pause `<button>`, pause when offscreen or tab hidden, never auto-resumes a visitor's own pause, reduced-motion → poster until pressed, poster before load / on autoplay refusal / on load failure. Edge vignette in the clip's own edge colour (outer ~5 % only). |
| `src/components/auth/AuthShell.tsx` | modified · common | `Wordmark`, `MarketBadge`, `LanguagePill`, `SocialLinks` exported; new `backdrop='video'` prop swaps the decorative layer for `VideoBackdrop` (header, content, footer unchanged). |
| `src/index.css` | modified · common | `.hp-card-solid` — the login/signup card over the backdrop: dark 56 % pane + 22 px blur (owner 2026-09-23, stepped down from 84 % so the clip's motion shows through) while the form still reads first. |
| `src/App.tsx` | modified · common | `LANDING` renders `VideoCover` when the market's switch is `video`; the classic branch is untouched. Login, signup and the registration-paused screen pass `backdrop='video'` + `hp-card-solid` in video-cover markets only. |
| `src/translations.ts` | modified · 5 languages | `authHeroLine`, `authVideoPlay`, `authVideoPause`, `authVideoAlt`. |
| `public/media/hero/heatpump-assembly-loop-v2.mp4` | new asset | Web copy of the owner's clip: H.264 crf 24, faststart, no audio — 1.84 MB, 10.17 s, 1998×1038, 24 fps. |
| `public/media/hero/heatpump-assembly-loop-v2-poster.jpg` | new asset | First frame (assembled unit in the studio), 72 KB. |
| `docs/LANDING_VIDEO_HERO.md` | new | This record. |

Source: `/Users/christophersung/Downloads/HeatPump_DB_Assembly_Loop.mp4` (4,356,860 bytes,
H.264 1998×1038, 24 fps, 244 frames, 10.167 s, **no audio stream**). Untouched;
both assets were generated from it with ffmpeg. Measured facts used by the
layout: background is a dark studio (edges ≈ `#051a18`–`#000d0c`, lit mist at
top centre `#1e423c`); moving parts occupy 28.3 %–~73 % of the frame height
(bright pixels reach 79.8 % — the last ~7 % is the front grille's floor
reflection) and 5.5 %–92.7 % of the width; first ↔ last frame mean difference
0.2/255 → the loop is seamless (assembled → exploded → reassembled).

Removed from the DE cover (still present on the classic cover): tagline pill,
the large Residential/Commercial tiles and their descriptions, the three chips,
the "Willkommen" card. The tiles had no handlers — decorative — so no access
path was lost. Legal links were never on the landing page (they live on the
login/signup pages); nothing removed there. The indexable keyword line stays in
the document (visually hidden).

## Counts

`__MARKET_STATS__` is injected at build time by `vite.config.ts → marketStats()`
from the market's two dataset files (`res` = residential file length, `com` =
commercial file length). Total is `res + com` — there is no separate total
source, so the total and the two parts cannot disagree. Build-time constants
(no loading state); the block is hidden when `res` is 0 (datasets absent).
Number formatting is the existing `toLocaleString()` (browser locale),
unchanged from the classic cover. DE at build: 7,336 = 5,330 + 2,006.

## Verified (Playwright, real Chromium playback)

- 1440×900, 1920×1080, 1280×720, 1440×768: plays, muted, one screen (no page
  scroll), no horizontal overflow; headline ends above the parts band and the
  counts start below it at every size (on 720/768-high screens the counts sit
  over the floor reflection, as in the design reference).
- 390×844 phone and 820×1180 tablet: order headline → clip → counts → buttons →
  links, clip at native aspect, no overflow, 52 px buttons.
- Play/pause button (click, Enter), visitor pause survives scroll-away/return,
  offscreen auto-pause + resume, hidden-tab pause + resume, reduced motion
  (poster, `preload=none`, plays on press), mp4 404 → poster fallback,
  DE→EN switch, Sign up → signup form, Log in → login form, no console errors.

## Rollback

*Before the merge (historic):* the work lived only on `feat/landing-video-de`.

*One market back to classic (before or after deploy):* set that market to
`'classic'` in `src/config/landingHero.ts`, build and deploy that market's
target only (`npm run build:de && npm run deploy:de`, etc.).

*Whole change back after a merge:* `git revert <merge or squash commit>` on
`main` and redeploy the affected market(s). Assets under `public/media/hero/`
are removed by the revert; leaving them would be harmless (~1.9 MB static).

*Unrelated work:* the branch was cut from `main` @ `1f85088` with a clean tree;
nothing else is on it.

## Mobile (2026-09-26)

Phones and tablets use the same composition as desktop: measured stage box,
studio continuation and floor shade at every width (the earlier in-flow
rounded card read as a separate window). iOS fix: `play()` is called on
mount — iOS Safari loads nothing until then, so the `canplay`-gated autoplay
never started and the poster stayed up. Short phones keep a 170 px minimum
band for the clip and scroll a little.

## iOS playback — the real cause (2026-09-26, second pass)

The clip fell under the global `**` → `Cache-Control: no-cache` hosting rule,
and Firebase Hosting answers Range requests on no-cache paths with **200 +
the whole file**; iOS Safari will not play a video without 206 byte-range
responses. `/media/**` now has its own cacheable rule on every target
(verified 206 after deploy). Any new video path must get the same rule.
The React `muted` prop sets only the property — the attribute is set
explicitly too, and the first touch/scroll is a play() fallback.

## Known limitations

1. On short desktop viewports (≤ 768 px high) the stage shrinks (e.g. 868×451
   at 1280×720) so nothing overlaps; the clip is smaller than on a 900 px+
   screen. The studio around it is continued by StageCanvas, so there is no
   visible box — but the parts are correspondingly smaller.
2. Social icons remain in the header (the reference omits them) — kept
   because they are existing functionality.
3. The clip is 1.84 MB; the headline and buttons render before it (poster
   shows meanwhile).
