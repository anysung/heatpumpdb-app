/** Funding guide — educational, homeowner/installer tabs. */
import React from 'react';
import { HpApp } from '../appState';
import { FD, Check, PlayIcon, sectionLabel } from '../ui';

const STEPS_PRO: [string, string, string][] = [
  ['1', 'Qualify the building', 'Heat load estimate, radiator temperatures, existing system age.'],
  ['2', 'Select a listed unit', 'Pick from the BAFA list — capture the BAFA ID in your quote.'],
  ['3', 'Customer applies at KfW', 'Grant commitment must precede the signed delivery contract.'],
  ['4', 'Install & document', 'Hydraulic balancing, commissioning report, invoices with BAFA ID.'],
  ['5', 'Proof & payout', 'Upload the installation proof package; payout follows review.'],
];
const STEPS_HOME: [string, string, string][] = [
  ['1', 'Check your starting point', 'Building age, current heating, rough heat demand.'],
  ['2', 'Get installer quotes', 'Ask for the BAFA ID of each offered heat pump.'],
  ['3', 'Apply before signing', 'Submit at KfW and wait for the commitment first.'],
  ['4', 'Installation', 'Your installer handles the technical documentation.'],
  ['5', 'Submit proof, get paid', 'Upload invoices and confirmations; the grant is paid out.'],
];
const CHECK_PRO = [
  'Heat load calculation (room-by-room or DIN EN 12831 estimate)',
  'BAFA ID confirmed on the current list — on the day of application',
  'Hydraulic balancing plan and commissioning checklist prepared',
  'Sound assessment for the outdoor unit location',
  'Customer informed: KfW commitment before delivery contract',
];
const CHECK_HOME = [
  'Confirm the building is older than 5 years',
  'Collect two comparable installer quotes with BAFA IDs',
  'Check the unit appears on the current BAFA list',
  'Apply at KfW and wait for the commitment',
  'Keep every invoice — proof upload comes after installation',
];
const FAQS: [string, string][] = [
  ['Do I need the BAFA list if I apply at KfW?', 'Yes. The grant is applied for at KfW, but the heat pump itself must be on the BAFA list of eligible units. This app shows the list status of every product — always re-verify on the official list on the day of application.'],
  ['When exactly must I apply?', 'The funding commitment must exist before you sign a delivery or installation contract. Planning services are allowed earlier. This is the single most common and most expensive mistake.'],
  ['What is the efficiency bonus?', 'An additional 5 percentage points for heat pumps using a natural refrigerant such as R290, or certain heat sources. Most new monoblock units in this database qualify — filter by R290 to see them.'],
  ['Is this page legal advice?', 'No. It is an editorial preparation guide based on public BAFA and KfW information. Conditions change; the official program documents always prevail.'],
];

export const GuidePage: React.FC<{ app: HpApp }> = ({ app }) => {
  const isPro = app.guideTab === 'pro';
  const steps = isPro ? STEPS_PRO : STEPS_HOME;
  const checklist = isPro ? CHECK_PRO : CHECK_HOME;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#272729', color: '#fff', padding: '52px 48px 44px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontFamily: FD, fontSize: 34, fontWeight: 600, letterSpacing: '-0.374px' }}>Funding, step by step.</span>
        <span style={{ fontSize: 17, color: '#ccc', letterSpacing: '-0.374px', maxWidth: 640 }}>
          Prepare a BEG EM application with confidence — whether you install heat pumps or own the home.
        </span>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {([['home', 'For homeowners'], ['pro', 'For installers']] as ['home' | 'pro', string][]).map(([id, label]) => {
            const on = app.guideTab === id;
            return (
              <span
                key={id}
                className="hp-press"
                onClick={() => app.setGuideTab(id)}
                style={{
                  borderRadius: 999, padding: '7px 17px', fontSize: 13, cursor: 'pointer',
                  ...(on ? { background: '#fff', color: '#1d1d1f', fontWeight: 600 } : { border: '1px solid rgba(255,255,255,.35)', color: '#fff' }),
                }}
              >
                {label}
              </span>
            );
          })}
        </div>
      </div>
      <div style={{ maxWidth: 1160, width: '100%', margin: '0 auto', padding: '32px 48px 48px', display: 'flex', flexDirection: 'column', gap: 28, boxSizing: 'border-box' }}>

        {/* journey */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span style={{ fontFamily: FD, fontSize: 21, fontWeight: 600, letterSpacing: '-0.2px' }}>
            {isPro ? 'The installer journey.' : 'The homeowner journey.'}
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 0 }}>
            {steps.map(([n, title, text]) => (
              <div key={n} style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '0 18px 0 0', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 'none', width: 26, height: 26, borderRadius: '50%', background: '#0066cc', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{n}</span>
                  <span style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{title}</span>
                <span style={{ fontSize: 12.5, color: '#7a7a7a', lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* checklist + video */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
          <div style={{ border: '1px solid #e0e0e0', borderRadius: 18, padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 600, letterSpacing: '-0.2px' }}>Preparation checklist.</span>
              <span style={{ fontSize: 12.5, color: '#0066cc', cursor: 'pointer' }}>Download PDF ›</span>
            </div>
            {checklist.map((text, i) => {
              const key = (isPro ? 'pro' : 'home') + i;
              const on = !!app.checked[key];
              return (
                <span key={key} onClick={() => app.toggleChecked(key)} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, fontSize: 14, lineHeight: 1.5, cursor: 'pointer', padding: '2px 0' }}>
                  <span style={{ flex: 'none', width: 17, height: 17, borderRadius: 5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, boxSizing: 'border-box', ...(on ? { background: '#0066cc' } : { border: '1px solid #d2d2d7' }) }}>
                    <Check size={10} visible={on} strokeWidth={3.2} />
                  </span>
                  <span style={on ? { color: '#7a7a7a', textDecoration: 'line-through' } : undefined}>{text}</span>
                </span>
              );
            })}
            <span style={{ fontSize: 11.5, color: '#7a7a7a', marginTop: 4 }}>
              A preparation aid, not legal advice. Verify each item against the official BAFA / KfW conditions.
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#f5f5f7', borderRadius: 18, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={sectionLabel}>3-MINUTE EXPLAINER</span>
              <div style={{ aspectRatio: '16/9', background: '#272729', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,.14)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PlayIcon />
                </span>
              </div>
              <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>How the BEG EM grant works — the 5 decisions that matter before you sign anything.</span>
            </div>
            <div style={{ border: '1px solid #e0e0e0', borderRadius: 18, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={sectionLabel}>GOOD TO KNOW</span>
              <span style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                Natural-refrigerant units (R290) currently qualify for the +5% efficiency bonus. Filter Products by R290 to see them.
              </span>
              <span onClick={app.goProductsR290} style={{ fontSize: 13, color: '#0066cc', cursor: 'pointer' }}>Show R290 products ›</span>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontFamily: FD, fontSize: 21, fontWeight: 600, letterSpacing: '-0.2px' }}>Common questions.</span>
          <div style={{ border: '1px solid #e0e0e0', borderRadius: 18, overflow: 'hidden' }}>
            {FAQS.map(([q, a], i) => {
              const open = app.faqOpen === i;
              return (
                <div key={q} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <span
                    onClick={() => app.setFaqOpen(open ? -1 : i)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '17px 24px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {q}
                    <span style={{ color: '#7a7a7a', fontSize: 17, transition: 'transform .18s', transform: `rotate(${open ? '90deg' : '0deg'})` }}>›</span>
                  </span>
                  {open && (
                    <span style={{ display: 'block', padding: '0 24px 17px', fontSize: 14, color: '#333', lineHeight: 1.6, maxWidth: 760 }}>{a}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
