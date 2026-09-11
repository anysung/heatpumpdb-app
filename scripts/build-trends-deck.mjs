#!/usr/bin/env node
/**
 * build-trends-deck.mjs — render a SWIPEABLE deck of Market & Trends cards
 * from one spec: card 1 carries the headline and the key figure, the cards
 * after it carry one idea each, and the last one carries the address.
 *
 * WHY A DECK AND NOT A LONGER CARD
 * A single card has to choose between saying enough and staying readable on a
 * phone. A deck does not: each card holds ONE idea at full size, and the
 * reader decides how far to go. It is also the only format that behaves the
 * same on both surfaces we publish to — the feed on our own site pages
 * through it with arrows, and LinkedIn pages through the identical images as
 * a carousel.
 *
 * WHAT THE REFERENCE DECKS DO, AND WHAT WE TOOK (owner brief 2026-09-11)
 *   · one idea per card and a caption under each — taken;
 *   · their portrait 4:5 — NOT taken (owner 2026-09-12): our cards are square
 *     and the feed they live in is square, so a deck that changed shape would
 *     have made the archive look like two products. 4:5 stays available via
 *     `ratio` for a LinkedIn-only deck;
 *   · one dominant element per card: a headline over a ground, a stack of
 *     three chips, a grid of tiles, a number;
 *   · a one-line caption UNDER each card (LinkedIn shows it beneath the
 *     image) — written here, published with the images;
 *   · the last card is the offer, with the address readable as text and a QR
 *     for the phone, because a carousel is not clickable.
 * What we did NOT take: their stock photography. Our cards are data furniture
 * on the market's own palette, and a photo would make them look like an ad.
 *
 * SPEC  (data_sources/market_trends/decks/<cc>-<slug>.deck.json)
 *   { country, countryLabel, month, footer, ratio?: '4:5'|'1:1',
 *     slug, cards: [ { title[2], sub?, caption, motif?, titleSize?,
 *                      sections: [ block | [block, block] ] } ] }
 * Everything the cards share (country, month, footer …) is written once and
 * inherited; a card may override any of it.
 *
 * LENGTH  3-6 cards for a story, 8 maximum. Card 1 is the SUBJECT — title,
 *         sub, a line of situation and a mark that stands for it (the `lead`
 *         block); the key chart or illustration opens card 2. A cover that
 *         leads with the number has already spent the story's one surprise.
 *
 * OUT  <outDir>/<slug>-1.png … -N.png   (2× masters)
 *      <outDir>/<slug>-captions.txt     (the per-card lines, in order)
 *      <outDir>/<slug>-carousel.pdf     (LinkedIn document post, one card/page)
 *
 * Run:  node scripts/build-trends-deck.mjs <deck.json> [outDir]
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deckDoc, RATIOS } from './lib/trends-card-frame.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const specPath = process.argv[2];
if (!specPath) { console.error('Usage: build-trends-deck.mjs <deck.json> [outDir]'); process.exit(1); }
const D = JSON.parse(readFileSync(specPath, 'utf8'));
const slug = D.slug ?? basename(specPath).replace(/\.deck\.json$/, '');
const outDir = process.argv[3] ?? join(ROOT, 'data_sources', 'market_trends', 'images');
mkdirSync(outDir, { recursive: true });

const ratio = D.ratio ?? '1:1';
const [W, H] = RATIOS[ratio] ?? RATIOS['1:1'];

/* A deck is 3 to 6 cards; 8 is the ceiling. Below three there is nothing to
   swipe through, and past six the last card is read by almost nobody — the
   limit is a content rule, so the renderer states it rather than silently
   producing a deck no one finishes. */
if (D.cards.length < 2) { console.error('✗ a deck needs at least 2 cards'); process.exit(1); }
if (D.cards.length > 8) { console.error(`✗ ${D.cards.length} cards — 8 is the ceiling; split the story`); process.exit(1); }
if (D.cards.length > 6) console.error(`note: ${D.cards.length} cards — 3 to 6 is the range that gets read to the end`);

/* Shared fields are written once at the top of the deck; a card overrides
   what it needs. The pips and the swipe hint are frame furniture, not content,
   so the spec never carries them. */
const cards = D.cards.map((c, i) => ({
  country: D.country, countryLabel: D.countryLabel, month: D.month, footer: D.footer,
  ...c,
  __w: W, __h: H, __ratio: ratio,
  __pips: D.cards.length > 1 ? D.cards.map((_, j) => j === i) : null,
  __swipe: i === 0 && D.cards.length > 1 ? (D.swipeHint ?? '') : '',
}));

const browser = await chromium.launch();
const page = await (await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 2,
})).newPage();
await page.setContent(deckDoc(cards), { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

/* A card that overflows its own frame ships a cut-off panel. Check every card
   BEFORE writing any file, and name the ones that need shortening — a deck
   where card 3 is clipped is worse than no deck. */
const overflows = await page.evaluate(() => [...document.querySelectorAll('.band')].map((band, i) => {
  const f = band.querySelector('.flow');
  return { i, over: f.scrollHeight - f.clientHeight };
}));
const bad = overflows.filter((o) => o.over > 2);
for (const o of bad) console.error(`✗ card ${o.i + 1} overflows by ${o.over}px — shorten a block or drop a row`);

const files = [];
for (let i = 0; i < cards.length; i++) {
  const out = join(outDir, `${slug}-${i + 1}.png`);
  await page.locator(`#band${i}`).screenshot({ path: out });
  files.push(out);
}

/* The captions travel with the images: LinkedIn asks for one line per card
   when the carousel is uploaded, and writing them at render time keeps them
   in step with the cards they describe. */
const captions = cards.map((c, i) => `${i + 1}. ${c.caption ?? ''}`).join('\n');
writeFileSync(join(outDir, `${slug}-captions.txt`), `${captions}\n`);

/* The LinkedIn document post wants a PDF; each page is exactly one card.
   The page is WRITTEN TO DISK and opened as a file, not fed to setContent: a
   setContent document has an about:blank origin and the browser refuses its
   file:// images — which produced a five-page PDF carrying two of them and no
   error at all. It is loaded from the image directory so the <img> sources are
   plain relative names. */
const deckHtmlPath = join(outDir, `${slug}-carousel.tmp.html`);
writeFileSync(deckHtmlPath, `<!doctype html><meta charset="utf-8"><style>
  @page { size: ${W}px ${H}px; margin: 0 }
  html,body { margin:0; padding:0 }
  img { display:block; width:${W}px; height:${H}px; page-break-after:always; break-after:page }
  img:last-child { page-break-after:auto; break-after:auto }
</style>${files.map((f) => `<img src="${basename(f)}">`).join('')}`);
const pdfPage = await (await browser.newContext()).newPage();
await pdfPage.goto(pathToFileURL(deckHtmlPath).href, { waitUntil: 'networkidle' });
const drawn = await pdfPage.evaluate(() => [...document.images].filter((im) => im.naturalWidth > 0).length);
if (drawn !== files.length) console.error(`✗ carousel PDF: ${drawn}/${files.length} cards loaded — not written`);
else {
  await pdfPage.pdf({ path: join(outDir, `${slug}-carousel.pdf`), width: `${W}px`, height: `${H}px`, printBackground: true, pageRanges: `1-${cards.length}` });
}
rmSync(deckHtmlPath, { force: true });

await browser.close();
console.log(`→ ${cards.length} cards ${W * 2}×${H * 2} (${ratio}, ${String(D.country).toUpperCase()} palette)`);
console.log(`   ${outDir}/${slug}-1…${cards.length}.png · ${slug}-captions.txt · ${slug}-carousel.pdf`);
if (bad.length) console.log(`   ⚠ ${bad.length} card(s) overflow — fix before publishing`);
