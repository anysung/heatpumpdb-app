/** Account — subscription, profile, language, web access, legal (store compliance). */
import React, { useEffect, useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase';
import { requestDeletion } from '../../services/adminService';
import { openCheckout, portalUrlFor, paddleConfigured } from '../../services/paddleService';
import { createTicket, getMyTickets, userReply } from '../../services/supportService';
import { HpApp } from '../appState';
import { UI_LANGUAGES, MARKET_ENTER_URL } from '../market';
import { tr } from '../i18n';
import { Language, SupportTicket, TicketCategory } from '../../types';
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

export const AccountPage: React.FC<{ app: HpApp }> = ({ app }) => {
  const t = tr(app.lang);
  const { user } = app;
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—';
  const role = user.companyType === 'Private Individual' ? t.account.roleHome : t.account.rolePro;
  const isPreview = user.id === 'preview';
  const isPro = user.plan === 'premium';

  // Web billing (Paddle) — overlay checkout for upgrades; hosted portal for
  // payment method / invoices / cancellation once a subscription exists.
  const startCheckout = () => {
    if (isPreview) { app.notify(t.account.previewOnly); return; }
    if (!paddleConfigured) { app.notify(t.account.checkoutSoon); return; }
    openCheckout(user).catch(() => app.notify(t.account.checkoutSoon));
  };
  const openBillingPortal = () => {
    if (isPreview) { app.notify(t.account.previewOnly); return; }
    const url = portalUrlFor(user);
    if (url) window.open(url, '_blank', 'noopener');
    else app.notify(t.account.managePlanSoon);
  };

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

        {/* Subscription */}
        <div style={{ border: '1px solid #e0e0e0', borderRadius: 18, padding: '26px 28px', display: 'flex', gap: 28, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CardTitle style={{ fontSize: 21 }}>{t.account.subscription}</CardTitle>
              <span style={{ border: '1px solid #e0e0e0', borderRadius: 999, padding: '3px 12px', fontSize: 11.5, fontWeight: 600, ...(isPro ? { background: '#e7f6ee', borderColor: '#bfe6d0', color: '#0a7a43' } : {}) }}>
                {isPro ? t.account.planBadge : t.account.planBadgeFree}
              </span>
            </div>
            <span style={{ fontSize: 14, color: '#333', lineHeight: 1.55, maxWidth: 520 }}>
              {t.account.planText}
            </span>
            <span style={{ fontSize: 12.5, color: '#7a7a7a', lineHeight: 1.55, maxWidth: 520 }}>
              {t.account.planStoreNote}
            </span>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              {!isPro && (
                <span
                  className="hp-press"
                  onClick={startCheckout}
                  style={{ background: '#0066cc', color: '#fff', borderRadius: 999, padding: '10px 22px', fontSize: 13.5, cursor: 'pointer' }}
                >
                  {t.account.upgradeBtn}
                </span>
              )}
              <span
                className="hp-press"
                onClick={openBillingPortal}
                style={isPro
                  ? { background: '#0066cc', color: '#fff', borderRadius: 999, padding: '10px 22px', fontSize: 13.5, cursor: 'pointer' }
                  : { border: '1px solid #d2d2d7', borderRadius: 999, padding: '10px 22px', fontSize: 13.5, background: '#fff', cursor: 'pointer' }}
              >
                {t.account.managePlan}
              </span>
            </div>
          </div>
          <div style={{ flex: '0 0 280px', background: '#f5f5f7', borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <span style={sectionLabel}>{t.account.includedTitle}</span>
            {t.account.included.map((x, i) => (
              <span key={i} style={{ fontSize: 13, lineHeight: 1.5 }}>{typeof x === 'function' ? x(app.quota.limit) : x}</span>
            ))}
          </div>
        </div>

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

        {/* ── Database rights / legal notice ── */}
        <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e0e0e0', marginTop: 26, paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
