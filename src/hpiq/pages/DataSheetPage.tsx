/** Data sheet studio — two modes, model picker, section toggles, live preview. */
import React, { useMemo, useState } from 'react';
import { HpApp, DsSectionKey } from '../appState';
import { longDate } from '../model';
import { FD, SearchIcon, pillPrimary, pillSecondary, sectionLabel } from '../ui';
import { tr } from '../i18n';

const PICKER_LIMIT = 60;

const MONO = 'ui-monospace, Menlo, monospace';

const FieldRow: React.FC<{ label: string; value: string; note?: number }> = ({ label, value, note }) => (
  <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '9px 0', borderBottom: '1px solid #f0f0f0' }}>
    <span style={{ color: '#7a7a7a' }}>
      {note != null && <span style={{ fontFamily: MONO, fontSize: 10, color: '#b6b6bc', marginRight: 7 }}>[{note}]</span>}
      {label}
    </span>
    <span style={{ fontWeight: 600 }}>{value}</span>
  </span>
);

/** Official EU energy label arrow scale (space heaters, A+++…D) with the
 *  product's W35 class marked. Colors follow the EU label design CI. */
const EU_SCALE: [string, string, string][] = [
  ['A+++', '#009036', '#fff'],
  ['A++',  '#52ae32', '#fff'],
  ['A+',   '#c8d400', '#1d1d1f'],
  ['A',    '#ffed00', '#1d1d1f'],
  ['B',    '#fbba00', '#1d1d1f'],
  ['C',    '#eb6909', '#fff'],
  ['D',    '#e2001a', '#fff'],
];

const EnergyScale: React.FC<{ current: string; caption: string }> = ({ current, caption }) => (
  <div style={{ flex: '0 0 250px', display: 'flex', flexDirection: 'column', gap: 5 }}>
    {EU_SCALE.map(([cls, bg, fg], i) => {
      const active = cls === current;
      return (
        <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: 10, height: 21 }}>
          <span style={{
            width: `${42 + i * 8}%`, height: '100%', background: bg, color: fg,
            clipPath: 'polygon(0 0, calc(100% - 9px) 0, 100% 50%, calc(100% - 9px) 100%, 0 100%)',
            display: 'inline-flex', alignItems: 'center', paddingLeft: 8,
            fontSize: 11, fontWeight: 700, letterSpacing: '.02em', boxSizing: 'border-box',
          }}>
            {cls}
          </span>
          {active && (
            <span style={{
              background: '#1d1d1f', color: '#fff', height: '100%', padding: '0 10px 0 16px',
              clipPath: 'polygon(9px 0, 100% 0, 100% 100%, 9px 100%, 0 50%)',
              display: 'inline-flex', alignItems: 'center', fontSize: 11.5, fontWeight: 700,
            }}>
              {cls}
            </span>
          )}
        </div>
      );
    })}
    <span style={{ fontSize: 10.5, color: '#7a7a7a', lineHeight: 1.5, marginTop: 6 }}>
      {caption}
    </span>
  </div>
);

const SectionHead: React.FC<{ title: string; muted?: boolean }> = ({ title, muted }) => (
  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', color: muted ? '#7a7a7a' : '#0066cc', borderBottom: '1px solid #e0e0e0', paddingBottom: 7 }}>{title}</span>
);

export const DataSheetPage: React.FC<{ app: HpApp }> = ({ app }) => {
  const t = tr(app.lang);
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
    ? [['identity', t.ds.sections.identityL], ['performance', t.ds.sections.perfL], ['env', t.ds.sections.envL], ['source', t.ds.sections.source]]
    : [['identity', t.ds.sections.identityP], ['performance', t.ds.sections.perfP], ['env', t.ds.sections.envP], ['physical', t.ds.sections.physical], ['bafa', t.ds.sections.bafa], ['source', t.ds.sections.source]];

  // Footnote numbering — assigned in render order, so only sections that are
  // actually shown contribute entries to TECHNICAL EXPLANATIONS below.
  const noteOrder: string[] = [];
  const n = (key: string): number => {
    let i = noteOrder.indexOf(key);
    if (i === -1) { noteOrder.push(key); i = noteOrder.length - 1; }
    return i + 1;
  };

  const dims = dsp && dsp.raw.width_mm && dsp.raw.height_mm && dsp.raw.depth_mm
    ? `${dsp.raw.width_mm} × ${dsp.raw.height_mm} × ${dsp.raw.depth_mm} mm`
    : '—';
  const weightTxt = dsp?.raw.weight_kg ? `${dsp.raw.weight_kg} kg` : '—';

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
        <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 600, letterSpacing: '-0.2px' }}>{t.ds.title}</span>
        <div style={{ display: 'flex', border: '1px solid #e0e0e0', borderRadius: 999, overflow: 'hidden', fontSize: 12.5 }}>
          <span onClick={() => app.setDsMode('product')} style={segStyle(!isLabelMode)}>{t.ds.modeProduct}</span>
          <span onClick={() => app.setDsMode('label')} style={segStyle(isLabelMode)}>{t.ds.modeLabel}</span>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#7a7a7a' }}>{t.ds.prints(app.quota.used, app.quota.limit)}</span>
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* picker + sections */}
        <div style={{ flex: '0 0 348px', borderRight: '1px solid rgba(0,0,0,.08)', display: 'flex', flexDirection: 'column', gap: 0, overflow: 'auto' }}>
          <div style={{ padding: '18px 20px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={sectionLabel}>{t.ds.step1}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e0e0e0', borderRadius: 999, padding: '7px 14px', color: '#7a7a7a', fontSize: 12.5 }}>
              <SearchIcon size={12} stroke="currentColor" />
              <input
                value={pickerQuery}
                onChange={e => setPickerQuery(e.target.value)}
                placeholder={t.ds.searchPlaceholder}
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
            <span style={sectionLabel}>{t.ds.step2}</span>
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
            <span style={sectionLabel}>{t.ds.step3}</span>
            <div style={{ display: 'flex', gap: 9 }}>
              <span className="hp-press" onClick={app.printSheet} style={pillPrimary}>{t.ds.printBtn}</span>
              <span className="hp-press" onClick={app.printSheet} style={pillSecondary}>{t.ds.pdfBtn}</span>
            </div>
            <span style={{ fontSize: 11.5, color: '#7a7a7a', lineHeight: 1.5 }}>{t.ds.exportNote}</span>
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
                    {isLabelMode ? t.ds.docKindLabel : t.ds.docKindProduct}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'right', fontSize: 11, color: '#7a7a7a' }}>
                  <span>{t.ds.generated} {longDate(new Date().toISOString())}</span>
                  <span>BAFA {dsp.bafaId} · {dsp.eprelId}</span>
                </div>
              </div>
              <div style={{ background: '#1d1d1f', color: '#fff', borderRadius: 8, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 600, letterSpacing: '-0.2px' }}>{dsp.model}</span>
                <span style={{ fontSize: 13, color: '#ccc' }}>{dsp.mfr} · {t.ds.airWater}{dsp.installType !== '—' ? ` · ${dsp.installType.toLowerCase()}` : ''}</span>
              </div>

              {app.dsSections.identity && (
                <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 22 }}>
                  <SectionHead title={t.ds.headIdentity} />
                  <FieldRow label={t.ds.f.manufacturer} value={dsp.mfr} note={n('manufacturer')} />
                  <FieldRow label={t.ds.f.model} value={dsp.model} note={n('model')} />
                  <FieldRow label={t.ds.f.odu} value={dsp.odu} note={n('odu')} />
                  <FieldRow label={t.ds.f.type} value={typeLine} note={n('type')} />
                  <FieldRow label={t.ds.f.bafaId} value={dsp.bafaId} note={n('bafaId')} />
                </div>
              )}

              {isLabelMode && (
                <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 22 }}>
                  <SectionHead title={t.ds.headEuLabel} />
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ flex: '0 0 92px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, border: '1px solid #e0e0e0', borderRadius: 8, padding: '12px 8px' }}>
                      <span style={{ fontSize: 8.5, letterSpacing: '.08em', color: '#7a7a7a' }}>ENERGY</span>
                      <span style={{ fontFamily: FD, fontSize: 27, fontWeight: 700 }}>{dsp.label}</span>
                      <span style={{ fontSize: 8.5, color: '#7a7a7a' }}>W35</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                      <span><span style={{ fontFamily: MONO, fontSize: 10, color: '#b6b6bc', marginRight: 7 }}>[{n('classW35')}]</span><span style={{ color: '#7a7a7a' }}>{t.ds.f.clsW35}</span> <strong style={{ fontWeight: 600 }}>{dsp.label}</strong></span>
                      <span><span style={{ fontFamily: MONO, fontSize: 10, color: '#b6b6bc', marginRight: 7 }}>[{n('classW55')}]</span><span style={{ color: '#7a7a7a' }}>{t.ds.f.clsW55}</span> <strong style={{ fontWeight: 600 }}>{dsp.labelMed}</strong></span>
                      <span><span style={{ fontFamily: MONO, fontSize: 10, color: '#b6b6bc', marginRight: 7 }}>[{n('eprelReg')}]</span><span style={{ color: '#7a7a7a' }}>{t.ds.f.eprelReg}</span> <strong style={{ fontWeight: 600 }}>{dsp.eprelId}</strong></span>
                      <span><span style={{ color: '#7a7a7a', marginLeft: 25 }}>{t.ds.f.infoSheet}</span> <strong style={{ fontWeight: 600 }}>{dsp.eprel ? t.ds.f.available : '—'}</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {app.dsSections.performance && (
                <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 22 }}>
                  <SectionHead title={t.ds.headPerf} />
                  <FieldRow label={t.ds.f.kw55} value={dsp.kw === '—' ? '—' : `${dsp.kw} kW`} note={n('kw55')} />
                  <FieldRow label={t.ds.f.cop7} value={dsp.cop7} note={n('cop7')} />
                  <FieldRow label={t.ds.f.cop2} value={dsp.cop2} note={n('cop2')} />
                  <FieldRow label={t.ds.f.copm7} value={dsp.copm7} note={n('copm7')} />
                  <FieldRow label={t.ds.f.scop} value={dsp.scop} note={n('scop')} />
                </div>
              )}

              {app.dsSections.env && (
                <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 22 }}>
                  <SectionHead title={t.ds.headEnv} />
                  <FieldRow label={t.ds.f.ref} value={dsp.ref} note={n('ref')} />
                  <FieldRow label={t.ds.f.refKg} value={dsp.refKg === '—' ? '—' : `${dsp.refKg} kg`} note={n('refKg')} />
                  <FieldRow label={t.ds.f.noise} value={dsp.noise === '—' ? '—' : `${dsp.noise} dB(A)`} note={n('noise')} />
                  <FieldRow label={t.ds.f.grid} value={dsp.raw.grid_ready ? t.ds.f.yes : t.ds.f.no} note={n('grid')} />
                </div>
              )}

              {app.dsSections.physical && !isLabelMode && (
                <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 22 }}>
                  <SectionHead title={t.ds.headPhysical} />
                  <FieldRow label={t.ds.f.dims} value={dims} note={n('dims')} />
                  <FieldRow label={t.ds.f.weight} value={weightTxt} note={n('weight')} />
                </div>
              )}

              {app.dsSections.bafa && !isLabelMode && (
                <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 22 }}>
                  <SectionHead title={t.ds.headBafa} />
                  <FieldRow
                    label={t.ds.f.bafaStatus}
                    value={(dsp.raw.bafa_listing_status ?? 'listed_in_snapshot') === 'listed_in_snapshot' ? t.ds.f.listed : t.ds.f.notListed}
                    note={n('bafaStatus')}
                  />
                  <FieldRow label={t.ds.f.begRel} value={t.ds.f.begVerify} note={n('begRel')} />
                </div>
              )}

              {app.dsSections.source && (
                <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 22 }}>
                  <SectionHead title={t.ds.headSource} muted />
                  <span style={{ fontSize: 11.5, color: '#7a7a7a', lineHeight: 1.6, paddingTop: 9 }}>
                    {t.ds.sourceText}
                  </span>
                </div>
              )}

              {/* ── Technical explanations (+ EU label scale in label mode) — always printed ── */}
              <div style={{ borderTop: '1px solid #e0e0e0', marginTop: 26, paddingTop: 20, display: 'flex', gap: 28, alignItems: 'flex-start' }}>
                {isLabelMode && (
                  <EnergyScale current={dsp.label} caption={t.ds.scaleCaption(dsp.label, dsp.labelMed)} />
                )}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', color: '#7a7a7a', paddingBottom: 8 }}>{t.ds.techExplanations}</span>
                  {noteOrder.map((key, i) => (
                    <span key={key} style={{ display: 'flex', gap: 8, fontSize: 10.5, color: '#7a7a7a', lineHeight: 1.55, padding: '2.5px 0' }}>
                      <span style={{ fontFamily: MONO, fontSize: 9.5, color: '#b6b6bc', flex: 'none', paddingTop: 1 }}>[{i + 1}]</span>
                      <span>{t.ds.notes[key]}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* ── Legal disclaimer — always printed ── */}
              <div style={{ borderTop: '1px solid #e0e0e0', marginTop: 20, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', color: '#7a7a7a' }}>{t.ds.disclaimerTitle}</span>
                <span style={{ fontSize: 9.5, color: '#9a9aa0', lineHeight: 1.65, textAlign: 'justify' }}>
                  {t.ds.disclaimer}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
