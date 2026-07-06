/** BAFA / KfW — curated German funding updates. */
import React from 'react';
import { HpApp } from '../appState';
import { FD, sectionLabel } from '../ui';

const TIMELINE: { date: string; badge: 'CONFIRMED' | 'GUIDANCE'; strong: string; rest: string }[] = [
  { date: '2 Jul 2026', badge: 'CONFIRMED', strong: 'KfW simplifies proof-of-installation upload', rest: ' — invoices and installer confirmation now in one step for grant 458.' },
  { date: '14 Jun 2026', badge: 'CONFIRMED', strong: 'BAFA list update', rest: ' — 214 new R290 monoblock entries; 37 models delisted after datasheet corrections.' },
  { date: '28 May 2026', badge: 'GUIDANCE', strong: 'Draft discussion on 2027 efficiency bonus criteria', rest: ' — no confirmed changes; monitor before advising customers on timing.' },
];

const SOURCES = [
  { title: 'BAFA — Federal Office for Economic Affairs and Export Control', sub: 'Official agency homepage', link: 'bafa.de ›', href: 'https://www.bafa.de' },
  { title: 'KfW grant 458', sub: 'Application portal & conditions', link: 'kfw.de ›', href: 'https://www.kfw.de' },
  { title: 'BMWK — Federal Ministry for Economic Affairs and Climate Action', sub: 'Energy transition & building efficiency policy', link: 'bmwk.de ›', href: 'https://www.bmwk.de' },
];

export const BafaPage: React.FC<{ app: HpApp }> = ({ app }) => {
  const totalText = app.totalListed ? app.totalListed.toLocaleString('en-US') : '—';
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#f5f5f7', padding: '44px 48px 36px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontFamily: FD, fontSize: 34, fontWeight: 600, letterSpacing: '-0.374px' }}>BAFA / KfW.</span>
        <span style={{ fontSize: 17, color: '#7a7a7a', letterSpacing: '-0.374px', maxWidth: 640 }}>
          Curated German funding updates for heat pumps. Confirmed changes, clearly separated from guidance.
        </span>
      </div>
      <div style={{ maxWidth: 1160, width: '100%', margin: '0 auto', padding: '28px 48px 48px', display: 'flex', flexDirection: 'column', gap: 24, boxSizing: 'border-box' }}>

        {/* status summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div style={{ border: '1px solid #e0e0e0', borderRadius: 18, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={sectionLabel}>BEG EM — HEAT PUMPS</span>
            <span style={{ fontFamily: FD, fontSize: 21, fontWeight: 600, letterSpacing: '-0.2px' }}>Up to 40%</span>
            <span style={{ fontSize: 12.5, color: '#7a7a7a', lineHeight: 1.5 }}>Base 30% + 5% efficiency bonus (natural refrigerant) + climate-speed bonus. Caps apply.</span>
          </div>
          <div style={{ border: '1px solid #e0e0e0', borderRadius: 18, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={sectionLabel}>KFW 458 — GRANT PORTAL</span>
            <span style={{ fontFamily: FD, fontSize: 21, fontWeight: 600, letterSpacing: '-0.2px' }}>Open</span>
            <span style={{ fontSize: 12.5, color: '#7a7a7a', lineHeight: 1.5 }}>Applications accepted for owner-occupied single-family homes; commitment before delivery contract.</span>
          </div>
          <div style={{ border: '1px solid #e0e0e0', borderRadius: 18, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={sectionLabel}>BAFA LIST COVERAGE</span>
            <span style={{ fontFamily: FD, fontSize: 21, fontWeight: 600, letterSpacing: '-0.2px' }}>{totalText} heat pumps</span>
            <span style={{ fontSize: 12.5, color: '#7a7a7a', lineHeight: 1.5 }}>Listed units in this app — refreshed with every regular data update.</span>
          </div>
        </div>

        {/* recent changes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontFamily: FD, fontSize: 21, fontWeight: 600, letterSpacing: '-0.2px' }}>Recent changes.</span>
          <div style={{ border: '1px solid #e0e0e0', borderRadius: 18, overflow: 'hidden' }}>
            {TIMELINE.map((t, i) => (
              <div key={t.date} style={{ display: 'flex', gap: 18, padding: '18px 24px', borderBottom: i < TIMELINE.length - 1 ? '1px solid #f0f0f0' : undefined, alignItems: 'baseline' }}>
                <span style={{ flex: '0 0 92px', fontSize: 12, color: '#7a7a7a' }}>{t.date}</span>
                <span style={{ flex: '0 0 88px', fontSize: 10.5, fontWeight: 600, letterSpacing: '.05em', border: '1px solid #e0e0e0', borderRadius: 999, padding: '3px 10px', textAlign: 'center', ...(t.badge === 'GUIDANCE' ? { color: '#7a7a7a' } : {}) }}>{t.badge}</span>
                <span style={{ fontSize: 14, lineHeight: 1.5 }}><strong style={{ fontWeight: 600 }}>{t.strong}</strong>{t.rest}</span>
              </div>
            ))}
          </div>
        </div>

        {/* two audiences */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#272729', color: '#fff', borderRadius: 18, padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ ...sectionLabel, color: '#ccc' }}>WHAT INSTALLERS SHOULD KNOW</span>
            <span style={{ fontSize: 14.5, lineHeight: 1.6, color: '#fff' }}>
              Commitment must exist before the delivery contract is signed. Use the app's data sheet with BAFA ID as the technical annex, and re-verify list status on the day of the application.
            </span>
            <span onClick={() => { app.setGuideTab('pro'); app.go('guide'); }} style={{ fontSize: 13, color: '#2997ff', cursor: 'pointer' }}>Installer checklist ›</span>
          </div>
          <div style={{ border: '1px solid #e0e0e0', borderRadius: 18, padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={sectionLabel}>WHAT HOMEOWNERS SHOULD KNOW</span>
            <span style={{ fontSize: 14.5, lineHeight: 1.6 }}>
              The grant is applied for at KfW, but the heat pump must appear on the BAFA list. Your installer confirms the technical requirements — ask for the BAFA ID of the offered unit.
            </span>
            <span onClick={() => { app.setGuideTab('home'); app.go('guide'); }} style={{ fontSize: 13, color: '#0066cc', cursor: 'pointer' }}>Read the funding guide ›</span>
          </div>
        </div>

        {/* official sources — exactly bafa.de / kfw.de / bmwk.de, no deep links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontFamily: FD, fontSize: 21, fontWeight: 600, letterSpacing: '-0.2px' }}>Official sources.</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {SOURCES.map(s => (
              <div key={s.href} style={{ border: '1px solid #e0e0e0', borderRadius: 18, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{s.title}</span>
                <span style={{ fontSize: 12, color: '#7a7a7a' }}>{s.sub}</span>
                <span onClick={() => window.open(s.href, '_blank', 'noopener')} style={{ fontSize: 12.5, color: '#0066cc', marginTop: 4, cursor: 'pointer' }}>{s.link}</span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 11.5, color: '#7a7a7a' }}>Summaries above are editorial guidance, not legal or funding advice. Official sources prevail.</span>
        </div>
      </div>
    </div>
  );
};
