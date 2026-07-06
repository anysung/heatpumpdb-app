/** Account — subscription, profile, language, web access, legal (store compliance). */
import React from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase';
import { requestDeletion } from '../../services/adminService';
import { HpApp } from '../appState';
import { tr } from '../i18n';
import { Language } from '../../types';
import { FD, sectionLabel } from '../ui';

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

        {/* Subscription */}
        <div style={{ border: '1px solid #e0e0e0', borderRadius: 18, padding: '26px 28px', display: 'flex', gap: 28, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CardTitle style={{ fontSize: 21 }}>{t.account.subscription}</CardTitle>
              <span style={{ border: '1px solid #e0e0e0', borderRadius: 999, padding: '3px 12px', fontSize: 11.5, fontWeight: 600 }}>{t.account.planBadge}</span>
            </div>
            <span style={{ fontSize: 14, color: '#333', lineHeight: 1.55, maxWidth: 520 }}>
              {t.account.planText}
            </span>
            <span style={{ fontSize: 12.5, color: '#7a7a7a' }}>
              {t.account.planStoreNote}
            </span>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <span
                className="hp-press"
                onClick={() => app.notify(t.account.managePlanSoon)}
                style={{ background: '#0066cc', color: '#fff', borderRadius: 999, padding: '10px 22px', fontSize: 13.5, cursor: 'pointer' }}
              >
                {t.account.managePlan}
              </span>
              <span
                className="hp-press"
                onClick={() => app.notify(t.account.restoreSoon)}
                style={{ border: '1px solid #d2d2d7', borderRadius: 999, padding: '10px 22px', fontSize: 13.5, background: '#fff', cursor: 'pointer' }}
              >
                {t.account.restore}
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
                {([['de', 'Deutsch'], ['en', 'English']] as [Language, string][]).map(([id, label]) => (
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
              <span style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontFamily: 'ui-monospace,Menlo,monospace', background: '#f5f5f7', width: 'fit-content' }}>www.heatpumpiq.de/enter</span>
              <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                <span
                  className="hp-press"
                  onClick={() =>
                    navigator.clipboard?.writeText('www.heatpumpiq.de/enter')
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
          <Card style={{ gap: 9 }}>
            <CardTitle>{t.account.support}</CardTitle>
            <span style={{ fontSize: 13, color: '#333', lineHeight: 1.5 }}>{t.account.supportText}</span>
            <span
              onClick={() => {
                window.location.href = `mailto:support@heatpumpiq.de?subject=${encodeURIComponent(t.account.supportSubject)}&body=${encodeURIComponent(t.account.supportBody(user.email))}`;
              }}
              style={{ color: '#0066cc', fontSize: 13, cursor: 'pointer', marginTop: 2 }}
            >
              {t.account.contactSupport}
            </span>
          </Card>
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
      </div>
    </div>
  );
};
