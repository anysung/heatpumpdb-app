/**
 * AdminLogin — the sign-in screen for the operations console (heatpumpdb-hub).
 *
 * Deliberately SEPARATE from the country auth surface (AuthShell / App LOGIN):
 * the console is an internal tool whose UI is EN | KO only (never German — see
 * market.ts), and it needs none of the country chrome (market badge, social
 * sign-in, "sign up", "back to landing"). Its language uses AdminLang and is
 * persisted with the same load/saveAdminLang the dashboard reads, so the choice
 * carries straight into the console after login.
 */
import React from 'react';
import { AdminLang, ADMIN_I18N } from './adminI18n';
import { LEGAL_ROUTES } from '../../config/legal';

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 10,
  padding: '11px 12px',
  color: '#f2f2f5',
  fontSize: 14,
  outline: 'none',
};

const legalLink: React.CSSProperties = {
  color: 'rgba(255,255,255,0.45)',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

export const AdminLogin: React.FC<{
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  lang: AdminLang; setLang: (l: AdminLang) => void;
}> = ({ email, setEmail, password, setPassword, onSubmit, isLoading, lang, setLang }) => {
  const s = ADMIN_I18N[lang];
  const t = s.login;
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0b0d10', color: '#e8e8ed', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>HeatPump <span style={{ color: '#ff6a3d' }}>DB</span></span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{s.console}</span>
        </div>
        {/* EN | KO — the console's only languages */}
        <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: 600, flex: 'none' }}>
          {(['en', 'ko'] as AdminLang[]).map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              style={{ padding: '6px 14px', cursor: 'pointer', border: 'none', background: lang === l ? '#fff' : 'transparent', color: lang === l ? '#111' : 'rgba(255,255,255,0.6)' }}
            >
              {l === 'en' ? 'EN' : '한국어'}
            </button>
          ))}
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 380, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t.title}</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '6px 0 24px' }}>{t.subtitle}</p>

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              {t.email}
              <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              {t.password}
              <input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
            </label>
            <button
              type="submit"
              disabled={isLoading}
              style={{ marginTop: 4, padding: 12, borderRadius: 10, border: 'none', background: '#ff6a3d', color: '#fff', fontWeight: 600, fontSize: 14, cursor: isLoading ? 'default' : 'pointer', opacity: isLoading ? 0.7 : 1 }}
            >
              {isLoading ? t.signingIn : t.signIn}
            </button>
          </form>

          {/* Legal links — small, on ONE row (per-link nowrap; wraps only if it must). */}
          <div style={{ marginTop: 24, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', fontSize: 10 }}>
            <a href={LEGAL_ROUTES.privacy} style={legalLink}>{t.privacy}</a>
            <a href={LEGAL_ROUTES.terms} style={legalLink}>{t.terms}</a>
            <a href={LEGAL_ROUTES.refund} style={legalLink}>{t.refund}</a>
            <a href={LEGAL_ROUTES.imprint} style={legalLink}>{t.imprint}</a>
          </div>
        </div>
      </main>
    </div>
  );
};
