/**
 * trends-card-frame — the card FRAME, shared by the single-card renderer and
 * the deck renderer.
 *
 * WHY THIS FILE EXISTS
 * The frame is brand furniture: market-tinted ground, side rail with the
 * domain, flag badge, month, title block, footer lockup. It was written once
 * inside build-trends-card.mjs, and the moment a second renderer needed it
 * (the swipeable deck) the choice was to copy it or to share it. A copy drifts
 * — one of the two would have kept the old padding after the next tweak and a
 * deck's second card would stop looking like the first. So: one frame, two
 * callers.
 *
 * cardDoc(spec)  → a complete 1254x1254 document (single card)
 * deckDoc(cards) → the same cards stacked vertically, one per 1254px band,
 *                  which is what the deck renderer screenshots and slices.
 *
 * ONE-SOURCE RULE unchanged: the footer lockup is the official brand SVG
 * export and the badge is the market's real app icon — neither is redrawn.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES, IC, esc, renderSection } from './trends-card-blocks.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BRIDGE_SVG = '/Users/christophersung/Claude/Projects/HeatPump DB Marketing/Claude Code/brand/svg';

export const CARD_PX = 1254;
/** Deck ratios. LinkedIn's feed gives a portrait card more screen than a
 *  square one, which is why the reference carousels are 4:5; the site's own
 *  card feed has always been square. One renderer serves both. */
export const RATIOS = { '1:1': [1254, 1254], '4:5': [1254, 1568] };

/** Sections, with the legacy hero/leftPanel/rightPanel/kurzfazit shape mapped
 *  onto the block vocabulary so the first cards still render from their
 *  original spec files. */
export const sectionsOf = (S) => S.sections ?? [
  { type: 'hero', ...S.hero },
  [
    { type: 'table', flex: 1.15, ...S.leftPanel },
    { type: 'list', flex: 1, ...S.rightPanel },
  ],
  { type: 'fazit', ...S.kurzfazit },
].filter(Boolean);

const lockupOf = (T) => {
  const f = join(BRIDGE_SVG, 'heatpumpdb-3a-lockup-dark.svg');
  return existsSync(f) ? readFileSync(f, 'utf8')
    : `<b style="color:#fff">HeatPump <span style="color:${T.a}">DB</span></b>`;
};

const badgeOf = (cc) => {
  const f = join(ROOT, 'public', 'icons', `${cc === 'GB' ? 'uk' : cc.toLowerCase()}-192.png`);
  return existsSync(f) ? `data:image/png;base64,${readFileSync(f).toString('base64')}` : '';
};

/** The style block. `S` only reaches it for titleSize, so a deck can vary the
 *  title size per card without the frame changing anywhere else. */
export const cardCss = (T, S = {}) => `
  * { box-sizing: border-box; margin: 0; }
  body { width: ${S.__w ?? 1254}px; height: ${S.__h ?? 1254}px; background: ${T.deep}; padding: 26px;
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased; }
  .card { width: 100%; height: 100%; border-radius: 26px; padding: 40px 52px 32px 116px;
    position: relative; display: flex; flex-direction: column; overflow: hidden;
    background: radial-gradient(120% 100% at 30% 12%, ${T.mid} 0%, ${T.base} 58%, ${T.deep} 100%); }
  /* Two soft market glows — the same aurora the landing page shows. */
  .glowA, .glowB { position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none; }
  .glowA { width: 620px; height: 620px; top: -230px; left: -170px; background: ${T.a}1f; }
  .glowB { width: 560px; height: 560px; bottom: -240px; right: -160px; background: ${T.b}1a; }

  .rail { position: absolute; left: 0; top: 0; bottom: 0; width: 90px; border-right: 1px solid rgba(255,255,255,.08); }
  .railtxt { position: absolute; left: 33px; top: 44%; transform: rotate(180deg); writing-mode: vertical-rl;
    letter-spacing: 5px; font-size: 14.5px; color: rgba(255,255,255,.3); }
  .raildash { position: absolute; left: 35px; bottom: 62px; width: 22px; height: 4px; border-radius: 2px; background: ${T.b}; }
  .badge { position: absolute; left: 20px; top: 40px; width: 52px; height: 52px; border-radius: 12px; }
  .month { position: absolute; right: 52px; top: 50px; color: rgba(255,255,255,.42); font-size: 16.5px;
    letter-spacing: 3px; font-weight: 600; }
  /* Deck position. A reader who has swiped twice needs to know whether a
     third card exists — the dots say so without a caption. */
  .pips { display: flex; gap: 7px; align-items: center; margin-left: 20px; }
  .pips i { width: 9px; height: 9px; border-radius: 50%; background: rgba(255,255,255,.22); display: block; }
  .pips i.on { background: ${T.a}; width: 26px; border-radius: 5px; }
  .swipe { display: flex; align-items: center; gap: 8px; margin-left: 22px;
    color: rgba(255,255,255,.55); font-size: 17px; font-weight: 600; white-space: nowrap; }
  .swipe b { color: ${T.a}; font-size: 22px; }
  .motif { position: absolute; right: 54px; top: 112px; opacity: .16; }

  h3.country { font-size: 32px; color: #fff; font-weight: 700; margin-bottom: 14px; position: relative; }
  h1 { font-size: ${S.titleSize ?? 45}px; line-height: 1.14; color: #fff; font-weight: 800; letter-spacing: -.8px; position: relative; }
  h1 .l2 { color: ${T.a}; display: block; }
  .sub { margin-top: 12px; color: rgba(255,255,255,.68); font-size: 24px; line-height: 1.4; max-width: 940px; position: relative; }

  .flow { display: flex; flex-direction: column; gap: 20px; margin-top: 24px; flex: 1; position: relative; min-height: 0; }
  /* The opening stat and the closing takeaway keep their natural height; the
     content blocks between them absorb whatever height is left and centre
     their content. Letting every block size to content left craters on short
     cards; letting every block stretch left empty rectangles under short
     lists — this does neither. */
  .flow > * { flex: 0 0 auto; }
  .flow > .row, .flow > .pnl, .flow > .stats { flex: 1 1 auto; }
  .pnl { justify-content: center; }
  .row { display: flex; gap: 20px; align-items: stretch; min-height: 0; }
  .cell { display: flex; flex-direction: column; min-width: 0; }
  .cell > * { flex: 1; }
  .pnl { background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.09); border-radius: 18px;
    padding: 22px 24px; display: flex; flex-direction: column; }
  .ph { display: flex; align-items: center; gap: 13px; margin-bottom: 14px; }
  .ph b { color: #fff; font-size: 28px; font-weight: 700; }

  /* hero */
  .hero { background: rgba(255,255,255,.05); border: 1px solid ${T.a}30; border-radius: 20px;
    padding: 24px 32px; display: flex; align-items: center; gap: 28px; }
  .hico { flex: none; } .hsep { width: 1px; align-self: stretch; background: rgba(255,255,255,.1); }
  .hbig { font-size: 31px; color: #fff; font-weight: 700; line-height: 1.15; }
  .hbig b { color: ${T.a}; font-size: 54px; font-weight: 800; }
  .hcap { margin-top: 5px; color: rgba(255,255,255,.6); font-size: 19px; line-height: 1.35; }
  .hside { margin-left: auto; text-align: right; }
  .hside span { display: block; color: ${T.b}; font-size: 30px; font-weight: 800; }
  .hside small { color: rgba(255,255,255,.55); font-size: 15px; }

  /* stats */
  /* The stat row is the card's headline furniture: it stretches with the
     flow, so its contents CENTRE inside whatever height they are given rather
     than clinging to the top and leaving a hole underneath. */
  .stats { display: flex; gap: 18px; }
  .stat { flex: 1; background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.09);
    border-radius: 18px; padding: 26px 26px; display: flex; flex-direction: column; gap: 6px;
    justify-content: center; text-align: center; align-items: center;
    justify-content: center; }
  .sv { font-size: 62px; font-weight: 800; letter-spacing: -1.5px; line-height: 1.05; }
  .sl { color: rgba(255,255,255,.8); font-size: 22px; line-height: 1.3; }
  .sn { color: rgba(255,255,255,.45); font-size: 16px; margin-top: 4px; }

  /* bars */
  .bars { display: flex; gap: 20px; align-items: flex-end; flex: 1; padding-top: 8px; min-height: 230px; }
  .bar { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; gap: 8px; }
  .bv { font-size: 20px; font-weight: 700; }
  .bcol { width: 100%; max-width: 92px; border-radius: 10px 10px 3px 3px; }
  .bl { color: rgba(255,255,255,.55); font-size: 15px; text-align: center; }
  .bfoot { margin-top: auto; padding-top: 14px; color: rgba(255,255,255,.45); font-size: 16px; }

/* series */
  .lgnd { display: flex; gap: 20px; font-size: 15px; color: rgba(255,255,255,.6); margin-bottom: 6px; }
  .lgnd span { display: inline-flex; align-items: center; gap: 7px; }
  .lgnd i { width: 13px; height: 13px; border-radius: 3px; display: inline-block; }
  .sbars { display: flex; gap: 16px; align-items: flex-end; flex: 1; padding-top: 10px; min-height: 250px; }
  .sbar { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%;
    justify-content: flex-end; gap: 7px; }
  .sbar .sv { font-size: 18px; font-weight: 700; color: #fff; white-space: nowrap; }
  .scol { width: 100%; max-width: 86px; border-radius: 9px 9px 3px 3px; background: rgba(255,255,255,.2);
    display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; }
  .shp { width: 100%; border-radius: 0 0 3px 3px; box-shadow: 0 -1px 0 rgba(255,255,255,.55); min-height: 3px; }
  .sbar .sl { color: rgba(255,255,255,.55); font-size: 15px; }
  .sbar .ss { font-size: 17px; font-weight: 800; }

  /* table */
  .cols { display: flex; justify-content: flex-end; font-size: 13px; letter-spacing: 1.4px; margin-bottom: 6px; }
  .cols .c1 { color: rgba(255,255,255,.4); width: 120px; text-align: center; }
  .cols .c2 { width: 168px; text-align: right; font-weight: 700; }
  .trow { display: flex; align-items: center; padding: 12px 0; border-top: 1px solid rgba(255,255,255,.08); font-size: 18px; }
  .tl { flex: 1; color: rgba(255,255,255,.78); padding-right: 8px; }
  .tf { width: 92px; text-align: center; color: rgba(255,255,255,.45); }
  .arr { width: 40px; text-align: center; }
  .tt { min-width: 146px; text-align: right; font-weight: 700; white-space: nowrap; }

  /* list */
  .rrow { display: flex; align-items: center; gap: 14px; padding: 11px 0; }
  .ric { flex: none; display: grid; place-items: center; width: 48px; height: 48px; border: 1.6px solid; border-radius: 50%; }
  .rl { flex: 1; color: rgba(255,255,255,.78); font-size: 18.5px; line-height: 1.3; }
  .rv { font-size: 22px; font-weight: 800; white-space: nowrap; }
  .rnote { margin-top: auto; border-top: 1px solid rgba(255,255,255,.08); padding-top: 14px; display: flex; gap: 14px; align-items: center; }
  .rnt b { display: block; color: #fff; font-size: 18px; }
  .rnt span { font-size: 17.5px; font-weight: 700; }
  .rnt span i { color: rgba(255,255,255,.55); font-style: normal; font-weight: 400; }

  /* checks */
  /* Rows share the panel's spare height instead of stacking at the top —
     a four-item list and a two-item list both fill their panel. */
  .checks { display: flex; flex-direction: column; justify-content: space-evenly; flex: 1; }
  .crow { display: flex; gap: 16px; align-items: center; padding: 6px 0; }
  .cic { flex: none; }
  .cl { color: rgba(255,255,255,.84); font-size: 25px; line-height: 1.34; }

  /* timeline */
  .tline { display: flex; flex-direction: column; justify-content: space-evenly; gap: 18px; flex: 1; }
  .tstep { display: flex; gap: 14px; align-items: flex-start; position: relative; }
  .tdot { flex: none; width: 15px; height: 15px; border-radius: 50%; margin-top: 5px; }
  .trail { position: absolute; left: 7px; top: 22px; width: 2px; height: calc(100% + 4px); }
  .ttx b { display: block; font-size: 19px; letter-spacing: .6px; }
  .ttx span { color: rgba(255,255,255,.8); font-size: 21px; line-height: 1.4; display: block; margin-top: 3px; }

  /* compare */
  .cmp { display: flex; gap: 18px; flex: 1; }
  .cmpc { flex: 1; border: 1px solid rgba(255,255,255,.1); border-radius: 15px; padding: 18px 20px;
    display: flex; flex-direction: column; gap: 9px; justify-content: center; }
  .cmph { font-size: 16px; font-weight: 800; letter-spacing: 1.4px; }
  .cmpr { display: flex; justify-content: space-between; gap: 12px; font-size: 17.5px; color: rgba(255,255,255,.72); }
  .cmpr b { font-size: 19px; white-space: nowrap; }

  /* lead — the cover card: a mark that stands for the subject, a line of
     situation, and at most three points on what follows */
  .lead { display: flex; align-items: center; gap: 56px; flex: 1; padding: 0 10px; }
  .leadmark { flex: none; width: 330px; height: 330px; border: 2px solid; border-radius: 56px;
    display: grid; place-items: center; }
  .leadtx { flex: 1; min-width: 0; }
  .leadp { color: rgba(255,255,255,.88); font-size: 36px; line-height: 1.46; }
  .leadpts { margin-top: 32px; display: flex; flex-direction: column; gap: 18px; }
  .leadpts span { display: flex; align-items: center; gap: 16px; color: rgba(255,255,255,.72); font-size: 28px; line-height: 1.3; }
  .leadpts i { flex: none; width: 12px; height: 12px; border-radius: 50%; display: block; }

  /* chips — icon + bold line + muted line, the deck's "what is wrong" list */
  .chips { display: flex; flex-direction: column; gap: 16px; justify-content: center; flex: 1; }
  .chip { display: flex; align-items: center; gap: 20px; background: rgba(255,255,255,.055);
    border: 1px solid rgba(255,255,255,.09); border-radius: 18px; padding: 22px 26px; }
  .chic { flex: none; width: 62px; height: 62px; border: 1.6px solid; border-radius: 16px; display: grid; place-items: center; }
  .chtx { flex: 1; min-width: 0; }
  .chtx b { display: block; color: #fff; font-size: 30px; font-weight: 700; line-height: 1.2; }
  .chtx i { display: block; color: rgba(255,255,255,.55); font-size: 22px; font-style: normal; margin-top: 4px; }
  .chv { font-size: 34px; font-weight: 800; white-space: nowrap; }

  /* cta — the closing card: one number, one address */
  .ctablk { display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: 10px; flex: 1; }
  .ctabig { font-size: 132px; font-weight: 800; letter-spacing: -4px; line-height: 1; }
  .ctaline { color: #fff; font-size: 38px; font-weight: 700; line-height: 1.2; }
  .ctabox { margin-top: 26px; display: flex; align-items: center; gap: 22px; background: #fff;
    border-radius: 20px; padding: 20px 26px; }
  .ctaqr { flex: none; width: 104px; height: 104px; display: block; }
  .ctaqr svg { width: 100%; height: 100%; display: block; }
  .ctatx b { display: block; color: #0b1220; font-size: 30px; font-weight: 800; }
  .ctatx i { display: block; color: #55637a; font-size: 21px; font-style: normal; margin-top: 3px; }

  /* fazit */
  .fazit { background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.09); border-radius: 18px;
    padding: 20px 28px; display: flex; gap: 22px; align-items: center; }
  .fico { flex: none; width: 72px; height: 72px; border: 1.6px solid; border-radius: 50%; display: grid; place-items: center; }
  .ftxt b { display: block; color: #fff; font-size: 29px; margin-bottom: 6px; }
  .ftxt p { color: rgba(255,255,255,.72); font-size: 23px; line-height: 1.42; }
  .fmotif { margin-left: auto; flex: none; opacity: .8; }

  .foot { margin-top: 20px; display: flex; align-items: center; position: relative; }
  .foot svg { height: 38px; width: auto; }
  .fteam { margin-left: auto; color: rgba(255,255,255,.34); font-size: 16px; }`;

/** The card itself — everything inside the 1254x1254 frame. */
export function cardBody(S) {
  const cc = String(S.country).toUpperCase();
  const T = THEMES[cc] ?? THEMES.DE;
  const lockup = lockupOf(T), badge = badgeOf(cc);
  const sections = sectionsOf(S);
  return `
<div class="card">
  <span class="glowA"></span><span class="glowB"></span>
  <div class="rail"></div>
  ${badge ? `<img class="badge" src="${badge}">` : ''}
  <div class="railtxt">HEATPUMPDB${cc === 'GB' ? '.UK' : '.' + cc}</div>
  <div class="raildash"></div>
  <div class="month">${esc(S.month)}</div>
  ${S.motif ? `<div class="motif">${IC(S.motif, '#ffffff', 140)}</div>` : ''}

  <h3 class="country">${esc(S.countryLabel ?? cc)}</h3>
  <h1>${esc(S.title[0])}${S.title[1] ? `<span class="l2">${esc(S.title[1])}</span>` : ''}</h1>
  ${S.sub ? `<p class="sub">${esc(S.sub)}</p>` : ''}

  <div class="flow">${sections.map((s) => renderSection(s, T)).join('')}</div>

  <div class="foot">${lockup}<span class="fteam">${esc(S.footer)}</span>${
    S.__swipe ? `<span class="swipe">${esc(S.__swipe)} <b>&rsaquo;</b></span>` : ''}${
    S.__pips ? `<span class="pips">${S.__pips.map((on) => `<i class="${on ? 'on' : ''}"></i>`).join('')}</span>` : ''}</div>
</div>`;
}

/** A complete document for ONE card — what build-trends-card.mjs screenshots. */
export function cardDoc(S) {
  const cc = String(S.country).toUpperCase();
  const T = THEMES[cc] ?? THEMES.DE;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${cardCss(T, S)}</style></head><body>${cardBody(S)}</body></html>`;
}

/**
 * The deck: N cards stacked, each in its own 1254x1254 band. The renderer
 * screenshots one card at a time by clipping to the band, so a deck and a
 * single card come out of exactly the same markup — no second layout to keep
 * in step.
 */
export function deckDoc(cards) {
  const cc = String(cards[0].country).toUpperCase();
  const T = THEMES[cc] ?? THEMES.DE;
  // Every card may carry its own titleSize; the per-card override is scoped to
  // its band so one long headline cannot shrink the rest of the deck.
  const css = cards.map((c, i) => c.titleSize
    ? `#band${i} h1 { font-size: ${c.titleSize}px; }` : '').join('\n');
  const [W, H] = RATIOS[cards[0].__ratio ?? '1:1'] ?? RATIOS['1:1'];
  const portrait = (cards[0].__ratio ?? '1:1') !== '1:1';
  const bands = cards.map((c, i) =>
    `<div class="band${portrait ? ' portrait' : ''}" id="band${i}">${cardBody(c)}</div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${cardCss(T, cards[0])}
  body { width: ${W}px; height: auto; padding: 0; }
  .band { width: ${W}px; height: ${H}px; padding: 26px; background: ${T.deep}; }

  /* ── Portrait rules, scoped to the deck ───────────────────────────────
     The square card stretches its blocks to fill the frame; at 4:5 that same
     rule turns a three-stat row into three 1,200px columns. A deck card
     instead keeps its blocks at their natural height and CENTRES them in the
     space under the headline — which is what the reference decks do, and why
     a card carrying one idea still looks composed rather than half empty. */
  /* Blocks still fill the frame — a portrait card with air under the headline
     reads as unfinished. What changes is the TYPE: a number that filled a
     square panel is lost in a portrait one, so the deck scales it up rather
     than shrinking the panel down. */
  .band.portrait .flow { gap: 24px; }
  .band.portrait .flow > * { flex: 1 1 auto; }
  .band.portrait .flow > .fazit { flex: 0 0 auto; }
  /* Three figures side by side fit a square; in portrait the same three
     columns are 310px wide and every number breaks across two lines. The deck
     lays them out as three ROWS instead — the number keeps its size, the
     label sits beside it, and the group fills the height it was given. */
  .band.portrait .stats { flex-direction: column; gap: 18px; }
  .band.portrait .stat { flex-direction: row; align-items: center; justify-content: flex-start;
    text-align: left; gap: 30px; padding: 28px 38px; }
  .band.portrait .sv { font-size: 76px; min-width: 340px; }
  .band.portrait .sl { font-size: 30px; line-height: 1.25; }
  .band.portrait .sn { font-size: 21px; margin-top: 0; }
  .band .chips { gap: 22px; }
  .band .chip { padding: 34px 34px; }
  .band .chtx b { font-size: 36px; }
  .band .chtx i { font-size: 25px; }
  .band .chic { width: 76px; height: 76px; }
  .band.portrait .ctabig { font-size: 190px; }
  .band.portrait .ctaline { font-size: 46px; }
  .band .ctabox { padding: 26px 32px; }
  .band .ctaqr { width: 128px; height: 128px; }
  .band .ctatx b { font-size: 36px; }
  .band .ctatx i { font-size: 24px; }
  .band .ftxt b { font-size: 33px; }
  .band .ftxt p { font-size: 26px; }
  .band .cell > * { flex: 1; }
  /* The position dots and the swipe hint sit ABOVE the footer lockup, not on
     top of it — at 4:5 the footer row is where the eye lands last. */
  ${css}
</style></head><body>${bands}</body></html>`;
}
