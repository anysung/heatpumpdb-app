/**
 * Production data-path smoke (Playwright, against `vite preview`).
 *
 * The dev-server e2e suites read public/data locally (import.meta.env.DEV) and
 * never exercise the REAL dataset path — that gap hid the 2026-07-18 PL App
 * Check incident. This test serves a PRODUCTION build, signs in as the
 * e2e-verify account and asserts the datasets actually download from
 * gs://heatpumpdb-datasets through the Firebase Storage SDK:
 *   1. both dataset requests (residential + commercial) return HTTP 200;
 *   2. the payloads are real catalogues (>100 kB), not error bodies;
 *   3. the app shell renders signed-in and the dataset-error banner is absent.
 *
 * Usage: node tests/storage-path.smoke.mjs <DE|GB|FR|PL> <port>
 *   (the caller builds the edition and serves it — see tests/run-storage-smoke.sh)
 * Needs HPDB_TEST_SECRETS (e2e-pw.txt; appcheck-debug-token.txt is optional —
 * used when present so the test keeps working if enforcement ever returns).
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const COUNTRY = (process.argv[2] || 'PL').toUpperCase();
const PORT = process.argv[3] || '5311';
const BASE = `http://localhost:${PORT}/`;
const SECRETS = process.env.HPDB_TEST_SECRETS;
if (!SECRETS) {
  console.error('set HPDB_TEST_SECRETS to the directory holding e2e-pw.txt');
  process.exit(2);
}

const EXISTING_USER = 'e2e-verify@heatpumpdb.de';
const EXISTING_PASS = readFileSync(`${SECRETS}/e2e-pw.txt`, 'utf8').trim();
let APPCHECK_DEBUG = '';
try { APPCHECK_DEBUG = readFileSync(`${SECRETS}/appcheck-debug-token.txt`, 'utf8').trim(); } catch { /* optional */ }

const LOGIN_BTN = /Log In|Anmelden|Se connecter|Zaloguj się/i;

let passed = 0;
let failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
if (APPCHECK_DEBUG) {
  await page.addInitScript(t => { window.FIREBASE_APPCHECK_DEBUG_TOKEN = t; }, APPCHECK_DEBUG);
}

// Every firebasestorage response, with payload size (0 when unreadable).
const storageHits = [];
page.on('response', async resp => {
  if (!resp.url().includes('firebasestorage.googleapis.com')) return;
  let size = 0;
  try { size = (await resp.body()).length; } catch { /* stream gone */ }
  storageHits.push({ url: resp.url(), status: resp.status(), size });
});

console.log(`\nProduction storage-path smoke — ${COUNTRY} (${BASE})\n`);

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: LOGIN_BTN }).first().click();
await page.waitForTimeout(800);
await page.locator('input[type="email"]').fill(EXISTING_USER);
await page.locator('input[type="password"]').fill(EXISTING_PASS);
await page.locator('button[type="submit"]').click();

// Wait for the post-login dataset downloads (two files), then settle.
await page.waitForResponse(
  r => r.url().includes('firebasestorage.googleapis.com') && r.url().includes('products'),
  { timeout: 45000 },
).catch(() => { /* asserted below */ });
await page.waitForTimeout(8000);

const ok200 = storageHits.filter(h => h.status === 200);
const failures = storageHits.filter(h => h.status !== 200);

check('signed-in app shell rendered', (await page.locator('[class*="hp-gnav"], [class*="mnav"]').count()) > 0);
check(
  'both dataset files downloaded from the bucket (HTTP 200)',
  ok200.length >= 2,
  `hits: ${JSON.stringify(storageHits.map(h => ({ status: h.status, size: h.size })))}`,
);
check(
  'payloads are real catalogues (>100 kB each)',
  ok200.length >= 2 && ok200.every(h => h.size > 100_000),
  `sizes: ${ok200.map(h => h.size).join(', ')}`,
);
check('no failed storage requests', failures.length === 0, JSON.stringify(failures));
check(
  'dataset-error banner is NOT shown',
  (await page.locator('[data-testid="dataset-load-error"]').count()) === 0,
);

await browser.close();
console.log(`\n${COUNTRY}: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
