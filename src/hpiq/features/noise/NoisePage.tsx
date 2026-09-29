/**
 * Noise check (Premium calculator, 2026-09-29) — workspace group.
 *
 * Estimates the outdoor unit's sound pressure at the neighbour's window from
 * sound power, placement (Q), screening and distance (noiseModel.ts), and judges
 * it against the edition's rule (market.ts NOISE_REGIME: DE TA Lärm night value,
 * GB MCS 020 a) 37.0 dB(A); FR/PL/IT distance table only). The dataset's sound
 * power respects the plausibility rules (a removed value is never used — the
 * user enters the manufacturer's). Customer PDF via noisePdf.ts + deliverPdf.
 * Standard accounts see a teaser and the upgrade prompt.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { HpApp } from '../../appState';
import { HpVM } from '../../model';
import { tr } from '../../i18n';
import { FD, sectionLabel, CheckBox } from '../../ui';
import { PremiumPill } from '../../Premium';
import { QaMark, QA_RED } from '../../QaMark';
import { NOISE_REGIME } from '../../market';
import { downloadPdf, printPdfViaShareSheet } from '../../pdf/deliverPdf';
import { isIos } from '../../pwaInstall';
import { WorkspaceTabs } from '../WorkspaceTabs';
import { peekToolTarget, takeToolTarget } from '../toolTarget';
import { brandingStrings } from '../branding/strings';
import {
  PREPARED_FOR_MAX, pdfBrandingFor, savedBranding, setDocBrandingOptions, useDocBrandingOptions,
} from '../branding/brandingState';
import { Switch } from '../branding/BrandingBandView';
import {
  DE_AREAS, DeArea, Placement, Screening, TA_LAERM, evaluateNoise, hasVerdict, limitDecimals, offersTonality, usesAreaType,
  validDistance, validLw,
} from './noiseModel';
import { formulaLine, noiseStrings, regimeStrings } from './strings';
import { VERDICT_RGB, buildNoisePdf, noisePdfFileName } from './noisePdf';

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e0e0e0', borderRadius: 18, padding: '18px 20px',
  display: 'flex', flexDirection: 'column', gap: 14, boxSizing: 'border-box', minWidth: 0,
};
const label: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, fontWeight: 600, color: '#3a3a3c' };
const input: React.CSSProperties = {
  border: '1px solid #d2d2d7', borderRadius: 10, padding: '9px 12px', fontSize: 14, outline: 'none',
  fontFamily: 'inherit', background: '#fff', width: '100%', boxSizing: 'border-box', minWidth: 0,
};
const hint: React.CSSProperties = { fontSize: 11.5, fontWeight: 400, color: '#7a7a7a', lineHeight: 1.45 };
const rgb = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;

const parseNum = (s: string): number | null => {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return isFinite(n) ? n : null;
};

/** Pill radio group. */
function Choice<T extends string>({ value, options, onChange, testId }: {
  value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; testId: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-testid={testId}>
      {options.map(o => {
        const on = o.id === value;
        return (
          <span key={o.id} className="hp-press" role="radio" aria-checked={on} data-testid={`${testId}-${o.id}`}
            onClick={() => onChange(o.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
              fontSize: 13, fontWeight: on ? 600 : 400, border: `1px solid ${on ? '#0066cc' : '#e0e0e0'}`,
              background: on ? '#eef5fd' : '#fff', color: '#1d1d1f',
            }}>
            <span style={{ flex: 'none', width: 14, height: 14, borderRadius: '50%', border: on ? '4.5px solid #0066cc' : '1.5px solid #9a9aa0', boxSizing: 'border-box', background: '#fff' }} />
            {o.label}
          </span>
        );
      })}
    </div>
  );
}

export const NoisePage: React.FC<{ app: HpApp }> = ({ app }) => {
  const s = noiseStrings(app.lang);
  const rs = regimeStrings(NOISE_REGIME, app.lang);
  const t = tr(app.lang);
  const bs = brandingStrings(app.lang);
  const store = app.allStore ?? app.store;
  const opts = useDocBrandingOptions();

  // Peek in the initializer (StrictMode runs it twice), consume once mounted.
  const [productId, setProductId] = useState<string | null>(() => peekToolTarget());
  useEffect(() => { takeToolTarget(); }, []);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [override, setOverride] = useState('');
  const [distance, setDistance] = useState('5');
  const [placement, setPlacement] = useState<Placement>('wall');
  const [screening, setScreening] = useState<Screening>('none');
  const [area, setArea] = useState<DeArea>('general');
  // LAI-Leitfaden Tab. 4: if nothing is known about tonality, use 3 dB → on by default.
  const [tonal, setTonal] = useState(true);

  const v: HpVM | null = productId ? store?.byId.get(productId) ?? null : null;
  const f1 = (x: number) => x.toLocaleString(t.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const ld = limitDecimals(NOISE_REGIME);
  const fLim = (x: number) => x.toLocaleString(t.locale, { minimumFractionDigits: ld, maximumFractionDigits: ld });

  /* Sound power: dataset (plausibility-clean) unless the user enters one. */
  const rawLw = v?.raw.noise_outdoor_dB;
  const removed = !!v && v.qaRemoved.includes('noise_outdoor_dB');
  const datasetLw = !removed && validLw(rawLw) ? rawLw : null;
  const flaggedLw = !!v && v.qaFlags.includes('noise_outdoor_dB');
  const overrideNum = parseNum(override);
  const overrideValid = validLw(overrideNum);
  const lw = overrideValid ? overrideNum : datasetLw;
  const lwFromOverride = overrideValid;
  const dist = parseNum(distance);
  const distOk = validDistance(dist);

  const result = useMemo(
    () => (lw != null && distOk ? evaluateNoise(NOISE_REGIME, { lw, distance: dist!, placement, screening, area, tonal }) : null),
    [lw, distOk, dist, placement, screening, area, tonal],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!store || q.length < 2) return [];
    const out: HpVM[] = [];
    for (const x of store.all) {
      if (`${x.mfr} ${x.model} ${x.odu}`.toLowerCase().includes(q)) out.push(x);
      if (out.length >= 8) break;
    }
    return out;
  }, [store, query]);

  const header = (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontFamily: FD, fontSize: 28, fontWeight: 600, letterSpacing: '-0.3px' }}>
          {t.nav.noise}{!app.premium && <PremiumPill app={app} />}
        </span>
        <span style={{ fontSize: 14, color: '#6e6e73', lineHeight: 1.55, maxWidth: 720 }}>{s.sub}</span>
      </div>
    </>
  );
  const disclaimerBar = (
    <div data-testid="noise-disclaimer" style={{ fontSize: 13, fontWeight: 650, color: '#1d1d1f', background: '#fff', border: '1px solid #d2d2d7', borderRadius: 12, padding: '10px 14px' }}>
      {s.disclaimer}
    </div>
  );
  const shell = (children: React.ReactNode) => (
    <div data-testid="noise-page" style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: '#f5f5f7' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(18px, 4vw, 36px) clamp(16px, 4vw, 32px) 48px', display: 'flex', flexDirection: 'column', gap: 18, boxSizing: 'border-box' }}>
        {header}
        {children}
      </div>
    </div>
  );

  /* ── Standard: teaser ─────────────────────────────────────────────────── */
  if (!app.premium) {
    return shell(
      <>
        <div style={{ ...card, gap: 10 }} data-testid="noise-teaser">
          <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 700 }}>{s.teaserTitle}</span>
          <span style={{ fontSize: 14, color: '#3a3a3c', lineHeight: 1.6 }}>{s.teaserBody}</span>
          <span className="hp-press" onClick={() => app.upsell()} data-testid="noise-upsell"
            style={{ alignSelf: 'flex-start', marginTop: 4, borderRadius: 999, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', background: '#0071e3', color: '#fff' }}>
            {s.upgrade}
          </span>
        </div>
        {disclaimerBar}
      </>,
    );
  }

  /* ── PDF ──────────────────────────────────────────────────────────────── */
  const inputRows = (): [string, string][] => {
    const rows: [string, string][] = [];
    rows.push([s.product, v ? `${v.mfr} · ${v.model}` : s.pdfManual]);
    if (lw != null) rows.push([s.lwUsed, `${f1(lw)} dB(A) — ${lwFromOverride ? s.lwSourceOverride : s.lwSourceDataset}`]);
    if (lwFromOverride && datasetLw != null) rows.push([s.lwDataset, `${f1(datasetLw)} dB(A)`]);
    rows.push([s.distance, dist != null ? f1(dist) : '—']);
    rows.push([s.placement, s.placements[placement]]);
    rows.push([s.screening, s.screenings[screening]]);
    if (usesAreaType(NOISE_REGIME) && rs.area && rs.areas && rs.nightValue) {
      rows.push([rs.area, `${rs.areas[area]} — ${rs.nightValue(String(TA_LAERM[area].night))}`]);
    }
    if (offersTonality(NOISE_REGIME) && rs.tonal) rows.push([rs.tonal, tonal ? '+3 dB' : '0 dB']);
    return rows;
  };
  const createPdf = () => {
    if (!result || lw == null || dist == null) return;
    try {
      const doc = buildNoisePdf({
        t, s, rs, regime: NOISE_REGIME, result,
        product: v ? { mfr: v.mfr, model: v.model, qaCheck: v.qaCheck } : null,
        inputs: inputRows(),
        distance: dist,
        formula: formulaLine(f1(lw), result.q, f1(dist), result.barrierDb, result.surchargeDb),
        f1,
        fLim,
        branding: pdfBrandingFor(app.user, app.premium, app.lang, opts),
      });
      const name = noisePdfFileName(v?.model);
      if (isIos()) printPdfViaShareSheet(doc, name).catch(() => app.notify(s.pdfFailed));
      else downloadPdf(doc, name);
    } catch {
      app.notify(s.pdfFailed);
    }
  };
  const saved = savedBranding(app.user);

  /* ── Inputs ───────────────────────────────────────────────────────────── */
  const productCard = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={sectionLabel}>{s.product.toUpperCase()}</span>
      {v && !picking ? (
        <div data-testid="noise-product" style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f5f5f7', borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 12, color: '#6e6e73' }}>{v.mfr}</span>
            <span style={{ fontSize: 14.5, fontWeight: 650, overflowWrap: 'anywhere' }}>{v.model}<QaMark v={v} lang={app.lang} size={14} /></span>
          </div>
          <span className="hp-press" data-testid="noise-change" onClick={() => { setPicking(true); setQuery(''); }} style={{ fontSize: 12.5, color: '#0066cc', cursor: 'pointer', whiteSpace: 'nowrap' }}>{s.change}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input data-testid="noise-search" autoFocus={picking} value={query} onChange={e => setQuery(e.target.value)} placeholder={s.searchPh} style={input} />
          {query.trim().length >= 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #e0e0e0', borderRadius: 10, overflow: 'hidden' }}>
              {matches.length === 0 && <span style={{ fontSize: 12.5, color: '#7a7a7a', padding: '9px 12px' }}>{s.noMatches}</span>}
              {matches.map(m => (
                <span key={m.id} className="hp-press" data-testid="noise-match" onClick={() => { setProductId(m.id); setPicking(false); setQuery(''); setOverride(''); }}
                  style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                  <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}><span style={{ color: '#6e6e73' }}>{m.mfr}</span> · {m.model}</span>
                  <span style={{ color: '#6e6e73', whiteSpace: 'nowrap' }}>{/^\d/.test(m.noise) ? `${m.noise} dB(A)` : '—'}</span>
                </span>
              ))}
            </div>
          )}
          {!v && <span style={hint}>{s.noProduct}</span>}
          {v && picking && <span className="hp-press" onClick={() => setPicking(false)} style={{ fontSize: 12.5, color: '#0066cc', cursor: 'pointer', alignSelf: 'flex-start' }}>✕</span>}
        </div>
      )}
    </div>
  );

  const needManual = datasetLw == null;
  const lwBlock = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {v && (
        <div data-testid="noise-lw-dataset" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#3a3a3c' }}>{s.lwDataset}</span>
          {datasetLw != null ? (
            <span style={{ fontSize: 20, fontWeight: 700, color: flaggedLw ? QA_RED : '#1d1d1f' }}>{f1(datasetLw)} <span style={{ fontSize: 13, fontWeight: 500, color: '#6e6e73' }}>dB(A)</span></span>
          ) : (
            <span data-testid={removed ? 'noise-lw-removed' : 'noise-lw-none'} style={{ fontSize: 12.5, color: removed ? QA_RED : '#a15c00', lineHeight: 1.5, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              {removed && <QaMark v={v} lang={app.lang} size={14} />}
              {removed ? s.lwRemoved : s.lwNone}
            </span>
          )}
          {v.qaCheck && datasetLw != null && <span style={{ ...hint, color: QA_RED }}>{s.lwFlagged}</span>}
        </div>
      )}
      <label style={label}>
        {s.override}
        <input data-testid="noise-override" inputMode="decimal" value={override} onChange={e => setOverride(e.target.value)} placeholder={s.overridePh}
          style={{ ...input, borderColor: needManual && !overrideValid ? '#a15c00' : override && !overrideValid ? QA_RED : '#d2d2d7' }} />
        <span style={hint}>{s.overrideHint}</span>
        {needManual && !overrideValid && <span style={{ ...hint, color: '#a15c00', fontWeight: 600 }}>{s.overrideRequired}</span>}
        {override.trim() && !overrideValid && <span style={{ ...hint, color: QA_RED }}>{s.lwInvalid}</span>}
      </label>
    </div>
  );

  const tonalityOn = offersTonality(NOISE_REGIME);
  const inputsCard = (
    <div style={{ ...card, flex: '1 1 380px' }} data-testid="noise-inputs">
      <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 700 }}>{s.inputs}</span>
      {productCard}
      {lwBlock}
      <label style={label}>
        {s.distance}
        <input data-testid="noise-distance" inputMode="decimal" value={distance} onChange={e => setDistance(e.target.value)} style={{ ...input, maxWidth: 160, borderColor: distOk ? '#d2d2d7' : QA_RED }} />
        <span style={hint}>{rs.distanceHint}</span>
        {!distOk && <span style={{ ...hint, color: QA_RED }}>{s.distanceInvalid}</span>}
      </label>
      <div style={label}>
        {s.placement}
        <Choice<Placement> testId="noise-placement" value={placement} onChange={setPlacement}
          options={(['free', 'wall', 'corner'] as Placement[]).map(id => ({ id, label: s.placements[id] }))} />
      </div>
      <div style={label}>
        {s.screening}
        <Choice<Screening> testId="noise-screening" value={screening} onChange={setScreening}
          options={(['none', 'partial', 'full'] as Screening[]).map(id => ({ id, label: s.screenings[id] }))} />
      </div>
      {usesAreaType(NOISE_REGIME) && rs.areas && rs.nightValue && (
        <label style={label}>
          {rs.area}
          <select data-testid="noise-area" value={area} onChange={e => setArea(e.target.value as DeArea)} style={input}>
            {DE_AREAS.map(a => <option key={a} value={a}>{rs.areas![a]}</option>)}
          </select>
          <span data-testid="noise-area-night" style={{ ...hint, fontWeight: 600, color: '#3a3a3c' }}>{rs.limitLine!(String(TA_LAERM[area].night))}</span>
        </label>
      )}
      {tonalityOn && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => setTonal(x => !x)} data-testid="noise-tonal">
          <CheckBox on={tonal} size={17} style={{ marginTop: 1 }} />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{rs.tonal}</span>
            <span style={hint}>{rs.tonalHint}</span>
          </span>
        </div>
      )}
    </div>
  );

  /* ── Result ───────────────────────────────────────────────────────────── */
  const vc = VERDICT_RGB[result?.verdict ?? 'none'];
  const resultCard = (
    <div style={{ ...card, flex: '1 1 400px' }} data-testid="noise-result">
      <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 700 }}>{s.result}</span>
      {!result ? (
        <span style={{ fontSize: 14, color: '#6e6e73' }}>{s.needLw}</span>
      ) : (
        <>
          <div style={{ background: rgb(vc.bg), borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ ...sectionLabel, color: '#6e6e73' }}>{s.atDistance(f1(dist!)).toUpperCase()}</span>
            <span data-testid="noise-lp" style={{ fontFamily: FD, fontSize: 48, fontWeight: 700, lineHeight: 1, color: rgb(vc.fg) }}>
              {f1(result.lp)} <span style={{ fontSize: 18, fontWeight: 600 }}>dB(A)</span>
            </span>
            {result.verdict && rs.verdict && rs.verdictBody && (
              <>
                <span data-testid="noise-verdict" data-verdict={result.verdict} style={{ fontSize: 16, fontWeight: 700, color: rgb(vc.fg) }}>{rs.verdict[result.verdict]}</span>
                <span style={{ fontSize: 13, color: '#3a3a3c', lineHeight: 1.55 }}>{rs.verdictBody[result.verdict]}</span>
              </>
            )}
            {!hasVerdict(NOISE_REGIME) && rs.noVerdict && (
              <span data-testid="noise-noverdict" style={{ fontSize: 13, color: '#3a3a3c', lineHeight: 1.55 }}>{rs.noVerdict}</span>
            )}
          </div>
          {(result.limit != null || result.rLimit != null) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, lineHeight: 1.5 }} data-testid="noise-limits">
              {result.limit != null && rs.limitLine && <span>{rs.limitLine(fLim(result.limit))}</span>}
              {result.target != null && rs.targetLine && <span>{rs.targetLine(fLim(result.target))}</span>}
              {result.rLimit != null && rs.rLimitLine && <span style={{ fontWeight: 650 }} data-testid="noise-rmin">{rs.rLimitLine(f1(result.rLimit))}</span>}
              {result.rTarget != null && rs.rTargetLine && <span style={{ fontWeight: 650 }}>{rs.rTargetLine(f1(result.rTarget))}</span>}
            </div>
          )}
          {rs.reference && (
            <div data-testid="noise-reference" style={{ fontSize: 12.5, lineHeight: 1.5, color: '#a15c00', background: '#fff4e5', borderRadius: 10, padding: '9px 12px', fontWeight: 600 }}>{rs.reference}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={sectionLabel}>{s.tableTitle.toUpperCase()}</span>
            <div data-testid="noise-table" style={{ display: 'grid', gridTemplateColumns: `repeat(${result.table.length + 1}, minmax(0, 1fr))`, border: '1px solid #e0e0e0', borderRadius: 10, overflow: 'hidden', fontSize: 13 }}>
              {[...result.table.map(r => ({ ...r, yours: false })), { r: dist!, lp: result.lp, yours: true }].map((row, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 4px', borderLeft: i ? '1px solid #eee' : undefined, background: row.yours ? '#eef5fd' : '#fff' }}>
                  <span style={{ fontSize: 11.5, color: '#6e6e73', textAlign: 'center' }}>{f1(row.r)} m{row.yours ? <><br />{s.yours}</> : null}</span>
                  <span style={{ fontWeight: 700 }}>{f1(row.lp)}</span>
                </div>
              ))}
            </div>
          </div>
          <details style={{ fontSize: 12.5, color: '#3a3a3c', lineHeight: 1.55 }} data-testid="noise-formula">
            <summary style={{ cursor: 'pointer', fontWeight: 650 }}>{s.formulaTitle}</summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              <code style={{ fontSize: 12, background: '#f5f5f7', borderRadius: 8, padding: '6px 10px', overflowWrap: 'anywhere' }}>
                {formulaLine(f1(lw!), result.q, f1(dist!), result.barrierDb, result.surchargeDb)} = {f1(result.lp)} dB(A)
              </code>
              <span>{s.formulaBody}</span>
              <span style={{ fontWeight: 650 }}>{s.assumptionsTitle}</span>
              <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc' }}>{s.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
              <span style={{ fontWeight: 650 }}>{s.sources}</span>
              <span style={{ color: '#6e6e73' }}>{rs.source}</span>
            </div>
          </details>

          {/* Customer PDF */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid #eee', paddingTop: 14 }}>
            <label style={label}>
              {bs.preparedForLabel}
              <input data-testid="noise-prepared-for" value={opts.preparedFor} maxLength={PREPARED_FOR_MAX}
                onChange={e => setDocBrandingOptions({ preparedFor: e.target.value })} placeholder={bs.preparedForPh} style={input} />
            </label>
            <span onClick={() => { if (saved) setDocBrandingOptions({ enabled: !opts.enabled }); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: saved ? 'pointer' : 'default', color: saved ? '#1d1d1f' : '#9a9aa0' }}>
              <Switch on={!!saved && opts.enabled} disabled={!saved} />
              {bs.toggle}
            </span>
            {!saved && (
              <span style={{ fontSize: 11.5, color: '#7a7a7a', marginTop: -6 }}>
                {bs.noBranding}{' '}
                <span onClick={() => app.go('account')} style={{ color: '#0066cc', cursor: 'pointer' }}>{bs.setUp}</span>
              </span>
            )}
            <span className="hp-press" data-testid="noise-pdf" onClick={createPdf}
              style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, background: '#1d1d1f', color: '#fff', borderRadius: 999, padding: '10px 18px', fontSize: 13.5, fontWeight: 650, cursor: 'pointer' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
              </svg>
              {s.pdfBtn}
            </span>
          </div>
        </>
      )}
    </div>
  );

  return shell(
    <>
      {disclaimerBar}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
        {inputsCard}
        {resultCard}
      </div>
    </>,
  );
};
