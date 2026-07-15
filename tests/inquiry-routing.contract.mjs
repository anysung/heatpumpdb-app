/**
 * Inquiry country-routing contract.
 *
 * Run: node tests/inquiry-routing.contract.mjs
 *
 * The Account page is ONE shared component across every edition, so a support
 * inquiry must carry the active country and reach that country's Admin context.
 * That path is client-side + Firestore, so it cannot be exercised end-to-end
 * without live credentials — but its contract is three small invariants in the
 * source, and a silent change to any of them would send inquiries to the wrong
 * (or one global) Admin destination. This test pins them.
 *
 * It also proves the layout task did NOT touch the routing files.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\s+/g, ' ');

let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${ok ? '' : `  — ${detail}`}`);
};

console.log('\nInquiry is tagged with the active country');
const support = read('src/services/supportService.ts');
// Every new ticket takes the user's country, else the build's active country —
// never a hardcoded one. ACTIVE_COUNTRY.code is DE/GB/FR per edition.
check('createTicket stores country = user.country || ACTIVE_COUNTRY.code',
  /country:\s*user\.country\s*\|\|\s*ACTIVE_COUNTRY\.code/.test(support),
  'the country tag on a new inquiry is missing or hardcoded');
check('supportService imports ACTIVE_COUNTRY (the per-edition country)',
  /import\s*\{\s*ACTIVE_COUNTRY\s*\}\s*from\s*'\.\.\/config\/countryProfiles'/.test(support));

console.log('\nAdmin routes an inquiry to its own country');
const inbox = read('src/components/admin/InboxPage.tsx');
// A per-market workspace shows only its own country; legacy tickets with no
// country fall back to DE so the list never breaks.
check('a market workspace filters tickets to its country',
  /country\s*\?\s*tickets\.filter\(\s*t\s*=>\s*\(t\.country\s*\|\|\s*'DE'\)\s*===\s*country\s*\)/.test(inbox),
  'the per-country filter (with a DE legacy fallback) is gone');
check('the global inbox (no country prop) shows every ticket',
  /country\s*\?\s*tickets\.filter[^:]+:\s*tickets/.test(inbox),
  'the global inbox no longer shows all tickets');

const admin = read('src/components/AdminDashboard.tsx');
check('each market workspace passes its country into the inbox',
  /tab === 'support'\s*&&\s*<InboxPage[^>]*country=\{country\}/.test(admin),
  'the market workspace does not scope the inbox to its country');
check('the market workspace receives a country prop',
  /MarketWorkspace[^{]*\{[^}]*country[^}]*\}/.test(admin));

console.log('\nThe data model carries the country');
const types = read('src/types.ts');
check('SupportTicket has a country field', /interface SupportTicket\s*\{[^}]*\bcountry\b/.test(types));

console.log('\nOne inquiry workflow — desktop AND phone use the shared SupportCard');
// The phone shell must not have its own support path. It reuses the exact same
// SupportCard (→ same createTicket → same country tagging → same Admin routing).
const parts = read('src/hpiq/pages/accountParts.tsx');
check('the shared SupportCard is exported from accountParts',
  /export const SupportCard/.test(parts));
check('the shared SupportCard calls createTicket (the country-tagging path)',
  /createTicket\(/.test(parts) && /from '\.\.\/\.\.\/services\/supportService'/.test(parts));
const desktop = read('src/hpiq/pages/AccountPage.tsx');
check('the desktop Account page imports SupportCard from accountParts',
  /import\s*\{[^}]*\bSupportCard\b[^}]*\}\s*from\s*'\.\/accountParts'/.test(desktop));
const mobile = read('src/hpiq/mobile/MobileApp.tsx');
check('the phone shell imports the SAME SupportCard from accountParts',
  /import\s*\{\s*SupportCard\s*\}\s*from\s*'\.\.\/pages\/accountParts'/.test(mobile));
check('the phone shell no longer references SUPPORT_EMAIL (no mailto support)',
  !/SUPPORT_EMAIL/.test(mobile));
check('the phone Support action opens the in-app inquiry (setSupportOpen), not a mailto',
  /setSupportOpen\(true\)/.test(mobile) && !/mailto:\$\{SUPPORT_EMAIL\}/.test(mobile));

console.log('\nThe layout task did not touch the routing');
// A behavioural guarantee: this feature must be layout-only. If any routing file
// shows up as modified vs HEAD, that assumption is broken and must be reviewed.
try {
  const dirty = execSync(
    'git status --porcelain src/services/supportService.ts src/components/admin/InboxPage.tsx src/components/AdminDashboard.tsx firestore.rules',
    { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' },
  ).trim();
  check('routing + rules files are unmodified in the working tree', dirty === '', `changed: ${dirty}`);
} catch (e) {
  console.log(`  · (git status unavailable — skipped: ${String(e.message).split('\n')[0]})`);
}

console.log(failed ? `\n✗ ${failed} contract assertion(s) failed\n` : '\n✓ inquiry routing contract holds\n');
process.exit(failed ? 1 : 0);
