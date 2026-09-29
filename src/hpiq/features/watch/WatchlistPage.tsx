/**
 * Watchlist page (Premium, 2026-09-29) — workspace group, SubTabs
 * Projects | Watchlist. Watched models with their current key specs and local
 * listing status (listing.ts), watched manufacturers with model counts, the
 * email-alert switch, and what the latest monthly update changed.
 * Standard accounts see a teaser and the upgrade prompt.
 */
import React, { useMemo } from 'react';
import { HpApp, HpPage } from '../../appState';
import { tr } from '../../i18n';
import { FD, SubTabs, sectionLabel } from '../../ui';
import { PremiumPill } from '../../Premium';
import { localListingStatus, LOCAL_LISTING_SOURCE, LocalListingStatus } from '../../listing';
import { watchStrings, fieldLabel } from './strings';
import {
  useWatchlist, useLatestChanges, indexChanges, removeWatch, setEmailAlerts, mfrSlug,
  MARKET, WATCH_LIMIT, WatchDoc, ChangeInfo,
} from './watchModel';

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e0e0e0', borderRadius: 18, padding: '18px 20px',
  display: 'flex', flexDirection: 'column', gap: 12,
};
const badge = (bg: string, color: string): React.CSSProperties => ({
  fontSize: 10.5, fontWeight: 700, letterSpacing: '.03em', borderRadius: 999, padding: '3px 9px',
  background: bg, color, whiteSpace: 'nowrap',
});
const linkBtn: React.CSSProperties = { fontSize: 12.5, color: '#0066cc', cursor: 'pointer', whiteSpace: 'nowrap' };
const removeBtn: React.CSSProperties = { fontSize: 12.5, color: '#b3261e', cursor: 'pointer', whiteSpace: 'nowrap' };

const Toggle: React.FC<{ on: boolean; onClick: () => void; testId?: string }> = ({ on, onClick, testId }) => (
  <span role="switch" aria-checked={on} data-testid={testId} onClick={onClick} className="hp-press"
    style={{ flex: 'none', width: 42, height: 24, borderRadius: 999, background: on ? '#34c759' : '#d2d2d7', position: 'relative', cursor: 'pointer', transition: 'background .15s' }}>
    <span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 20, height: 20, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .15s' }} />
  </span>
);

export const WatchlistPage: React.FC<{ app: HpApp }> = ({ app }) => {
  const s = watchStrings(app.lang);
  const t = tr(app.lang);
  const uid = app.premium ? app.user?.id : null;
  const { items, settings, ready } = useWatchlist(uid);
  const { changes } = useLatestChanges(!!uid);
  const idx = useMemo(() => indexChanges(changes), [changes]);
  const store = app.allStore ?? app.store;

  const market = items.filter(i => i.market === MARKET);
  const models = market.filter(i => i.type === 'model');
  const mfrs = market.filter(i => i.type === 'manufacturer');

  const mfrCounts = useMemo(() => {
    const m = new Map<string, { name: string; count: number }>();
    for (const v of store?.all ?? []) {
      const k = mfrSlug(v.mfr);
      const cur = m.get(k);
      if (cur) cur.count++; else m.set(k, { name: v.mfr, count: 1 });
    }
    return m;
  }, [store]);

  const statusLabel = (st: LocalListingStatus | string | null | undefined): string =>
    st === 'listed' ? t.ds.f.listed : st === 'not_listed' ? t.ds.f.notListed : t.ds.f.verifyRequired;

  const monthLabel = changes?.month
    ? new Date(`${changes.month}-15T12:00:00Z`).toLocaleDateString(t.locale, { month: 'long', year: 'numeric' })
    : '';

  const remove = async (w: WatchDoc) => {
    if (!uid) return;
    try { await removeWatch(uid, w.docId); app.notify(s.removed); } catch { app.notify(s.failed); }
  };
  const toggleAlerts = async () => {
    if (!uid) return;
    try { await setEmailAlerts(uid, !settings.emailAlerts, app.lang); } catch { app.notify(s.failed); }
  };
  const openMfr = (name: string) => { app.setMfrFilter([name]); app.go('products'); };

  const Badges: React.FC<{ info?: ChangeInfo }> = ({ info }) => !info ? null : (
    <span style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap' }}>
      {info.kinds.includes('listing') && <span style={badge('#fff4e5', '#a15c00')} data-testid="badge-listing">{s.badgeListing}</span>}
      {info.kinds.includes('added') && <span style={badge('#e8f5ee', '#0a6847')}>{s.badgeAdded}</span>}
      {info.kinds.includes('removed') && <span style={badge('#fdecea', '#b3261e')}>{s.badgeRemoved}</span>}
      {info.kinds.includes('specs') && <span style={badge('#eef5fd', '#0b5cad')}>{s.badgeSpecs}</span>}
    </span>
  );

  const detail = (info: ChangeInfo): string => [
    info.listing ? `${statusLabel(info.listing.from)} → ${statusLabel(info.listing.to)}` : '',
    info.specFields?.length ? s.changedSpecs(info.specFields.map(f => fieldLabel(f, app.lang)).join(', ')) : '',
  ].filter(Boolean).join(' · ');

  const header = (
    <>
      <SubTabs
        group="workspace"
        tabs={[{ id: 'projects', label: s.tabProjects }, { id: 'watchlist', label: s.tabWatchlist }]}
        active="watchlist"
        onSelect={id => app.go(id as HpPage)}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontFamily: FD, fontSize: 28, fontWeight: 600, letterSpacing: '-0.3px' }}>
          {s.title}{!app.premium && <PremiumPill app={app} />}
        </span>
        <span style={{ fontSize: 14, color: '#6e6e73', lineHeight: 1.55, maxWidth: 720 }}>{s.sub}</span>
      </div>
    </>
  );

  const shell = (children: React.ReactNode) => (
    <div data-testid="watchlist-page" style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: '#f5f5f7' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: 'clamp(18px, 4vw, 36px) clamp(16px, 4vw, 32px) 48px', display: 'flex', flexDirection: 'column', gap: 18, boxSizing: 'border-box' }}>
        {header}
        {children}
      </div>
    </div>
  );

  /* ── Standard: teaser ─────────────────────────────────────────────────── */
  if (!app.premium) {
    return shell(
      <div style={{ ...card, gap: 10 }} data-testid="watchlist-teaser">
        <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 700 }}>{s.teaserTitle}</span>
        <span style={{ fontSize: 14, color: '#3a3a3c', lineHeight: 1.6 }}>{s.teaserBody}</span>
        <span className="hp-press" onClick={() => app.upsell()} data-testid="watchlist-upsell"
          style={{ alignSelf: 'flex-start', marginTop: 4, borderRadius: 999, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', background: '#0071e3', color: '#fff' }}>
          {s.teaserCta}
        </span>
      </div>,
    );
  }

  /* ── Premium ──────────────────────────────────────────────────────────── */
  const changedModels = models.filter(w => idx.byId.has(w.key));
  const changedMfrs = mfrs.filter(w => (idx.byMfr.get(w.key) ?? 0) > 0);

  return shell(
    <>
      <div style={{ ...card, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{s.emailAlerts}</span>
          <span style={{ fontSize: 12.5, color: '#6e6e73', lineHeight: 1.5 }}>{s.emailAlertsHint}</span>
        </div>
        <Toggle on={settings.emailAlerts} onClick={toggleAlerts} testId="watch-email-toggle" />
      </div>

      {/* Latest update */}
      <div style={card} data-testid="watch-latest">
        <span style={sectionLabel}>{(changes?.month ? s.latestTitle(monthLabel) : s.latestHeading).toUpperCase()}</span>
        {!changes ? (
          <span style={{ fontSize: 13.5, color: '#6e6e73' }}>{s.latestNoData}</span>
        ) : !changedModels.length && !changedMfrs.length ? (
          <span style={{ fontSize: 13.5, color: '#6e6e73' }}>{s.latestNone}</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {changedModels.map(w => {
              const info = idx.byId.get(w.key)!;
              const d = detail(info);
              return (
                <div key={w.docId} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <span style={{ ...linkBtn, fontSize: 13.5, fontWeight: 600, color: '#1d1d1f', whiteSpace: 'normal' }} onClick={() => store?.byId.has(w.key) && app.openProduct(w.key)}>{w.label}</span>
                  <Badges info={info} />
                  {d && <span style={{ fontSize: 12.5, color: '#6e6e73' }}>{d}</span>}
                </div>
              );
            })}
            {changedMfrs.map(w => (
              <div key={w.docId} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <span style={{ ...linkBtn, fontSize: 13.5, fontWeight: 600, color: '#1d1d1f' }} onClick={() => openMfr(mfrCounts.get(w.key)?.name ?? w.label)}>{w.label}</span>
                <span style={badge('#eef5fd', '#0b5cad')}>{s.mfrChanged(idx.byMfr.get(w.key) ?? 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Models */}
      <div style={card} data-testid="watch-models">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={sectionLabel}>{s.models.toUpperCase()}</span>
          <span style={{ fontSize: 11.5, color: '#9a9aa0' }}>{s.used(items.length, WATCH_LIMIT)}</span>
        </div>
        {ready && !models.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-testid="watch-empty">
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>{s.emptyTitle}</span>
            <span style={{ fontSize: 13, color: '#6e6e73', lineHeight: 1.55 }}>{s.emptyBody}</span>
          </div>
        ) : models.map(w => {
          const v = store?.byId.get(w.key);
          const info = idx.byId.get(w.key);
          const st = v && LOCAL_LISTING_SOURCE ? localListingStatus(v.raw) : null;
          return (
            <div key={w.docId} data-testid="watch-model-row"
              style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px', borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
              <div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1d1d1f', cursor: v ? 'pointer' : 'default' }} onClick={() => v && app.openProduct(v.id)}>
                    {v ? `${v.mfr} ${v.model}` : w.label}
                  </span>
                  <Badges info={info} />
                </span>
                {v ? (
                  <span style={{ fontSize: 12.5, color: '#6e6e73' }}>
                    {s.capacity} {v.ratedKw} kW · SCOP {v.scop}{LOCAL_LISTING_SOURCE ? ` · ${statusLabel(st)}` : ''}
                  </span>
                ) : (
                  <span style={{ fontSize: 12.5, color: '#b3261e' }}>{s.notInCatalogue}</span>
                )}
              </div>
              <span style={{ display: 'flex', gap: 14 }}>
                {v && <span style={linkBtn} onClick={() => app.openProduct(v.id)}>{s.open}</span>}
                <span style={removeBtn} data-testid="watch-remove" onClick={() => remove(w)}>{s.remove}</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Manufacturers */}
      <div style={card} data-testid="watch-mfrs">
        <span style={sectionLabel}>{s.manufacturers.toUpperCase()}</span>
        {!mfrs.length ? (
          <span style={{ fontSize: 13, color: '#6e6e73' }}>{s.emptyMfr}</span>
        ) : mfrs.map(w => {
          const m = mfrCounts.get(w.key);
          const n = idx.byMfr.get(w.key) ?? 0;
          return (
            <div key={w.docId} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px', borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
              <div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{m?.name ?? w.label}</span>
                  {n > 0 && <span style={badge('#eef5fd', '#0b5cad')}>{s.mfrChanged(n)}</span>}
                </span>
                <span style={{ fontSize: 12.5, color: m ? '#6e6e73' : '#b3261e' }}>{m ? s.modelsCount(m.count) : s.notInCatalogue}</span>
              </div>
              <span style={{ display: 'flex', gap: 14 }}>
                {m && <span style={linkBtn} onClick={() => openMfr(m.name)}>{s.open}</span>}
                <span style={removeBtn} onClick={() => remove(w)}>{s.remove}</span>
              </span>
            </div>
          );
        })}
      </div>
    </>,
  );
};
