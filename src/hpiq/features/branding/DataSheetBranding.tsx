/**
 * Data sheet studio — "Your branding" controls + the preview band
 * (Premium, 2026-09-29). State is the shared per-document options store
 * (brandingState.ts), which HpiqApp's PDF build reads too.
 */
import React from 'react';
import { HpApp } from '../../appState';
import { PremiumPill } from '../../Premium';
import { sectionLabel } from '../../ui';
import { brandingStrings } from './strings';
import {
  PREPARED_FOR_MAX, pdfBrandingFor, savedBranding, setDocBrandingOptions, useDocBrandingOptions,
} from './brandingState';
import { BrandingBandView, Switch } from './BrandingBandView';

/** Studio left-rail block, between SECTIONS and EXPORT. */
export const DataSheetBrandingSection: React.FC<{ app: HpApp }> = ({ app }) => {
  const s = brandingStrings(app.lang);
  const opts = useDocBrandingOptions();
  const saved = savedBranding(app.user);
  const on = app.premium && !!saved && opts.enabled;

  const onToggle = () => {
    if (!app.premium) { app.upsell(); return; }
    if (!saved) return;
    setDocBrandingOptions({ enabled: !opts.enabled });
  };

  return (
    <div data-testid="ds-branding" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 11, borderTop: '1px solid rgba(0,0,0,.08)' }}>
      <span style={{ ...sectionLabel, textTransform: 'uppercase' }}>{s.studioHead}{!app.premium && <PremiumPill app={app} />}</span>
      <span onClick={onToggle} data-testid="ds-branding-toggle" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: app.premium && !saved ? 'default' : 'pointer', color: app.premium && !saved ? '#9a9aa0' : '#1d1d1f' }}>
        <Switch on={on} disabled={app.premium && !saved} />
        {s.toggle}
      </span>
      {app.premium && !saved && (
        <span style={{ fontSize: 11.5, color: '#7a7a7a', marginTop: -4 }}>
          {s.noBranding}{' '}
          <span onClick={() => app.go('account')} style={{ color: '#0066cc', cursor: 'pointer' }}>{s.setUp}</span>
        </span>
      )}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: '#555' }}>
        {s.preparedForLabel}
        <input
          value={app.premium ? opts.preparedFor : ''}
          readOnly={!app.premium}
          onFocus={e => { if (!app.premium) { e.currentTarget.blur(); app.upsell(); } }}
          maxLength={PREPARED_FOR_MAX}
          onChange={e => setDocBrandingOptions({ preparedFor: e.target.value })}
          placeholder={s.preparedForPh}
          data-testid="ds-prepared-for"
          style={{ border: '1px solid #d2d2d7', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, outline: 'none', fontFamily: 'inherit' }}
        />
      </label>
    </div>
  );
};

/** The preview's twin of the PDF band — renders nothing when unbranded. */
export const DataSheetBrandingBand: React.FC<{ app: HpApp }> = ({ app }) => {
  const opts = useDocBrandingOptions();
  const b = pdfBrandingFor(app.user, app.premium, app.lang, opts);
  if (!b) return null;
  return <BrandingBandView b={b} style={{ marginBottom: 14 }} />;
};
