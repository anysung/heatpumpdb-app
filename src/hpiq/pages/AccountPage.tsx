/** Account — subscription, profile, language, web access, legal (store compliance). */
import React from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase';
import { requestDeletion } from '../../services/adminService';
import { HpApp } from '../appState';
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
  const { user } = app;
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—';
  const role = user.companyType === 'Private Individual' ? 'Homeowner / private' : 'Installer / professional';
  const isPreview = user.id === 'preview';

  const sendSetupLink = () => {
    if (isPreview) { app.notify('Not available in preview mode.'); return; }
    sendPasswordResetEmail(auth, user.email)
      .then(() => app.notify(`Setup link sent to ${user.email} — check your inbox.`))
      .catch(() => app.notify('Could not send the link — please try again later.'));
  };

  const deleteAccount = () => {
    if (isPreview) { app.notify('Not available in preview mode.'); return; }
    const ok = window.confirm(
      'Delete your account?\n\nThis deactivates your account immediately and requests permanent deletion. Store subscriptions must be cancelled separately.'
    );
    if (!ok) return;
    requestDeletion(user.id, 'Self-service request from Account page', displayName)
      .then(() => {
        app.notify('Deletion requested — your account is now deactivated.');
        setTimeout(app.onLogout, 1800);
      })
      .catch(() => app.notify('Could not request deletion — please contact support.'));
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#f5f5f7', padding: '40px 48px 32px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontFamily: FD, fontSize: 34, fontWeight: 600, letterSpacing: '-0.374px' }}>Account.</span>
        <span style={{ fontSize: 17, color: '#7a7a7a', letterSpacing: '-0.374px' }}>Manage your subscription, profile and app settings.</span>
      </div>
      <div style={{ maxWidth: 1160, width: '100%', margin: '0 auto', padding: '28px 48px 48px', display: 'flex', flexDirection: 'column', gap: 20, boxSizing: 'border-box' }}>

        {/* Subscription */}
        <div style={{ border: '1px solid #e0e0e0', borderRadius: 18, padding: '26px 28px', display: 'flex', gap: 28, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CardTitle style={{ fontSize: 21 }}>Subscription.</CardTitle>
              <span style={{ border: '1px solid #e0e0e0', borderRadius: 999, padding: '3px 12px', fontSize: 11.5, fontWeight: 600 }}>HeatpumpIQ Pro — active</span>
            </div>
            <span style={{ fontSize: 14, color: '#333', lineHeight: 1.55, maxWidth: 520 }}>
              Your plan renews on 5 August 2026 at €29/month. A 7-day free trial starts when a plan is first selected after installing the app.
            </span>
            <span style={{ fontSize: 12.5, color: '#7a7a7a' }}>
              Subscribed via Google Play / Apple App Store — plan changes and cancellation are handled in the store where the subscription was started.
            </span>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <span
                className="hp-press"
                onClick={() => app.notify('Plan changes are managed in the App Store / Google Play once the store version launches.')}
                style={{ background: '#0066cc', color: '#fff', borderRadius: 999, padding: '10px 22px', fontSize: 13.5, cursor: 'pointer' }}
              >
                Manage plan ›
              </span>
              <span
                className="hp-press"
                onClick={() => app.notify('Purchase restore applies to the App Store / Google Play version of the app.')}
                style={{ border: '1px solid #d2d2d7', borderRadius: 999, padding: '10px 22px', fontSize: 13.5, background: '#fff', cursor: 'pointer' }}
              >
                Restore purchases
              </span>
            </div>
          </div>
          <div style={{ flex: '0 0 280px', background: '#f5f5f7', borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <span style={sectionLabel}>INCLUDED IN PRO</span>
            <span style={{ fontSize: 13, lineHeight: 1.5 }}>Full product database access</span>
            <span style={{ fontSize: 13, lineHeight: 1.5 }}>Unlimited comparisons</span>
            <span style={{ fontSize: 13, lineHeight: 1.5 }}>{app.quota.limit} data sheet prints / month</span>
            <span style={{ fontSize: 13, lineHeight: 1.5 }}>BAFA / KfW & label updates</span>
          </div>
        </div>

        {/* Profile + Language */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card style={{ gap: 4 }}>
            <CardTitle style={{ marginBottom: 8 }}>Profile.</CardTitle>
            <ProfileRow label="Account email" value={user.email} />
            <ProfileRow label="Display name" value={displayName} />
            <ProfileRow label="Company" value={user.companyName || '—'} />
            <ProfileRow label="Role" value={role} last />
            <span
              onClick={() => app.notify('Profile editing is coming soon — contact support to change your details.')}
              style={{ fontSize: 12.5, color: '#0066cc', cursor: 'pointer', marginTop: 4 }}
            >
              Edit profile ›
            </span>
          </Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Card style={{ gap: 12 }}>
              <CardTitle>App language.</CardTitle>
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
                Deutsch is the default for the Germany edition. English is available everywhere in the app.
              </span>
            </Card>
            <Card style={{ gap: 9 }}>
              <CardTitle>Use on the web.</CardTitle>
              <span style={{ fontSize: 13, color: '#333', lineHeight: 1.5 }}>
                Open HeatpumpIQ in any browser and sign in with the same account — searches, comparisons and print quota stay in sync.
              </span>
              <span style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontFamily: 'ui-monospace,Menlo,monospace', background: '#f5f5f7', width: 'fit-content' }}>www.heatpumpiq.de/enter</span>
              <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                <span
                  className="hp-press"
                  onClick={() =>
                    navigator.clipboard?.writeText('www.heatpumpiq.de/enter')
                      .then(() => app.notify('Link copied to clipboard.'))
                      .catch(() => app.notify('Could not copy — please copy the link manually.'))
                  }
                  style={{ border: '1px solid #d2d2d7', borderRadius: 999, padding: '8px 18px', fontSize: 13, background: '#fff', cursor: 'pointer' }}
                >
                  Copy link
                </span>
                <span
                  className="hp-press"
                  onClick={() => {
                    window.location.href = `mailto:${user.email}?subject=${encodeURIComponent('HeatpumpIQ on the web')}&body=${encodeURIComponent('Open HeatpumpIQ in any browser and sign in with your account:\n\nwww.heatpumpiq.de/enter')}`;
                  }}
                  style={{ border: '1px solid #d2d2d7', borderRadius: 999, padding: '8px 18px', fontSize: 13, background: '#fff', cursor: 'pointer' }}
                >
                  Email me the link
                </span>
              </div>
            </Card>
          </div>
        </div>

        {/* Security + Support */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card style={{ gap: 9 }}>
            <CardTitle>Email & password.</CardTitle>
            <span style={{ fontSize: 13, color: '#333', lineHeight: 1.5 }}>Receive a secure link by email to set or change your email/password sign-in.</span>
            <span onClick={sendSetupLink} style={{ color: '#0066cc', fontSize: 13, cursor: 'pointer', marginTop: 2 }}>Send setup link to {user.email} ›</span>
          </Card>
          <Card style={{ gap: 9 }}>
            <CardTitle>Support.</CardTitle>
            <span style={{ fontSize: 13, color: '#333', lineHeight: 1.5 }}>Questions or problems? We reply within 1–3 business days.</span>
            <span
              onClick={() => {
                window.location.href = `mailto:support@heatpumpiq.de?subject=${encodeURIComponent('HeatpumpIQ support request')}&body=${encodeURIComponent(`Account: ${user.email}\n\nDescribe your question or problem:\n`)}`;
              }}
              style={{ color: '#0066cc', fontSize: 13, cursor: 'pointer', marginTop: 2 }}
            >
              Contact support & view replies ›
            </span>
          </Card>
        </div>

        {/* Legal + Delete */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card style={{ gap: 9 }}>
            <CardTitle>Terms & policies.</CardTitle>
            {(['Privacy policy', 'Terms of use', 'Impressum'] as const).map(doc => (
              <span
                key={doc}
                onClick={() => app.notify(`${doc} is being finalized for launch — it will open here once published.`)}
                style={{ color: '#0066cc', fontSize: 13.5, cursor: 'pointer' }}
              >
                {doc} ›
              </span>
            ))}
          </Card>
          <Card style={{ gap: 10 }}>
            <CardTitle>Delete account.</CardTitle>
            <span style={{ fontSize: 13, color: '#333', lineHeight: 1.5 }}>Permanently deletes your account, saved comparisons and settings. This cannot be undone.</span>
            <span style={{ fontSize: 12, color: '#7a7a7a', lineHeight: 1.55, border: '1px solid #e0e0e0', borderRadius: 8, padding: '10px 14px', background: '#f5f5f7' }}>
              Subscriptions started via the App Store or Google Play must be cancelled directly in that store before deleting the account.
            </span>
            <span
              className="hp-press"
              onClick={deleteAccount}
              style={{ border: '1px solid #d2d2d7', borderRadius: 999, padding: '9px 20px', fontSize: 13, background: '#fff', cursor: 'pointer', width: 'fit-content', color: '#c0392b' }}
            >
              Delete account
            </span>
          </Card>
        </div>
      </div>
    </div>
  );
};
