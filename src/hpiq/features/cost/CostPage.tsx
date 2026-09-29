/**
 * Running cost & CO₂ (Premium feature 6, owner-approved 2026-09-29).
 *
 * Workspace group page. Pick a model (preselected from the product detail via
 * toolTarget, or searched in the FULL catalogue app.allStore), a flow
 * temperature and the heat demand (direct, or floor area × building standard);
 * energy prices and CO₂ factors start from the market defaults
 * (src/config/energyDefaults.json — public statistics, refreshed twice a year,
 * docs/ENERGY_DEFAULTS.md) and are all editable. The maths is the pure
 * costModel.ts. Output: cards + an inline SVG bar comparison + a customer PDF
 * (costPdf.ts, optional installer band). Standard sees a teaser → app.upsell().
 * Every state carries the "Estimate" disclaimer.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { HpApp } from '../../appState';
import { HpVM } from '../../model';
import { tr } from '../../i18n';
import { FD, pillPrimary, pillSecondary, sectionLabel } from '../../ui';
import { PremiumPill } from '../../Premium';
import { QaMark } from '../../QaMark';
import { MARKET, SOURCE_ID_ABBR } from '../../market';
import { isIos } from '../../pwaInstall';
import { downloadPdf, printPdfViaShareSheet } from '../../pdf/deliverPdf';
import { WorkspaceTabs } from '../WorkspaceTabs';
import { peekToolTarget, takeToolTarget } from '../toolTarget';
import { brandingStrings } from '../branding/strings';
import { PREPARED_FOR_MAX, pdfBrandingFor, savedBranding, setDocBrandingOptions, useDocBrandingOptions } from '../branding/brandingState';
import { Switch } from '../branding/BrandingBandView';
import defaultsJson from '../../../config/energyDefaults.json';
import {
  BUILDING_STANDARDS, BuildingStandard, CostResult, EnergyDefaultsFile, FlowTemp, InputKey, SourcedValue,
  DEFAULT_BOILER_EFFICIENCY, demandFromArea, estimate, formatMoney, invalidInputs, marketDefaults, roundTo, scopFor,
} from './costModel';
import { costStrings, CostStrings } from './strings';
import { buildCostPdf, costPdfFileName, CostPdfSource } from './costPdf';

const FILE = defaultsJson as unknown as EnergyDefaultsFile;
const MD = marketDefaults(FILE, MARKET.code);

const PAGE: React.CSSProperties = { flex: 1, background: '#f5f5f7', minHeight: 'calc(100vh - 60px)' };
const INNER: React.CSSProperties = { maxWidth: 1160, width: '100%', margin: '0 auto', padding: '24px clamp(16px, 4vw, 48px) 56px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 18 };
const TITLE: React.CSSProperties = { fontFamily: FD, fontSize: 'clamp(25px, 4vw, 34px)', fontWeight: 600, letterSpacing: '-0.374px', color: '#1d1d1f' };
const CARD: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: 18, boxSizing: 'border-box' };
const INPUT: React.CSSProperties = { border: '1px solid #d2d2d7', borderRadius: 10, padding: '9px 12px', fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', background: '#fff', color: '#1d1d1f', outline: 'none' };
const BAD: React.CSSProperties = { borderColor: '#c0262d', background: '#fff7f7' };
const LABEL: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, color: '#3a3a3c', fontWeight: 500, minWidth: 0 };
const HINT: React.CSSProperties = { fontSize: 11.5, color: '#7a7a7a', lineHeight: 1.45, fontWeight: 400 };
const LINK: React.CSSProperties = { color: '#0066cc', cursor: 'pointer', fontSize: 13 };
const HP_BLUE = '#0066cc', GAS_BROWN = '#b07828', GOOD = '#0a6847', WARN = '#8a6a1f';

/** Accepts "0,35" and "0.35"; empty → null. */
const parseNum = (s: string): number | null => {
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const decimalSep = (locale: string) => (1.5).toLocaleString(locale).charAt(1);
const showNum = (n: number | null | undefined, locale: string) => (n == null ? '' : String(n).replace('.', decimalSep(locale)));
const currencySymbol = (cur: string, locale: string) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: cur }).formatToParts(0).find(p => p.type === 'currency')?.value ?? cur;
const fmtScop = (n: number, locale: string) => n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number, locale: string) => Math.round(n).toLocaleString(locale);
const fmtKg = (n: number, locale: string) => (Math.abs(n) >= 1000
  ? `${(n / 1000).toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} t CO₂`
  : `${Math.round(n).toLocaleString(locale)} kg CO₂`);
const fmtDateIso = (iso: string, locale: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
};

export const CostPage: React.FC<{ app: HpApp }> = ({ app }) => {
  const s = costStrings(app.lang);
  return (
    <div style={PAGE} data-testid="cost-page">
      <div style={INNER}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={TITLE}>{s.title}</span>
          <EstimateBadge s={s} />
          {!app.premium && <PremiumPill app={app} />}
        </div>
        <span style={{ fontSize: 14, color: '#6e6e73', lineHeight: 1.5, marginTop: -8, maxWidth: 780 }}>{s.subtitle}</span>
        <Disclaimer s={s} />
        {app.premium ? <Calculator app={app} s={s} /> : <Teaser app={app} s={s} />}
      </div>
    </div>
  );
};

const EstimateBadge: React.FC<{ s: CostStrings }> = ({ s }) => (
  <span data-testid="cost-estimate-badge" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#5c4500', background: '#ffe9a8', borderRadius: 999, padding: '3px 9px' }}>{s.estimate}</span>
);

const Disclaimer: React.FC<{ s: CostStrings }> = ({ s }) => (
  <div data-testid="cost-disclaimer" style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.5, color: WARN, background: '#fdf6e7', border: '1px solid #f1e2bd', borderRadius: 12, padding: '10px 14px', maxWidth: 900 }}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flex: 'none', marginTop: 2 }}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.5" /></svg>
    <span>{s.disclaimer}</span>
  </div>
);

const Teaser: React.FC<{ app: HpApp; s: CostStrings }> = ({ app, s }) => (
  <div data-testid="cost-teaser" style={{ ...CARD, padding: '26px 26px 24px', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
    <span style={{ fontFamily: FD, fontSize: 20, fontWeight: 700 }}>{s.teaserTitle}</span>
    <span style={{ fontSize: 14, color: '#3a3a3c', lineHeight: 1.55 }}>{s.teaserBody}</span>
    <span className="hp-press" data-testid="cost-unlock" onClick={app.upsell} style={{ ...pillPrimary, alignSelf: 'flex-start', fontWeight: 700 }}>{s.unlock}</span>
  </div>
);

/* ── Calculator ──────────────────────────────────────────────────────────── */

type Tariff = 'household' | 'hp';

interface PriceState {
  tariff: Tariff;
  elec: string; gas: string; standing: string; boiler: string; grid: string; gasCo2: string;
}

const defaultPrices = (locale: string, tariff: Tariff = 'household'): PriceState => ({
  tariff,
  elec: showNum(tariff === 'hp' && MD.heatPumpTariff ? MD.heatPumpTariff.value : MD.electricity.value, locale),
  gas: showNum(MD.gas.value, locale),
  standing: '0',
  boiler: showNum(FILE.boilerEfficiency?.value ?? DEFAULT_BOILER_EFFICIENCY, locale),
  grid: showNum(MD.gridCo2.value, locale),
  gasCo2: showNum(MD.gasCo2.value, locale),
});

const Calculator: React.FC<{ app: HpApp; s: CostStrings }> = ({ app, s }) => {
  const t = tr(app.lang);
  const locale = t.locale;
  const cur = MD.currency;
  const sym = currencySymbol(cur, locale);
  const money = (n: number) => formatMoney(roundTo(n), cur, locale);

  // Peek in the initializer (StrictMode runs it twice in dev), consume once mounted.
  const [productId, setProductId] = useState<string | null>(() => peekToolTarget());
  useEffect(() => { takeToolTarget(); }, []);
  const v: HpVM | null = productId ? app.allStore?.byId.get(productId) ?? app.store?.byId.get(productId) ?? null : null;

  const [flow, setFlow] = useState<FlowTemp>(35);
  const [scopOwn, setScopOwn] = useState<string>('');
  const [scopEdit, setScopEdit] = useState(false);
  const [demandMode, setDemandMode] = useState<'direct' | 'helper'>('helper');
  const [demandDirect, setDemandDirect] = useState('15000');
  const [area, setArea] = useState('140');
  const [standard, setStandard] = useState<BuildingStandard>('partly');
  const [prices, setPrices] = useState<PriceState>(() => defaultPrices(locale));
  const [advanced, setAdvanced] = useState(false);
  const setP = (patch: Partial<PriceState>) => setPrices(p => ({ ...p, ...patch }));

  const record = useMemo(() => (v ? scopFor({
    scop: v.raw.scop,
    eta35: (v.raw as unknown as Record<string, number | null>).efficiency_35C_percent,
    eta55: (v.raw as unknown as Record<string, number | null>).efficiency_55C_percent,
    qaFlags: v.qaFlags,
  }, flow) : null), [v, flow]);

  // No seasonal data for this flow temperature → the own-SCOP field opens.
  useEffect(() => { if (record && record.value == null) setScopEdit(true); }, [record]);

  const scopManual = scopEdit ? parseNum(scopOwn) : null;
  const scop = scopEdit ? scopManual : record?.value ?? null;
  const scopBasisKey = scopEdit ? 'manual' : (record?.basis === 'none' || !record ? 'manual' : record.basis);

  const kwhPerM2 = FILE.buildingStandards.values[standard];
  const helperDemand = demandFromArea(parseNum(area), kwhPerM2);
  const demand = demandMode === 'direct' ? parseNum(demandDirect) : helperDemand;

  const inputs = {
    demandKwh: demand,
    scop,
    boilerEfficiency: parseNum(prices.boiler),
    electricityPrice: parseNum(prices.elec),
    gasPrice: parseNum(prices.gas),
    standingDiff: parseNum(prices.standing) ?? 0,
    gridCo2: parseNum(prices.grid),
    gasCo2: parseNum(prices.gasCo2),
  };
  const bad = new Set<InputKey>(invalidInputs(inputs));
  const result: CostResult | null = v && !bad.size ? estimate(inputs as Required<typeof inputs> & { demandKwh: number; scop: number; boilerEfficiency: number; electricityPrice: number; gasPrice: number; gridCo2: number; gasCo2: number }) : null;

  const isDefault = (val: string, def: number | null | undefined) => def != null && parseNum(val) === def;
  const elecDefault = prices.tariff === 'hp' && MD.heatPumpTariff ? MD.heatPumpTariff : MD.electricity;

  /* ── PDF ── */
  const bs = brandingStrings(app.lang);
  const opts = useDocBrandingOptions();
  const saved = savedBranding(app.user);
  const [pdfOpen, setPdfOpen] = useState(false);

  const sourcesFor = (): CostPdfSource[] => {
    const row = (label: string, sv: SourcedValue, custom: boolean): CostPdfSource => ({
      label: custom ? `${label} (${s.custom})` : label, source: sv.source, asOf: sv.asOf, url: sv.url,
    });
    const out = [
      row(`${s.elecPrice} · ${prices.tariff === 'hp' ? s.tariffHp : s.tariffHousehold}`, elecDefault, !isDefault(prices.elec, elecDefault.value)),
      row(s.gasPrice, MD.gas, !isDefault(prices.gas, MD.gas.value)),
      row(s.gridCo2.replace(/\s*\(.*\)$/, ''), MD.gridCo2, !isDefault(prices.grid, MD.gridCo2.value)),
      row(s.gasCo2.replace(/\s*\(.*\)$/, ''), MD.gasCo2, !isDefault(prices.gasCo2, MD.gasCo2.value)),
    ];
    if (demandMode === 'helper') {
      const b = FILE.buildingStandards;
      out.push({ label: `${s.standard} (${s.helperSource})`, source: b.source, asOf: b.asOf, url: b.url });
    }
    return out;
  };

  const makePdf = () => {
    if (!v || !result) return;
    try {
      const flowLabel = flow === 35 ? s.flow35 : s.flow55;
      const basisText = s.basis[scopBasisKey as keyof CostStrings['basis']];
      const rows = [
        { label: s.pdfModel, value: `${v.mfr} ${v.model} (${SOURCE_ID_ABBR} ${v.sourceId})` },
        { label: s.flow, value: flowLabel },
        { label: s.scopUsed, value: `${fmtScop(scop as number, locale)} — ${basisText}` },
        {
          label: s.demand,
          value: demandMode === 'helper'
            ? `${fmtInt(demand as number, locale)} kWh (${showNum(parseNum(area), locale)} m² × ${kwhPerM2} kWh/m²·a, ${s.standards[standard]})`
            : `${fmtInt(demand as number, locale)} kWh`,
        },
        { label: s.elecPrice, value: `${prices.elec} ${s.perKwh(sym)} (${prices.tariff === 'hp' ? s.tariffHp : s.tariffHousehold})` },
        { label: s.gasPrice, value: `${prices.gas} ${s.perKwh(sym)}` },
        { label: s.standing, value: `${prices.standing || '0'} ${s.perYear(sym)}` },
        { label: s.boiler, value: prices.boiler },
        { label: s.gridCo2, value: prices.grid },
        { label: s.gasCo2, value: prices.gasCo2 },
      ];
      const doc = buildCostPdf({
        s, t,
        model: { name: v.model, mfr: v.mfr, id: v.sourceId },
        inputs: rows,
        result,
        money,
        kg: n => fmtKg(n, locale),
        scopBasis: `${fmtScop(scop as number, locale)}, ${basisText}`,
        sources: sourcesFor(),
        defaultsAsOf: fmtDateIso(MD.asOf, locale),
        branding: pdfBrandingFor(app.user, app.premium, app.lang, opts),
      });
      const name = costPdfFileName(opts.preparedFor, v.model);
      setPdfOpen(false);
      if (isIos()) printPdfViaShareSheet(doc, name).catch(() => app.notify(s.pdfFailed));
      else downloadPdf(doc, name);
    } catch (e) {
      console.warn('[cost] pdf failed', e);
      app.notify(s.pdfFailed);
    }
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
      {/* ── Inputs ── */}
      <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ ...CARD, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ ...sectionLabel, textTransform: 'uppercase' }}>{s.product}</span>
          {v ? (
            <div data-testid="cost-product" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 15.5, fontWeight: 650, overflowWrap: 'anywhere' }}>{v.model}<QaMark v={v} lang={app.lang} size={14} /></span>
                <span style={{ fontSize: 12.5, color: '#6e6e73' }}>{v.mfr} · {v.ratedKw} kW · {SOURCE_ID_ABBR} {v.sourceId}</span>
              </div>
              <span className="hp-press" data-testid="cost-change" onClick={() => { setProductId(null); setScopEdit(false); setScopOwn(''); }} style={LINK}>{s.change}</span>
            </div>
          ) : (
            <ProductPicker app={app} s={s} onPick={id => { setProductId(id); setScopEdit(false); setScopOwn(''); }} />
          )}
        </div>

        {v && (
          <>
            <div style={{ ...CARD, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ ...sectionLabel, textTransform: 'uppercase' }}>{s.flow}</span>
              <Segmented
                testid="cost-flow"
                value={String(flow)}
                options={[{ id: '35', label: s.flow35 }, { id: '55', label: s.flow55 }]}
                onChange={id => { setFlow(Number(id) as FlowTemp); setScopEdit(false); }}
              />
              <div data-testid="cost-scop" style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#f5f5f7', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, color: '#3a3a3c' }}>{s.scopUsed}</span>
                  {!scopEdit && record?.value != null && <span data-testid="cost-scop-value" style={{ fontSize: 18, fontWeight: 700, fontFamily: FD }}>{fmtScop(record.value, locale)}</span>}
                  {!scopEdit && record?.value != null && <span style={HINT}>{s.basis[record.basis as 'scop' | 'eta35' | 'eta55']}</span>}
                </div>
                {record?.scopFlagged && <span data-testid="cost-scop-flagged" style={{ ...HINT, color: '#c0262d' }}>{s.scopFlagged}</span>}
                {record?.value == null && <span data-testid="cost-scop-missing" style={{ ...HINT, color: WARN }}>{s.scopMissing}</span>}
                {scopEdit && (
                  <input data-testid="cost-scop-input" inputMode="decimal" style={{ ...INPUT, maxWidth: 160, ...(bad.has('scop') ? BAD : {}) }} value={scopOwn} placeholder="3,5" onChange={e => setScopOwn(e.target.value)} />
                )}
                {record?.value != null && (
                  <span onClick={() => setScopEdit(e => !e)} style={{ ...LINK, fontSize: 12 }}>{scopEdit ? s.scopUseRecord : s.scopOverride}</span>
                )}
              </div>
            </div>

            <div style={{ ...CARD, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ ...sectionLabel, textTransform: 'uppercase' }}>{s.demand}</span>
              <Segmented
                testid="cost-demand-mode"
                value={demandMode}
                options={[{ id: 'helper', label: s.demandHelper }, { id: 'direct', label: s.demandDirect }]}
                onChange={id => setDemandMode(id as 'direct' | 'helper')}
              />
              {demandMode === 'direct' ? (
                <label style={LABEL}>
                  kWh
                  <input data-testid="cost-demand" inputMode="numeric" style={{ ...INPUT, ...(bad.has('demandKwh') ? BAD : {}) }} value={demandDirect} onChange={e => setDemandDirect(e.target.value)} />
                </label>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                    <label style={LABEL}>
                      {s.area}
                      <input data-testid="cost-area" inputMode="decimal" style={{ ...INPUT, ...(bad.has('demandKwh') ? BAD : {}) }} value={area} onChange={e => setArea(e.target.value)} />
                    </label>
                    <label style={LABEL}>
                      {s.standard}
                      <select data-testid="cost-standard" style={INPUT} value={standard} onChange={e => setStandard(e.target.value as BuildingStandard)}>
                        {BUILDING_STANDARDS.map(b => (
                          <option key={b} value={b}>{s.standards[b]} · {FILE.buildingStandards.values[b]} kWh/m²·a</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <span data-testid="cost-helper-result" style={{ fontSize: 13, color: '#1d1d1f', fontWeight: 600 }}>
                    {helperDemand != null ? s.helperResult(fmtInt(helperDemand, locale)) : '—'}
                  </span>
                  <span style={HINT}>
                    {s.helperSource}: <a href={FILE.buildingStandards.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc' }}>{FILE.buildingStandards.source}</a>
{` (${FILE.buildingStandards.asOf}) — ${s.helperNote}`}
                  </span>
                </>
              )}
            </div>

            <div style={{ ...CARD, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ ...sectionLabel, textTransform: 'uppercase', flex: '1 1 auto' }}>{s.prices}</span>
                <span className="hp-press" data-testid="cost-reset" onClick={() => setPrices(defaultPrices(locale, prices.tariff))} style={{ ...LINK, fontSize: 12 }}>{s.reset}</span>
              </div>
              <span data-testid="cost-asof" style={HINT}>{s.defaultsAsOf(fmtDateIso(MD.asOf, locale))}</span>
              {MD.heatPumpTariff && (
                <Segmented
                  testid="cost-tariff"
                  value={prices.tariff}
                  options={[{ id: 'household', label: s.tariffHousehold }, { id: 'hp', label: s.tariffHp }]}
                  onChange={id => {
                    const tariff = id as Tariff;
                    const src = tariff === 'hp' && MD.heatPumpTariff ? MD.heatPumpTariff : MD.electricity;
                    setP({ tariff, elec: showNum(src.value, locale) });
                  }}
                />
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                <label style={LABEL}>
                  {s.elecPrice} ({s.perKwh(sym)})
                  <input data-testid="cost-elec" inputMode="decimal" style={{ ...INPUT, ...(bad.has('electricityPrice') ? BAD : {}) }} value={prices.elec} onChange={e => setP({ elec: e.target.value })} />
                </label>
                <label style={LABEL}>
                  {s.gasPrice} ({s.perKwh(sym)})
                  <input data-testid="cost-gas" inputMode="decimal" style={{ ...INPUT, ...(bad.has('gasPrice') ? BAD : {}) }} value={prices.gas} onChange={e => setP({ gas: e.target.value })} />
                </label>
                <label style={LABEL}>
                  {s.boiler}
                  <input data-testid="cost-boiler" inputMode="decimal" style={{ ...INPUT, ...(bad.has('boilerEfficiency') ? BAD : {}) }} value={prices.boiler} onChange={e => setP({ boiler: e.target.value })} />
                  <span style={HINT}>{s.boilerHint}</span>
                </label>
                <label style={LABEL}>
                  {s.standing} ({s.perYear(sym)})
                  <input data-testid="cost-standing" inputMode="decimal" style={{ ...INPUT, ...(bad.has('standingDiff') ? BAD : {}) }} value={prices.standing} onChange={e => setP({ standing: e.target.value })} />
                  <span style={HINT}>{s.standingHint}</span>
                </label>
              </div>
              <span className="hp-press" data-testid="cost-advanced" onClick={() => setAdvanced(a => !a)} style={{ ...LINK, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ display: 'inline-block', transform: advanced ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>{s.advanced}
              </span>
              {advanced && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                  <label style={LABEL}>
                    {s.gridCo2}
                    <input data-testid="cost-grid" inputMode="decimal" style={{ ...INPUT, ...(bad.has('gridCo2') ? BAD : {}) }} value={prices.grid} onChange={e => setP({ grid: e.target.value })} />
                  </label>
                  <label style={LABEL}>
                    {s.gasCo2}
                    <input data-testid="cost-gasco2" inputMode="decimal" style={{ ...INPUT, ...(bad.has('gasCo2') ? BAD : {}) }} value={prices.gasCo2} onChange={e => setP({ gasCo2: e.target.value })} />
                  </label>
                </div>
              )}
              <Sources s={s} />
            </div>
          </>
        )}
      </div>

      {/* ── Results ── */}
      <div style={{ flex: '1 1 380px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 76 }}>
        <div data-testid="cost-results" style={{ ...CARD, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...sectionLabel, textTransform: 'uppercase', flex: 1 }}>{s.results}</span>
            <EstimateBadge s={s} />
          </div>
          {!v ? (
            <span style={{ fontSize: 14, color: '#6e6e73', lineHeight: 1.5 }}>{s.noProduct}</span>
          ) : !result ? (
            <span data-testid="cost-missing" style={{ fontSize: 14, color: WARN, lineHeight: 1.5 }}>{s.missing}</span>
          ) : (
            <Results s={s} r={result} money={money} kg={n => fmtKg(n, locale)} kwh={n => fmtInt(roundTo(n), locale)} />
          )}
        </div>
        {v && result && (
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="hp-press" data-testid="cost-pdf" onClick={() => setPdfOpen(o => !o)} style={{ ...pillSecondary, alignSelf: 'flex-start', background: '#1d1d1f', color: '#fff', border: '1px solid #1d1d1f', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
              {s.pdf}
            </span>
            {pdfOpen && (
              <div data-testid="cost-pdf-prompt" style={{ ...CARD, borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 12px 32px rgba(0,0,0,.10)' }}>
                <label style={LABEL}>
                  {bs.preparedForLabel}
                  <input
                    autoFocus
                    data-testid="cost-prepared-for"
                    value={opts.preparedFor}
                    maxLength={PREPARED_FOR_MAX}
                    placeholder={bs.preparedForPh}
                    onChange={e => setDocBrandingOptions({ preparedFor: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') makePdf(); }}
                    style={INPUT}
                  />
                </label>
                <span
                  onClick={() => { if (saved) setDocBrandingOptions({ enabled: !opts.enabled }); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: saved ? 'pointer' : 'default', color: saved ? '#1d1d1f' : '#9a9aa0' }}
                >
                  <Switch on={!!saved && opts.enabled} disabled={!saved} />
                  {bs.toggle}
                </span>
                {!saved && (
                  <span style={{ fontSize: 11.5, color: '#7a7a7a', marginTop: -6 }}>
                    {bs.noBranding}{' '}
                    <span onClick={() => app.go('account')} style={{ color: '#0066cc', cursor: 'pointer' }}>{bs.setUp}</span>
                  </span>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <span className="hp-press" onClick={() => setPdfOpen(false)} style={{ border: '1px solid #d2d2d7', borderRadius: 999, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>{s.cancel}</span>
                  <span className="hp-press" data-testid="cost-pdf-create" onClick={makePdf} style={{ background: '#1d1d1f', color: '#fff', borderRadius: 999, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{s.pdfCreate}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Pieces ─────────────────────────────────────────────────────────────── */

const Segmented: React.FC<{ testid: string; value: string; options: { id: string; label: string }[]; onChange: (id: string) => void }> = ({ testid, value, options, onChange }) => (
  <div data-testid={testid} role="radiogroup" style={{ display: 'flex', background: '#f0f0f2', borderRadius: 10, padding: 3, gap: 3, flexWrap: 'wrap' }}>
    {options.map(o => (
      <span
        key={o.id}
        role="radio"
        aria-checked={o.id === value}
        data-value={o.id}
        className="hp-press"
        onClick={() => onChange(o.id)}
        style={{
          flex: '1 1 auto', textAlign: 'center', padding: '7px 10px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
          fontWeight: o.id === value ? 650 : 500, background: o.id === value ? '#fff' : 'transparent',
          boxShadow: o.id === value ? '0 1px 3px rgba(0,0,0,.12)' : 'none', color: '#1d1d1f',
        }}
      >
        {o.label}
      </span>
    ))}
  </div>
);

const ProductPicker: React.FC<{ app: HpApp; s: CostStrings; onPick: (id: string) => void }> = ({ app, s, onPick }) => {
  const [q, setQ] = useState('');
  const store = app.allStore ?? app.store;
  const hits = useMemo(() => (store && q.trim().length >= 2 ? store.search(q, 8) : null), [store, q]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input data-testid="cost-search" style={INPUT} value={q} placeholder={s.searchPh} onChange={e => setQ(e.target.value)} autoFocus />
      {!hits && <span style={HINT}>{s.noProduct}</span>}
      {hits && hits.items.length === 0 && <span style={HINT}>{s.noResults}</span>}
      {hits && hits.items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #e8e8ed', borderRadius: 12, overflow: 'hidden' }}>
          {hits.items.map(h => (
            <span key={h.id} data-testid="cost-search-hit" className="hp-press" onClick={() => onPick(h.id)} style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f2', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, overflowWrap: 'anywhere' }}>{h.model}</span>
              <span style={{ fontSize: 11.5, color: '#7a7a7a' }}>{h.mfr} · {h.ratedKw} kW · SCOP {h.scop}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const Sources: React.FC<{ s: CostStrings }> = ({ s }) => {
  const rows: [string, SourcedValue | null | undefined][] = [
    [s.tariffHousehold, MD.electricity],
    [s.tariffHp, MD.heatPumpTariff],
    [s.gasPrice, MD.gas],
    [s.gridCo2, MD.gridCo2],
    [s.gasCo2, MD.gasCo2],
  ];
  return (
    <details data-testid="cost-sources" style={{ fontSize: 12, color: '#6e6e73' }}>
      <summary style={{ cursor: 'pointer', color: '#0066cc' }}>{s.sources}</summary>
      <ul style={{ margin: '8px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5, lineHeight: 1.45 }}>
        {rows.filter(([, v]) => v && v.value != null).map(([label, v]) => (
          <li key={label}>
            <b style={{ color: '#3a3a3c', fontWeight: 600 }}>{label}:</b> {v!.value} {v!.unit} — <a href={v!.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc' }}>{v!.source}</a> ({v!.asOf}){v!.note ? `. ${v!.note}` : ''}
          </li>
        ))}
      </ul>
    </details>
  );
};

const Results: React.FC<{ s: CostStrings; r: CostResult; money: (n: number) => string; kg: (n: number) => string; kwh: (n: number) => string }> = ({ s, r, money, kg, kwh }) => {
  const savePos = r.saving >= 0, co2Pos = r.co2SavingKg >= 0;
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <Stat testid="cost-hp" label={`${s.annualCost} · ${s.hp}`} value={money(r.hpCost)} sub={`${s.range} ${money(r.band.hpCost.low)} – ${money(r.band.hpCost.high)}`} foot={s.electricityUse(kwh(r.hpKwh))} color={HP_BLUE} />
        <Stat testid="cost-gas-result" label={`${s.annualCost} · ${s.gas}`} value={money(r.gasCost)} foot={s.gasUse(kwh(r.gasKwh))} color={GAS_BROWN} />
        <Stat testid="cost-saving" label={savePos ? s.saving : s.extraCost} value={money(Math.abs(r.saving))} sub={`${s.range} ${money(r.band.saving.low)} – ${money(r.band.saving.high)}`} color={savePos ? GOOD : WARN} strong />
        <Stat testid="cost-co2-saving" label={co2Pos ? s.co2Saving : s.co2Extra} value={kg(Math.abs(r.co2SavingKg))} sub={`${s.hp} ${kg(r.hpCo2Kg)} · ${s.gas} ${kg(r.gasCo2Kg)}`} color={co2Pos ? GOOD : WARN} strong />
      </div>
      <Bars title={s.annualCost} hpLabel={s.hp} gasLabel={s.gas} hp={r.hpCost} gas={r.gasCost} band={r.band.hpCost} fmt={money} />
      <Bars title={s.co2} hpLabel={s.hp} gasLabel={s.gas} hp={r.hpCo2Kg} gas={r.gasCo2Kg} band={r.band.hpCo2Kg} fmt={kg} />
      <span data-testid="cost-band-why" style={HINT}>{s.bandWhy}</span>
    </>
  );
};

const Stat: React.FC<{ testid: string; label: string; value: string; sub?: string; foot?: string; color: string; strong?: boolean }> = ({ testid, label, value, sub, foot, color, strong }) => (
  <div data-testid={testid} style={{ background: strong ? '#f3f8f5' : '#f5f5f7', borderRadius: 12, padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
    <span style={{ fontSize: 11, fontWeight: 600, color: '#6e6e73', letterSpacing: '.02em' }}>{label}</span>
    <span style={{ fontFamily: FD, fontSize: 24, fontWeight: 700, color, letterSpacing: '-.3px' }}>{value}</span>
    {sub && <span style={{ fontSize: 11.5, color: '#6e6e73' }}>{sub}</span>}
    {foot && <span style={{ fontSize: 11.5, color: '#8a8a8e' }}>{foot}</span>}
  </div>
);

/** Two horizontal bars (heat pump vs gas), the heat-pump range as a whisker. Inline SVG. */
const Bars: React.FC<{ title: string; hpLabel: string; gasLabel: string; hp: number; gas: number; band: { low: number; high: number }; fmt: (n: number) => string }> = ({ title, hpLabel, gasLabel, hp, gas, band, fmt }) => {
  const W = 100, max = Math.max(gas, band.high, 1e-9);
  const pct = (n: number) => Math.max(0.6, (n / max) * W);
  const row = (label: string, value: number, color: string, whisker?: { low: number; high: number }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, 110px) 1fr auto', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12.5, color: '#3a3a3c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <svg viewBox={`0 0 ${W} 10`} preserveAspectRatio="none" style={{ width: '100%', height: 16, display: 'block' }} aria-hidden>
        <rect x="0" y="1" width={W} height="8" rx="1.5" fill="#f0f0f2" />
        <rect x="0" y="1" width={pct(value)} height="8" rx="1.5" fill={color} />
        {whisker && (
          <g stroke="#1d1d1f" strokeWidth="0.6" vectorEffect="non-scaling-stroke">
            <line x1={pct(whisker.low)} x2={pct(whisker.high)} y1="5" y2="5" vectorEffect="non-scaling-stroke" />
            <line x1={pct(whisker.low)} x2={pct(whisker.low)} y1="2.5" y2="7.5" vectorEffect="non-scaling-stroke" />
            <line x1={pct(whisker.high)} x2={pct(whisker.high)} y1="2.5" y2="7.5" vectorEffect="non-scaling-stroke" />
          </g>
        )}
      </svg>
      <span style={{ fontSize: 12.5, fontWeight: 650, whiteSpace: 'nowrap', textAlign: 'right', minWidth: 70 }}>{fmt(value)}</span>
    </div>
  );
  return (
    <div data-testid="cost-bars" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#1d1d1f' }}>{title}</span>
      {row(hpLabel, hp, HP_BLUE, band)}
      {row(gasLabel, gas, GAS_BROWN)}
    </div>
  );
};
