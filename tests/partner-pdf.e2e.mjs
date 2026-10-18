/**
 * Creator-partner PDFs — rendered for real (2026-10-18).
 *
 * Builds a six-month partner history through partnerRules.js (the same code the
 * billing function uses), renders the statement, payment receipt and annual
 * statement in all five partner languages in Chromium (embedded Noto Sans +
 * brand artwork — exactly what the admin console sends), then checks the text
 * layer: figures present, Polish/Italian/German/French glyphs intact (the PDF
 * standard font would drop them), nothing personal in the statement.
 *
 * Run: node tests/partner-pdf.e2e.mjs [outDir]    (starts its own vite on :5198)
 */
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const R = require(resolve(root, 'google_cloud_function_billing/partnerRules.js'));
const outDir = resolve(process.argv[2] || '/tmp/partner-pdf');
mkdirSync(outDir, { recursive: true });

// ── A plausible partner history, booked through the real rules ────────────
const ledger = [], attributions = [];
let seq = 0;
const plans = [['professional', 'monthly', 693, 545], ['professional', 'annual', 6930, 6120], ['team_3', 'monthly', 1743, 1520]];
const months = ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04'];
months.forEach((m, mi) => {
  for (let i = 0; i < 6 + mi * 4; i++) {
    const [planCode, billingTerm, , earn] = plans[i % 7 === 0 ? 1 : i % 5 === 0 ? 2 : 0];
    const at = `${m}-${String(3 + (i % 24)).padStart(2, '0')}T10:00:00Z`;
    seq++;
    const a = { id: `sub_${seq}`, customerRef: R.customerRef(seq), qualifying: true, firstPaidAt: at, planCode, billingTerm,
      canceledAt: i % 13 === 0 && mi < 5 ? `${months[mi + 1]}-20T10:00:00Z` : null };
    attributions.push(a);
    ledger.push({ id: `c_${seq}`, type: 'commission', first: true, customerRef: a.customerRef, planCode, billingTerm,
      at, month: R.berlinMonth(at), netCents: earn, amountCents: R.commissionCents(earn) });
  }
  // renewals of earlier monthly subscriptions
  attributions.filter(a => a.billingTerm === 'monthly' && a.firstPaidAt < `${m}-01` && !a.canceledAt).forEach(a => {
    const at = `${m}-${a.firstPaidAt.slice(8, 10)}T10:00:00Z`;
    const earn = a.planCode === 'team_3' ? 2170 : 779;
    ledger.push({ id: `r_${a.id}_${m}`, type: 'commission', first: false, customerRef: a.customerRef, planCode: a.planCode,
      billingTerm: a.billingTerm, at, month: m, netCents: earn, amountCents: R.commissionCents(earn) });
  });
});
ledger.push({ id: 'a_1', type: 'clawback', customerRef: 'C-0012', planCode: 'professional', billingTerm: 'annual',
  at: '2027-04-18T10:00:00Z', month: '2027-04', netCents: -6120, amountCents: -1836, action: 'refund' });
ledger.push({ id: 'v_1', type: 'video_support', at: '2027-04-21T10:00:00Z', month: '2027-04', amountCents: 15000, note: 'Q2 video' });
const payouts = [];
for (const m of months.slice(0, 5)) {
  const st = R.buildStatement({ ym: m, ledger, attributions });
  if (st.payoutDue) {
    const at = `${R.payoutDueDate(m).slice(0, 8)}12T12:00:00Z`;
    const p = { id: `p_${m}`, type: 'payout', at, month: R.berlinMonth(at), amountCents: -st.closingCents, reference: `WISE-${m.replace('-', '')}` };
    ledger.push(p); payouts.push(p);
  }
}
const ym = '2027-04';
const statement = { ...R.buildStatement({ ym, ledger, attributions }), history: R.buildHistory({ ym, firstMonth: '2026-11', ledger, attributions }),
  month: ym, statementNo: 'CP-2027-04-0006', status: 'approved', partnerSince: '2026-11-12' };

// ── Render ────────────────────────────────────────────────────────────────
const PORT = 5198;
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });
let failed = 0, passed = 0;
const is = (name, ok, extra = '') => { if (ok) { passed++; console.log(`  ✓ ${name}`); } else { failed++; console.error(`  ✗ ${name} ${extra}`); } };
try {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome' });
  const page = await browser.newPage();
  for (let i = 0; i < 40; i++) {
    try { await page.goto(`http://localhost:${PORT}/tests/harness/partner-pdf.html`); break; }
    catch { await new Promise(r => setTimeout(r, 500)); }
  }
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  const EXPECT = {
    en: ['Creator Partner Statement', 'Commission earned in', 'Payment receipt', 'Statement of amounts paid'],
    de: ['Partner-Abrechnung', 'Provision im', 'Zahlungsbestätigung', 'Überweisung'],
    fr: ['Relevé partenaire', 'Commissions de', 'Reçu de paiement', 'Montant versé'],
    pl: ['Zestawienie partnerskie', 'Prowizja za', 'Potwierdzenie płatności', 'Państwa'],
    it: ['Rendiconto partner', 'Commissioni di', 'Ricevuta di pagamento', 'Il Suo'],
  };
  console.log('\nPartner PDFs\n');
  for (const lang of Object.keys(EXPECT)) {
    const out = await page.evaluate(([l, st, p, ps]) => window.__render(l, st, p, ps), [lang, statement, payouts[payouts.length - 1], payouts]);
    let all = '';
    for (const [kind, b64] of Object.entries(out)) {
      const file = resolve(outDir, `${kind}.${lang}.pdf`);
      writeFileSync(file, Buffer.from(b64, 'base64'));
      const text = execFileSync('pdftotext', ['-layout', file, '-']).toString();
      all += text;
      if (kind === 'statement') {
        is(`${lang}: statement carries the code and statement no.`, text.includes('RHH30') && text.includes('CP-2027-04-0006'));
        is(`${lang}: statement has no email address of a customer`, !/@(?!heatpumpdb\.eu)/.test(text));
        const pages = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [file]).toString())[1]);
        is(`${lang}: statement fits on ≤ 3 pages (${pages})`, pages <= 3);
      }
    }
    for (const s of EXPECT[lang]) is(`${lang}: "${s}" renders`, all.includes(s), '(missing — glyph loss or copy change)');
  }
  await browser.close();
} finally {
  vite.kill();
}
console.log(`\n${passed} passed, ${failed} failed — PDFs in ${outDir}\n`);
process.exit(failed ? 1 : 0);
