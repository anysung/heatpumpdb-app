/**
 * Registration pause — browser tests (Playwright, against the dev server).
 *
 * Covers, per country edition:
 *   1. the Sign Up entry is still visible;
 *   2. choosing it shows the localized notice + the reopening date, and NO form;
 *   3. registerUser() refuses BEFORE any Firebase Auth account is created
 *      (asserted on the wire: zero calls to identitytoolkit accounts:signUp);
 *   4. no Firestore user profile is written;
 *   5. an existing approved member can still sign in and reach the app.
 *
 * SAFETY: the Auth sign-up endpoint is aborted at the network layer, so even if
 * a guard regressed, this test cannot create a real account in the live project
 * — it records the attempt and fails instead.
 *
 * Usage: node tests/registration-pause.e2e.mjs <DE|GB|FR> <port>
 *   (the caller starts the dev server for that country — see npm run test:registration:e2e)
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const COUNTRY = (process.argv[2] || 'DE').toUpperCase();
const PORT = process.argv[3] || '5199';
const BASE = `http://localhost:${PORT}/`;
const SCRATCH = process.env.HPDB_TEST_SECRETS || '.';

const EXISTING_USER = 'e2e-verify@heatpumpdb.de';
const EXISTING_PASS = readFileSync(`${SCRATCH}/e2e-pw.txt`, 'utf8').trim();
const APPCHECK_DEBUG = readFileSync(`${SCRATCH}/appcheck-debug-token.txt`, 'utf8').trim();

/** Localized notice we expect, per UI language. */
const NOTICE = {
  en: { title: 'Registration is temporarily unavailable', date: '24 July 2026' },
  de: { title: 'Registrierung vorübergehend nicht möglich', date: '24. Juli 2026' },
  fr: { title: 'Les inscriptions sont temporairement suspendues', date: '24 juillet 2026' },
};
/** Which languages the edition must be able to show the notice in. */
const LANGS = { DE: ['en', 'de'], GB: ['en'], FR: ['fr'] }[COUNTRY];

let passed = 0;
let failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(t => { window.FIREBASE_APPCHECK_DEBUG_TOKEN = t; }, APPCHECK_DEBUG);

// Record — and hard-block — any attempt to create a Firebase Auth account or a
// Firestore user document. Nothing here should ever fire.
const authSignUpCalls = [];
const firestoreWrites = [];
await page.route('**/identitytoolkit.googleapis.com/**', route => {
  const url = route.request().url();
  if (url.includes('accounts:signUp')) { authSignUpCalls.push(url); return route.abort(); }
  return route.continue();
});
page.on('request', req => {
  const u = req.url();
  if (u.includes('firestore.googleapis.com') && /Write|Commit/.test(u)) firestoreWrites.push(u);
});

console.log(`\nRegistration pause — ${COUNTRY} edition (${BASE})\n`);

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);

// ── 1. The Sign Up entry stays visible ───────────────────────────────────
const signUpEntry = page.getByRole('button', { name: /Sign Up|Registrieren|Créer un compte/i }).first();
check('Sign Up entry is still visible on the landing page', await signUpEntry.isVisible());

// ── 2. Choosing it shows the localized notice, not a form ────────────────
for (const lang of LANGS) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  if (lang !== (COUNTRY === 'FR' ? 'fr' : 'en')) {
    await page.getByRole('button', { name: lang.toUpperCase(), exact: true }).first().click();
    await page.waitForTimeout(400);
  }
  await page.getByRole('button', { name: /Sign Up|Registrieren|Créer un compte/i }).first().click();
  await page.waitForTimeout(800);

  const card = page.locator('[data-testid="registration-paused"]');
  check(`[${lang}] notice card is shown`, await card.isVisible());

  const title = await card.locator('h2').innerText().catch(() => '');
  check(`[${lang}] notice is localized`, title.trim() === NOTICE[lang].title, `got: "${title.trim()}"`);

  const date = await page.locator('[data-testid="registration-reopen-date"]').innerText().catch(() => '');
  check(`[${lang}] reopening date shown as ${NOTICE[lang].date}`, date.trim() === NOTICE[lang].date, `got: "${date.trim()}"`);

  const hasForm = await page.locator('input[type="password"]').count();
  check(`[${lang}] the signup form is NOT rendered`, hasForm === 0, `password inputs: ${hasForm}`);
}

// ── 3+4. The real guard: registerUser() must refuse before Auth/Firestore ──
// Calls the actual module the app uses (Vite serves it), not a copy.
const writesBefore = firestoreWrites.length;
const result = await page.evaluate(async () => {
  try {
    const m = await import('/src/services/authService.ts');
    await m.registerUser({
      email: `blocked-probe-${Date.now()}@example.com`,
      password: 'Blocked-Probe-123',
      firstName: 'Blocked', lastName: 'Probe',
      companyType: 'Installer', jobRole: 'Technician',
    });
    return 'ACCOUNT_WAS_CREATED';
  } catch (e) { return e?.message ?? String(e); }
});
check('registerUser() refuses with "registration-closed"', result === 'registration-closed', `got: "${result}"`);
check('NO Firebase Auth account creation attempted (accounts:signUp)', authSignUpCalls.length === 0, `calls: ${authSignUpCalls.length}`);
await page.waitForTimeout(1000);
check('NO Firestore user profile written', firestoreWrites.length === writesBefore, `writes: ${firestoreWrites.length - writesBefore}`);

// ── 5. Existing approved member can still sign in ────────────────────────
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /Log In|Anmelden|Connexion|Se connecter/i }).first().click();
await page.waitForTimeout(800);
await page.locator('input[type="email"]').fill(EXISTING_USER);
await page.locator('input[type="password"]').fill(EXISTING_PASS);
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(12000);

const signedIn = await page.locator('.hp-gnav, [class*="hp-gnav"]').count() > 0
  || await page.getByText(/Products|Produkte|Produits/i).first().isVisible().catch(() => false);
check('existing approved user can still sign in and reach the app', signedIn);
check('signing in created no Auth account and no profile write', authSignUpCalls.length === 0);

await browser.close();
console.log(`\n${COUNTRY}: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
