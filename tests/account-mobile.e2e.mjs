/**
 * Phone Account screen (< 700px) — the curated MobileApp shell (not the shared
 * AccountPage). Verifies the 8fe2a80 customer-facing changes were carried over:
 * the raw support address is gone, and a compact Advertising & partnerships card
 * (mailto only) is present in the right position — in every edition's language.
 *
 * Usage: node tests/account-mobile.e2e.mjs <DE|GB|FR> <port>
 *        (or tests/run-account-mobile-e2e.sh, one dev server per edition)
 *
 * The phone shell is deliberately compact: it has a combined identity card, App
 * language, Support (a mailto contact — there is no in-app ticket form here), a
 * new Advertising card and Terms & policies. So the test checks the relative
 * order of the cards that exist, not desktop-only cards.
 *
 * Runs against ?preview=hpiq at 390px — no sign-in, nothing written to Firestore.
 */
import { chromium } from 'playwright';

const COUNTRY = (process.argv[2] || 'DE').toUpperCase();
const PORT = process.argv[3] || '5199';
const BASE = `http://localhost:${PORT}/?preview=hpiq`;

let passed = 0, failed = 0;
const check = (n, ok, d = '') => {
  if (ok) { passed++; console.log(`  PASS  ${n}`); }
  else { failed++; console.error(`  FAIL  ${n}${d ? `\n        ${d}` : ''}`); }
};

// DE and GB default to English UI, France to French (market.ts DEFAULT_LANGUAGE).
const EN = { language: 'App language.', support: 'Support.', ad: 'Advertising & partnerships.',
  adBody: 'Advertising inquiries and business opportunities.', terms: 'Terms & policies.',
  contact: 'Contact support & view replies ›', account: 'Account' };
const LABELS = {
  DE: EN, GB: EN,
  FR: { language: 'Langue de l’application.', support: 'Support.', ad: 'Publicité & partenariats.',
    adBody: 'Demandes publicitaires et opportunités commerciales.', terms: 'Conditions & politiques.',
    contact: 'Contacter le support & voir les réponses ›', account: 'Compte' },
}[COUNTRY];

const browser = await chromium.launch();

/** Vertical position of the first element whose exact text is `txt` (or null). */
const yOf = (page, txt) => page.locator(`text="${txt}"`).first().evaluate(
  el => el.getBoundingClientRect().y).catch(() => null);

async function run(role) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 140)));

  await page.goto(`${BASE}&as=${role}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  // Bottom tab bar → Account (last tab). Before navigating, this label appears
  // only in the tab bar, so it is unambiguous.
  await page.getByText(new RegExp(`^${LABELS.account}$`)).last().click();
  await page.waitForTimeout(1200);

  console.log(`\n[${COUNTRY} · ${role} · phone 390px]`);
  const L = LABELS;
  const body = await page.locator('body').innerText();

  // ── Support card: raw address gone, wording + contact action kept ──
  check('[support] the raw support@heatpumpdb.eu address is NOT shown',
    !body.includes('support@heatpumpdb.eu') && (await page.locator('[data-testid="support-email"]').count()) === 0,
    'the raw support address is still visible on the phone Account screen');
  check('[support] the Support section is still present', body.includes(L.support));
  const contact = page.locator('[data-testid="mobile-contact-support"]');
  check('[support] the contact-support action still works', (await contact.count()) === 1 && (await contact.first().innerText()).includes(L.contact.replace(' ›', '')));

  // ── Advertising & partnerships (compact, mailto only) ──
  const ad = page.locator('[data-testid="marketing-email"]');
  check('[ad] the marketing email is shown', (await ad.count()) === 1 && (await ad.first().innerText()) === 'marketing@heatpumpdb.eu');
  check('[ad] it is a clickable mailto link', (await ad.first().getAttribute('href')) === 'mailto:marketing@heatpumpdb.eu');
  check(`[ad] title is translated (${COUNTRY})`, body.includes(L.ad));
  check(`[ad] body is translated (${COUNTRY})`, body.includes(L.adBody));
  // No form / button / banner inside the Advertising card.
  check('[ad] the card is compact — no form / CTA / image',
    await page.locator(`text="${L.ad}"`).first().evaluate(el => {
      let cardEl = el;
      while (cardEl && !(cardEl.style && cardEl.style.borderRadius === '14px')) cardEl = cardEl.parentElement;
      return cardEl ? !cardEl.querySelector('input, textarea, select, button, img') : false;
    }));

  // ── Card order (of the cards the curated shell renders) ──
  // GB is English-only, so the phone hides the App-language card entirely
  // (gated on UI_LANGUAGES.length > 1 — pre-existing curation). It is asserted
  // only where the edition actually offers a language choice.
  const [yLang, ySupport, yAd, yTerms] = await Promise.all(
    [L.language, L.support, L.ad, L.terms].map(txt => yOf(page, txt)));
  const multiLang = COUNTRY !== 'GB';
  check(`[order] App language card ${multiLang ? 'present, above Support' : 'absent (single-language edition)'}`,
    multiLang ? (yLang != null && yLang < ySupport) : (yLang == null),
    `y: lang=${yLang} support=${ySupport}`);
  check('[order] Support → Advertising → Terms & policies',
    ySupport != null && yAd != null && yTerms != null && ySupport < yAd && yAd < yTerms,
    `y: support=${ySupport} ad=${yAd} terms=${yTerms}`);

  // ── No horizontal overflow ──
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check('[layout] no horizontal overflow', !overflow, `scrollW ${await page.evaluate(() => document.documentElement.scrollWidth)} vs ${390}`);

  check('the account screen rendered for this role', body.length > 200);
  check('no page errors', errors.length === 0, errors[0] ?? '');
  await ctx.close();
}

for (const role of ['pro', 'owner', 'member']) await run(role);

await browser.close();
console.log(`\n${COUNTRY}: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
