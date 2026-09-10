#!/usr/bin/env node
/**
 * build-trends-card.mjs — render ONE Market & Trends card
 * (1254×1254 → 2508px PNG master) from a JSON spec.
 *
 * WHY GENERATED
 * With a template the monthly routine collapses to: owner sends a Korean
 * brief → Claude writes the market-language spec → this renders the card →
 * the existing ingestion converts (WebP for the site, JPEG for share
 * previews) and publishes. No design tool in the loop, identical branding
 * every month, and a correction is a re-render rather than a redraw.
 *
 * FIXED FRAME, FREE INTERIOR (owner 2026-08-12)
 * The frame is brand furniture and never varies: market-tinted ground, side
 * rail carrying the domain, flag badge, month, title block, footer lockup.
 * The interior is composed per card from the block vocabulary in
 * lib/trends-card-blocks.mjs — a market-data story gets bars, a rules change
 * gets before/after, a phased reform gets a timeline. The ground colour is
 * the market's own landing-page palette, so a card looks like it came from
 * the site it links to.
 *
 * The frame itself now lives in lib/trends-card-frame.mjs, because the deck
 * renderer (build-trends-deck.mjs) draws the same cards and a copied frame
 * would have drifted from this one on the first tweak.
 *
 * SPEC: { country, countryLabel, month, title[2], sub, motif?, footer,
 *         sections: [ block | [block, block] ] }   // blocks: see the lib
 * Legacy specs (hero/leftPanel/rightPanel/kurzfazit keys) are mapped onto the
 * same blocks, so the first cards still render from their original files.
 *
 * Run:  node scripts/build-trends-card.mjs <spec.json> <out.png>
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { cardDoc, CARD_PX } from './lib/trends-card-frame.mjs';

const specPath = process.argv[2];
const outPath = process.argv[3];
if (!specPath || !outPath) { console.error('Usage: build-trends-card.mjs <spec.json> <out.png>'); process.exit(1); }
const S = JSON.parse(readFileSync(specPath, 'utf8'));
const cc = String(S.country).toUpperCase();

const browser = await chromium.launch();
const page = await (await browser.newContext({
  viewport: { width: CARD_PX, height: CARD_PX }, deviceScaleFactor: 2,
})).newPage();
await page.setContent(cardDoc(S), { waitUntil: 'networkidle' });
await page.waitForTimeout(250);

// A card that overflows its own frame ships a cut-off panel — say so loudly.
// The CONTENT column is what must fit: the card's own scrollHeight counts the
// decorative glows, which sit outside the frame on purpose.
const overflow = await page.evaluate(() => {
  const f = document.querySelector('.flow');
  return { h: f.scrollHeight, box: f.clientHeight };
});
if (overflow.h > overflow.box + 2) {
  console.error(`✗ content overflows the card by ${overflow.h - overflow.box}px — shorten a block or drop a row`);
}

await page.screenshot({ path: outPath });
await browser.close();
console.log(`→ ${outPath} (2508×2508, ${cc} palette)${overflow.h > overflow.box + 2 ? ' ⚠ OVERFLOW' : ''}`);
