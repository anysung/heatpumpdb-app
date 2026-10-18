/**
 * PartnerDetail — one creator partner: details, links, attributed
 * subscriptions, the ledger (payouts, transfer costs, video support,
 * corrections), statements, receipts, documents, the annual statement and the
 * end of the partnership. All writes go through audited function endpoints.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { AdminLang } from '../adminI18n';
import { PARTNERS_I18N } from './partnersI18n';
import { SectionCard, StatCard, EmptyState } from '../shared';
import {
  Partner, LedgerEntry, Attribution, Statement, PartnerDoc,
  listLedger, listAttributions, listPartnerStatements, listPartnerDocs,
  updatePartner, addLedgerEntry, endPartner, sendPartnerDocument, uploadPartnerDocument, getPartnerDocument,
  voidAttribution, balanceOf, partnerLink, MARKET_SITES,
} from '../../../services/partnerAdminService';
import { getUsers } from '../../../services/authService';
import { buildStatementPdf, buildReceiptPdf, buildAnnualPdf, pdfBase64, preloadPartnerPdf } from './partnerPdf';
import { btnPri, btnSec, btnDanger, inp, eurFmt } from '../PartnersPage';

const fileToBase64 = (f: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = () => reject(new Error('read-failed'));
  r.readAsDataURL(f);
});

export const PartnerDetail: React.FC<{ al: AdminLang; partner: Partner; onBack: () => void; onChanged: () => void }> = ({ al, partner, onBack, onChanged }) => {
  const P = PARTNERS_I18N[al];
  const [p, setP] = useState<Partner>(partner);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [attrs, setAttrs] = useState<Attribution[]>([]);
  const [stmts, setStmts] = useState<Statement[]>([]);
  const [docs, setDocs] = useState<PartnerDoc[]>([]);
  const [signups, setSignups] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [tick, setTick] = useState(0);
  const reload = () => { setTick(t => t + 1); onChanged(); };

  useEffect(() => { preloadPartnerPdf().catch(() => {}); }, []);
  useEffect(() => {
    listLedger(p.pid).then(setLedger).catch(() => setLedger([]));
    listAttributions(p.pid).then(setAttrs).catch(() => setAttrs([]));
    listPartnerStatements(p.pid).then(setStmts).catch(() => setStmts([]));
    listPartnerDocs(p.pid).then(setDocs).catch(() => setDocs([]));
  }, [p.pid, tick]);
  useEffect(() => {
    // Funnel: accounts that carry this partner's code or link (trial or paid).
    getUsers().then(us => setSignups(us.filter((u: any) =>
      u.partnerCode === p.code || u.partnerRef === p.refSlug || u.signupRef === p.refSlug).length)).catch(() => setSignups(null));
  }, [p.code, p.refSlug]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 6000); };
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try { await fn(); flash(P.done); reload(); } catch (e: any) { flash(P.failed(e.message)); }
    setBusy('');
  };

  const balance = balanceOf(ledger);
  const paying = attrs.filter(a => a.qualifying && !a.voided && a.firstPaidAt && !a.firstPaymentReversed);
  const active = paying.filter(a => !a.canceledAt);

  // ── Details form ──
  const [form, setForm] = useState({
    name: p.name, email: p.email, otherEmails: (p.otherEmails || []).join(', '), lang: p.lang, country: p.country,
    channelUrl: p.channelUrl || '', contractNo: p.contractNo || '', contractStatus: p.contractStatus || 'none',
    contractSentAt: p.contractSentAt || '', contractSignedAt: p.contractSignedAt || '',
    payoutMethod: p.payoutMethod || '', notes: p.notes || '', status: p.status === 'ended' ? 'ended' : p.status,
  });
  const saveDetails = () => run('details', async () => {
    const { status, ...rest } = form;
    await updatePartner(p.pid, { ...rest, ...(status !== 'ended' ? { status } : {}) });
    setP({ ...p, ...rest, otherEmails: rest.otherEmails.split(',').map(s => s.trim()).filter(Boolean), status: status as any });
  });

  // ── Ledger entry ──
  const today = new Date().toISOString().slice(0, 10);
  const [entry, setEntry] = useState({ type: 'payout', amountEur: '', at: today, reference: '', note: '', videoUrl: '' });
  const addEntry = () => run('entry', async () => {
    await addLedgerEntry({ pid: p.pid, ...entry });
    setEntry({ ...entry, amountEur: '', reference: '', note: '', videoUrl: '' });
  });

  // ── Documents ──
  const sendReceipt = (e: LedgerEntry) => run(`rc_${e.id}`, async () => {
    const d = buildReceiptPdf(e, p);
    await sendPartnerDocument({ pid: p.pid, kind: 'receipt', ledgerEntryId: e.id, pdfBase64: pdfBase64(d), filename: `HeatPumpDB-receipt-${e.id}.pdf` });
  });
  const previewReceipt = (e: LedgerEntry) => window.open(buildReceiptPdf(e, p).output('bloburl') as unknown as string, '_blank');
  const upload = (kind: string, ledgerEntryId?: string) => (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0]; ev.target.value = '';
    if (!f) return;
    run(`up_${kind}_${ledgerEntryId || ''}`, async () => {
      await uploadPartnerDocument({ pid: p.pid, kind, filename: f.name, contentType: f.type || 'application/pdf', fileBase64: await fileToBase64(f), ledgerEntryId });
    });
  };
  const openDoc = (path: string) => run(`doc_${path}`, async () => {
    const r = await getPartnerDocument(path);
    const bin = atob(r.base64); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    window.open(URL.createObjectURL(new Blob([bytes], { type: r.contentType })), '_blank');
  });

  // ── Statements ──
  const previewSt = (s: Statement) => window.open(buildStatementPdf(s, p).output('bloburl') as unknown as string, '_blank');

  // ── Annual ──
  const years = useMemo(() => Array.from(new Set(ledger.filter(e => e.type === 'payout').map(e => String(e.at).slice(0, 4)))).sort().reverse(), [ledger]);
  const [year, setYear] = useState('');
  const sendAnnual = () => run('annual', async () => {
    const y = year || years[0];
    const pays = ledger.filter(e => e.type === 'payout' && String(e.at).startsWith(y));
    const fees = ledger.filter(e => e.type === 'payout_fee' && String(e.at).startsWith(y));
    const d = buildAnnualPdf(y, pays, fees, p);
    await sendPartnerDocument({ pid: p.pid, kind: 'annual', year: y, pdfBase64: pdfBase64(d), filename: `HeatPumpDB-payments-${y}-${p.code}.pdf` });
  });

  // ── End ──
  const [endReason, setEndReason] = useState('');
  const [endBreach, setEndBreach] = useState(false);
  const [endArmed, setEndArmed] = useState(false);

  const [voidNote, setVoidNote] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState('');
  const copy = (s: string) => { navigator.clipboard?.writeText(s).then(() => { setCopied(s); setTimeout(() => setCopied(''), 2000); }); };

  const field = (label: string, el: React.ReactNode) => <label className="flex flex-col gap-1 text-xs text-gray-600">{label}{el}</label>;

  return (
    <div data-testid={`partner-detail-${p.pid}`}>
      <button className="text-sm text-blue-700 mb-3 hover:underline" onClick={onBack}>{P.back}</button>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{p.name} {p.testPartner && <span className="text-xs font-bold bg-gray-200 text-gray-700 px-1.5 rounded align-middle">{P.testBadge}</span>}</h2>
          <div className="text-sm text-gray-500 font-mono">{p.pid} · {p.code} · {p.discountId}</div>
        </div>
        <span className="text-sm font-semibold">{P.status[p.status]} · {P.contract[p.contractStatus || 'none']}</span>
      </div>
      {msg && <div className="mb-3 text-sm bg-gray-50 border rounded px-3 py-2" data-testid="partner-msg">{msg}</div>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <StatCard label={P.kBalance} value={eurFmt(balance)} color="blue" />
        <StatCard label={P.kPaying} value={paying.length} color="green" />
        <StatCard label={P.kActive} value={active.length} color="green" />
        <StatCard label={P.kSignups} value={signups ?? '—'} color="purple" />
        <StatCard label={P.kPremium} value={(p.premiumUntil || '—').slice(0, 10)} color="gray" />
      </div>

      <SectionCard title={P.links} className="mb-4">
        <div className="space-y-1.5">
          {(p.country ? [p.country, ...Object.keys(MARKET_SITES).filter(c => c !== p.country)] : Object.keys(MARKET_SITES)).map(cc => {
            const link = partnerLink(p, cc);
            return (
              <div key={cc} className="flex items-center gap-2 text-xs">
                <span className="w-8 font-semibold">{cc}</span>
                <code className="flex-1 bg-gray-50 border rounded px-2 py-1 truncate">{link}</code>
                <button className={btnSec} onClick={() => copy(link)}>{copied === link ? P.copied : P.copy}</button>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <SectionCard title={P.info}>
          <div className="grid grid-cols-2 gap-2">
            {field(P.fName, <input className={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />)}
            {field(P.fEmail, <input className={inp} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />)}
            {field(P.fOtherEmails, <input className={inp} value={form.otherEmails} onChange={e => setForm({ ...form, otherEmails: e.target.value })} />)}
            {field(P.fLang, <select className={inp} value={form.lang} onChange={e => setForm({ ...form, lang: e.target.value })}>{['en', 'de', 'fr', 'pl', 'it'].map(l => <option key={l}>{l}</option>)}</select>)}
            {field(P.fCountry, <select className={inp} value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}>{['DE', 'GB', 'FR', 'PL', 'IT'].map(l => <option key={l}>{l}</option>)}</select>)}
            {field(P.fChannel, <input className={inp} value={form.channelUrl} onChange={e => setForm({ ...form, channelUrl: e.target.value })} />)}
            {field(P.fContractNo, <input className={inp} value={form.contractNo} onChange={e => setForm({ ...form, contractNo: e.target.value })} />)}
            {field(P.fContractStatus, <select className={inp} value={form.contractStatus} onChange={e => setForm({ ...form, contractStatus: e.target.value as any })}>{(['none', 'sent', 'signed'] as const).map(s => <option key={s} value={s}>{P.contract[s]}</option>)}</select>)}
            {field(P.fSentAt, <input type="date" className={inp} value={form.contractSentAt} onChange={e => setForm({ ...form, contractSentAt: e.target.value })} />)}
            {field(P.fSignedAt, <input type="date" className={inp} value={form.contractSignedAt} onChange={e => setForm({ ...form, contractSignedAt: e.target.value })} />)}
            {p.status !== 'ended' && field(P.fPartnerStatus, <select className={inp} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })}>{(['active', 'paused', 'prospect'] as const).map(s => <option key={s} value={s}>{P.status[s]}</option>)}</select>)}
            <div className="col-span-2">{field(P.fPayout, <textarea className={inp} rows={2} value={form.payoutMethod} onChange={e => setForm({ ...form, payoutMethod: e.target.value })} />)}</div>
            <div className="col-span-2">{field(P.fNotes, <textarea className={inp} rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />)}</div>
          </div>
          <div className="flex justify-end mt-3"><button className={btnPri} disabled={busy === 'details'} onClick={saveDetails}>{busy === 'details' ? P.saving : P.save}</button></div>
        </SectionCard>

        <SectionCard title={P.addEntry}>
          <div className="grid grid-cols-2 gap-2">
            {field(P.colType, <select className={inp} value={entry.type} onChange={e => setEntry({ ...entry, type: e.target.value })} data-testid="ledger-type">
              {Object.entries(P.eType).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>)}
            {field(P.eDate, <input type="date" className={inp} value={entry.at} onChange={e => setEntry({ ...entry, at: e.target.value })} />)}
            {entry.type !== 'video_support' && field(P.eAmount, <input className={inp} value={entry.amountEur} onChange={e => setEntry({ ...entry, amountEur: e.target.value })} placeholder={entry.type === 'manual' ? '-12.50 / 12.50' : '50.00'} data-testid="ledger-amount" />)}
            {entry.type === 'payout' && field(P.eRef, <input className={inp} value={entry.reference} onChange={e => setEntry({ ...entry, reference: e.target.value })} />)}
            {entry.type === 'video_support' && field(P.eVideo, <input className={inp} value={entry.videoUrl} onChange={e => setEntry({ ...entry, videoUrl: e.target.value })} />)}
            <div className="col-span-2">{field(P.eNote, <input className={inp} value={entry.note} onChange={e => setEntry({ ...entry, note: e.target.value })} />)}</div>
          </div>
          <div className="flex justify-between items-center mt-3">
            <span className="text-xs text-gray-500">{P.kBalance}: <b>{eurFmt(balance)}</b></span>
            <button className={btnPri} disabled={busy === 'entry'} onClick={addEntry} data-testid="ledger-add">{P.add}</button>
          </div>
        </SectionCard>
      </div>

      <SectionCard title={P.attributions} className="mb-4">
        {attrs.length === 0 ? <EmptyState message={P.none} /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 border-b">
              <th className="py-2">{P.colRef}</th><th>{P.colPlan}</th><th>{P.colTerm}</th><th>{P.colFirstPaid}</th><th>{P.colEnds}</th><th>{P.colStatus}</th><th>{P.colFlags}</th><th />
            </tr></thead>
            <tbody>{attrs.map(a => (
              <tr key={a.id} className={`border-b ${a.voided ? 'opacity-50' : ''}`}>
                <td className="py-2 font-mono">{a.customerRef}</td><td>{a.planCode}</td><td>{a.billingTerm}</td>
                <td className="text-xs">{(a.firstPaidAt || '—').slice(0, 10)}</td><td className="text-xs">{(a.commissionEndsAt || '—').slice(0, 10)}</td>
                <td className="text-xs">{a.voided ? P.voided : !a.qualifying ? `${P.notQualifying} (${a.notQualifyingReason})` : (a.subStatus || '')}{a.canceledAt ? ` · ${String(a.canceledAt).slice(0, 10)}` : ''}</td>
                <td className="text-xs text-red-700">{(a.reviewFlags || []).join(', ')}</td>
                <td className="text-right whitespace-nowrap">
                  {!a.voided && a.qualifying && (
                    <span className="inline-flex gap-1">
                      <input className={`${inp} w-36 text-xs`} placeholder={P.resolvedPh} value={voidNote[a.id] || ''} onChange={e => setVoidNote({ ...voidNote, [a.id]: e.target.value })} />
                      <button className={btnDanger} disabled={!(voidNote[a.id] || '').trim() || busy === `void_${a.id}`}
                        onClick={() => run(`void_${a.id}`, () => voidAttribution(a.id, voidNote[a.id]))}>{P.voidAttr}</button>
                    </span>
                  )}
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </SectionCard>

      <SectionCard title={P.ledger} className="mb-4">
        {ledger.length === 0 ? <EmptyState message={P.none} /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 border-b">
              <th className="py-2">{P.colDate}</th><th>{P.colType}</th><th>{P.colRef}</th><th>{P.colPlan}</th><th className="text-right">{P.colNet}</th><th className="text-right">{P.colAmount}</th><th>{P.colNote}</th><th />
            </tr></thead>
            <tbody>{ledger.map(e => (
              <tr key={e.id} className="border-b">
                <td className="py-1.5 text-xs">{String(e.at).slice(0, 10)}</td>
                <td className="text-xs">{P.types[e.type] ?? e.type}{e.pending ? ` · ${P.pending}` : ''}</td>
                <td className="font-mono text-xs">{e.customerRef || ''}</td>
                <td className="text-xs">{e.planCode ? `${e.planCode} / ${e.billingTerm}` : ''}</td>
                <td className="text-right text-xs">{e.netCents != null ? eurFmt(e.netCents) : ''}</td>
                <td className={`text-right font-semibold ${e.amountCents < 0 ? 'text-red-700' : 'text-green-700'}`}>{eurFmt(e.amountCents)}</td>
                <td className="text-xs text-gray-500">{e.reference ? `ref ${e.reference} ` : ''}{e.note || ''}{e.videoUrl ? ` ${e.videoUrl}` : ''}</td>
                <td className="text-right whitespace-nowrap">
                  {e.type === 'payout' && (
                    <span className="inline-flex gap-1 items-center">
                      <button className={btnSec} onClick={() => previewReceipt(e)}>{P.preview}</button>
                      <button className={btnSec} disabled={busy === `rc_${e.id}`} onClick={() => sendReceipt(e)}>{e.receiptSentAt ? P.resend : P.sendReceipt}</button>
                      {e.receiptSignedAt ? <span className="text-xs text-green-700">{P.receiptSigned}</span> : (
                        <label className={`${btnSec} cursor-pointer`}>{P.uploadSigned}<input type="file" className="hidden" accept="application/pdf,image/*" onChange={upload('signed-receipt', e.id)} /></label>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </SectionCard>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <SectionCard title={P.statements}>
          {stmts.length === 0 ? <EmptyState message={P.none} /> : stmts.map(s => (
            <div key={s.id} className="flex items-center justify-between border-b py-1.5 text-sm">
              <span>{s.month} · {eurFmt(s.closingCents)} · {P.stStatus[s.status]}</span>
              <button className={btnSec} onClick={() => previewSt(s)}>{P.preview}</button>
            </div>
          ))}
          <div className="mt-4 pt-3 border-t">
            <div className="text-xs font-semibold text-gray-600 mb-2">{P.annual}</div>
            <div className="flex gap-2 items-center">
              <select className={inp} value={year || years[0] || ''} onChange={e => setYear(e.target.value)} disabled={!years.length}>
                {years.map(y => <option key={y}>{y}</option>)}
              </select>
              <button className={btnSec} disabled={!years.length || busy === 'annual'} onClick={sendAnnual}>{P.annualSend}</button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title={P.documents}>
          {docs.length === 0 ? <EmptyState message={P.none} /> : docs.map(d => (
            <div key={d.id} className="flex items-center justify-between border-b py-1.5 text-xs">
              <span>{String(d.createdAt).slice(0, 10)} · {d.kind} · {d.filename}</span>
              <button className={btnSec} onClick={() => openDoc(d.path)}>{P.download}</button>
            </div>
          ))}
          <label className={`${btnSec} cursor-pointer inline-block mt-3`}>{P.uploadContract}
            <input type="file" className="hidden" accept="application/pdf,image/*" onChange={upload('signed-contract')} /></label>
        </SectionCard>
      </div>

      {p.status !== 'ended' && (
        <SectionCard title={P.endTitle}>
          <p className="text-xs text-gray-500 mb-2">{P.endHelp}</p>
          <div className="flex gap-2 items-center flex-wrap">
            <input className={`${inp} flex-1`} placeholder={P.endReason} value={endReason} onChange={e => setEndReason(e.target.value)} />
            <label className="text-xs text-red-700 flex items-center gap-1"><input type="checkbox" checked={endBreach} onChange={e => setEndBreach(e.target.checked)} />{P.endBreach}</label>
            <button className={btnDanger} disabled={!endReason.trim() || busy === 'end'} onClick={() => {
              if (!endArmed) { setEndArmed(true); return; }
              setEndArmed(false);
              run('end', async () => { const r = await endPartner(p.pid, endReason, endBreach); setP({ ...p, status: 'ended' }); if (r.errors?.length) flash(P.failed(r.errors.join(', '))); });
            }}>{endArmed ? P.confirm : P.endBtn}</button>
          </div>
        </SectionCard>
      )}
    </div>
  );
};
