/**
 * PartnersPage — the creator-partner programme's operating surface (2026-10-18).
 *
 * Owner decision 2026-10-18: no code reaches a creator until this page, the
 * ledger behind it and the monthly statement all work end to end. The page
 * READS the books directly (admin-read rules) and WRITES only through audited
 * billing-function endpoints (services/partnerAdminService.ts) — so a balance
 * on this screen is always the sum of the ledger, never a number someone typed.
 *
 * Tabs: Partners (list → detail) · Join requests (→ register) · Review queue ·
 * Monthly close (drafts → preview → approve → send; payouts and receipts) ·
 * Audit log.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { AdminLang } from './adminI18n';
import { PARTNERS_I18N } from './partners/partnersI18n';
import { StatCard, SectionCard, EmptyState, PageHeader } from './shared';
import {
  Partner, LedgerEntry, Statement, ReviewItem, InterestRecord, Attribution,
  listPartners, listAllLedger, listStatements, listReview, listInterest, listPartnerAudit,
  closeMonth, setStatementStatus, sendPartnerDocument, resolveReview, voidAttribution, balanceOf,
} from '../../services/partnerAdminService';
import { buildStatementPdf, preloadPartnerPdf, pdfBase64 } from './partners/partnerPdf';
import { RegisterPartnerForm } from './partners/RegisterPartnerForm';
import { PartnerDetail } from './partners/PartnerDetail';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

type Tab = 'partners' | 'requests' | 'review' | 'monthly' | 'audit';

export const eurFmt = (c: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format((c || 0) / 100);
export const btn = 'px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors disabled:opacity-40';
export const btnPri = `${btn} bg-blue-600 text-white border-blue-600 hover:bg-blue-700`;
export const btnSec = `${btn} bg-white text-gray-700 border-gray-300 hover:bg-gray-50`;
export const btnDanger = `${btn} bg-white text-red-700 border-red-300 hover:bg-red-50`;
export const inp = 'px-2.5 py-1.5 border rounded-md text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500';

export const prevBerlinMonth = (): string => {
  const now = new Date();
  const ym = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit' }).format(now).slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

export const PartnersPage: React.FC<{ al: AdminLang }> = ({ al }) => {
  const P = PARTNERS_I18N[al];
  const [tab, setTab] = useState<Tab>('partners');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [attrs, setAttrs] = useState<Attribution[]>([]);
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [interest, setInterest] = useState<InterestRecord[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [openPid, setOpenPid] = useState<string | null>(null);
  const [registering, setRegistering] = useState<Partial<Partner> & { interestId?: string } | null>(null);
  const [tick, setTick] = useState(0);
  const reload = () => setTick(t => t + 1);

  useEffect(() => { preloadPartnerPdf().catch(() => {}); }, []);
  useEffect(() => {
    listPartners().then(setPartners).catch(() => setPartners([]));
    listAllLedger().then(setLedger).catch(() => setLedger([]));
    getDocs(collection(db, 'partnerAttributions')).then(s => setAttrs(s.docs.map(d => d.data() as Attribution))).catch(() => setAttrs([]));
    listReview().then(setReview).catch(() => setReview([]));
    listInterest().then(setInterest).catch(() => setInterest([]));
    listStatements().then(setStatements).catch(() => setStatements([]));
  }, [tick]);

  const byPid = useMemo(() => {
    const m: Record<string, { balance: number; paying: number }> = {};
    for (const p of partners) {
      const l = ledger.filter(e => e.pid === p.pid);
      const a = attrs.filter(x => x.pid === p.pid && x.qualifying && !x.voided && x.firstPaidAt && !x.firstPaymentReversed);
      m[p.pid] = { balance: balanceOf(l), paying: a.length };
    }
    return m;
  }, [partners, ledger, attrs]);

  const openReview = review.filter(r => r.status === 'open');
  const newRequests = interest.filter(i => i.status === 'new');
  const owed = Object.values(byPid).reduce((s, x) => s + Math.max(0, x.balance), 0);
  const lastMonth = prevBerlinMonth();
  const due = statements.filter(s => s.month === lastMonth && s.payoutDue).length;

  if (openPid) {
    const p = partners.find(x => x.pid === openPid);
    if (p) return <PartnerDetail al={al} partner={p} onBack={() => { setOpenPid(null); reload(); }} onChanged={reload} />;
  }

  const tabBtn = (k: Tab, label: string, badge = 0) => (
    <button key={k} onClick={() => setTab(k)} data-testid={`partners-tab-${k}`}
      className={`px-4 py-2 text-sm font-medium flex items-center gap-2 ${tab === k ? 'bg-slate-800 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
      {label}{badge > 0 && <span className="bg-yellow-400 text-slate-900 text-[10px] font-bold px-1.5 rounded-full">{badge}</span>}
    </button>
  );

  return (
    <div data-testid="partners-page">
      <PageHeader title={`🤝 ${P.title}`} subtitle={P.subtitle}
        action={<button className={btnPri} onClick={() => setRegistering({})} data-testid="partner-register-open">{P.register}</button>} />
      <div className="mb-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">{P.launchGate}</div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <StatCard label={P.stActive} value={partners.filter(p => p.status === 'active' && !p.testPartner).length} color="green" />
        <StatCard label={P.stOwed} value={eurFmt(owed)} color="blue" />
        <StatCard label={P.stDue} value={due} color="purple" subtitle={lastMonth} />
        <StatCard label={P.stReview} value={openReview.length} color={openReview.length ? 'red' : 'gray'} />
        <StatCard label={P.stRequests} value={newRequests.length} color={newRequests.length ? 'yellow' : 'gray'} />
      </div>

      <div className="flex rounded-lg overflow-hidden border border-gray-300 bg-white w-fit mb-4">
        {tabBtn('partners', P.tabs.partners)}
        {tabBtn('requests', P.tabs.requests, newRequests.length)}
        {tabBtn('review', P.tabs.review, openReview.length)}
        {tabBtn('monthly', P.tabs.monthly)}
        {tabBtn('audit', P.tabs.audit)}
      </div>

      {registering && (
        <RegisterPartnerForm al={al} initial={registering} onClose={() => setRegistering(null)}
          onDone={(pid) => { setRegistering(null); reload(); setOpenPid(pid); }} />
      )}

      {tab === 'partners' && (
        <SectionCard title={P.tabs.partners}>
          {partners.length === 0 ? <EmptyState message={P.none} /> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-2">{P.colName}</th><th>{P.colCode}</th><th>{P.colCountry}</th><th>{P.colStatus}</th>
                <th>{P.colContract}</th><th className="text-right">{P.colPaying}</th><th className="text-right">{P.colBalance}</th><th>{P.colPremium}</th>
              </tr></thead>
              <tbody>
                {partners.map(p => (
                  <tr key={p.pid} className="border-b hover:bg-blue-50 cursor-pointer" onClick={() => setOpenPid(p.pid)} data-testid={`partner-row-${p.pid}`}>
                    <td className="py-2 font-medium">{p.name} {p.testPartner && <span className="ml-1 text-[10px] font-bold bg-gray-200 text-gray-700 px-1 rounded">{P.testBadge}</span>}
                      <div className="text-xs text-gray-400">{p.pid}</div></td>
                    <td className="font-mono">{p.code}</td>
                    <td>{p.country}</td>
                    <td>{P.status[p.status]}</td>
                    <td>{P.contract[p.contractStatus || 'none']}</td>
                    <td className="text-right">{byPid[p.pid]?.paying ?? 0}</td>
                    <td className="text-right font-semibold">{eurFmt(byPid[p.pid]?.balance ?? 0)}</td>
                    <td className="text-xs">{(p.premiumUntil || '').slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>
      )}

      {tab === 'requests' && (
        <SectionCard title={P.tabs.requests}>
          {interest.length === 0 ? <EmptyState message={P.none} /> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-2">{P.colDate}</th><th>{P.colPid}</th><th>{P.colName}</th><th>{P.colEmail}</th><th>{P.colLang}</th><th>{P.colStatus}</th><th />
              </tr></thead>
              <tbody>
                {interest.map(r => (
                  <tr key={r.id} className="border-b">
                    <td className="py-2 text-xs">{r.createdAt.slice(0, 16).replace('T', ' ')}</td>
                    <td className="font-mono text-xs">{r.pid}</td><td>{r.name || '—'}</td><td>{r.email}</td><td>{r.lang}</td>
                    <td>{P.reqStatus[r.status] ?? r.status}</td>
                    <td className="text-right">
                      {r.status !== 'registered' && r.status !== 'test' && !partners.some(p => p.pid === r.pid) && (
                        <button className={btnSec} onClick={() => setRegistering({
                          pid: r.pid, email: r.email, name: r.name || '', lang: r.lang || 'en',
                          country: ({ gb: 'GB', de: 'DE', fr: 'FR', pl: 'PL', it: 'IT' } as Record<string, string>)[r.pid.slice(0, 2)] || '',
                          interestId: r.id,
                        })}>{P.reqRegister}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>
      )}

      {tab === 'review' && <ReviewTab al={al} items={review} partners={partners} onChanged={reload} />}
      {tab === 'monthly' && <MonthlyTab al={al} partners={partners} statements={statements} ledger={ledger} onChanged={reload} onOpen={setOpenPid} />}
      {tab === 'audit' && <AuditTab al={al} />}
    </div>
  );
};

// ── Review queue ────────────────────────────────────────────────────────────
const ReviewTab: React.FC<{ al: AdminLang; items: ReviewItem[]; partners: Partner[]; onChanged: () => void }> = ({ al, items, partners, onChanged }) => {
  const P = PARTNERS_I18N[al];
  const [showAll, setShowAll] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [armed, setArmed] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const shown = items.filter(i => showAll || i.status === 'open');
  const name = (pid?: string) => partners.find(p => p.pid === pid)?.name || pid || '—';
  const act = async (fn: () => Promise<unknown>) => {
    try { await fn(); setMsg(P.done); onChanged(); } catch (e: any) { setMsg(P.failed(e.message)); }
  };
  return (
    <SectionCard title={P.tabs.review} action={
      <label className="text-xs text-gray-500 flex items-center gap-1"><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />{P.showResolved}</label>}>
      {msg && <div className="text-xs mb-2 text-gray-600">{msg}</div>}
      {shown.length === 0 ? <EmptyState icon="✅" message={P.none} /> : shown.map(i => (
        <div key={i.id} className={`border rounded-md p-3 mb-2 ${i.status === 'open' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex justify-between text-sm">
            <span className="font-semibold">{P.reviewKinds[i.kind] ?? i.kind} · {name(i.pid)}</span>
            <span className="text-xs text-gray-500">{String(i.createdAt).slice(0, 16).replace('T', ' ')}</span>
          </div>
          <div className="text-xs text-gray-600 mt-1">{i.note}</div>
          {i.flags?.length ? <div className="text-xs text-red-700 mt-1">{i.flags.join(', ')}</div> : null}
          {i.subscriptionId && <div className="text-[11px] text-gray-400 font-mono mt-1">{i.subscriptionId}</div>}
          {i.status === 'open' && (
            <div className="flex gap-2 mt-2 items-center">
              <input className={`${inp} flex-1`} placeholder={P.resolvedPh} value={notes[i.id] || ''} onChange={e => setNotes({ ...notes, [i.id]: e.target.value })} />
              <button className={btnSec} onClick={() => act(() => resolveReview(i.id, notes[i.id] || ''))}>{P.resolve}</button>
              {i.subscriptionId && i.kind === 'self-referral' && (
                <button className={btnDanger} disabled={!(notes[i.id] || '').trim()} onClick={() => {
                  if (armed !== i.id) { setArmed(i.id); return; }
                  setArmed(null);
                  act(async () => { await voidAttribution(i.subscriptionId, notes[i.id]); await resolveReview(i.id, `voided: ${notes[i.id]}`); });
                }}>{armed === i.id ? P.confirm : P.voidAttr}</button>
              )}
            </div>
          )}
          {i.status !== 'open' && i.resolution && <div className="text-xs text-gray-500 mt-1">✓ {i.resolution}</div>}
        </div>
      ))}
    </SectionCard>
  );
};

// ── Monthly close ───────────────────────────────────────────────────────────
const MonthlyTab: React.FC<{
  al: AdminLang; partners: Partner[]; statements: Statement[]; ledger: LedgerEntry[];
  onChanged: () => void; onOpen: (pid: string) => void;
}> = ({ al, partners, statements, ledger, onChanged, onOpen }) => {
  const P = PARTNERS_I18N[al];
  const [month, setMonth] = useState(prevBerlinMonth());
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const rows = statements.filter(s => s.month === month).sort((a, b) => a.pid.localeCompare(b.pid));
  const partnerOf = (pid: string) => partners.find(p => p.pid === pid);

  const run = async () => {
    setBusy('close');
    try { const r = await closeMonth(month); setMsg(P.closeDone(r.drafts, r.settled, r.stillPending, r.skippedFinal)); onChanged(); }
    catch (e: any) { setMsg(P.failed(e.message)); }
    setBusy('');
  };
  const pdfFor = (s: Statement) => { const p = partnerOf(s.pid); return p ? buildStatementPdf(s, p) : null; };
  const preview = (s: Statement) => { const d = pdfFor(s); if (d) window.open(d.output('bloburl') as unknown as string, '_blank'); };
  const send = async (s: Statement, resend = false) => {
    const d = pdfFor(s); if (!d) return;
    setBusy(s.id);
    try {
      await sendPartnerDocument({ pid: s.pid, kind: 'statement', statementId: s.id, pdfBase64: pdfBase64(d), filename: `HeatPumpDB-statement-${s.month}-${partnerOf(s.pid)?.code}.pdf`, resend });
      setMsg(P.done); onChanged();
    } catch (e: any) { setMsg(P.failed(e.message)); }
    setBusy('');
  };
  const status = async (s: Statement, st: 'draft' | 'approved') => {
    try { await setStatementStatus(s.id, st); onChanged(); } catch (e: any) { setMsg(P.failed(e.message)); }
  };

  const payouts = ledger.filter(e => e.type === 'payout').sort((a, b) => String(b.at).localeCompare(String(a.at)));

  return (
    <>
      <SectionCard title={P.tabs.monthly}>
        <div className="flex gap-2 items-center mb-2">
          <label className="text-xs text-gray-500">{P.monthLabel}</label>
          <input type="month" className={inp} value={month} onChange={e => setMonth(e.target.value)} data-testid="partners-month" />
          <button className={btnPri} onClick={run} disabled={!!busy} data-testid="partners-run-close">{busy === 'close' ? P.closing : P.runClose}</button>
        </div>
        <p className="text-xs text-gray-500 mb-3">{P.closeHelp}</p>
        {msg && <div className="text-xs mb-3 text-gray-700 bg-gray-50 border rounded px-2 py-1">{msg}</div>}
        {rows.length === 0 ? <EmptyState message={P.none} /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 border-b">
              <th className="py-2">{P.colName}</th><th className="text-right">{P.colAmount}</th><th>{P.colStatus}</th><th className="text-right">{P.colPending}</th><th>{P.colStatus}</th><th />
            </tr></thead>
            <tbody>{rows.map(s => (
              <tr key={s.id} className="border-b" data-testid={`statement-row-${s.pid}`}>
                <td className="py-2"><button className="text-blue-700 hover:underline" onClick={() => onOpen(s.pid)}>{partnerOf(s.pid)?.name || s.pid}</button>
                  <div className="text-[11px] text-gray-400">{s.statementNo}</div></td>
                <td className="text-right font-semibold">{eurFmt(s.closingCents)}</td>
                <td className="text-xs">{s.payoutDue ? <span className="text-green-700 font-semibold">{P.payoutDue} · {P.dueBy} {s.payoutDueBy}</span> : P.carried}</td>
                <td className="text-right">{s.pendingCount || 0}</td>
                <td className="text-xs">{P.stStatus[s.status]}{s.sentAt ? ` · ${String(s.sentAt).slice(0, 10)}` : ''}</td>
                <td className="text-right space-x-1 whitespace-nowrap">
                  <button className={btnSec} onClick={() => preview(s)}>{P.preview}</button>
                  {s.status === 'draft' && <button className={btnSec} onClick={() => status(s, 'approved')}>{P.approve}</button>}
                  {s.status === 'approved' && <button className={btnSec} onClick={() => status(s, 'draft')}>{P.unapprove}</button>}
                  {s.status === 'approved' && <button className={btnPri} disabled={busy === s.id} onClick={() => send(s)}>{busy === s.id ? P.sending : P.send}</button>}
                  {s.status === 'sent' && <button className={btnSec} disabled={busy === s.id} onClick={() => send(s, true)}>{P.resend}</button>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </SectionCard>

      <SectionCard title={P.payoutsTitle} className="mt-4">
        {payouts.length === 0 ? <EmptyState message={P.none} /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 border-b">
              <th className="py-2">{P.colDate}</th><th>{P.colName}</th><th className="text-right">{P.colAmount}</th><th>{P.colReference}</th><th>{P.colReceipt}</th>
            </tr></thead>
            <tbody>{payouts.map(e => (
              <tr key={e.id} className="border-b">
                <td className="py-2 text-xs">{String(e.at).slice(0, 10)}</td>
                <td><button className="text-blue-700 hover:underline" onClick={() => onOpen(e.pid)}>{partnerOf(e.pid)?.name || e.pid}</button></td>
                <td className="text-right">{eurFmt(-e.amountCents)}</td>
                <td className="text-xs font-mono">{e.reference || '—'}</td>
                <td className="text-xs">{e.receiptSignedAt ? <span className="text-green-700">{P.receiptSigned}</span>
                  : e.receiptSentAt ? <span className="text-amber-700">{P.receiptSent} · {P.receiptMissing}</span> : <span className="text-red-700">—</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </SectionCard>
    </>
  );
};

// ── Audit ──────────────────────────────────────────────────────────────────
const AuditTab: React.FC<{ al: AdminLang }> = ({ al }) => {
  const P = PARTNERS_I18N[al];
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { listPartnerAudit().then(setRows).catch(() => setRows([])); }, []);
  return (
    <SectionCard title={P.tabs.audit}>
      {rows.length === 0 ? <EmptyState message={P.none} /> : (
        <table className="w-full text-xs">
          <thead><tr className="text-left text-gray-500 border-b"><th className="py-2">{P.colDate}</th><th>{P.colWho}</th><th>{P.colWhat}</th><th>{P.colPid}</th><th>{P.colNote}</th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.id} className="border-b">
              <td className="py-1.5">{String(r.at).slice(0, 16).replace('T', ' ')}</td><td>{r.by}</td><td className="font-semibold">{r.action}</td>
              <td className="font-mono">{r.pid || r.subscriptionId || r.month || ''}</td>
              <td className="text-gray-500">{['code', 'type', 'amountCents', 'status', 'reason', 'to'].filter(k => r[k] != null && r[k] !== '').map(k => `${k}: ${r[k]}`).join(' · ')}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </SectionCard>
  );
};
