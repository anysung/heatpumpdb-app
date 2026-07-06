/** EU energy label — EPREL-style records with always-on label inspector. */
import React, { useEffect, useRef, useState } from 'react';
import { HpApp } from '../appState';
import { HpVM } from '../model';
import { FD, Check, pillPrimary, pillSecondary, sectionLabel } from '../ui';

const GRID = '2.2fr 1fr 0.8fr 0.8fr 0.9fr 1.1fr';
const PAGE_SIZE = 100;

export const LabelPage: React.FC<{ app: HpApp }> = ({ app }) => {
  const { store } = app;
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [eprelStatus, setEprelStatus] = useState({ matched: true, notMatched: true });
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const records = (store ? store.labelRecords(app.classFilter) : [])
    .filter(v => (v.eprel ? eprelStatus.matched : eprelStatus.notMatched));
  const rows = records.slice(0, visible);

  useEffect(() => {
    setVisible(PAGE_SIZE);
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [app.classFilter, store, eprelStatus]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || visible >= records.length) return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) setVisible(v => v + PAGE_SIZE);
    }, { root: scrollerRef.current, rootMargin: '600px' });
    io.observe(sentinel);
    return () => io.disconnect();
  }, [visible, records.length]);

  const lsel: HpVM | null = (app.labelSelId && store ? store.byId.get(app.labelSelId) : null) ?? records[0] ?? null;

  return (
    <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', minHeight: 0, height: 'calc(100vh - 46px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 28px', borderBottom: '1px solid rgba(0,0,0,.08)', flex: 'none' }}>
        <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 600, letterSpacing: '-0.2px' }}>EU energy label</span>
        <span style={{ fontSize: 12, color: '#7a7a7a', border: '1px solid #e0e0e0', borderRadius: 999, padding: '5px 13px' }}>EPREL-style records</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#7a7a7a' }}>
          {records.length.toLocaleString('en-US')} label records · EPREL sync {app.eprelSyncDate}
        </span>
      </div>
      <div style={{ flex: 1, overflowX: 'auto', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'stretch', minWidth: 1240, height: '100%', boxSizing: 'border-box' }}>

          {/* label filter rail */}
          <div style={{ flex: '0 0 248px', boxSizing: 'content-box', borderRight: '1px solid rgba(0,0,0,.08)', padding: 20, display: 'flex', flexDirection: 'column', gap: 22, overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={sectionLabel}>ENERGY CLASS (W35)</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['A+++', 'A++', 'A+'].map(c => {
                  const on = app.classFilter === c;
                  return (
                    <span
                      key={c}
                      className="hp-press"
                      onClick={() => app.setClassFilter(on ? null : c)}
                      style={{
                        borderRadius: 999, padding: '5px 13px', fontSize: 12.5, cursor: 'pointer',
                        ...(on ? { background: '#0066cc', color: '#fff' } : { border: '1px solid #e0e0e0', color: '#1d1d1f' }),
                      }}
                    >
                      {c}
                    </span>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={sectionLabel}>EPREL STATUS</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13.5 }}>
                {([['matched', 'Matched'], ['notMatched', 'Not matched']] as ['matched' | 'notMatched', string][]).map(([key, l]) => {
                  const on = eprelStatus[key];
                  return (
                    <span
                      key={key}
                      onClick={() => setEprelStatus(s => ({ ...s, [key]: !s[key] }))}
                      style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', userSelect: 'none' }}
                    >
                      <span style={{ width: 15, height: 15, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', ...(on ? { background: '#0066cc' } : { background: '#fff', border: '1px solid #d2d2d7' }) }}>
                        <Check size={9} visible={on} strokeWidth={3.4} />
                      </span>
                      {l}
                    </span>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={sectionLabel}>ABOUT THIS DATA</span>
              <span style={{ fontSize: 12, color: '#7a7a7a', lineHeight: 1.5 }}>
                Label records follow the EU energy labelling framework for space heaters. Always attach the official label from the manufacturer or EPREL for legal use.
              </span>
            </div>
          </div>

          {/* label table */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: '1px solid rgba(0,0,0,.08)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: '0 12px', padding: '10px 20px', borderBottom: '1px solid rgba(0,0,0,.08)', fontSize: 10.5, fontWeight: 600, letterSpacing: '.05em', color: '#7a7a7a', flex: 'none' }}>
              <span>MODEL</span><span>MANUFACTURER</span><span>CLASS W35</span><span>CLASS W55</span><span>SOUND POWER</span><span>EPREL</span>
            </div>
            <div ref={scrollerRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {rows.map(lr => {
                const isSel = lsel?.id === lr.id;
                return (
                  <div
                    key={lr.id}
                    className="hp-row"
                    onClick={() => app.setLabelSelId(lr.id)}
                    style={{
                      display: 'grid', gridTemplateColumns: GRID, gap: '0 12px', alignItems: 'center',
                      padding: '12px 20px', borderBottom: '1px solid #f0f0f0', fontSize: 13, cursor: 'pointer',
                      ...(isSel ? { background: '#f5f5f7', boxShadow: 'inset 2px 0 0 #0066cc' } : { background: '#fff' }),
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 600, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lr.model}</span>
                      <span style={{ fontSize: 11, color: '#7a7a7a' }}>ODU {lr.odu}</span>
                    </span>
                    <span>{lr.mfr}</span>
                    <span style={{ fontWeight: 600 }}>{lr.label}</span>
                    <span>{lr.labelMed}</span>
                    <span>{lr.noise === '—' ? '—' : `${lr.noise} dB(A)`}</span>
                    <span>{lr.eprelText}</span>
                  </div>
                );
              })}
              {visible < records.length && <div ref={sentinelRef} style={{ height: 1 }} />}
              <div style={{ padding: '11px 20px', fontSize: 12, color: '#7a7a7a' }}>
                Click a record to inspect label details, or generate an energy label sheet from the inspector.
              </div>
            </div>
          </div>

          {/* label inspector — always visible */}
          {lsel && (
            <div style={{ flex: '0 0 400px', display: 'flex', flexDirection: 'column', background: '#f5f5f7', overflow: 'auto' }}>
              <div style={{ padding: '20px 24px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, color: '#7a7a7a' }}>{lsel.mfr} · {lsel.eprelId}</span>
                <span style={{ fontFamily: FD, fontSize: 21, fontWeight: 600, letterSpacing: '-0.28px', lineHeight: 1.18 }}>{lsel.model}</span>
              </div>
              <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 18, padding: 20, display: 'flex', gap: 18, alignItems: 'center' }}>
                  <div style={{ flex: '0 0 96px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1px solid #e0e0e0', borderRadius: 8, padding: '14px 10px' }}>
                    <span style={{ fontSize: 9, letterSpacing: '.08em', color: '#7a7a7a' }}>ENERGY</span>
                    <span style={{ fontFamily: FD, fontSize: 30, fontWeight: 700, letterSpacing: '-0.5px' }}>{lsel.label}</span>
                    <span style={{ fontSize: 9, color: '#7a7a7a' }}>space heating W35</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, minWidth: 0 }}>
                    <span><span style={{ color: '#7a7a7a' }}>W35:</span> <strong style={{ fontWeight: 600 }}>{lsel.label}</strong> · <span style={{ color: '#7a7a7a' }}>W55:</span> <strong style={{ fontWeight: 600 }}>{lsel.labelMed}</strong></span>
                    <span><span style={{ color: '#7a7a7a' }}>Rated output:</span> <strong style={{ fontWeight: 600 }}>{lsel.kw === '—' ? '—' : `${lsel.kw} kW`}</strong></span>
                    <span><span style={{ color: '#7a7a7a' }}>Sound power:</span> <strong style={{ fontWeight: 600 }}>{lsel.noise === '—' ? '—' : `${lsel.noise} dB(A)`}</strong></span>
                    <span><span style={{ color: '#7a7a7a' }}>Refrigerant:</span> <strong style={{ fontWeight: 600 }}>{lsel.refKg === '—' ? lsel.ref : `${lsel.ref} · ${lsel.refKg} kg`}</strong></span>
                  </div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 18, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
                  <span style={{ ...sectionLabel, fontSize: 10.5 }}>SOURCE & VERIFICATION</span>
                  <span style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#7a7a7a' }}>EPREL status</span><span style={{ fontWeight: 600 }}>{lsel.eprelText}</span></span>
                  <span style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#7a7a7a' }}>Registration</span><span style={{ fontWeight: 600 }}>{lsel.eprelId}</span></span>
                  <span style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#7a7a7a' }}>Last updated</span><span style={{ fontWeight: 600 }}>{app.eprelSyncDate}</span></span>
                  <span style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#7a7a7a' }}>Data completeness</span><span style={{ fontWeight: 600 }}>{lsel.completeness}</span></span>
                  <span style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#7a7a7a' }}>Product info sheet</span><span style={{ fontWeight: 600 }}>{lsel.eprel ? 'Available' : '—'}</span></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className="hp-press" onClick={() => app.openDataSheet(lsel.id, 'label')} style={pillPrimary}>Energy label sheet ›</span>
                  <span className="hp-press" onClick={() => app.openProduct(lsel.id)} style={pillSecondary}>Open product profile</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
