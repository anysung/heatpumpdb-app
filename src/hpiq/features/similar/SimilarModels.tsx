/**
 * Alternatives finder (Premium feature 3, 2026-09-29).
 *
 * Shown under a product's detail (desktop inspector, phone/tablet detail).
 * Scoring lives in similarity.ts (pure, unit-tested); this file only picks the
 * pool, owns the chip state and renders. Standard accounts see the count as a
 * teaser with the list locked behind the one upgrade prompt (app.upsell).
 */
import { QaMark } from '../../QaMark';
import React, { useMemo, useState } from 'react';
import { HpApp } from '../../appState';
import { HpVM } from '../../model';
import { tr } from '../../i18n';
import { ListingChip } from '../../ListingChip';
import { LOCAL_LISTING_FILTER, LOCAL_LISTING_SOURCE, localListingStatus } from '../../listing';
import { classifyProductSegment } from '../../../config/segmentation';
import { sectionLabel } from '../../ui';
import { PremiumPill } from '../../Premium';
import { rankAlternatives, SimFilters, collapseVariants } from './similarity';
import { similarStrings } from './strings';

const MAX_ROWS = 5;

const chip = (on: boolean, disabled = false): React.CSSProperties => ({
  border: `1px solid ${on ? '#1d1d1f' : '#d2d2d7'}`,
  background: on ? '#1d1d1f' : '#fff',
  color: on ? '#fff' : disabled ? '#b6b6bc' : '#1d1d1f',
  borderRadius: 999, padding: '4px 11px', fontSize: 11.5, fontWeight: on ? 600 : 500,
  cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
});

export const LockIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);

const isListed = (v: HpVM) => localListingStatus(v.raw) === 'listed';

export const SimilarModels: React.FC<{ app: HpApp; v: HpVM; compact?: boolean }> = ({ app, v, compact }) => {
  const s = similarStrings(app.lang);
  const t = tr(app.lang);
  const [filters, setFilters] = useState<SimFilters>({});

  // The SAME segment pool as the product: the active store when it holds the
  // product (always, on the Products page), else the full catalogue narrowed
  // to the product's own segment by the one split rule.
  const pool = useMemo<readonly HpVM[]>(() => {
    if (app.store?.byId.has(v.id)) return app.store.all;
    const seg = classifyProductSegment(v.ratedKwNum);
    return (app.allStore?.all ?? []).filter(x => classifyProductSegment(x.ratedKwNum) === seg);
  }, [app.store, app.allStore, v.id, v.ratedKwNum]);

  const res = useMemo(() => rankAlternatives(v, pool, filters, isListed), [v, pool, filters]);

  const toggle = (k: keyof SimFilters) => setFilters(f => ({ ...f, [k]: !f[k] }));
  const pct = Math.round(res.tolerance * 100);

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid #e0e0e0', borderRadius: compact ? 14 : 18,
    padding: compact ? '13px 14px' : '16px 18px', display: 'flex', flexDirection: 'column', gap: 10,
  };

  const header = (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ ...sectionLabel, fontSize: 10.5, textTransform: 'uppercase' }}>
        {s.title}{!app.premium && <PremiumPill app={app} />}
      </span>
      {!res.noCapacity && (
        <span data-testid="similar-count" style={{ fontSize: 12, color: '#7a7a7a' }}>{s.found(res.baseCount)}</span>
      )}
    </div>
  );

  if (res.noCapacity) {
    return (
      <div data-testid="similar-models" style={card}>
        {header}
        <span style={{ fontSize: 12.5, color: '#7a7a7a', lineHeight: 1.5 }}>{s.noCapacity}</span>
      </div>
    );
  }

  /* ── Standard: teaser count + locked list ─────────────────────────────── */
  if (!app.premium) {
    return (
      <div data-testid="similar-models" style={card}>
        {header}
        {res.baseCount > 0 ? (
          <div
            className="hp-press"
            data-testid="similar-locked"
            onClick={app.upsell}
            style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', cursor: 'pointer' }}
          >
            <div aria-hidden="true" style={{ filter: 'blur(4px)', opacity: 0.55, display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
              {Array.from({ length: Math.min(3, res.baseCount) }).map((_, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ height: 11, width: `${70 - i * 12}%`, background: '#d2d2d7', borderRadius: 4 }} />
                  <span style={{ height: 9, width: `${50 - i * 6}%`, background: '#e8e8ed', borderRadius: 4 }} />
                </div>
              ))}
            </div>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(255,255,255,.55)', textAlign: 'center', padding: '0 12px' }}>
              <span style={{ fontSize: 12, color: '#3a3a3c', lineHeight: 1.4 }}>{s.locked}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0066cc', display: 'inline-flex', alignItems: 'center', gap: 5 }}><LockIcon /> {s.unlock}</span>
            </div>
          </div>
        ) : (
          <span style={{ fontSize: 12.5, color: '#7a7a7a' }}>{s.none}</span>
        )}
      </div>
    );
  }

  /* ── Premium: chips + ranked rows ─────────────────────────────────────── */
  const groups = collapseVariants(res.items).slice(0, MAX_ROWS);
  const rows = groups.map(g => g.item);
  const variantsOf = new Map(groups.map(g => [g.item.id, g.variants]));
  return (
    <div data-testid="similar-models" style={card}>
      {header}
      <span style={{ fontSize: 11.5, color: '#7a7a7a', lineHeight: 1.45 }}>
        {s.band(pct)}
        {res.widened && <><br /><span data-testid="similar-widened" style={{ color: '#8a6a1f' }}>{s.widened}</span></>}
      </span>
      {res.baseCount > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span data-testid="similar-chip-r290" style={chip(!!filters.r290)} onClick={() => toggle('r290')}>{s.r290}</span>
          <span
            data-testid="similar-chip-quieter"
            style={chip(!!filters.quieter, res.noNoise)}
            onClick={() => { if (!res.noNoise) toggle('quieter'); }}
          >
            {s.quieter}
          </span>
          {/* Offered only where the market's listing filter divides the
              catalogue (DE, PL) — the same rule as the Products filter. */}
          {LOCAL_LISTING_FILTER && LOCAL_LISTING_SOURCE && (
            <span data-testid="similar-chip-listed" style={chip(!!filters.listedOnly)} onClick={() => toggle('listedOnly')}>
              {s.listedOnly(LOCAL_LISTING_SOURCE === 'AGREMENT' ? 'Agrément' : LOCAL_LISTING_SOURCE)}
            </span>
          )}
        </div>
      )}
      {rows.length === 0 ? (
        <span style={{ fontSize: 12.5, color: '#7a7a7a' }}>{res.baseCount === 0 ? s.none : s.noneFiltered}</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((r, i) => {
            const inCmp = app.compare.includes(r.id);
            const sound = /^\d/.test(r.noise) ? `${r.noise} dB` : r.noise;
            return (
              <div
                key={r.id}
                data-testid="similar-row"
                className="hp-press"
                onClick={() => app.setSelectedId(r.id)}
                style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '9px 2px', borderTop: i ? '1px solid #f0f0f0' : 'none', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: '#1d1d1f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.model}</span>
                  <QaMark v={r} lang={app.lang} size={13} />
                  {(variantsOf.get(r.id) ?? 0) > 0 && (
                    <span data-testid="similar-variants" style={{ flex: 'none', fontSize: 10.5, color: '#6e6e73', background: '#f0f0f2', borderRadius: 999, padding: '1px 7px' }}>{s.variants(variantsOf.get(r.id) ?? 0)}</span>
                  )}
                  <ListingChip raw={r.raw} t={t} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: '#6e6e73' }}>
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.mfr} · {r.ratedKw} kW · {s.colScop} {r.scop} · {sound}
                  </span>
                  {/* Comparison is a desktop feature (the phone shell has no tray). */}
                  {!compact && (
                    <span
                      data-testid="similar-compare"
                      onClick={e => { e.stopPropagation(); app.toggleCompare(r.id); }}
                      style={{ flex: 'none', color: inCmp ? '#0a6847' : '#0066cc', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {inCmp ? s.inCompare : s.compare}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

