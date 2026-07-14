/**
 * UK Commercial catalogue + reactive filtering/sorting + logo animation.
 *
 * Usage: node tests/products-uk-commercial.e2e.mjs <DE|GB|FR> <port>
 *
 * Runs against the dev server (which reads public/data directly), signed in with
 * the e2e account. Nothing is written to Firestore.
 */
import { chromium } from 'playwright';

const COUNTRY = (process.argv[2] || 'GB').toUpperCase();
const PORT = process.argv[3] || '5199';
// The dev preview needs no sign-in and reads the datasets straight from
// public/data — exactly the code path the product pages use in the browser.
const BASE = `http://localhost:${PORT}/?preview=hpiq`;

let passed = 0, failed = 0;
const check = (n, ok, d = '') => {
  if (ok) { passed++; console.log(`  PASS  ${n}`); }
  else { failed++; console.error(`  FAIL  ${n}${d ? `\n        ${d}` : ''}`); }
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 980 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 120)));

console.log(`\nProducts — ${COUNTRY} edition\n`);

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);          // datasets load from public/data

await page.getByText(/^Products$|^Produkte$|^Produits$/).first().click();
await page.waitForTimeout(3500);

/** The result count shown in the header ("N models"). */
const total = async () => {
  const txt = await page.locator('body').innerText();
  const m = txt.match(/([\d.,]+)\s*(models|Modelle|modèles|of|von|sur)/i);
  return m ? parseInt(m[1].replace(/[.,]/g, ''), 10) : -1;
};
const rows = () => page.locator('[data-row-id]').count();

/* ── Residential baseline ─────────────────────────────────────────────── */
const resCount = await rows();
check('[residential] products load', resCount > 0, `rows=${resCount}`);

/* ── COMMERCIAL — the UK bug ──────────────────────────────────────────── */
await page.getByText(/^Commercial$|^Gewerbe$|^Tertiaire$/).first().click();
await page.waitForTimeout(2500);
const comRows = await rows();
const comTotal = await total();
check('[commercial] catalogue loads (non-zero)', comRows > 0, `rows=${comRows}`);
check('[commercial] total is plausible (>100)', comTotal > 100, `total=${comTotal}`);

const body = await page.locator('body').innerText();
if (COUNTRY === 'GB') {
  check('[GB commercial] "listed only" filter is NOT offered', (await page.locator('[data-testid="listed-only-toggle"]').count()) === 0);
  check('[GB commercial] records show "Not on PEL"', /Not on PEL/i.test(body));
  check('[GB commercial] no BAFA eligibility claimed as UK eligibility', !/BEG|BAFA-listed|BAFA list status/i.test(body));
  check('[GB commercial] no BUS eligibility claimed', !/eligible for BUS|BUS eligible/i.test(body));
} else {
  check(`[${COUNTRY} commercial] "listed only" filter IS offered (unchanged)`, (await page.locator('[data-testid="listed-only-toggle"]').count()) === 1);
}

/* ── Reactive filtering / sorting — every change lands in ONE render ───── */
const firstModel = async () => (await page.locator('[data-row-id]').first().innerText()).split('\n')[0];

// Manufacturer filter
const before = await rows();
const mfr = page.locator('[data-testid="mfr-option"]').first();
const hasMfr = (await mfr.count()) > 0;
if (hasMfr) {
  const label = (await mfr.innerText()).split('\n')[0].trim();
  await mfr.click();
  await page.waitForTimeout(150);          // one frame, no debounce allowed
  const after = await rows();
  const t2 = await total();
  check('[filter] manufacturer updates the list immediately', after !== before || t2 < comTotal, `${before} → ${after}, total ${comTotal} → ${t2}`);
  await mfr.click();                        // clear
  await page.waitForTimeout(150);
  check('[filter] clearing the manufacturer immediately restores the list', (await total()) === comTotal);
}

// Refrigerant
const ref = page.locator('[data-testid="ref-option"]').first();
if (await ref.count()) {
  const t0 = await total();
  await ref.click();
  await page.waitForTimeout(150);
  const t1 = await total();
  check('[filter] refrigerant updates the list immediately', t1 !== t0, `${t0} → ${t1}`);
  await page.locator('[data-testid="ref-option"]').first().click();
  await page.waitForTimeout(150);
  check('[filter] clearing refrigerant immediately restores the list', (await total()) === t0);
}

// Sort — reorders the *filtered* result, immediately
const top0 = await firstModel();
await page.locator('[data-testid="sort-trigger"]').first().click();
await page.waitForTimeout(200);
const opt = page.locator('[data-testid="sort-option"]').nth(1);
if (await opt.count()) {
  await opt.click();
  await page.waitForTimeout(150);
  const top1 = await firstModel();
  check('[sort] changing the sort immediately reorders the list', top1 !== top0, `${top0} → ${top1}`);
}

// Search
const search = page.locator('input[placeholder]').first();
if (await search.count()) {
  const t0 = await total();
  await search.fill('Daikin');
  await page.waitForTimeout(250);
  const t1 = await total();
  check('[search] free text narrows the list quickly', t1 <= t0);
  await search.fill('');
  await page.waitForTimeout(250);
}

/* ── Detail / compare / data sheet on an imported commercial record ────── */
await page.locator('[data-row-id]').first().click();
await page.waitForTimeout(900);
check('[commercial] product detail opens', /Manufacturer|Hersteller|Fabricant/i.test(await page.locator('body').innerText()));

const cmp = page.locator('[data-testid="compare-toggle"]');
check('[commercial] compare controls render', (await cmp.count()) >= 2);
await cmp.nth(0).click();
await cmp.nth(1).click();
await page.waitForTimeout(500);
const cmpText = await page.locator('body').innerText();
check('[commercial] two records can be compared', /2/.test(cmpText) && /Compare|Vergleich|Comparer/i.test(cmpText));

// Data sheet reachable for an imported commercial record
await page.getByText(/^Data sheet$|^Datenblatt$|^Fiche technique$/).first().click();
await page.waitForTimeout(2500);
check('[commercial] Data Sheet opens for an imported record',
  (await page.locator('.hpiq-print-doc').count()) >= 1);
const dsLogo = await page.evaluate(async () => {
  const g = document.querySelector('.hpiq-print-doc .hp-logo-spin');
  if (!g) return null;
  const t1 = getComputedStyle(g).transform;
  await new Promise(r => setTimeout(r, 600));
  return { rotating: t1 !== getComputedStyle(g).transform, origin: getComputedStyle(g).transformOrigin };
});
check('[logo] Data Sheet mark is animated on screen', !!dsLogo?.rotating);
check('[logo] Data Sheet mark uses the same centre', dsLogo?.origin === '32px 32px');

/* ── Logo animation (header) ──────────────────────────────────────────── */
const logo = await page.evaluate(async () => {
  const g = document.querySelector('.hp-logo-spin');
  if (!g) return null;
  const cs = getComputedStyle(g);
  const t1 = cs.transform;
  await new Promise(r => setTimeout(r, 600));
  return {
    origin: cs.transformOrigin,
    rotating: t1 !== getComputedStyle(g).transform && t1 !== 'none',
    textAnim: getComputedStyle(document.querySelector('svg text')).animationName,
  };
});
check('[logo] header mark is rotating', !!logo?.rotating);
check('[logo] rotation centre is the exact mark centre (32px 32px)', logo?.origin === '32px 32px', logo?.origin);
check('[logo] the wordmark does not rotate', logo?.textAnim === 'none');

check('no page errors', errors.length === 0, errors[0] ?? '');

await browser.close();
console.log(`\n${COUNTRY}: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
