/** Account — subscription program, team seats, profile, language, legal. */
import React, { useEffect, useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase';
import { requestDeletion } from '../../services/adminService';
import { openCheckout, portalUrlFor, checkoutConfigured } from '../../services/paddleService';
import {
  getMyOrg, seatsUsed, inviteMember, cancelInvite, removeMember,
  getMyChangeRequest, scheduleChange, cancelChange,
} from '../../services/subscriptionService';
import { createTicket, getMyTickets, userReply } from '../../services/supportService';
import { HpApp } from '../appState';
import { UI_LANGUAGES, MARKET_ENTER_URL } from '../market';
import { tr } from '../i18n';
import { Language, SupportTicket, TicketCategory, Organization, SubscriptionChangeRequest } from '../../types';
import {
  SubPlanCode, BillingTerm, SUB_PLANS, SUB_PLAN_CODES, BILLING_TERMS,
  formatEur, perMonth, perUserMonth, isTeamPlan, subscriptionUnlocked,
} from '../../config/subscriptionPlans';
import { FD, sectionLabel } from '../ui';
import { shortDate } from '../model';

const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ border: '1px solid #e0e0e0', borderRadius: 18, padding: '24px 26px', display: 'flex', flexDirection: 'column', ...style }}>{children}</div>
);

const CardTitle: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 600, letterSpacing: '-0.2px', ...style }}>{children}</span>
);

const ProfileRow: React.FC<{ label: string; value: string; last?: boolean }> = ({ label, value, last }) => (
  <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, padding: '10px 0', borderBottom: last ? undefined : '1px solid #f0f0f0' }}>
    <span style={{ color: '#7a7a7a' }}>{label}</span><span style={{ fontWeight: 600 }}>{value}</span>
  </span>
);

const statusChip = (status: string, label: string) => (
  <span style={{
    fontSize: 10.5, fontWeight: 700, letterSpacing: '.03em', borderRadius: 999, padding: '2.5px 9px',
    ...(status === 'open' ? { background: '#fff4e0', color: '#9a6b00' }
      : status === 'answered' ? { background: '#e6f4ea', color: '#1a7f37' }
      : { background: '#f0f0f0', color: '#7a7a7a' }),
  }}>{label}</span>
);

/** In-app support: create inquiries, read admin replies, follow up — the
 *  store-required support channel, wired to the admin inbox. */
const SupportCard: React.FC<{ app: HpApp }> = ({ app }) => {
  const t = tr(app.lang);
  const { user } = app;
  const isPreview = user.id === 'preview';
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory>('general');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    if (isPreview) return;
    getMyTickets(user.id).then(setTickets);
  };
  useEffect(refresh, [user.id]);

  const submit = () => {
    if (isPreview) { app.notify(t.account.previewOnly); return; }
    if (!subject.trim() || !message.trim() || busy) return;
    setBusy(true);
    createTicket(user, category, subject.trim(), message.trim())
      .then(() => {
        setSubject(''); setMessage(''); setShowForm(false);
        app.notify(t.account.tkSent);
        refresh();
      })
      .catch(() => app.notify(t.account.tkFailed))
      .finally(() => setBusy(false));
  };

  const sendReply = (ticket: SupportTicket) => {
    if (!reply.trim() || busy) return;
    setBusy(true);
    userReply(ticket, user, reply.trim())
      .then(() => { setReply(''); app.notify(t.account.tkReplySent); refresh(); })
      .catch(() => app.notify(t.account.tkFailed))
      .finally(() => setBusy(false));
  };

  const inputStyle: React.CSSProperties = {
    border: '1px solid #d2d2d7', borderRadius: 10, padding: '9px 12px', fontSize: 13,
    fontFamily: 'inherit', color: '#1d1d1f', background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  return (
    <Card style={{ gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <CardTitle>{t.account.support}</CardTitle>
        <span
          className="hp-press"
          onClick={() => setShowForm(f => !f)}
          style={{ border: '1px solid #d2d2d7', borderRadius: 999, padding: '7px 16px', fontSize: 12.5, background: showForm ? '#1d1d1f' : '#fff', color: showForm ? '#fff' : '#1d1d1f', cursor: 'pointer', fontWeight: 600 }}
        >
          {t.account.tkNew}
        </span>
      </div>
      <span style={{ fontSize: 13, color: '#333', lineHeight: 1.5 }}>{t.account.supportText}</span>

      {showForm && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid #e0e0e0', borderRadius: 12, padding: 14, background: '#fafafa' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={category} onChange={e => setCategory(e.target.value as TicketCategory)} style={{ ...inputStyle, width: 180 }}>
              {Object.entries(t.account.tkCats).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder={t.account.tkSubject} style={inputStyle} maxLength={120} />
          </div>
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder={t.account.tkMessage} rows={4} style={{ ...inputStyle, resize: 'vertical' }} maxLength={4000} />
          <span
            className="hp-press"
            onClick={submit}
            style={{ background: '#0066cc', color: '#fff', borderRadius: 999, padding: '9px 20px', fontSize: 13, cursor: 'pointer', width: 'fit-content', opacity: busy ? 0.6 : 1 }}
          >
            {t.account.tkSend}
          </span>
        </div>
      )}

      <span style={{ ...sectionLabel, marginTop: 4 }}>{t.account.tkMine}</span>
      {tickets.length === 0 && <span style={{ fontSize: 12.5, color: '#7a7a7a' }}>{t.account.tkNone}</span>}
      {tickets.map(tk => {
        const expanded = openId === tk.id;
        return (
          <div key={tk.id} style={{ border: '1px solid #e0e0e0', borderRadius: 12, overflow: 'hidden' }}>
            <div
              onClick={() => setOpenId(expanded ? null : tk.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: expanded ? '#f5f5f7' : '#fff' }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tk.subject}</span>
              {statusChip(tk.status, t.account.tkStatus[tk.status])}
              <span style={{ fontSize: 11.5, color: '#7a7a7a' }}>{shortDate(tk.updatedAt, t.locale)}</span>
            </div>
            {expanded && (
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid #f0f0f0' }}>
                {tk.messages.map((m, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: m.from === 'user' ? 'flex-end' : 'flex-start' }}>
                    <span style={{ fontSize: 10.5, color: '#7a7a7a' }}>{t.account.tkFrom[m.from]} · {shortDate(m.at, t.locale)}</span>
                    <span style={{
                      fontSize: 13, lineHeight: 1.55, borderRadius: 12, padding: '9px 13px', maxWidth: '85%', whiteSpace: 'pre-wrap',
                      ...(m.from === 'user' ? { background: '#0066cc', color: '#fff' } : { background: '#f0f0f0', color: '#1d1d1f' }),
                    }}>{m.text}</span>
                  </div>
                ))}
                {tk.status !== 'closed' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                    <input value={reply} onChange={e => setReply(e.target.value)} placeholder={t.account.tkReplyPlaceholder} style={inputStyle} maxLength={4000} onKeyDown={e => { if (e.key === 'Enter') sendReply(tk); }} />
                    <span className="hp-press" onClick={() => sendReply(tk)} style={{ border: '1px solid #d2d2d7', borderRadius: 999, padding: '8px 18px', fontSize: 12.5, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', opacity: busy ? 0.6 : 1 }}>
                      {t.account.tkReply}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
};

/* ── Subscription program ─────────────────────────────────────────────────── */

const pill = (bg: string, color: string): React.CSSProperties => ({
  fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', borderRadius: 999,
  padding: '3px 10px', background: bg, color, whiteSpace: 'nowrap',
});

/**
 * Two-step plan picker: (1) who — Professional / Team 3 / Team 5,
 * (2) how long — monthly / 6 months / annual. Defaults: annual term,
 * Team 3 Annual highlighted as Most Popular.
 * mode 'checkout' opens Paddle (7-day trial on the price itself);
 * mode 'schedule' registers a renewal-time change instead.
 */
const PlanPicker: React.FC<{
  app: HpApp;
  mode: 'checkout' | 'schedule';
  org?: Organization | null;
  onSchedule?: (plan: SubPlanCode, term: BillingTerm, keepUids?: string[]) => void;
}> = ({ app, mode, org, onSchedule }) => {
  const t = tr(app.lang);
  const s = t.sub;
  const [term, setTerm] = useState<BillingTerm>('annual');
  const [pendingDowngrade, setPendingDowngrade] = useState<SubPlanCode | null>(null);
  const [keepUids, setKeepUids] = useState<string[]>([]);
  const isPreview = app.user.id === 'preview';

  const choose = (plan: SubPlanCode) => {
    if (isPreview) { app.notify(t.account.previewOnly); return; }
    if (mode === 'checkout') {
      if (!checkoutConfigured(plan, term)) { app.notify(s.notConfigured); return; }
      openCheckout(app.user, plan, term).catch(() => app.notify(s.notConfigured));
      return;
    }
    // Schedule mode: downgrades below the current member count need a keep-list.
    const members = org?.members ?? [];
    const targetSeats = SUB_PLANS[plan].seatLimit;
    if (members.length > targetSeats) {
      setPendingDowngrade(plan);
      setKeepUids(org ? [org.ownerUid] : []);
      return;
    }
    onSchedule?.(plan, term);
  };

  const confirmDowngrade = () => {
    if (!pendingDowngrade) return;
    const target = SUB_PLANS[pendingDowngrade].seatLimit;
    if (keepUids.length !== target) return;
    onSchedule?.(pendingDowngrade, term, keepUids);
    setPendingDowngrade(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Step 2 first visually: billing-term toggle (annual default) */}
      <div style={{ display: 'flex', border: '1px solid #d2d2d7', borderRadius: 999, overflow: 'hidden', fontSize: 13, width: 'fit-content' }}>
        {BILLING_TERMS.map(tm => (
          <span
            key={tm}
            onClick={() => setTerm(tm)}
            style={{ padding: '8px 18px', cursor: 'pointer', display: 'flex', gap: 7, alignItems: 'center', ...(term === tm ? { background: '#1d1d1f', color: '#fff', fontWeight: 600 } : {}) }}
          >
            {s.termNames[tm]}
            {s.termSave[tm] && (
              <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '2px 7px', background: term === tm ? 'rgba(255,255,255,.18)' : '#e7f6ee', color: term === tm ? '#fff' : '#0a7a43' }}>
                {tm === 'annual' ? s.bestValue : s.termSave[tm]}
              </span>
            )}
          </span>
        ))}
      </div>

      {/* Plan cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {SUB_PLAN_CODES.map(code => {
          const plan = SUB_PLANS[code];
          const price = plan.prices[term];
          const popular = code === 'team_3' && term === 'annual';
          const team = isTeamPlan(code);
          return (
            <div
              key={code}
              style={{
                border: popular ? '2px solid #0066cc' : '1px solid #e0e0e0', borderRadius: 18,
                padding: '20px 20px 18px', display: 'flex', flexDirection: 'column', gap: 7, position: 'relative', background: '#fff',
              }}
            >
              {popular && (
                <span style={{ ...pill('#0066cc', '#fff'), position: 'absolute', top: -11, left: 18 }}>{s.mostPopular}</span>
              )}
              <span style={{ fontFamily: FD, fontSize: 18, fontWeight: 600 }}>{s.planNames[code]}</span>
              <span style={{ fontSize: 12.5, color: '#7a7a7a' }}>{s.planUsers[code]}</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 4 }}>
                <span style={{ fontFamily: FD, fontSize: 27, fontWeight: 700, letterSpacing: '-0.4px' }}>{formatEur(price)}</span>
                <span style={{ fontSize: 12.5, color: '#7a7a7a' }}>{s.perTerm[term]}{team ? ` ${s.forWholeTeam}` : ''}</span>
              </div>
              <span style={{ fontSize: 11.5, color: '#7a7a7a' }}>
                {team ? s.perUserEq(formatEur(Math.round(perUserMonth(code, term) * 100) / 100)) : (term !== 'monthly' ? s.perMonthEq(formatEur(Math.round(perMonth(code, term) * 100) / 100)) : ' ')}
              </span>
              <span style={{ fontSize: 12.5, color: '#333', lineHeight: 1.5, flex: 1 }}>{s.planBlurbs[code]}</span>
              <span style={{ ...pill('#e7f6ee', '#0a7a43'), width: 'fit-content' }}>{team ? s.teamTrialBadge : s.trialBadge}</span>
              <span
                className="hp-press"
                onClick={() => choose(code)}
                style={{
                  marginTop: 8, textAlign: 'center', borderRadius: 999, padding: '10px 0', fontSize: 13, cursor: 'pointer', fontWeight: 600,
                  ...(popular ? { background: '#0066cc', color: '#fff' } : { border: '1px solid #d2d2d7', background: '#fff' }),
                }}
              >
                {mode === 'checkout' ? s.startTrial : s.confirmSchedule}
              </span>
            </div>
          );
        })}
      </div>

      {/* Downgrade keep-list (schedule mode only) */}
      {pendingDowngrade && org && (
        <div style={{ border: '1px solid #f0c36d', background: '#fff8e8', borderRadius: 14, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, lineHeight: 1.55 }}>
            {s.downgradeSeats(s.planNames[pendingDowngrade], SUB_PLANS[pendingDowngrade].seatLimit, org.members.length)}
          </span>
          <span style={sectionLabel}>{s.keepMembersTitle(SUB_PLANS[pendingDowngrade].seatLimit)}</span>
          {org.members.map(m => {
            const isOwner = m.uid === org.ownerUid;
            const checked = keepUids.includes(m.uid);
            return (
              <label key={m.uid} style={{ display: 'flex', gap: 9, alignItems: 'center', fontSize: 13, cursor: isOwner ? 'default' : 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isOwner}
                  onChange={() => setKeepUids(prev => checked ? prev.filter(u => u !== m.uid) : (prev.length < SUB_PLANS[pendingDowngrade].seatLimit ? [...prev, m.uid] : prev))}
                />
                {m.email}{isOwner ? ` — ${s.teamAdminLabel}` : ''}
              </label>
            );
          })}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <span
              className="hp-press"
              onClick={confirmDowngrade}
              style={{ background: keepUids.length === SUB_PLANS[pendingDowngrade].seatLimit ? '#0066cc' : '#b6b6bc', color: '#fff', borderRadius: 999, padding: '8px 18px', fontSize: 12.5, cursor: 'pointer' }}
            >
              {s.confirmSchedule}
            </span>
            <span className="hp-press" onClick={() => setPendingDowngrade(null)} style={{ border: '1px solid #d2d2d7', borderRadius: 999, padding: '8px 18px', fontSize: 12.5, background: '#fff', cursor: 'pointer' }}>
              ✕
            </span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 11.5, color: '#7a7a7a', lineHeight: 1.55 }}>{s.trialNote}</span>
        <span style={{ fontSize: 11.5, color: '#7a7a7a', lineHeight: 1.55 }}>{s.cancelNote}</span>
        <span style={{ fontSize: 11.5, color: '#7a7a7a', lineHeight: 1.55 }}>{s.fixedTermNote}</span>
        <span style={{ fontSize: 11.5, color: '#9a9aa0', lineHeight: 1.55 }}>{s.vatNote}</span>
      </div>
    </div>
  );
};

/** Team seats (Team 3 / Team 5 administrators): members, invitations, replacement. */
const TeamCard: React.FC<{ app: HpApp; org: Organization; onChanged: (o: Organization) => void }> = ({ app, org, onChanged }) => {
  const t = tr(app.lang);
  const s = t.sub;
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const free = org.seatLimit - seatsUsed(org);

  const doInvite = async () => {
    const email = invite.trim().toLowerCase();
    if (!email || busy) return;
    setBusy(true);
    try {
      await inviteMember(org, email);
      onChanged({ ...org, invitedEmails: [...(org.invitedEmails ?? []), email] });
      setInvite('');
      app.notify(s.inviteSent(email));
    } catch (e: any) {
      app.notify(e?.message === 'no-seats' ? s.inviteFailSeats : e?.message?.startsWith('already') ? s.inviteFailDup : s.inviteFailed);
    } finally { setBusy(false); }
  };

  const doRemove = async (uid: string, email: string) => {
    if (!window.confirm(s.removeConfirm(email))) return;
    await removeMember(org, uid);
    onChanged({ ...org, members: org.members.filter(m => m.uid !== uid) });
    app.notify(s.removedOk);
  };

  const doCancelInvite = async (email: string) => {
    await cancelInvite(org, email);
    onChanged({ ...org, invitedEmails: (org.invitedEmails ?? []).filter(e => e !== email) });
  };

  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 };

  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: 18, padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 600, letterSpacing: '-0.2px' }}>{s.teamTitle}</span>
        <span style={pill('#f0f0f0', '#1d1d1f')}>{s.seatsUsed(seatsUsed(org), org.seatLimit)}</span>
      </div>
      {org.subscriptionStatus === 'trialing' && (
        <span style={{ fontSize: 12, color: '#9a6b00', background: '#fff4e0', borderRadius: 10, padding: '8px 12px', lineHeight: 1.5 }}>{s.teamTrialNote}</span>
      )}
      <div>
        {org.members.map(m => (
          <div key={m.uid} style={row}>
            <span style={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</span>
            <span style={{ fontSize: 11.5, color: '#7a7a7a' }}>{m.uid === org.ownerUid ? s.teamAdminLabel : s.memberLabel}</span>
            {m.uid !== org.ownerUid && (
              <span className="hp-press" onClick={() => doRemove(m.uid, m.email)} style={{ fontSize: 11.5, color: '#c0392b', border: '1px solid #e8c5be', borderRadius: 999, padding: '4px 12px', cursor: 'pointer' }}>
                {s.removeBtn}
              </span>
            )}
          </div>
        ))}
        {(org.invitedEmails ?? []).map(e => (
          <div key={e} style={row}>
            <span style={{ flex: 1, color: '#7a7a7a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e}</span>
            <span style={{ fontSize: 11.5, color: '#9a6b00' }}>{s.invitedLabel}</span>
            <span className="hp-press" onClick={() => doCancelInvite(e)} style={{ fontSize: 11.5, color: '#7a7a7a', border: '1px solid #d2d2d7', borderRadius: 999, padding: '4px 12px', cursor: 'pointer' }}>
              {s.cancelInviteBtn}
            </span>
          </div>
        ))}
      </div>
      {free > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          <input
            value={invite}
            onChange={e => setInvite(e.target.value)}
            placeholder={s.invitePlaceholder}
            type="email"
            style={{ border: '1px solid #d2d2d7', borderRadius: 10, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', background: '#fff', outline: 'none', flex: 1 }}
            onKeyDown={e => { if (e.key === 'Enter') doInvite(); }}
          />
          <span className="hp-press" onClick={doInvite} style={{ background: '#0066cc', color: '#fff', borderRadius: 999, padding: '9px 20px', fontSize: 13, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
            {s.inviteBtn}
          </span>
        </div>
      )}
    </div>
  );
};

/** The whole subscription area: member view / active-subscription view / plan picker. */
const SubscriptionSection: React.FC<{ app: HpApp }> = ({ app }) => {
  const t = tr(app.lang);
  const s = t.sub;
  const { user } = app;
  const isPreview = user.id === 'preview';
  const sub = user.subscription;
  const unlocked = !!sub && subscriptionUnlocked(sub.status, sub.currentPeriodEndsAt);
  const legacyPro = !sub && user.plan === 'premium';
  const [org, setOrg] = useState<Organization | null>(null);
  const [changeReq, setChangeReq] = useState<SubscriptionChangeRequest | null>(null);
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    if (isPreview) return;
    if (user.orgId) getMyOrg(user).then(setOrg).catch(() => {});
    if (sub) getMyChangeRequest(user.id).then(setChangeReq).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, user.orgId]);

  const openBillingPortal = () => {
    if (isPreview) { app.notify(t.account.previewOnly); return; }
    const url = portalUrlFor(user);
    if (url) window.open(url, '_blank', 'noopener');
    else app.notify(t.account.managePlanSoon);
  };

  const doSchedule = (plan: SubPlanCode, term: BillingTerm, keepUids?: string[]) => {
    scheduleChange(user, plan, term, keepUids)
      .then(() => {
        setChangeReq({
          id: user.id, userId: user.id, userEmail: user.email,
          currentPlanCode: sub?.planCode ?? '', requestedPlanCode: plan, requestedBillingTerm: term,
          effectiveAt: sub?.currentPeriodEndsAt ?? null, status: 'scheduled', createdAt: new Date().toISOString(),
        });
        setScheduling(false);
        app.notify(s.scheduledOk);
      })
      .catch(() => app.notify(s.inviteFailed));
  };

  const fmt = (d?: string | null) => (d ? shortDate(d, t.locale) : '—');

  // ── Team member: access managed by the team admin — no billing controls ──
  if (user.orgRole === 'member' && org && sub) {
    return (
      <div style={{ border: '1px solid #e0e0e0', borderRadius: 18, padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CardTitle style={{ fontSize: 21 }}>{s.currentTitle}</CardTitle>
          <span style={pill('#e7f6ee', '#0a7a43')}>{s.memberViewBadge} · {s.planNames[org.planCode]}</span>
        </div>
        <span style={{ fontSize: 13.5, color: '#333', lineHeight: 1.6, maxWidth: 640 }}>
          {s.memberViewText(s.planNames[org.planCode], org.ownerEmail)}
        </span>
        <span style={{ fontSize: 12, color: '#7a7a7a' }}>{s.teamTrialNote}</span>
      </div>
    );
  }

  // ── Active subscription (or legacy premium): status + management ──
  if (unlocked || legacyPro) {
    const statusLine = legacyPro
      ? t.account.planBadge
      : sub!.provider === 'free_grant'
        ? s.freeGrantBadge(fmt(sub!.currentPeriodEndsAt))
        : sub!.status === 'trialing' ? s.statusTrialing(fmt(sub!.trialEndsAt ?? sub!.currentPeriodEndsAt))
        : sub!.status === 'past_due' ? s.statusPastDue
        : sub!.cancelAtPeriodEnd || sub!.status === 'canceled' ? s.statusCanceled(fmt(sub!.currentPeriodEndsAt))
        : s.statusActive(fmt(sub!.currentPeriodEndsAt));
    return (
      <>
        <div style={{ border: '1px solid #e0e0e0', borderRadius: 18, padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <CardTitle style={{ fontSize: 21 }}>{s.currentTitle}</CardTitle>
            <span style={pill('#e7f6ee', '#0a7a43')}>
              {legacyPro ? t.account.planBadge : `${s.planNames[sub!.planCode]}${sub!.billingTerm ? ` · ${s.termNames[sub!.billingTerm]}` : ''}`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={sectionLabel}>{s.currentPlanLabel}</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                {legacyPro ? 'HeatPump DB Pro' : `${s.planNames[sub!.planCode]}${sub!.billingTerm ? ` · ${s.termNames[sub!.billingTerm]}` : ''}`}
              </span>
              <span style={{ fontSize: 12.5, color: '#7a7a7a' }}>{statusLine}</span>
            </div>
            {changeReq && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={sectionLabel}>{s.nextPlanLabel}</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  {s.planNames[changeReq.requestedPlanCode]} · {s.termNames[changeReq.requestedBillingTerm]}
                </span>
                <span style={{ fontSize: 12.5, color: '#7a7a7a' }}>{s.startsOn(fmt(changeReq.effectiveAt))}</span>
              </div>
            )}
          </div>
          <span style={{ fontSize: 12, color: '#7a7a7a', lineHeight: 1.55, maxWidth: 640 }}>{t.account.planStoreNote}</span>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span className="hp-press" onClick={openBillingPortal} style={{ background: '#0066cc', color: '#fff', borderRadius: 999, padding: '10px 22px', fontSize: 13.5, cursor: 'pointer' }}>
              {t.account.managePlan}
            </span>
            {!legacyPro && !changeReq && (
              <span className="hp-press" onClick={() => setScheduling(v => !v)} style={{ border: '1px solid #d2d2d7', borderRadius: 999, padding: '10px 22px', fontSize: 13.5, background: scheduling ? '#1d1d1f' : '#fff', color: scheduling ? '#fff' : '#1d1d1f', cursor: 'pointer' }}>
                {s.changeAtRenewal}
              </span>
            )}
            {changeReq && (
              <span
                className="hp-press"
                onClick={() => cancelChange(user.id).then(() => { setChangeReq(null); app.notify(s.scheduleCancelled); })}
                style={{ border: '1px solid #d2d2d7', borderRadius: 999, padding: '10px 22px', fontSize: 13.5, background: '#fff', cursor: 'pointer' }}
              >
                {s.cancelScheduled}
              </span>
            )}
          </div>
          <span style={{ fontSize: 11.5, color: '#9a9aa0' }}>{s.cancelNote}</span>
          {scheduling && !legacyPro && (
            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.scheduleTitle}</span>
              <span style={{ fontSize: 12.5, color: '#7a7a7a' }}>{s.scheduleApply(fmt(sub!.currentPeriodEndsAt))}</span>
              <PlanPicker app={app} mode="schedule" org={org} onSchedule={doSchedule} />
            </div>
          )}
        </div>
        {user.orgRole === 'team_admin' && org && (
          <TeamCard app={app} org={org} onChanged={setOrg} />
        )}
      </>
    );
  }

  // ── No subscription yet: the two-step picker ──
  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: 18, padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <CardTitle style={{ fontSize: 21 }}>{s.pickTitle}</CardTitle>
        <span style={{ fontSize: 13.5, color: '#7a7a7a' }}>{s.pickSub}</span>
      </div>
      <PlanPicker app={app} mode="checkout" />
    </div>
  );
};

export const AccountPage: React.FC<{ app: HpApp }> = ({ app }) => {
  const t = tr(app.lang);
  const { user } = app;
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—';
  const role = user.companyType === 'Private Individual' ? t.account.roleHome : t.account.rolePro;
  const isPreview = user.id === 'preview';

  const sendSetupLink = () => {
    if (isPreview) { app.notify(t.account.previewOnly); return; }
    sendPasswordResetEmail(auth, user.email)
      .then(() => app.notify(t.account.linkSent(user.email)))
      .catch(() => app.notify(t.account.linkFailed));
  };

  const deleteAccount = () => {
    if (isPreview) { app.notify(t.account.previewOnly); return; }
    const ok = window.confirm(t.account.delConfirm);
    if (!ok) return;
    requestDeletion(user.id, 'Self-service request from Account page', displayName)
      .then(() => {
        app.notify(t.account.delDone);
        setTimeout(app.onLogout, 1800);
      })
      .catch(() => app.notify(t.account.delFailed));
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#f5f5f7', padding: '40px 48px 32px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontFamily: FD, fontSize: 34, fontWeight: 600, letterSpacing: '-0.374px' }}>{t.account.heroTitle}</span>
        <span style={{ fontSize: 17, color: '#7a7a7a', letterSpacing: '-0.374px' }}>{t.account.heroSub}</span>
      </div>
      <div style={{ maxWidth: 1160, width: '100%', margin: '0 auto', padding: '28px 48px 48px', display: 'flex', flexDirection: 'column', gap: 20, boxSizing: 'border-box' }}>

        {/* Subscription program (Professional / Team 3 / Team 5) */}
        <SubscriptionSection app={app} />

        {/* Profile + Language */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card style={{ gap: 4 }}>
            <CardTitle style={{ marginBottom: 8 }}>{t.account.profile}</CardTitle>
            <ProfileRow label={t.account.email} value={user.email} />
            <ProfileRow label={t.account.displayName} value={displayName} />
            <ProfileRow label={t.account.company} value={user.companyName || '—'} />
            <ProfileRow label={t.account.role} value={role} last />
            <span
              onClick={() => app.notify(t.account.editProfileSoon)}
              style={{ fontSize: 12.5, color: '#0066cc', cursor: 'pointer', marginTop: 4 }}
            >
              {t.account.editProfile}
            </span>
          </Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Card style={{ gap: 12 }}>
              <CardTitle>{t.account.language}</CardTitle>
              <div style={{ display: 'flex', border: '1px solid #e0e0e0', borderRadius: 999, overflow: 'hidden', fontSize: 13, width: 'fit-content' }}>
                {(([['fr', 'Français'], ['de', 'Deutsch'], ['en', 'English']] as [Language, string][])
                  .filter(([id]) => UI_LANGUAGES.includes(id))).map(([id, label]) => (
                  <span
                    key={id}
                    onClick={() => app.setLang(id)}
                    style={{
                      padding: '7px 18px', cursor: 'pointer',
                      ...(app.lang === id ? { background: '#1d1d1f', color: '#fff', fontWeight: 600 } : { color: '#1d1d1f' }),
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <span style={{ fontSize: 12.5, color: '#7a7a7a', lineHeight: 1.5 }}>
                {t.account.languageNote}
              </span>
            </Card>
            <Card style={{ gap: 9 }}>
              <CardTitle>{t.account.web}</CardTitle>
              <span style={{ fontSize: 13, color: '#333', lineHeight: 1.5 }}>
                {t.account.webText}
              </span>
              <span style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontFamily: 'ui-monospace,Menlo,monospace', background: '#f5f5f7', width: 'fit-content' }}>{MARKET_ENTER_URL}</span>
              <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                <span
                  className="hp-press"
                  onClick={() =>
                    navigator.clipboard?.writeText(MARKET_ENTER_URL)
                      .then(() => app.notify(t.account.copied))
                      .catch(() => app.notify(t.account.copyFailed))
                  }
                  style={{ border: '1px solid #d2d2d7', borderRadius: 999, padding: '8px 18px', fontSize: 13, background: '#fff', cursor: 'pointer' }}
                >
                  {t.account.copyLink}
                </span>
                <span
                  className="hp-press"
                  onClick={() => {
                    window.location.href = `mailto:${user.email}?subject=${encodeURIComponent(t.account.emailSubject)}&body=${encodeURIComponent(t.account.emailBody)}`;
                  }}
                  style={{ border: '1px solid #d2d2d7', borderRadius: 999, padding: '8px 18px', fontSize: 13, background: '#fff', cursor: 'pointer' }}
                >
                  {t.account.emailLink}
                </span>
              </div>
            </Card>
          </div>
        </div>

        {/* Security + Support */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card style={{ gap: 9 }}>
            <CardTitle>{t.account.security}</CardTitle>
            <span style={{ fontSize: 13, color: '#333', lineHeight: 1.5 }}>{t.account.securityText}</span>
            <span onClick={sendSetupLink} style={{ color: '#0066cc', fontSize: 13, cursor: 'pointer', marginTop: 2 }}>{t.account.sendLink(user.email)}</span>
          </Card>
          <SupportCard app={app} />
        </div>

        {/* Legal + Delete */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card style={{ gap: 9 }}>
            <CardTitle>{t.account.legal}</CardTitle>
            {t.account.legalDocs.map(doc => (
              <span
                key={doc}
                onClick={() => app.notify(t.account.legalSoon(doc))}
                style={{ color: '#0066cc', fontSize: 13.5, cursor: 'pointer' }}
              >
                {doc} ›
              </span>
            ))}
          </Card>
          <Card style={{ gap: 10 }}>
            <CardTitle>{t.account.del}</CardTitle>
            <span style={{ fontSize: 13, color: '#333', lineHeight: 1.5 }}>{t.account.delText}</span>
            <span style={{ fontSize: 12, color: '#7a7a7a', lineHeight: 1.55, border: '1px solid #e0e0e0', borderRadius: 8, padding: '10px 14px', background: '#f5f5f7' }}>
              {t.account.delStoreNote}
            </span>
            <span
              className="hp-press"
              onClick={deleteAccount}
              style={{ border: '1px solid #d2d2d7', borderRadius: 999, padding: '9px 20px', fontSize: 13, background: '#fff', cursor: 'pointer', width: 'fit-content', color: '#c0392b' }}
            >
              {t.account.delBtn}
            </span>
          </Card>
        </div>

        {/* ── Fair use: one-person accounts + no data extraction ── */}
        <div style={{ border: '1px solid #e8d9b5', background: '#fdf8ec', borderRadius: 14, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', color: '#8a6d1f', textTransform: 'uppercase' }}>{t.account.fairUseTitle}</span>
          <span style={{ fontSize: 12.5, color: '#5c4d1e', lineHeight: 1.6 }}>{t.account.fairUseAccount}</span>
          <span style={{ fontSize: 12.5, color: '#5c4d1e', lineHeight: 1.6 }}>{t.account.fairUseData}</span>
        </div>

        {/* ── Database rights / legal notice ── */}
        <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e0e0e0', marginTop: 6, paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: '#7a7a7a', textTransform: 'uppercase' }}>{t.account.legalNoticeTitle}</span>
          <p style={{ fontSize: 11, color: '#9a9aa0', lineHeight: 1.65, textAlign: 'justify', margin: 0, maxWidth: 980 }}>
            {t.account.legalNotice}
          </p>
          <span style={{ fontSize: 11, color: '#9a9aa0' }}>{t.footer.copyright(new Date().getFullYear())}</span>
        </div>
      </div>
    </div>
  );
};
