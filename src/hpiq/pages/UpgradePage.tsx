/**
 * Upgrade — the plans page (owner, 2026-09-28; modelled on the header
 * "Upgrade" entry pattern of consumer AI tools).
 *
 *  · Personal plans: Standard vs Professional.
 *  · Business plans: Standard vs Team 3 & Team 5.
 *  · Monthly / Annual toggle (annual saving computed from the configured
 *    prices, never hard-coded), then the Standard-vs-Premium comparison and
 *    the FAQ.
 *
 * It replaced the "Choose your plan" section of the Account page; the Account
 * page keeps what belongs to an EXISTING subscription (status, billing portal,
 * renewal-time changes, team seats). Checkout goes to Paddle exactly as the
 * old picker did — no Paddle trial, immediate charge, EUR, VAT added at
 * checkout.
 */
import React, { useState } from 'react';
import { HpApp } from '../appState';
import { tr } from '../i18n';
import { FD } from '../ui';
import {
  SubPlanCode, BillingTerm, SUB_PLANS, BILLING_TERMS, formatEur, perMonth, perUserMonth,
  isTeamPlan, sharedTermDiscountPct, effectiveSubscription, subscriptionUnlocked,
} from '../../config/subscriptionPlans';
import { openCheckout, checkoutConfigured } from '../../services/paddleService';
import { TeamNameGate, nameNeededForCheckout } from '../../components/OnboardingSheet';
import { accessInfo } from '../../config/entitlement';

const fill = (s: string, k: string, v: string | number) => s.replace(`{${k}}`, String(v));
const eur = (v: number) => formatEur(Math.round(v * 100) / 100);

const Check: React.FC<{ color?: string }> = ({ color = '#22c55e' }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', marginTop: 2 }}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const Cross: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c7c7cc" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
);

export const UpgradePage: React.FC<{ app: HpApp }> = ({ app }) => {
  const t = tr(app.lang);
  const u = t.up;
  const s = t.sub;
  const [tab, setTab] = useState<'personal' | 'business'>('personal');
  const [term, setTerm] = useState<BillingTerm>('annual');
  const [nameFor, setNameFor] = useState<SubPlanCode | null>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const isPreview = app.user.id === 'preview';

  const sub = effectiveSubscription(app.user);
  const paidPlan: SubPlanCode | null = sub && sub.provider !== 'free_grant' && subscriptionUnlocked(sub.status, sub.currentPeriodEndsAt)
    ? (sub.planCode as SubPlanCode) : null;
  const inTrial = accessInfo(app.user).state === 'trial';
  const savePct = sharedTermDiscountPct('annual');

  const choose = (plan: SubPlanCode) => {
    if (paidPlan) { app.go('account'); return; }
    if (isPreview) { app.notify(t.account.previewOnly); return; }
    if (!checkoutConfigured(plan, term)) { app.notify(s.notConfigured); return; }
    if (nameNeededForCheckout(app.user, isTeamPlan(plan))) { setNameFor(plan); return; }
    openCheckout(app.user, plan, term).catch(() => app.notify(s.notConfigured));
  };

  const plans: SubPlanCode[] = tab === 'personal' ? ['professional'] : ['team_3', 'team_5'];

  /* ── cards ── */
  const standardCard = (
    <div className="hp-up-card hp-up-std" style={{ ...cardBase, background: 'rgba(255,255,255,.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 24 }}>
        <span style={{ fontFamily: FD, fontSize: 21, fontWeight: 700 }}>{t.tier.free}</span>
        {!app.premium && <span style={badge('rgba(255,255,255,.14)', '#fff')}>{u.currentPlan}</span>}
      </div>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>{u.standardSub}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 10 }}>
        <span style={{ fontFamily: FD, fontSize: 38, fontWeight: 800, letterSpacing: '-1px' }}>{u.standardPrice}</span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>{u.standardPer}</span>
      </div>
      <div style={{ minHeight: 34 }} />
      <span style={{ ...ctaBase, background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.7)', cursor: 'default' }}>{u.standardCta}</span>
      <ul style={listStyle}>
        {u.standardFeatures.map(f => <li key={f} style={liStyle}><Check color="rgba(255,255,255,.55)" />{f}</li>)}
      </ul>
    </div>
  );

  const planCard = (code: SubPlanCode) => {
    const plan = SUB_PLANS[code];
    const team = isTeamPlan(code);
    const price = plan.prices[term];
    const annualStrike = term === 'annual' ? plan.prices.monthly * 12 : null;
    const highlight = code === 'professional' || code === 'team_5';
    const ribbon = code === 'professional' ? u.mostPopular : code === 'team_5' ? u.bestValue : null;
    const isCurrent = paidPlan === code;
    const features = team
      ? [...u.teamFeatures.map(f => fill(f, 'n', plan.seatLimit)), ...(code === 'team_5' ? [u.team5Extra] : []), ...u.proFeatures.slice(1)]
      : u.proFeatures;
    const inner = (
      <div className="hp-up-card" style={{ ...cardBase, background: highlight ? 'linear-gradient(160deg, #10241c 0%, #0d1117 55%, #111827 100%)' : 'rgba(255,255,255,.06)', height: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minHeight: 24 }}>
          <span style={{ fontFamily: FD, fontSize: 21, fontWeight: 700 }}>{s.planNames[code]}</span>
          {ribbon && <span style={badge('linear-gradient(90deg,#22c55e,#06b6d4)', '#04120c')}>{ribbon}</span>}
          {term === 'annual' && savePct > 0 && <span style={badge('#e11d48', '#fff')}>-{savePct}%</span>}
          {isCurrent && <span style={badge('rgba(255,255,255,.18)', '#fff')}>{u.currentPlan}</span>}
        </div>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>{s.planUsers[code]}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {annualStrike && <span style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, color: '#fb7185', textDecoration: 'line-through' }}>{eur(annualStrike)}</span>}
          <span style={{ fontFamily: FD, fontSize: 38, fontWeight: 800, letterSpacing: '-1px' }}>{eur(price)}</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>{s.perTerm[term]} · {s.exclVat}</span>
        </div>
        <div style={{ minHeight: 34, fontSize: 12.5, color: '#86efac', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {term === 'annual' && <span>{fill(u.annualEq, 'pm', eur(perMonth(code, term)))}</span>}
          {team && <span style={{ color: 'rgba(255,255,255,.55)' }}>{fill(u.perUser, 'p', eur(perUserMonth(code, term)))}</span>}
        </div>
        <span
          className="hp-press hp-up-cta"
          data-testid={`upgrade-cta-${code}`}
          onClick={() => choose(code)}
          style={{ ...ctaBase, background: highlight ? 'linear-gradient(90deg,#22c55e 0%,#10b981 40%,#06b6d4 100%)' : '#fff', color: highlight ? '#04120c' : '#111', cursor: 'pointer', fontWeight: 800 }}
        >
          {paidPlan ? u.manageCta : fill(u.upgradeTo, 'plan', s.planNames[code])}
        </span>
        <ul style={listStyle}>
          {features.map(f => <li key={f} style={liStyle}><Check />{f}</li>)}
        </ul>
      </div>
    );
    return highlight
      ? <div key={code} className="hp-up-glow" style={{ borderRadius: 22, padding: 2 }}>{inner}</div>
      : <div key={code} style={{ borderRadius: 22, padding: 2, background: 'rgba(255,255,255,.12)' }}>{inner}</div>;
  };

  return (
    <div style={{ flex: 1, background: '#fff' }}>
      {nameFor && (
        <TeamNameGate
          language={app.lang as any}
          user={app.user}
          onSaved={(patch) => { const p = nameFor; setNameFor(null); openCheckout({ ...app.user, ...patch }, p, term).catch(() => app.notify(s.notConfigured)); }}
          onCancel={() => setNameFor(null)}
        />
      )}

      {/* ── Hero + plans (dark) ── */}
      <div className="hp-up-hero" style={{ color: '#fff', padding: 'clamp(36px,6vw,64px) clamp(16px,4vw,48px) clamp(40px,6vw,72px)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#86efac' }}>{u.heroEyebrow}</span>
          <h1 style={{ fontFamily: FD, fontSize: 'clamp(28px, 4.6vw, 48px)', fontWeight: 800, letterSpacing: '-0.8px', lineHeight: 1.1, margin: 0, maxWidth: 820 }}>{u.heroTitle}</h1>
          <p style={{ fontSize: 'clamp(14.5px, 1.6vw, 17px)', color: 'rgba(255,255,255,.72)', lineHeight: 1.6, maxWidth: 760, margin: 0 }}>{u.heroSub}</p>
          {inTrial && <span style={{ ...badge('rgba(34,197,94,.16)', '#86efac'), fontSize: 12.5, padding: '6px 14px', border: '1px solid rgba(34,197,94,.4)' }}>{u.trialActive}</span>}

          {/* Personal / Business */}
          <div role="tablist" data-tour="upgrade-plans" style={{ display: 'inline-flex', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 999, padding: 4, marginTop: 10 }}>
            {(['personal', 'business'] as const).map(k => (
              <span key={k} role="tab" aria-selected={tab === k} data-testid={`upgrade-tab-${k}`} className="hp-press" onClick={() => setTab(k)}
                style={{ padding: '10px 22px', borderRadius: 999, cursor: 'pointer', fontSize: 14, fontWeight: 650, whiteSpace: 'nowrap', ...(tab === k ? { background: '#fff', color: '#111' } : { color: 'rgba(255,255,255,.72)' }) }}>
                {k === 'personal' ? u.tabPersonal : u.tabBusiness}
              </span>
            ))}
          </div>
          {/* Monthly / Annual */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 999, padding: 4 }}>
            {BILLING_TERMS.map(tm => (
              <span key={tm} className="hp-press" onClick={() => setTerm(tm)} data-testid={`upgrade-term-${tm}`}
                style={{ padding: '7px 16px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'inline-flex', gap: 7, alignItems: 'center', ...(term === tm ? { background: 'rgba(255,255,255,.16)', color: '#fff' } : { color: 'rgba(255,255,255,.6)' }) }}>
                {s.termNames[tm]}
                {tm === 'annual' && savePct > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: '#bef264' }}>-{savePct}%</span>}
              </span>
            ))}
          </div>

          <div style={{ width: '100%', display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(300px, 100%), 1fr))`, gap: 20, marginTop: 22, textAlign: 'left', maxWidth: tab === 'personal' ? 760 : 1120 }}>
            {standardCard}
            {plans.map(planCard)}
          </div>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 12, maxWidth: 760, lineHeight: 1.6 }}>
            {s.vatNote} {s.eurBillingNote}
          </span>
        </div>
      </div>

      {/* ── Comparison ── */}
      <div style={{ maxWidth: 980, margin: '0 auto', padding: 'clamp(36px,5vw,56px) clamp(16px,4vw,32px) 12px' }}>
        <h2 style={{ fontFamily: FD, fontSize: 'clamp(24px,3vw,32px)', fontWeight: 700, margin: 0, color: '#1d1d1f' }}>{u.compareTitle}</h2>
        <p style={{ color: '#6e6e73', fontSize: 15, margin: '8px 0 22px' }}>{u.compareSub}</p>
        <div data-testid="upgrade-compare" style={{ border: '1px solid #e8e8ed', borderRadius: 18, overflow: 'hidden' }}>
          <div style={{ ...rowGrid, background: '#f5f5f7', fontSize: 12.5, fontWeight: 700, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            <span>{u.colFeature}</span><span style={{ textAlign: 'center' }}>{t.tier.free}</span>
            <span style={{ textAlign: 'center', color: '#0a6847' }}>{t.tier.premium}</span>
          </div>
          {u.rows.map(([label, std, pre], i) => (
            <div key={label} style={{ ...rowGrid, borderTop: '1px solid #f0f0f2', background: i % 2 ? '#fcfcfd' : '#fff' }}>
              <span style={{ fontSize: 14, color: '#1d1d1f' }}>{label}</span>
              <span style={{ display: 'flex', justifyContent: 'center', fontSize: 13, color: '#6e6e73' }}>{cell(std, u.sampleCell)}</span>
              <span style={{ display: 'flex', justifyContent: 'center', fontSize: 13.5, fontWeight: 700, color: '#0a6847' }}>{cell(pre, u.sampleCell)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── FAQ ── */}
      <div style={{ maxWidth: 820, margin: '0 auto', padding: 'clamp(32px,5vw,52px) clamp(16px,4vw,32px)' }}>
        <h2 style={{ fontFamily: FD, fontSize: 'clamp(24px,3vw,32px)', fontWeight: 700, margin: '0 0 18px', color: '#1d1d1f', textAlign: 'center' }}>{u.faqTitle}</h2>
        {u.faq.map(([q, a], i) => (
          <div key={q} style={{ border: '1px solid #e8e8ed', borderRadius: 14, marginBottom: 10, overflow: 'hidden' }}>
            <div onClick={() => setFaqOpen(faqOpen === i ? null : i)} style={{ padding: '16px 18px', display: 'flex', justifyContent: 'space-between', gap: 12, cursor: 'pointer', fontSize: 15, fontWeight: 600, color: '#1d1d1f' }}>
              {q}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#86868b" strokeWidth="2" strokeLinecap="round" style={{ flex: 'none', transform: faqOpen === i ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M6 9l6 6 6-6" /></svg>
            </div>
            {faqOpen === i && <div style={{ padding: '0 18px 16px', fontSize: 14, color: '#3a3a3c', lineHeight: 1.65 }}>{a}</div>}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 26, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, color: '#1d1d1f', fontWeight: 600 }}>{u.bottomTitle}</span>
          <span className="hp-press" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{ borderRadius: 999, padding: '11px 22px', fontSize: 14, fontWeight: 800, cursor: 'pointer', background: 'linear-gradient(90deg,#22c55e,#06b6d4)', color: '#04120c' }}>
            {u.bottomCta}
          </span>
        </div>
      </div>
    </div>
  );
};

function cell(v: string, sample: string): React.ReactNode {
  if (v === 'y') return <Check color="#0a6847" />;
  if (v === 'n') return <Cross />;
  if (v === 'sample') return <span style={{ fontSize: 12 }}>{sample}</span>;
  return v;
}

const cardBase: React.CSSProperties = {
  borderRadius: 20, padding: '24px 22px 22px', display: 'flex', flexDirection: 'column', gap: 4, color: '#fff',
  border: '1px solid rgba(255,255,255,.08)', backdropFilter: 'blur(6px)',
};
const ctaBase: React.CSSProperties = {
  display: 'block', textAlign: 'center', borderRadius: 999, padding: '13px 16px', fontSize: 14.5, fontWeight: 700, marginTop: 4,
};
const listStyle: React.CSSProperties = { listStyle: 'none', margin: '18px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 };
const liStyle: React.CSSProperties = { display: 'flex', gap: 10, fontSize: 13.5, lineHeight: 1.45, color: 'rgba(255,255,255,.88)' };
const rowGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 2.2fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 12, padding: '13px 18px', alignItems: 'center' };
const badge = (bg: string, color: string): React.CSSProperties => ({
  fontSize: 11, fontWeight: 800, letterSpacing: '.02em', borderRadius: 999, padding: '3px 9px', background: bg, color, whiteSpace: 'nowrap',
});
