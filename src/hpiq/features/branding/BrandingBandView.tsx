/**
 * On-screen twin of the PDF "Prepared by … for …" band (pdf/brandingBand.ts):
 * used by the Account card preview and the data-sheet preview (DataSheetDoc).
 */
import React from 'react';
import type { PdfBranding } from '../../pdf/brandingBand';
import { hasBrandingContent } from '../../pdf/brandingBand';

const cap: React.CSSProperties = { fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', color: '#7a7a7a', textTransform: 'uppercase' };

export const BrandingBandView: React.FC<{ b: PdfBranding | null; placeholderFor?: string; style?: React.CSSProperties }> = ({ b, placeholderFor, style }) => {
  if (!hasBrandingContent(b) && !placeholderFor) return null;
  const labels = b?.labels;
  const company = b?.company?.trim();
  const contact = b?.contact?.trim();
  const hasLeft = !!(b?.logo || company || contact);
  const forText = b?.preparedFor?.trim();
  return (
    <div data-testid="branding-band" style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#f5f5f7', borderRadius: 8, padding: '11px 16px', minHeight: 44, ...style }}>
      {b?.logo && <img src={b.logo} alt="" style={{ maxHeight: 42, maxWidth: 'min(150px, 28%)', objectFit: 'contain', flex: 'none' }} />}
      {hasLeft && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
          <span style={cap}>{labels?.preparedBy}</span>
          {company && <span style={{ fontSize: 15, fontWeight: 650, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{company}</span>}
          {contact && <span style={{ fontSize: 11.5, color: '#7a7a7a', lineHeight: 1.4, overflowWrap: 'anywhere' }}>{contact}</span>}
        </div>
      )}
      {(forText || placeholderFor) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: hasLeft ? '0 1 auto' : 1, maxWidth: hasLeft ? '38%' : undefined, borderLeft: hasLeft ? '1px solid #d6d6dc' : undefined, paddingLeft: hasLeft ? 14 : 0 }}>
          <span style={cap}>{labels?.preparedFor}</span>
          <span style={{ fontSize: 13.5, fontWeight: 650, overflowWrap: 'anywhere', color: forText ? '#1d1d1f' : '#b6b6bc', fontStyle: forText ? undefined : 'italic' }}>{forText || placeholderFor}</span>
        </div>
      )}
    </div>
  );
};

/** The studio's switch visual (same as the data-sheet section toggles). */
export const Switch: React.FC<{ on: boolean; disabled?: boolean }> = ({ on, disabled }) => (
  <span style={{ flex: 'none', width: 32, height: 19, borderRadius: 999, position: 'relative', display: 'inline-block', transition: 'background .18s', background: on ? '#0066cc' : '#d2d2d7', opacity: disabled ? 0.5 : 1 }}>
    <span style={{ position: 'absolute', top: 2, width: 15, height: 15, borderRadius: '50%', background: '#fff', transition: 'left .18s', left: on ? 15 : 2 }} />
  </span>
);

export const LockIcon: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
