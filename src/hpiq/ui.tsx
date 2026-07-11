/**
 * Shared style constants + tiny primitives for the HeatPump DB design system.
 * Values are the literal ones from the approved prototype markup.
 */
import React from 'react';
import { BrandLogo } from '../components/BrandLogo';

export const FD = 'var(--hp-font-display)';

/**
 * Copyright watermark — faint centered brand mark for rights protection on
 * the data sheet and the comparison view. Screen variant sits inside its
 * (position:relative) container; the print variant is position:fixed so it
 * repeats centered on EVERY printed/PDF page (rules in hpiq.css).
 */
export const Watermark: React.FC<{ print?: boolean }> = ({ print }) => (
  <div className={print ? 'hpiq-print-watermark' : 'hpiq-watermark'} aria-hidden="true">
    <BrandLogo height={96} theme="light" />
  </div>
);

export const C = {
  primary: '#0066cc',
  linkOnDark: '#2997ff',
  ink: '#1d1d1f',
  muted: '#7a7a7a',
  soft: '#333',
  parchment: '#f5f5f7',
  tile: '#272729',
  hairline: '#e0e0e0',
  divider: '#f0f0f0',
  chip: '#d2d2d7',
  sep: 'rgba(0,0,0,.08)',
} as const;

/** 11px 600 letterspaced muted section label (rail/card headers). */
export const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: C.muted,
};

export const card18: React.CSSProperties = {
  border: `1px solid ${C.hairline}`, borderRadius: 18,
};

export const pillPrimary: React.CSSProperties = {
  background: C.primary, color: '#fff', borderRadius: 999,
  padding: '10px 20px', fontSize: 13.5, cursor: 'pointer',
};

export const pillSecondary: React.CSSProperties = {
  border: `1px solid ${C.chip}`, borderRadius: 999,
  padding: '10px 20px', fontSize: 13.5, background: '#fff', cursor: 'pointer',
};

export const frosted: React.CSSProperties = {
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
};

/** Monoline check mark used inside checkboxes / compare boxes. */
export const Check: React.FC<{ size?: number; visible: boolean; strokeWidth?: number }> = ({ size = 9, visible, strokeWidth = 3.4 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={strokeWidth} style={{ opacity: visible ? 1 : 0 }}>
    <path d="m5 13 4 4L19 7" />
  </svg>
);

export const SearchIcon: React.FC<{ size?: number; stroke?: string; strokeWidth?: number; style?: React.CSSProperties }> = ({ size = 16, stroke = '#7a7a7a', strokeWidth = 1.5, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} style={style}>
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
);

export const ChevronDown: React.FC<{ size?: number }> = ({ size = 10 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="m6 9 6 6 6-6" /></svg>
);

export const SignOutIcon: React.FC = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" />
  </svg>
);

export const PlayIcon: React.FC = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
);

/**
 * Dual-handle capacity range slider (pointer drag, whole kW).
 * Stateless — parent owns [lo, hi]; stale-closure safe because each drag
 * only moves its own handle while the other bound stays fixed.
 */
export const KwRangeSlider: React.FC<{
  bounds: { min: number; max: number };
  lo: number;
  hi: number;
  onChange: (next: [number, number]) => void;
}> = ({ bounds, lo, hi, onChange }) => {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const pctOf = (kw: number) => (bounds.max > bounds.min ? ((kw - bounds.min) / (bounds.max - bounds.min)) * 100 : 0);
  const drag = (which: 'lo' | 'hi') => (e: React.PointerEvent) => {
    e.preventDefault();
    const track = trackRef.current;
    if (!track) return;
    const move = (ev: PointerEvent) => {
      const rect = track.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
      const kw = Math.round(bounds.min + pct * (bounds.max - bounds.min));
      onChange(which === 'lo' ? [Math.min(kw, hi), hi] : [lo, Math.max(kw, lo)]);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    move(e.nativeEvent);
  };
  const handleStyle = (kw: number): React.CSSProperties => ({
    position: 'absolute', left: `${pctOf(kw)}%`, top: '50%', transform: 'translate(-50%,-50%)',
    width: 15, height: 15, borderRadius: '50%', background: '#fff', border: `1px solid ${C.chip}`,
    boxShadow: '0 1px 3px rgba(0,0,0,.15)', cursor: 'grab', touchAction: 'none',
  });
  return (
    <div style={{ padding: '4px 2px 0' }}>
      <div ref={trackRef} style={{ position: 'relative', height: 3, background: C.hairline, borderRadius: 2, touchAction: 'none' }}>
        <div style={{ position: 'absolute', left: `${pctOf(lo)}%`, right: `${100 - pctOf(hi)}%`, top: 0, bottom: 0, background: C.primary, borderRadius: 2 }} />
        <span onPointerDown={drag('lo')} style={handleStyle(lo)} />
        <span onPointerDown={drag('hi')} style={handleStyle(hi)} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted, marginTop: 9 }}>
        <span>{lo} kW</span><span>{hi} kW</span>
      </div>
    </div>
  );
};

/** Small square compare/filter checkbox (15–18px, blue when on). */
export const CheckBox: React.FC<{
  on: boolean; size?: number; radius?: number; onClick?: (e: React.MouseEvent) => void; style?: React.CSSProperties;
}> = ({ on, size = 15, radius = 4, onClick, style }) => (
  <span
    onClick={onClick}
    style={{
      flex: 'none', width: size, height: size, borderRadius: radius,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      cursor: onClick ? 'pointer' : undefined,
      boxSizing: 'border-box',
      ...(on ? { background: C.primary } : { background: '#fff', border: `1px solid ${C.chip}` }),
      ...style,
    }}
  >
    <Check size={size >= 17 ? 10 : 9} visible={on} strokeWidth={size >= 18 ? 3.2 : 3.4} />
  </span>
);
