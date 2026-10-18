/**
 * RegisterPartnerForm — one action that makes a creator a partner: Paddle
 * discount (first payment only, every current Premium price), partner record,
 * code mapping, promotions-registry entry and Premium on their own account
 * (billing function /partnerRegister). Prefilled from a join request.
 */
import React, { useState } from 'react';
import { AdminLang } from '../adminI18n';
import { PARTNERS_I18N } from './partnersI18n';
import { registerPartner, Partner } from '../../../services/partnerAdminService';
import programme from '../../../legal/partnerProgramme.json';
import { btnPri, btnSec, inp } from '../PartnersPage';

const LANGS = ['en', 'de', 'fr', 'pl', 'it'];
const MARKETS = ['DE', 'GB', 'FR', 'PL', 'IT'];

/** Suggested code: the channel's first word, letters only, + the discount figure. */
const suggestCode = (name: string) =>
  `${(name || '').toUpperCase().replace(/[^A-Z]/g, ' ').trim().split(/\s+/)[0]?.slice(0, 10) || 'PARTNER'}${programme.firstPaymentDiscountPct}`;

export const RegisterPartnerForm: React.FC<{
  al: AdminLang; initial: Partial<Partner> & { interestId?: string };
  onClose: () => void; onDone: (pid: string) => void;
}> = ({ al, initial, onClose, onDone }) => {
  const P = PARTNERS_I18N[al];
  const [f, setF] = useState({
    pid: initial.pid || '', name: initial.name || '', email: initial.email || '', otherEmails: '',
    lang: initial.lang || 'en', country: initial.country || '', channelUrl: '', contractNo: '',
    code: initial.name ? suggestCode(initial.name) : '', premiumMonths: '12', testPartner: false, discountPct: '100',
    payoutMethod: '', notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const set = (k: keyof typeof f, v: any) => setF(x => ({ ...x, [k]: v }));

  const submit = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await registerPartner({
        ...f, code: f.code.toUpperCase(), premiumMonths: Number(f.premiumMonths),
        discountPct: Number(f.discountPct), interestId: initial.interestId || '',
      });
      setMsg(P.registered(r.code));
      onDone(r.pid);
    } catch (e: any) { setMsg(P.failed(e.message)); }
    setBusy(false);
  };

  const row = (label: string, el: React.ReactNode) => (
    <label className="flex flex-col gap-1 text-xs text-gray-600">{label}{el}</label>
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" data-testid="partner-register-form">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6">
        <h3 className="text-lg font-bold mb-1">{P.regTitle}</h3>
        <p className="text-xs text-gray-500 mb-4">{P.regHelp}</p>
        <div className="grid grid-cols-2 gap-3">
          {row(P.fPid, <input className={inp} value={f.pid} onChange={e => set('pid', e.target.value.toLowerCase())} placeholder="gb-renewable-heating-hub" />)}
          {row(P.fName, <input className={inp} value={f.name} onChange={e => { set('name', e.target.value); if (!f.code) set('code', suggestCode(e.target.value)); }} />)}
          {row(P.fEmail, <input className={inp} value={f.email} onChange={e => set('email', e.target.value)} />)}
          {row(P.fOtherEmails, <input className={inp} value={f.otherEmails} onChange={e => set('otherEmails', e.target.value)} />)}
          {row(P.fLang, <select className={inp} value={f.lang} onChange={e => set('lang', e.target.value)}>{LANGS.map(l => <option key={l}>{l}</option>)}</select>)}
          {row(P.fCountry, <select className={inp} value={f.country} onChange={e => set('country', e.target.value)}><option value="">—</option>{MARKETS.map(m => <option key={m}>{m}</option>)}</select>)}
          {row(P.fChannel, <input className={inp} value={f.channelUrl} onChange={e => set('channelUrl', e.target.value)} />)}
          {row(P.fContractNo, <input className={inp} value={f.contractNo} onChange={e => set('contractNo', e.target.value)} placeholder="HPDB-P-2026-001" />)}
          {row(P.fCode, <input className={`${inp} font-mono`} value={f.code} onChange={e => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />)}
          {row(P.fPremiumMonths, <input className={inp} type="number" min={1} max={36} value={f.premiumMonths} onChange={e => set('premiumMonths', e.target.value)} />)}
          <div className="col-span-2">{row(P.fPayout, <textarea className={inp} rows={2} value={f.payoutMethod} onChange={e => set('payoutMethod', e.target.value)} />)}</div>
          <div className="col-span-2">{row(P.fNotes, <textarea className={inp} rows={2} value={f.notes} onChange={e => set('notes', e.target.value)} />)}</div>
          <label className="col-span-2 text-xs text-gray-600 flex items-center gap-2">
            <input type="checkbox" checked={f.testPartner} onChange={e => set('testPartner', e.target.checked)} />{P.fTest}
            {f.testPartner && <input className={`${inp} w-20`} value={f.discountPct} onChange={e => set('discountPct', e.target.value)} />}
          </label>
        </div>
        {msg && <div className="text-sm mt-3">{msg}</div>}
        <div className="flex justify-end gap-2 mt-5">
          <button className={btnSec} onClick={onClose}>{P.cancel}</button>
          <button className={btnPri} disabled={busy || !f.pid || !f.name || !f.email || !f.code} onClick={submit} data-testid="partner-register-submit">
            {busy ? P.saving : P.save}
          </button>
        </div>
      </div>
    </div>
  );
};
