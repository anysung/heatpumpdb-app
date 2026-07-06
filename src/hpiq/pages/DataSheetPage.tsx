/** Data sheet studio — two modes, model picker, section toggles, live preview. */
import React, { useMemo, useState } from 'react';
import { HpApp, DsSectionKey } from '../appState';
import { longDate } from '../model';
import { FD, SearchIcon, pillPrimary, pillSecondary, sectionLabel } from '../ui';

const PICKER_LIMIT = 60;

const FieldRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '9px 0', borderBottom: '1px solid #f0f0f0' }}>
    <span style={{ color: '#7a7a7a' }}>{label}</span><span style={{ fontWeight: 600 }}>{value}</span>
  </span>
);

const SectionHead: React.FC<{ title: string; muted?: boolean }> = ({ title, muted }) => (
  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', color: muted ? '#7a7a7a' : '#0066cc', borderBottom: '1px solid #e0e0e0', paddingBottom: 7 }}>{title}</span>
);

export const DataSheetPage: React.FC<{ app: HpApp }> = ({ app }) => {
  const { store } = app;
  const [pickerQuery, setPickerQuery] = useState('');

  const isLabelMode = app.dsMode === 'label';
  const dsp = (app.dsId && store ? store.byId.get(app.dsId) : null) ?? store?.all[0] ?? null;

  const pickerRows = useMemo(() => {
    if (!store) return [];
    const q = pickerQuery.trim().toLowerCase();
    const list = q.length >= 2
      ? store.all.filter(p => `${p.model} ${p.mfr} ${p.bafaId}`.toLowerCase().includes(q))
      : store.all;
    return list.slice(0, PICKER_LIMIT);
  }, [store, pickerQuery]);

  const sectionDefs: [DsSectionKey, string][] = isLabelMode
    ? [['identity', 'Product identity'], ['performance', 'Rated output & efficiency'], ['env', 'Acoustic & refrigerant'], ['source', 'Source & verification']]
    : [['identity', 'Product identification'], ['performance', 'Performance data'], ['env', 'Environmental & acoustic'], ['bafa', 'BAFA / funding status'], ['source', 'Source & verification']];

  const segStyle = (on: boolean): React.CSSProperties => ({
    padding: '6px 16px', fontSize: 12.5, cursor: 'pointer',
    ...(on ? { background: '#1d1d1f', color: '#fff', fontWeight: 600 } : { color: '#1d1d1f' }),
  });

  const typeLine = dsp
    ? `${dsp.raw.type ?? 'Luft / Wasser'}${dsp.installType !== '—' ? ` · ${dsp.installType}` : ''}`
    : '';

  return (
    <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', minHeight: 0, height: 'calc(100vh - 46px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 28px', borderBottom: '1px solid rgba(0,0,0,.08)', flex: 'none' }}>
        <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 600, letterSpacing: '-0.2px' }}>Data sheet studio</span>
        <div style={{ display: 'flex', border: '1px solid #e0e0e0', borderRadius: 999, overflow: 'hidden', fontSize: 12.5 }}>
          <span onClick={() => app.setDsMode('product')} style={segStyle(!isLabelMode)}>Product data sheet</span>
          <span onClick={() => app.setDsMode('label')} style={segStyle(isLabelMode)}>EU energy label sheet</span>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#7a7a7a' }}>Prints this month: {app.quota.used} / {app.quota.limit}</span>
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* picker + sections */}
        <div style={{ flex: '0 0 348px', borderRight: '1px solid rgba(0,0,0,.08)', display: 'flex', flexDirection: 'column', gap: 0, overflow: 'auto' }}>
          <div style={{ padding: '18px 20px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={sectionLabel}>1 · SELECT MODEL</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e0e0e0', borderRadius: 999, padding: '7px 14px', color: '#7a7a7a', fontSize: 12.5 }}>
              <SearchIcon size={12} stroke="currentColor" />
              <input
                value={pickerQuery}
                onChange={e => setPickerQuery(e.target.value)}
                placeholder="Search model…"
                style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 12.5, fontFamily: 'inherit', color: '#1d1d1f', padding: 0 }}
              />
            </div>
          </div>
          {/* Real catalog is 5,000+ models — the picker list scrolls in place so
              steps 2 · SECTIONS and 3 · EXPORT stay visible (3-step flow). */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 'none', maxHeight: 336, overflowY: 'auto' }}>
            {pickerRows.map(d => {
              const on = dsp?.id === d.id;
              return (
                <span
                  key={d.id}
                  onClick={() => app.setDsId(d.id)}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer',
                    ...(on ? { background: '#f5f5f7', boxShadow: 'inset 2px 0 0 #0066cc' } : {}),
                  }}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.model}</span>
                    <span style={{ fontSize: 11, color: '#7a7a7a' }}>{d.mfr} · {d.kw} kW · {d.label}</span>
                  </span>
                </span>
              );
            })}
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 11, borderTop: '1px solid rgba(0,0,0,.08)', marginTop: 8 }}>
            <span style={sectionLabel}>2 · INCLUDED SECTIONS</span>
            {sectionDefs.map(([key, label]) => {
              const on = app.dsSections[key];
              return (
                <span key={key} onClick={() => app.toggleDsSection(key)} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
                  <span style={{ flex: 'none', width: 32, height: 19, borderRadius: 999, position: 'relative', display: 'inline-block', transition: 'background .18s', background: on ? '#0066cc' : '#d2d2d7' }}>
                    <span style={{ position: 'absolute', top: 2, width: 15, height: 15, borderRadius: '50%', background: '#fff', transition: 'left .18s', left: on ? 15 : 2 }} />
                  </span>
                  {label}
                </span>
              );
            })}
          </div>
          <div style={{ padding: '14px 20px 22px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid rgba(0,0,0,.08)' }}>
            <span style={sectionLabel}>3 · EXPORT</span>
            <div style={{ display: 'flex', gap: 9 }}>
              <span className="hp-press" onClick={app.printSheet} style={pillPrimary}>Print ›</span>
              <span className="hp-press" onClick={app.printSheet} style={pillSecondary}>Download PDF</span>
            </div>
            <span style={{ fontSize: 11.5, color: '#7a7a7a', lineHeight: 1.5 }}>Sheets carry source references and the generation date — installer-ready documentation.</span>
          </div>
        </div>

        {/* preview */}
        <div style={{ flex: 1, background: '#f5f5f7', padding: 28, display: 'flex', justifyContent: 'center', overflow: 'auto' }}>
          {dsp && (
            <div className="hpiq-print-doc" style={{ width: 680, maxWidth: '100%', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '40px 44px', display: 'flex', flexDirection: 'column', gap: 0, height: 'fit-content', boxSizing: 'content-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 18 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontFamily: FD, fontSize: 21, fontWeight: 600, letterSpacing: '-0.28px' }}>HeatpumpIQ</span>
                  <span style={{ fontSize: 11, letterSpacing: '.08em', color: '#7a7a7a' }}>
                    {isLabelMode ? 'EU ENERGY LABEL INFORMATION SHEET — RESIDENTIAL' : 'TECHNICAL PRODUCT DATA SHEET — RESIDENTIAL'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'right', fontSize: 11, color: '#7a7a7a' }}>
                  <span>Generated {longDate(new Date().toISOString())}</span>
                  <span>BAFA {dsp.bafaId} · {dsp.eprelId}</span>
                  <span>Source snapshot {app.bafaSnapshotDate}</span>
                </div>
              </div>
              <div style={{ background: '#1d1d1f', color: '#fff', borderRadius: 8, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 600, letterSpacing: '-0.2px' }}>{dsp.model}</span>
                <span style={{ fontSize: 13, color: '#ccc' }}>{dsp.mfr} · air/water{dsp.installType !== '—' ? ` · ${dsp.installType.toLowerCase()}` : ''}</span>
              </div>

              {app.dsSections.identity && (
                <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 22 }}>
                  <SectionHead title="PRODUCT IDENTIFICATION" />
                  <FieldRow label="Manufacturer" value={dsp.mfr} />
                  <FieldRow label="Model" value={dsp.model} />
                  <FieldRow label="Outdoor unit" value={dsp.odu} />
                  <FieldRow label="Heat pump type" value={typeLine} />
                  <FieldRow label="BAFA ID" value={dsp.bafaId} />
                </div>
              )}

              {isLabelMode && (
                <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 22 }}>
                  <SectionHead title="EU ENERGY LABEL" />
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ flex: '0 0 92px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, border: '1px solid #e0e0e0', borderRadius: 8, padding: '12px 8px' }}>
                      <span style={{ fontSize: 8.5, letterSpacing: '.08em', color: '#7a7a7a' }}>ENERGY</span>
                      <span style={{ fontFamily: FD, fontSize: 27, fontWeight: 700 }}>{dsp.label}</span>
                      <span style={{ fontSize: 8.5, color: '#7a7a7a' }}>W35</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                      <span><span style={{ color: '#7a7a7a' }}>Seasonal space heating class (W35):</span> <strong style={{ fontWeight: 600 }}>{dsp.label}</strong></span>
                      <span><span style={{ color: '#7a7a7a' }}>Medium-temperature class (W55):</span> <strong style={{ fontWeight: 600 }}>{dsp.labelMed}</strong></span>
                      <span><span style={{ color: '#7a7a7a' }}>EPREL registration:</span> <strong style={{ fontWeight: 600 }}>{dsp.eprelId}</strong></span>
                      <span><span style={{ color: '#7a7a7a' }}>Product information sheet:</span> <strong style={{ fontWeight: 600 }}>{dsp.eprel ? 'Available' : '—'}</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {app.dsSections.performance && (
                <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 22 }}>
                  <SectionHead title="PERFORMANCE DATA" />
                  <FieldRow label="Heating capacity (55°C)" value={dsp.kw === '—' ? '—' : `${dsp.kw} kW`} />
                  <FieldRow label="COP (A7/W35)" value={dsp.cop7} />
                  <FieldRow label="COP (A2/W35)" value={dsp.cop2} />
                  <FieldRow label="COP (A−7/W35)" value={dsp.copm7} />
                  <FieldRow label="SCOP" value={dsp.scop} />
                </div>
              )}

              {app.dsSections.env && (
                <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 22 }}>
                  <SectionHead title="ENVIRONMENTAL & ACOUSTIC" />
                  <FieldRow label="Refrigerant" value={dsp.ref} />
                  <FieldRow label="Refrigerant amount" value={dsp.refKg === '—' ? '—' : `${dsp.refKg} kg`} />
                  <FieldRow label="Sound power level (outdoor)" value={dsp.noise === '—' ? '—' : `${dsp.noise} dB(A)`} />
                  <FieldRow label="Grid ready (SG Ready)" value={dsp.raw.grid_ready ? 'Yes / Ja' : 'No / Nein'} />
                </div>
              )}

              {app.dsSections.bafa && !isLabelMode && (
                <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 22 }}>
                  <SectionHead title="BAFA / FUNDING STATUS" />
                  <FieldRow label="BAFA list status" value={`Listed (snapshot ${app.bafaSnapshotDate})`} />
                  <FieldRow label="BEG EM relevance" value="Potentially eligible — verify" />
                </div>
              )}

              {app.dsSections.source && (
                <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 22 }}>
                  <SectionHead title="SOURCE & VERIFICATION" muted />
                  <span style={{ fontSize: 11.5, color: '#7a7a7a', lineHeight: 1.6, paddingTop: 9 }}>
                    Data compiled from BAFA source snapshot ({app.bafaSnapshotDate}) and EPREL-style records ({app.eprelSyncDate}). This sheet is generated documentation, not an official certificate. Verify current BAFA eligibility and the official EU energy label before contractual use.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
