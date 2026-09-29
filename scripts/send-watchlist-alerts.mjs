#!/usr/bin/env node
/**
 * send-watchlist-alerts.mjs — mail Premium members what changed in this
 * month's data update among the models / manufacturers they watch.
 *
 *   node scripts/send-watchlist-alerts.mjs            DRY RUN (default): who would get what
 *   node scripts/send-watchlist-alerts.mjs --send     send for real
 *   options: --month=YYYY-MM (default: current month, Europe/Berlin)
 *            --max-minutes=15 (hard deadline for the whole run)
 *
 * Inputs (Firestore, IAM auth via gcloud — rules do not apply):
 *   users/{uid}/watch/*          collection-group read; nobody watching → exits at once
 *   users/{uid}/watch/_settings  { emailAlerts !== false, lang }
 *   countries/{CC}/changes/latest   written by compute-dataset-changes.mjs;
 *                                   used only when its `month` is THIS month
 *   users/{uid} (+ organizations/{orgId}) — recipient checks (lib/watch-alerts.mjs)
 * Outputs (only with --send):
 *   the mail (support@heatpumpdb.eu via smtppro.zoho.eu:465, letterhead from
 *   google_cloud_function_billing/index.js), a memberEmails row per mail
 *   (kind 'watchlist'), and watchAlertRuns/{YYYY-MM}.sent.{uid} = true —
 *   the idempotency record: a re-run never mails anyone twice for one month.
 *
 * Never fatal to the monthly window: every failure is counted and printed; the
 * exit code is non-zero only so the window log shows it.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import vm from 'node:vm';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDoc, setDoc, addDoc, runQuery, PROJECT } from './lib/firestore-rest.mjs';
import { skipRecipient, selectChanges, buildAlertMail, langFor, MARKET_SITE } from './lib/watch-alerts.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (n) => args.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const SEND = args.includes('--send');
const DEADLINE = Date.now() + Number(arg('max-minutes') ?? 15) * 60_000;
const berlinMonth = () => {
  const p = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit' })
    .formatToParts(new Date()).reduce((a, x) => (a[x.type] = x.value, a), {});
  return `${p.year}-${p.month}`;
};
const MONTH = arg('month') ?? berlinMonth();
if (!/^\d{4}-\d{2}$/.test(MONTH)) { console.error(`bad --month=${MONTH}`); process.exit(2); }
const MARKETS = ['DE', 'GB', 'FR', 'PL', 'IT'];
const SUPPORT_FROM = 'support@heatpumpdb.eu';

const tally = {};
const bump = (k) => { tally[k] = (tally[k] ?? 0) + 1; };
const mask = (e) => String(e).replace(/^(.).*(@.*)$/, '$1***$2');

/* 1 — who watches anything at all? */
const watchDocs = await runQuery({ from: [{ collectionId: 'watch', allDescendants: true }], limit: 20000 });
const byUid = new Map();
for (const d of watchDocs) {
  const parts = d.path.split('/');                     // users/{uid}/watch/{docId}
  if (parts[0] !== 'users' || parts.length !== 4) continue;
  const uid = parts[1];
  if (!byUid.has(uid)) byUid.set(uid, { watches: [], settings: {} });
  if (d.id === '_settings') byUid.get(uid).settings = d.data;
  else byUid.get(uid).watches.push(d.data);
}
const watchers = [...byUid.entries()].filter(([, v]) => v.watches.length);
console.log(`Watchlist alerts ${MONTH}${SEND ? '' : '  [dry run — nothing sent]'}`);
console.log(`  watch docs: ${watchDocs.length}   accounts with watches: ${watchers.length}`);
if (!watchers.length) { console.log('  nobody watches anything — done.'); process.exit(0); }

/* 2 — this month's change lists. A stale `latest` (older month) is ignored:
       re-announcing last month's changes would be a false story. */
const diffs = {};
for (const cc of MARKETS) {
  try {
    const d = await getDoc(`countries/${cc}/changes/latest`);
    if (!d) { console.log(`  ${cc}: no change list`); continue; }
    if (d.month !== MONTH) { console.log(`  ${cc}: latest change list is ${d.month}, not ${MONTH} — skipped`); continue; }
    if (d.suspect) { console.log(`  ${cc}: change list flagged SUSPECT — skipped`); continue; }
    diffs[cc] = d;
    console.log(`  ${cc}: listing ${d.counts?.listing ?? 0}, added ${d.counts?.added ?? 0}, removed ${d.counts?.removed ?? 0}, specs ${d.counts?.specs ?? 0}`);
  } catch (e) { console.error(`! ${cc}: change list unreadable — ${String(e.message).slice(0, 160)}`); bump('changes-unreadable'); }
}
if (!Object.keys(diffs).length) { console.log('  no current change list in any market — done.'); process.exit(0); }

/* 3 — idempotency record */
const run = (await getDoc(`watchAlertRuns/${MONTH}`)) ?? {};
const alreadySent = run.sent ?? {};

/* 4 — plan */
const planned = [];
const orgCache = new Map();
for (const [uid, { watches, settings }] of watchers) {
  if (Date.now() > DEADLINE) { console.error('! deadline reached while planning — stopping'); bump('deadline'); break; }
  if (alreadySent[uid]) { bump('already-sent'); continue; }
  if (settings.emailAlerts === false) { bump('alerts-off'); continue; }
  const items = selectChanges(watches, diffs);
  if (!items.length) { bump('nothing-changed'); continue; }
  let user, org = null;
  try {
    user = await getDoc(`users/${uid}`);
    if (user) user.uid = uid;
    if (user?.orgId) {
      if (!orgCache.has(user.orgId)) orgCache.set(user.orgId, await getDoc(`organizations/${user.orgId}`));
      org = orgCache.get(user.orgId);
    }
  } catch (e) { bump('profile-unreadable'); continue; }
  const why = skipRecipient(user, org, Date.now());
  if (why) { bump(why); continue; }
  const country = String(user.country ?? items[0].market ?? 'DE').toUpperCase();
  const lang = langFor(settings.lang, country);
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  const mail = buildAlertMail({ lang, name, month: MONTH, items, site: MARKET_SITE[country] ?? MARKET_SITE.DE });
  planned.push({ uid, to: String(user.email).trim(), country, items: items.length, mail });
}

console.log(`\n  planned mails: ${planned.length}`);
for (const p of planned) console.log(`    ${p.uid.slice(0, 6)}…  ${mask(p.to)}  ${p.country}/${p.mail.lang}  ${p.items} change(s)  "${p.mail.subject}"`);
if (Object.keys(tally).length) console.log(`  skipped: ${JSON.stringify(tally)}`);
if (!SEND || !planned.length) process.exit(0);

/* 5 — send */
function loadNodemailer() {
  const tries = [join(ROOT, 'google_cloud_function_billing/package.json'), join(ROOT, 'package.json'),
    join(homedir(), '.heatpumpdb/mailer/package.json')];
  for (const t of tries) {
    try { return createRequire(t)('nodemailer'); } catch { /* next */ }
  }
  // Outside the repo on purpose: the window must not dirty the working tree.
  const dir = join(homedir(), '.heatpumpdb/mailer');
  mkdirSync(dir, { recursive: true });
  execFileSync('npm', ['install', '--prefix', dir, '--no-audit', '--no-fund', 'nodemailer@^6.9.14'],
    { stdio: 'inherit', timeout: 180_000 });
  return createRequire(join(dir, 'package.json'))('nodemailer');
}

/** The letterhead, evaluated from the billing function's own source — one
 *  design for every member mail, never a copy that drifts. */
function loadLetterhead() {
  const fnDir = join(ROOT, 'google_cloud_function_billing');
  const src = readFileSync(join(fnDir, 'index.js'), 'utf8');
  const start = src.indexOf('const MAIL_ASSETS');
  const lh = src.indexOf('function letterhead(', start);
  const end = src.indexOf('\n}\n', lh);
  if (start < 0 || lh < 0 || end < 0) throw new Error('letterhead block not found in billing index.js');
  const block = src.slice(start, end + 2);
  const ctx = vm.createContext({ require: createRequire(join(fnDir, 'index.js')), __dirname: fnDir, SUPPORT_FROM, String, JSON });
  return vm.runInContext(`${block}\n;({ letterhead, mailAttachments, plainBody, TEXT_SIGNATURE })`, ctx, { timeout: 5000 });
}

let failures = 0;
try {
  const { letterhead, mailAttachments, plainBody, TEXT_SIGNATURE } = loadLetterhead();
  const pass = execFileSync('gcloud', ['secrets', 'versions', 'access', 'latest', '--secret=heatpumpdb-smtp-pass', `--project=${PROJECT}`],
    { encoding: 'utf8', timeout: 30_000 }).trim();
  if (!pass) throw new Error('empty SMTP password');
  const nodemailer = loadNodemailer();
  const tx = nodemailer.createTransport({
    host: 'smtppro.zoho.eu', port: 465, secure: true, auth: { user: SUPPORT_FROM, pass },
    connectionTimeout: 20_000, greetingTimeout: 20_000, socketTimeout: 60_000,
  });

  for (const p of planned) {
    if (Date.now() > DEADLINE) { console.error('! deadline reached — the rest goes out on a re-run (idempotent)'); break; }
    const record = {
      uid: p.uid, to: p.to, subject: p.mail.subject, body: plainBody(p.mail.body), kind: 'watchlist',
      sentByUid: 'system', sentByEmail: null, at: new Date().toISOString(), lang: p.mail.lang, month: MONTH,
    };
    try {
      const info = await tx.sendMail({
        from: `HeatPump DB <${SUPPORT_FROM}>`, to: p.to, replyTo: SUPPORT_FROM, subject: p.mail.subject,
        text: plainBody(p.mail.body) + TEXT_SIGNATURE,
        html: letterhead(p.mail.body, p.to, p.mail.cta),
        attachments: mailAttachments(),
      });
      // Mark ONE map entry (field-path mask) so concurrent/earlier entries survive.
      await setDoc(`watchAlertRuns/${MONTH}`, { sent: { [p.uid]: true }, updatedAt: new Date() },
        { mask: [`sent.\`${p.uid}\``, 'updatedAt'] });
      alreadySent[p.uid] = true;
      await addDoc('memberEmails', { ...record, ok: true, messageId: info.messageId ?? null }).catch(e => console.error('memberEmails write failed', e.message));
      console.log(`  ✓ ${mask(p.to)}`);
    } catch (e) {
      failures++;
      console.error(`  ✗ ${mask(p.to)} — ${String(e.message).slice(0, 160)}`);
      await addDoc('memberEmails', { ...record, ok: false, error: String(e.message).slice(0, 500) }).catch(() => {});
    }
  }
} catch (e) {
  failures++;
  console.error(`! send phase aborted — ${String(e.message).slice(0, 300)}`);
}
process.exit(failures ? 1 : 0);
