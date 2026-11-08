/**
 * One-click unsubscribe (RFC 8058) — the invariants that keep marketing mail
 * out of Junk without ever letting a link scanner unsubscribe someone.
 *
 * Run: node tests/unsubscribe.unit.mjs
 */
import { readFileSync } from 'node:fs';

let failed = 0;
const ok = (name, cond, detail = '') => {
  if (!cond) failed++;
  console.log(`${cond ? '  ✓' : '  ✗'} ${name}${cond ? '' : `  — ${detail}`}`);
};

const fn = readFileSync(new URL('../google_cloud_function_billing/index.js', import.meta.url), 'utf8');
const body = (decl) => {
  const i = fn.indexOf(decl);
  return i < 0 ? '' : fn.slice(i, fn.indexOf('\n}\n', i));
};

console.log('\nHeaders on a marketing mail');
const bulk = body('async function bulkMemberEmail(');
ok('List-Unsubscribe carries an HTTPS target first', /'List-Unsubscribe': `<\$\{unsubUrl\}>, <mailto:/.test(bulk));
ok('List-Unsubscribe-Post announces one-click', bulk.includes(`'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'`));
ok('headers only on marketing (announcement) mail', /\.\.\.\(marketing \? \{ headers:/.test(bulk));
ok('the footer link is in the plain part too', bulk.includes('unsubText(unsubUrl)'));
ok('the public URL is HTTPS', /PUBLIC_FN_URL[\s\S]{0,80}'https:\/\//.test(fn));

console.log('\nEndpoint');
const ep = body('async function unsubscribe(req, res) {');
ok('the endpoint exists', ep.length > 0);
ok('it is routed before the POST-only gate',
  fn.indexOf("path.endsWith('/unsubscribe')") > 0
  && fn.indexOf("path.endsWith('/unsubscribe')") < fn.indexOf("if (req.method !== 'POST') return sendErr(res, 405, 'method-not-allowed');\n    if (path.endsWith('/sendVerificationEmail')"));
ok('the token is compared in constant time', ep.includes('crypto.timingSafeEqual'));
const getBranch = ep.slice(ep.indexOf("if (req.method === 'GET')"), ep.indexOf("if (req.method !== 'POST')"));
ok('a GET never writes (link scanners prefetch)', getBranch.length > 0 && !/\.set\(|\.update\(|\.add\(/.test(getBranch));
ok('only marketingConsent is cleared', /ref\.set\(\{ marketingConsent: false, marketingOptOutAt: nowIso\(\), marketingOptOutVia: via \}/.test(ep));
ok('the opt-out is audited', ep.includes("action: 'marketingUnsubscribe'"));
ok('the token is written server-side only', /set\(\{ marketingUnsubToken: token \}, \{ merge: true \}\)/.test(fn));

if (failed) { console.error(`\n✗ ${failed} unsubscribe assertion(s) failed`); process.exit(1); }
console.log('\n✓ all unsubscribe assertions passed');
