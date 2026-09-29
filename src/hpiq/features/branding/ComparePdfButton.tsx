/**
 * Branded comparison PDF (Premium, 2026-09-29) — compare-modal header slot.
 * A small inline prompt (prepared for · branding on/off) then a generated A4
 * landscape PDF (pdf/comparisonPdf.ts). The build is synchronous so the iOS
 * share sheet is still reached inside the click gesture.
 */
import React, { useState } from 'react';
import { HpApp } from '../../appState';
import { HpVM } from '../../model';
import { tr } from '../../i18n';
import { buildComparisonPdf, comparisonFileName } from '../../pdf/comparisonPdf';
import { downloadPdf, printPdfViaShareSheet } from '../../pdf/deliverPdf';
import { isIos } from '../../pwaInstall';
import { PremiumPill } from '../../Premium';
import { brandingStrings } from './strings';
import {
  PREPARED_FOR_MAX, pdfBrandingFor, savedBranding, setDocBrandingOptions, useDocBrandingOptions,
} from './brandingState';
import { Switch } from './BrandingBandView';

export const ComparePdfButton: React.FC<{ app: HpApp; ids: string[] }> = ({ app, ids }) => {
  const t = tr(app.lang);
  const s = brandingStrings(app.lang);
  const opts = useDocBrandingOptions();
  const [open, setOpen] = useState(false);
  const saved = savedBranding(app.user);

  const items = ids
    .map(id => app.store?.byId.get(id) ?? app.allStore?.byId.get(id))
    .filter(Boolean) as HpVM[];
  if (items.length === 0) return null;

  const create = () => {
    try {
      const doc = buildComparisonPdf({
        items, t, s,
        branding: pdfBrandingFor(app.user, app.premium, app.lang, opts),
        dataStatusDate: app.dataStatusDate,
      });
      const name = comparisonFileName(opts.preparedFor);
      setOpen(false);
      // Phones: iOS has no usable blob download — the share sheet (Save to
      // Files / Print / Mail) is the route, exactly like the data sheet.
      if (isIos()) printPdfViaShareSheet(doc, name).catch(() => app.notify(s.cmpFailed));
      else downloadPdf(doc, name);
    } catch {
      app.notify(s.cmpFailed);
    }
  };

  const onButton = () => {
    if (!app.premium) { app.upsell(); return; }
    setOpen(o => !o);
  };

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <span
        className="hp-press"
        data-testid="compare-pdf"
        onClick={onButton}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #d2d2d7', borderRadius: 999, padding: '9px 18px', fontSize: 14, fontWeight: 600, background: '#fff', cursor: 'pointer' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
        </svg>
        {s.cmpBtn}
        {!app.premium && <PremiumPill app={app} />}
      </span>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 4 }} />
          <div
            data-testid="compare-pdf-prompt"
            style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 5, width: 320, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 14, boxShadow: '0 12px 32px rgba(0,0,0,.16)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <span style={{ fontSize: 14, fontWeight: 650 }}>{s.cmpTitle}</span>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: '#555' }}>
              {s.preparedForLabel}
              <input
                autoFocus
                value={opts.preparedFor}
                maxLength={PREPARED_FOR_MAX}
                onChange={e => setDocBrandingOptions({ preparedFor: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') create(); }}
                placeholder={s.preparedForPh}
                data-testid="compare-prepared-for"
                style={{ border: '1px solid #d2d2d7', borderRadius: 10, padding: '9px 12px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit' }}
              />
            </label>
            <span
              onClick={() => { if (saved) setDocBrandingOptions({ enabled: !opts.enabled }); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: saved ? 'pointer' : 'default', color: saved ? '#1d1d1f' : '#9a9aa0' }}
            >
              <Switch on={!!saved && opts.enabled} disabled={!saved} />
              {s.toggle}
            </span>
            {!saved && (
              <span style={{ fontSize: 11.5, color: '#7a7a7a', marginTop: -6 }}>
                {s.noBranding}{' '}
                <span onClick={() => { setOpen(false); app.setShowCompare(false); app.go('account'); }} style={{ color: '#0066cc', cursor: 'pointer' }}>{s.setUp}</span>
              </span>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <span className="hp-press" onClick={() => setOpen(false)} style={{ border: '1px solid #d2d2d7', borderRadius: 999, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>{s.cancel}</span>
              <span className="hp-press" data-testid="compare-pdf-create" onClick={create} style={{ background: '#1d1d1f', color: '#fff', borderRadius: 999, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{s.cmpCreate}</span>
            </div>
          </div>
        </>
      )}
    </span>
  );
};
