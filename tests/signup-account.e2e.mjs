/**
 * Sign Up + Account + Team + policies — browser tests (Playwright, dev server).
 *
 * Usage: node tests/signup-account.e2e.mjs <DE|GB|FR> <port>
 *
 * The dev server is started by the caller with VITE_REGISTRATION_OPEN=true, so
 * the REOPENED Sign Up form can be exercised. The pause itself is covered by
 * tests/registration-pause.e2e.mjs, which runs against the shipped flag.
 *
 * The team Account shapes are driven through the DEV preview (?preview=hpiq&as=…)
 * so the tests never write organizations into the live Firestore.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const COUNTRY = (process.argv[2] || 'DE').toUpperCase();
const PORT = process.argv[3] || '5199';
const BASE = `http://localhost:${PORT}/`;
const SECRETS = process.env.HPDB_TEST_SECRETS || '.';
const PW = readFileSync(`${SECRETS}/e2e-pw.txt`, 'utf8').trim();
const APPCHECK = readFileSync(`${SECRETS}/appcheck-debug-token.txt`, 'utf8').trim();
const USER = 'e2e-verify@heatpumpdb.de';

const LANG = { DE: 'en', GB: 'en', FR: 'fr' }[COUNTRY];
const SIGNUP_BTN = /Sign Up|Registrieren|Créer un compte/i;
const LOGIN_BTN = /Log In|Anmelden|Se connecter/i;

let passed = 0, failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
await ctx.addInitScript(t => { window.FIREBASE_APPCHECK_DEBUG_TOKEN = t; }, APPCHECK);
const page = await ctx.newPage();

console.log(`\nSign Up / Account / Team — ${COUNTRY} edition\n`);

/* ── 1. SIGN UP (registration reopened) ─────────────────────────────────── */
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: SIGNUP_BTN }).first().click();
await page.waitForTimeout(700);

check('signup form is rendered (registration reopened)', await page.locator('[data-testid="signup-form"]').isVisible());

for (const f of ['su-first', 'su-last', 'su-email', 'su-password', 'su-company-name', 'su-company-type']) {
  check(`required field present: ${f}`, (await page.locator(`[data-testid="${f}"]`).count()) === 1);
}
check('optional field present: company city', (await page.locator('[data-testid="su-city"]').count()) === 1);
check('optional field present: company website', (await page.locator('[data-testid="su-website"]').count()) === 1);

const body = await page.locator('body').innerText();
check('Job Role field removed', !/Job Role|Funktion|Fonction/i.test(body));
check('Referral Source field removed', !/Referral|Wie sind Sie auf uns|Source de/i.test(body));
check('no separate country field', !/^Country$|Land \*|Pays \*/m.test(body));
check('company guidance shown', await page.locator('[data-testid="su-company-guidance"]').isVisible());

// Company types: the controlled list
const options = await page.locator('[data-testid="su-company-type"] option').allInnerTexts();
check('10 company types offered', options.length === 11, `got ${options.length} (incl. placeholder)`);

// Individual / Sole Trader guidance
await page.selectOption('[data-testid="su-company-type"]', 'individual');
await page.waitForTimeout(250);
check('Individual / Sole Trader guidance appears', await page.locator('[data-testid="su-individual-hint"]').isVisible());

// "Other" requires the detail field
await page.selectOption('[data-testid="su-company-type"]', 'other');
await page.waitForTimeout(250);
check('"Other" reveals the detail field', await page.locator('[data-testid="su-company-type-other"]').isVisible());

// Validation: consent is required
const fill = async () => {
  await page.fill('[data-testid="su-first"]', 'Test');
  await page.fill('[data-testid="su-last"]', 'User');
  await page.fill('[data-testid="su-email"]', `probe-${Date.now()}@example.com`);
  await page.fill('[data-testid="su-password"]', 'Sup3rSecret!');
  await page.fill('[data-testid="su-company-name"]', 'Probe GmbH');
  await page.selectOption('[data-testid="su-company-type"]', 'installer');
};
await fill();
await page.click('[data-testid="su-submit"]');
await page.waitForTimeout(400);
check('terms acceptance is required', await page.locator('[data-testid="su-error"]').isVisible());

// Validation: website format
await page.check('[data-testid="su-consent"]');
await page.fill('[data-testid="su-website"]', 'not a website');
await page.click('[data-testid="su-submit"]');
await page.waitForTimeout(400);
check('invalid website is rejected', await page.locator('[data-testid="su-error"]').isVisible());

// Policy links on the signup page
check('Terms link on signup', (await page.locator('[data-testid="su-terms-link"]').getAttribute('href')) === '/terms');
check('Privacy link on signup', (await page.locator('[data-testid="su-privacy-link"]').getAttribute('href')) === '/privacy');
check('CTA reads "continue to plan selection"',
  /plan selection|Tarifauswahl|choix de la formule/i.test(await page.locator('[data-testid="su-submit"]').innerText()));

/* ── 2. PUBLIC POLICY ROUTES (no login) ─────────────────────────────────── */
for (const [path, id] of [['/privacy', 'legal-privacy'], ['/terms', 'legal-terms'], ['/refund-policy', 'legal-refund'], ['/imprint', 'legal-imprint']]) {
  const p2 = await ctx.newPage();
  await p2.goto(`${BASE.replace(/\/$/, '')}${path}`, { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(900);
  const shown = await p2.locator(`[data-testid="${id}"]`).isVisible().catch(() => false);
  const text = await p2.locator('body').innerText();
  check(`${path} opens without a login`, shown);
  check(`${path} has no app-store wording`, !/app store|App Store|Google Play|in-app purchase/i.test(text));
  await p2.close();
}

/* ── 3. ACCOUNT (professional) — real signed-in user ────────────────────── */
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.getByRole('button', { name: LOGIN_BTN }).first().click();
await page.waitForTimeout(700);
await page.fill('input[type="email"]', USER);
await page.fill('input[type="password"]', PW);
await page.click('button[type="submit"]');
await page.waitForTimeout(14000);
check('existing user still logs in', (await page.locator('[class*="hp-gnav"]').count()) > 0);

await page.locator('[title="Account"]').first().click();
await page.waitForTimeout(3000);
const acc = await page.locator('body').innerText();
check('"Use on the web" section is gone', !/Use on the web|Im Web nutzen|Utiliser sur le web/i.test(acc));
check('no "Copy link" / "Email me the link" buttons', !/Copy link|Link kopieren|Email me the link|M’envoyer le lien/i.test(acc));
check('Company profile card shown', /Company profile|Unternehmensprofil|Profil de l’entreprise/i.test(acc));
check('Job Role row removed from Account', !/Job Role|Funktion:/i.test(acc));
check('policy links on Account', (await page.locator('[data-testid="policy-privacy"]').count()) > 0);
check('New inquiry still available', /New inquiry|Neue Anfrage|Nouvelle demande/i.test(acc));
check('Email & password card still there', /Email & password|E-Mail & Passwort|E-mail & mot de passe/i.test(acc));
check('App language card still there', /App language|App-Sprache|Langue de l’application/i.test(acc));
check('Delete account still there', (await page.locator('[data-testid="delete-account"]').count()) > 0);
check('profile edit is available', (await page.locator('[data-testid="edit-company"]').count()) > 0);
check('no team card for a professional', (await page.locator('[data-testid="manage-team"]').count()) === 0);

/* ── 4. TEAM OWNER (dev preview) ────────────────────────────────────────── */
const owner = await ctx.newPage();
await owner.goto(`${BASE}?preview=hpiq&as=owner`, { waitUntil: 'domcontentloaded' });
await owner.waitForTimeout(3000);
await owner.locator('[title="Account"]').first().click();
await owner.waitForTimeout(1200);
check('[owner] Team management card visible', await owner.locator('[data-testid="manage-team"]').isVisible());
check('[owner] seats shown as "2 of 3 seats used"', /2 (of|von|sièges sur) 3/i.test(await owner.locator('[data-testid="team-seats"]').innerText()));
check('[owner] pending invitation count shown', /1/.test(await owner.locator('[data-testid="team-pending"]').innerText()));

await owner.locator('[data-testid="manage-team"]').click();
await owner.waitForTimeout(900);
check('[owner] Team management subview opens', await owner.locator('[data-testid="team-management"]').isVisible());
const tm = await owner.locator('body').innerText();
check('[owner] active members listed', /Tom Klein|Anna Berger/.test(tm));
check('[owner] pending invitation listed', /neu@nordwind.example/.test(tm));
check('[owner] resend + cancel actions', (await owner.locator('[data-testid="resend-invite"]').count()) > 0 && (await owner.locator('[data-testid="cancel-invite"]').count()) > 0);
check('[owner] remove-member action for a member', (await owner.locator('[data-testid="remove-member"]').count()) === 1);
check('[owner] owner cannot remove themselves (only 1 remove button for 2 members)', (await owner.locator('[data-testid="remove-member"]').count()) === 1);
check('[owner] seat limit enforced: no invite box when full', (await owner.locator('[data-testid="no-seats"]').count()) === 1);
check('[owner] company settings editable', (await owner.locator('[data-testid="edit-org-company"]').count()) === 1);
check('[owner] ownership-transfer guidance points at Support', /New inquiry|Neue Anfrage|Nouvelle demande/i.test(tm));
await owner.locator('[data-testid="team-back"]').click();
await owner.waitForTimeout(600);
check('[owner] back returns to the account', (await owner.locator('[data-testid="team-management"]').count()) === 0);
await owner.close();

/* ── 5. TEAM MEMBER (dev preview) ───────────────────────────────────────── */
const member = await ctx.newPage();
await member.goto(`${BASE}?preview=hpiq&as=member`, { waitUntil: 'domcontentloaded' });
await member.waitForTimeout(3000);
await member.locator('[title="Account"]').first().click();
await member.waitForTimeout(1200);
const mem = await member.locator('body').innerText();
check('[member] "Your team" card shown', /Your team|Ihr Team|Votre équipe/i.test(mem));
check('[member] team info is read-only (no manage button)', (await member.locator('[data-testid="manage-team"]').count()) === 0);
check('[member] no invite controls', (await member.locator('[data-testid="invite-email"]').count()) === 0);
check('[member] no member-removal controls', (await member.locator('[data-testid="remove-member"]').count()) === 0);
check('[member] company info marked as managed by the admin', /Managed by your team administrator|Wird von Ihrem Team-Administrator|Géré par votre administrateur/i.test(mem));
check('[member] Leave team available', await member.locator('[data-testid="leave-team"]').isVisible());
check('[member] Delete account is separate from Leave team', (await member.locator('[data-testid="delete-account"]').count()) === 1);
check('[member] personal profile card shown', /Personal profile|Persönliches Profil|Profil personnel/i.test(mem));
await member.close();

await browser.close();
console.log(`\n${COUNTRY}: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
