/**
 * Watchlist page (Premium, 2026-09-29) — workspace group, SubTabs
 * Projects | Watchlist. Watched models with their current key specs and local
 * listing status (listing.ts), watched manufacturers with model counts, the
 * email-alert switch, and what the latest monthly update changed.
 * Standard accounts see a teaser and the upgrade prompt.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { HpApp, HpPage } from '../../appState';
import { tr } from '../../i18n';
import { FD, CheckBox, sectionLabel } from '../../ui';
import { HpVM } from '../../model';
import { ListingChip } from '../../ListingChip';
import { QaMark, qaStyle } from '../../QaMark';
import { classifyProductSegment } from '../../../config/segmentation';
import { AddToProject } from '../projects/AddToProject';
import { watchPageStrings } from './pageStrings';
import { PremiumPill } from '../../Premium';
import { localListingStatus, LOCAL_LISTING_SOURCE, LocalListingStatus } from '../../listing';
import { watchStrings, fieldLabel } from './strings';
import {
  useWatchlist, useLatestChanges, indexChanges, addWatch, removeWatch, setEmailAlerts, mfrSlug,
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
const inputStyle: React.CSSProperties = { border: '1px solid #d2d2d7', borderRadius: 10, padding: '9px 12px', fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', background: '#fff', color: '#1d1d1f', minWidth: 0 };
const dim: React.CSSProperties = { color: '#8a8a8e' };
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
  const ps = watchPageStrings(app.lang);
  const t = tr(app.lang);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>([]);
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

  // ── add from this page ──
  const have = useMemo(() => new Set(models.map(m => m.key)), [models]);
  const haveMfr = useMemo(() => new Set(mfrs.map(m => m.key)), [mfrs]);
  const hits = useMemo(() => (store && q.trim().length >= 2 ? store.search(q, 7).items : null), [store, q]);
  const mfrOptions = useMemo(
    () => [...mfrCounts.entries()].map(([slug, m]) => ({ slug, ...m })).sort((a, b) => a.name.localeCompare(b.name)),
    [mfrCounts],
  );
  const add = async (type: 'model' | 'manufacturer', key: string, label: string) => {
    if (!uid) return;
    if (items.length >= WATCH_LIMIT) { app.notify(s.limit(WATCH_LIMIT)); return; }
    try { await addWatch(uid, type, key, label, app.lang); app.notify(s.added); } catch { app.notify(s.failed); }
  };

  // ── compare 2–4 watched models (the Products comparison, one segment) ──
  useEffect(() => { setSel(prev => prev.filter(id => have.has(id))); }, [have]);
  const toggleSel = (id: string) => setSel(prev => {
    if (prev.includes(id)) return prev.filter(x => x !== id);
    if (prev.length >= 4) { app.notify(ps.compareHint); return prev; }
    return [...prev, id];
  });
  const compareSelected = () => {
    const vs = sel.map(id => store?.byId.get(id)).filter((v): v is HpVM => !!v);
    const seg = vs.length ? classifyProductSegment(vs[0].ratedKwNum) : 'unclassified';
    const ids = vs.filter(v => classifyProductSegment(v.ratedKwNum) === seg && seg !== 'unclassified').map(v => v.id).slice(0, 4);
    if (ids.length < 2) { app.notify(ps.compareHint); return; }
    if (ids.length < sel.length) app.notify(ps.compareSegment);
    app.compare.forEach(id => app.toggleCompare(id));
    app.openProduct(ids[0]);
    ids.forEach(id => app.toggleCompare(id));
    app.setShowCompare(true);
  };
  const soundOf = (v: HpVM) => (/^\d/.test(v.noise) ? `${v.noise} dB(A)` : v.noise);

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontFamily: FD, fontSize: 28, fontWeight: 600, letterSpacing: '-0.3px' }}>
          {s.title}{!app.premium && <PremiumPill app={app} />}
        </span>
        <span style={{ fontSize: 14, color: '#6e6e73', lineHeight: 1.55 }}>{ps.sub}</span>
      </div>
      <div data-testid="watch-how" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {ps.how.map(([head, text], i) => (
          <div key={head} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 14, padding: '13px 15px', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <span style={{ flex: 'none', width: 24, height: 24, borderRadius: 999, background: '#1d1d1f', color: '#fff', fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
              <span style={{ fontSize: 13.5, fontWeight: 650 }}>{head}</span>
              <span style={{ fontSize: 12.5, color: '#6e6e73', lineHeight: 1.5 }}>{text}</span>
            </span>
          </div>
        ))}
      </div>
    </>
  );

  const shell = (children: React.ReactNode) => (
    <div data-testid="watchlist-page" style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: '#f5f5f7' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: 'clamp(18px, 4vw, 36px) clamp(16px, 4vw, 32px) 48px', display: 'flex', flexDirection: 'column', gap: 18, boxSizing: 'border-box' }}>
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
      {/* Add — the page is self-sufficient: register models and manufacturers here */}
      <div style={card} data-testid="watch-add">
        <span style={sectionLabel}>{ps.addTitle.toUpperCase()}</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, alignItems: 'start' }}>
          <div style={{ position: 'relative', minWidth: 0 }}>
            <input data-testid="watch-add-search" value={q} onChange={e => setQ(e.target.value)} placeholder={ps.addSearchPh} style={inputStyle} />
            {hits && (
              <div style={{ position: 'absolute', zIndex: 20, top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, boxShadow: '0 12px 28px rgba(0,0,0,.14)', overflow: 'hidden' }}>
                {hits.length === 0 && <span style={{ display: 'block', padding: '10px 12px', fontSize: 12.5, color: '#7a7a7a' }}>{ps.addNoResults}</span>}
                {hits.map(h => {
                  const inIt = have.has(h.id);
                  return (
                    <span key={h.id} data-testid="watch-add-hit" className="hp-press"
                      onClick={() => { if (!inIt) void add('model', h.id, `${h.mfr} ${h.model}`); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid #f0f0f2', cursor: inIt ? 'default' : 'pointer', opacity: inIt ? 0.55 : 1 }}>
                      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, overflowWrap: 'anywhere' }}>{h.model}</span>
                        <span style={{ fontSize: 11.5, color: '#7a7a7a' }}>{h.mfr} · {h.ratedKw} kW · SCOP {h.scop}</span>
                      </span>
                      <span style={{ flex: 'none', fontSize: 12, fontWeight: 600, color: inIt ? '#0a6847' : '#0066cc' }}>{inIt ? `✓ ${ps.inList}` : `+ ${ps.addBtn}`}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <select data-testid="watch-add-mfr" value="" style={inputStyle}
            onChange={e => { const m = mfrOptions.find(x => x.slug === e.target.value); if (m && !haveMfr.has(m.slug)) void add('manufacturer', m.slug, m.name); }}>
            <option value="">{ps.addMfr}</option>
            {mfrOptions.map(m => <option key={m.slug} value={m.slug} disabled={haveMfr.has(m.slug)}>{m.name} ({m.count}){haveMfr.has(m.slug) ? ' ✓' : ''}</option>)}
          </select>
        </div>
        <span style={{ ...linkBtn, alignSelf: 'flex-start' }} onClick={() => app.go('products')}>{ps.browse} ›</span>
      </div>

      {/* Models — the working list */}
      <div style={card} data-testid="watch-models">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={sectionLabel}>{s.models.toUpperCase()}</span>
          <span style={{ fontSize: 11.5, color: '#9a9aa0', flex: '1 1 auto' }}>{s.used(items.length, WATCH_LIMIT)}</span>
          {models.length > 1 && (
            <span className="hp-press" data-testid="watch-compare" title={ps.compareHint} onClick={compareSelected}
              style={{ border: '1px solid #d2d2d7', borderRadius: 999, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: '#fff', opacity: sel.length >= 2 ? 1 : 0.55 }}>
              {ps.compareSel(sel.length)}
            </span>
          )}
        </div>
        {ready && !models.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-testid="watch-empty">
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>{s.emptyTitle}</span>
            <span style={{ fontSize: 13, color: '#6e6e73', lineHeight: 1.55 }}>{ps.emptyBody}</span>
          </div>
        ) : models.map(w => {
          const v = store?.byId.get(w.key);
          const info = idx.byId.get(w.key);
          return (
            <div key={w.docId} data-testid="watch-model-row"
              style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 14px', borderTop: '1px solid #f0f0f0', paddingTop: 11 }}>
              <span style={{ flex: 'none', display: 'inline-flex', width: 18 }}>
                {v && <CheckBox on={sel.includes(w.key)} size={16} radius={4} onClick={() => toggleSel(w.key)} />}
              </span>
              <div style={{ flex: '2 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1d1d1f', cursor: v ? 'pointer' : 'default', overflowWrap: 'anywhere' }} onClick={() => v && app.openProduct(v.id)}>
                    {v ? v.model : w.label}{v && <QaMark v={v} lang={app.lang} size={13} />}
                  </span>
                  <Badges info={info} />
                </span>
                {v ? (
                  <span style={{ fontSize: 12.5, color: '#6e6e73' }}>{v.mfr}</span>
                ) : (
                  <span style={{ fontSize: 12.5, color: '#b3261e' }}>{s.notInCatalogue}</span>
                )}
              </div>
              {v && (
                <div style={{ flex: '3 1 330px', minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 16px', fontSize: 12.5, color: '#3a3a3c' }}>
                  <span><span style={dim}>{s.capacity}</span> <b style={{ fontWeight: 600 }}>{v.ratedKw} kW</b></span>
                  <span><span style={dim}>SCOP</span> <b style={{ fontWeight: 600, ...qaStyle(v, 'scop') }}>{v.scop}</b></span>
                  <span><span style={dim}>{ps.colSound}</span> <b style={{ fontWeight: 600 }}>{soundOf(v)}</b></span>
                  <span><span style={dim}>{ps.colRef}</span> <b style={{ fontWeight: 600 }}>{v.ref}</b></span>
                  {LOCAL_LISTING_SOURCE && <ListingChip raw={v.raw} t={t} />}
                </div>
              )}
              <span style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                {v && <span style={linkBtn} data-testid="watch-open" onClick={() => app.openProduct(v.id)}>{s.open}</span>}
                {v && <span style={linkBtn} data-testid="watch-datasheet" onClick={() => app.openDataSheet(v.id, 'product')}>{ps.dataSheet}</span>}
                {v && <AddToProject app={app} ids={[v.id]} />}
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

      <div style={{ ...card, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{s.emailAlerts}</span>
          <span style={{ fontSize: 12.5, color: '#6e6e73', lineHeight: 1.5 }}>{s.emailAlertsHint}</span>
        </div>
        <Toggle on={settings.emailAlerts} onClick={toggleAlerts} testId="watch-email-toggle" />
      </div>
    </>,
  );
};
