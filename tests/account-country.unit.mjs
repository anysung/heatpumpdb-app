/**
 * One-email-one-country policy — the pure decision (src/services/accountCountry.ts).
 *
 * Covers the access matrix the auth flows enforce:
 *   same-country → allowed, cross-country → blocked (returns registered code),
 *   owner/admin → allowed everywhere, missing country → fail-open (allowed),
 *   plus isAdminRole.
 */
import { build } from 'esbuild';

async function load(entry) {
  const r = await build({ entryPoints: [entry], bundle: true, format: 'esm', write: false, platform: 'neutral' });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
}
const { crossCountryBlock, isAdminRole, OWNER_EMAIL } = await load('src/services/accountCountry.ts');

let passed = 0, failed = 0;
const is = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name} — expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`); }
};

const user = (over = {}) => ({ email: 'u@example.com', role: 'user', country: 'IT', ...over });

console.log('\nOne-email-one-country policy\n');

// same-country → allowed
is('IT user on IT site → allowed', crossCountryBlock(user({ country: 'IT' }), 'IT'), null);
is('DE user on DE site → allowed', crossCountryBlock(user({ country: 'DE' }), 'DE'), null);

// cross-country → blocked, returns the registered country
is('IT user on DE site → blocked (returns IT)', crossCountryBlock(user({ country: 'IT' }), 'DE'), 'IT');
is('DE user on IT site → blocked (returns DE)', crossCountryBlock(user({ country: 'DE' }), 'IT'), 'DE');
is('GB user on FR site → blocked (returns GB)', crossCountryBlock(user({ country: 'GB' }), 'FR'), 'GB');

// owner/admin → allowed everywhere
is('owner (by email) on any site → allowed', crossCountryBlock(user({ email: OWNER_EMAIL, country: 'DE' }), 'IT'), null);
for (const role of ['owner', 'admin', 'support', 'ops']) {
  is(`${role} on a foreign site → allowed`, crossCountryBlock(user({ role, country: 'DE' }), 'IT'), null);
}

// missing country → fail-open (never lock out a legacy/exception account)
is('no country on any site → allowed (fail-open)', crossCountryBlock(user({ country: undefined }), 'IT'), null);
is('empty country → allowed (fail-open)', crossCountryBlock(user({ country: '' }), 'DE'), null);

// isAdminRole
is('isAdminRole owner', isAdminRole('owner'), true);
is('isAdminRole user', isAdminRole('user'), false);
is('isAdminRole undefined', isAdminRole(undefined), false);

console.log(failed ? `\n✗ ${failed} assertion(s) failed\n` : `\n✓ all ${passed} account-country assertions passed\n`);
process.exit(failed ? 1 : 0);
