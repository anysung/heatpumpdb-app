/**
 * Welcome / Premium-trial activation mail (owner decision 2026-09-28).
 *
 * Run: node tests/welcome-mail.unit.mjs
 *
 * Copy contract, in all five languages: subject + body, the 15-day Premium
 * trial, the trial end date, "continues on Standard (free)", no payment
 * method + nothing charged automatically, the market site link — and never
 * the word "Free" for the tier.
 *
 * Wiring contract (source-level, index.js): the mail is sent from the shared
 * activation path ONLY when a fresh trial was granted, it is claimed before
 * sending (idempotent) and it is fail-open (time-boxed, never throws into the
 * activation).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { WELCOME_COPY, formatTrialEnd, buildWelcomeMail, welcomeMailDue } =
  require('../google_cloud_function_billing/welcomeMailCopy.js');

let failed = 0, passed = 0;
const ok = (name, cond, detail = '') => {
  if (cond) passed++; else failed++;
  console.log(`${cond ? '  ✓' : '  ✗'} ${name}${cond ? '' : `  — ${detail}`}`);
};

const LANGS = ['en', 'de', 'fr', 'pl', 'it'];
const STANDARD_FIRST = {
  en: /Standard \(free\)/, de: /Standard \(kostenlos\)/, fr: /Standard \(gratuit\)/,
  pl: /Standard \(bezpłatny\)/, it: /Standard \(gratuito\)/,
};
const NO_PAYMENT_METHOD = {
  en: /No payment method is needed/, de: /keine Zahlungsmethode erforderlich/,
  fr: /Aucun moyen de paiement n'est nécessaire/, pl: /Nie jest potrzebna żadna metoda płatności/,
  it: /Non serve alcun metodo di pagamento/,
};
const NO_AUTO_CHARGE = {
  en: /nothing is charged automatically/, de: /nichts automatisch berechnet/,
  fr: /rien n'est facturé automatiquement/, pl: /nic nie zostanie pobrane automatycznie/,
  it: /nulla viene addebitato automaticamente/,
};
const ALL_FEATURES = {
  en: /every feature of the app, without restrictions/, de: /alle Funktionen der App ohne Einschränkungen/,
  fr: /toutes les fonctionnalités de l'application, sans restriction/, pl: /wszystkich funkcji aplikacji bez ograniczeń/,
  it: /tutte le funzioni dell'app senza limitazioni/,
};
const CONGRATS = {
  en: /Congratulations on signing up/, de: /herzlichen Glückwunsch zu Ihrer Registrierung/,
  fr: /Félicitations pour votre inscription/, pl: /gratulujemy rejestracji/,
  it: /congratulazioni per la registrazione/,
};

const ENDS = Date.UTC(2026, 9, 12, 14, 30);          // 12 Oct 2026
const SITE = 'https://www.heatpumpdb.fr';

console.log('\nWelcome mail — copy in every language\n');
ok('exactly five languages', JSON.stringify(Object.keys(WELCOME_COPY).sort()) === JSON.stringify([...LANGS].sort()));
for (const lang of LANGS) {
  const m = buildWelcomeMail({ lang, name: 'Anna Nowak', endsMs: ENDS, site: SITE, days: 15 });
  const all = `${m.subject}\n${m.body}`;
  ok(`${lang}: language kept`, m.lang === lang, m.lang);
  ok(`${lang}: subject present`, typeof m.subject === 'string' && m.subject.length > 10);
  ok(`${lang}: body present`, typeof m.body === 'string' && m.body.length > 200);
  ok(`${lang}: subject names the 15-day Premium trial`, /15/.test(m.subject) && /Premium/.test(m.subject), m.subject);
  ok(`${lang}: body mentions 15 days`, /\b15\b/.test(m.body));
  ok(`${lang}: congratulates`, CONGRATS[lang].test(m.body));
  ok(`${lang}: whole app, no restrictions`, ALL_FEATURES[lang].test(m.body));
  ok(`${lang}: continues on Standard (free)`, STANDARD_FIRST[lang].test(m.body));
  ok(`${lang}: no payment method needed`, NO_PAYMENT_METHOD[lang].test(m.body));
  ok(`${lang}: nothing charged automatically`, NO_AUTO_CHARGE[lang].test(m.body));
  ok(`${lang}: carries the trial end date`, m.body.includes(formatTrialEnd(ENDS, lang)) && /2026/.test(m.date), m.date);
  ok(`${lang}: links the market site in the text`, m.body.includes(SITE));
  ok(`${lang}: button goes to the market site`, m.cta && m.cta.url === SITE && !!m.cta.label);
  ok(`${lang}: one CTA marker`, m.body.split('{{CTA}}').length === 2);
  ok(`${lang}: greets by name`, m.body.startsWith(`${{ en: 'Dear', de: 'Guten Tag', fr: 'Bonjour', pl: 'Dzień dobry', it: 'Buongiorno' }[lang]} Anna Nowak,`));
  ok(`${lang}: never calls the tier "Free"`, !/\bFree\b/.test(all));
  ok(`${lang}: no unfilled placeholder`, !/\$\{|\bundefined\b|\bNaN\b|\bnull\b/.test(all));
}

console.log('\nWelcome mail — dates, fallbacks, idempotency\n');
ok('en date', formatTrialEnd(ENDS, 'en') === '12 October 2026', formatTrialEnd(ENDS, 'en'));
ok('de date', formatTrialEnd(ENDS, 'de') === '12. Oktober 2026', formatTrialEnd(ENDS, 'de'));
ok('fr date', formatTrialEnd(ENDS, 'fr') === '12 octobre 2026', formatTrialEnd(ENDS, 'fr'));
ok('pl date (genitive)', formatTrialEnd(ENDS, 'pl') === '12 października 2026', formatTrialEnd(ENDS, 'pl'));
ok('it date', formatTrialEnd(ENDS, 'it') === '12 ottobre 2026', formatTrialEnd(ENDS, 'it'));
ok('fr first of month is "1er"', formatTrialEnd(Date.UTC(2026, 10, 1), 'fr') === '1er novembre 2026');
ok('unknown language falls back to English', buildWelcomeMail({ lang: 'xx', endsMs: ENDS, site: SITE }).lang === 'en');
ok('no name → plain greeting', buildWelcomeMail({ lang: 'en', endsMs: ENDS, site: SITE }).body.startsWith('Dear,\n'));
ok('due for a fresh account', welcomeMailDue({ status: 'active' }) === true);
ok('not due once claimed', welcomeMailDue({ welcomeMailClaimedAt: '2026-09-28T10:00:00Z' }) === false);
ok('not due once sent', welcomeMailDue({ welcomeMailSentAt: '2026-09-28T10:00:00Z' }) === false);
ok('not due after a failed send (never resent automatically)',
  welcomeMailDue({ welcomeMailClaimedAt: 'x', welcomeMailError: 'smtp' }) === false);

console.log('\nWelcome mail — wiring in the billing function\n');
const fn = readFileSync(new URL('../google_cloud_function_billing/index.js', import.meta.url), 'utf8');
const slice = (start) => { const i = fn.indexOf(start); return i < 0 ? '' : fn.slice(i, fn.indexOf('\n}\n', i)); };
const activate = slice('async function activateAccount(');
const sender = slice('async function sendWelcomeMail(');
ok('activateAccount exists', !!activate);
ok('sendWelcomeMail exists', !!sender);
ok('sent only when a fresh trial was granted',
  /if \(result && result\.activated && result\.trial && result\._trialEndsMs\)\s*\{\s*const welcome = await sendWelcomeMail\(/.test(activate));
ok('internal fields never reach the client',
  /delete result\._trialEndsMs/.test(activate) && /delete result\._country/.test(activate));
ok('claimed in a transaction before sending',
  sender.indexOf('runTransaction') > 0 && sender.indexOf('welcomeMailDue') > 0 &&
  sender.indexOf('welcomeMailClaimedAt') < sender.indexOf('sendMail('));
ok('stamps welcomeMailSentAt after a successful send', sender.indexOf('welcomeMailSentAt') > sender.indexOf('sendMail('));
ok('records failures (welcomeMailError + memberEmails)', /welcomeMailError/.test(sender) && /memberEmails/.test(sender));
ok('time-boxed send (cannot hold the activation)', /Promise\.race/.test(sender) && /WELCOME_SEND_TIMEOUT_MS/.test(sender));
ok('fail-open: the send path is wrapped, SMTP missing is a status not an error',
  /catch \(e\)/.test(sender) && /'not-configured'/.test(sender) && !/throw /.test(sender));
ok('uses the letterhead, support sender and plain-text signature',
  /letterhead\(msg\.body, email, msg\.cta\)/.test(sender) && /SUPPORT_FROM/.test(sender) && /TEXT_SIGNATURE/.test(sender));
ok('market language + site from the profile country', /MARKET_LANG\[cc\]/.test(sender) && /MARKET_SITE\[cc\]/.test(sender));

console.log(failed ? `\n✗ ${failed} assertion(s) failed\n` : `\n✓ all welcome-mail assertions passed (${passed})\n`);
process.exit(failed ? 1 : 0);
