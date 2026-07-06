/** Products — main catalog: filter rail + dense table + inspector + compare tray. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HpApp } from '../appState';
import { HpVM } from '../model';
import { ProductFilters, ProductSort, SORT_LABELS } from '../productService';
import { FD, CheckBox, ChevronDown, frosted, pillPrimary, pillSecondary, sectionLabel } from '../ui';

const GRID = '34px 2.2fr 1fr 0.9fr 0.8fr 0.7fr 0.7fr 1.2fr';
const PAGE_SIZE = 100;

const SkeletonRow: React.FC<{ widths: string[]; dim?: boolean }> = ({ widths, dim }) => (
  <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: '0 12px', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #f0f0f0', opacity: dim ? 0.5 : 1 }}>
    <span />
    {widths.map((w, i) => <span key={i} style={{ height: 10, borderRadius: 6, background: '#f0f0f0', width: w }} />)}
  </div>
);

const SK1 = ['78%', '70%', '50%', '55%', '50%', '55%', '65%'];
const SK2 = ['66%', '75%', '45%', '60%', '55%', '50%', '70%'];

export const ProductsPage: React.FC<{ app: HpApp }> = ({ app }) => {
  const { store } = app;
  const [mfrExpanded, setMfrExpanded] = useState(false);
  const [items, setItems] = useState<HpVM[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [sort, setSort] = useState<ProductSort>('cop2');
  const [sortOpen, setSortOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pendingScrollRef = useRef<string | null>(null);

  // Capacity range — [lo, hi] in whole kW over the store's bounds; null = untouched (full range).
  const bounds = store?.kwBounds ?? null;
  const [capRange, setCapRange] = useState<[number, number] | null>(null);
  useEffect(() => { setCapRange(null); }, [store]);   // dataset switch resets the slider
  const capLo = capRange?.[0] ?? bounds?.min ?? 0;
  const capHi = capRange?.[1] ?? bounds?.max ?? 0;
  const capNarrowed = !!bounds && !!capRange && (capRange[0] > bounds.min || capRange[1] < bounds.max);

  const filters: ProductFilters = useMemo(() => ({
    refrigerant: app.refFilter,
    manufacturers: app.mfrFilter,
    bafaListedOnly: app.bafaOnly,
    capMin: capNarrowed ? capLo : null,
    capMax: capNarrowed ? capHi : null,
    sort,
  }), [app.refFilter, app.mfrFilter, app.bafaOnly, capNarrowed, capLo, capHi, sort]);

  // Dual-handle capacity slider — pointer drag maps track % to whole kW.
  const trackRef = useRef<HTMLDivElement>(null);
  const dragHandle = (which: 'lo' | 'hi') => (e: React.PointerEvent) => {
    if (!bounds) return;
    e.preventDefault();
    const track = trackRef.current;
    if (!track) return;
    const move = (ev: PointerEvent) => {
      const rect = track.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
      const kw = Math.round(bounds.min + pct * (bounds.max - bounds.min));
      setCapRange(prev => {
        const [lo, hi] = prev ?? [bounds.min, bounds.max];
        return which === 'lo' ? [Math.min(kw, hi), hi] : [lo, Math.max(kw, lo)];
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    move(e.nativeEvent);
  };
  const pctOf = (kw: number) => (bounds && bounds.max > bounds.min ? ((kw - bounds.min) / (bounds.max - bounds.min)) * 100 : 0);

  // First page (and reset) whenever data or filters change — cursor pagination.
  // If a row was preselected (e.g. Find → "View details"), stream pages until
  // it is included, then scroll it into view.
  useEffect(() => {
    if (!store) return;
    let page = store.getPage(filters, null, PAGE_SIZE);
    let acc = page.items;
    if (app.selectedId) {
      while (page.nextCursor && !acc.some(v => v.id === app.selectedId)) {
        page = store.getPage(filters, page.nextCursor, PAGE_SIZE);
        acc = [...acc, ...page.items];
      }
    }
    setItems(acc);
    setNextCursor(page.nextCursor);
    setFilteredTotal(page.filteredTotal);
    pendingScrollRef.current = app.selectedId ?? '__top__';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, filters]);

  // After the reset render, bring the preselected row (or the top) into view.
  useEffect(() => {
    const pending = pendingScrollRef.current;
    if (!pending) return;
    pendingScrollRef.current = null;
    if (pending === '__top__') { scrollerRef.current?.scrollTo({ top: 0 }); return; }
    const target = scrollerRef.current?.querySelector(`[data-row-id="${CSS.escape(pending)}"]`);
    if (target) target.scrollIntoView({ block: 'center' });
  }, [items]);

  // Stream further pages as the sentinel scrolls into view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !store || !nextCursor) return;
    const io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      const page = store.getPage(filters, nextCursor, PAGE_SIZE);
      setItems(prev => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    }, { root: scrollerRef.current, rootMargin: '600px' });
    io.observe(sentinel);
    return () => io.disconnect();
  }, [store, filters, nextCursor]);

  useEffect(() => {
    if (app.showCompare) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [app.showCompare]);

  const sel = app.selectedId && store ? store.byId.get(app.selectedId) ?? null : null;
  const compareItems = app.compare.map(id => store?.byId.get(id)).filter(Boolean) as HpVM[];
  const compareCount = compareItems.length;
  const canCompare = compareCount >= 2;
  const showPanel = app.showCompare && canCompare;

  const appliedChips: { label: string; onRemove: () => void }[] = [];
  if (app.refFilter) appliedChips.push({ label: app.refFilter, onRemove: () => app.setRefFilter(null) });
  app.mfrFilter.forEach(m => appliedChips.push({ label: m, onRemove: () => app.setMfrFilter(app.mfrFilter.filter(x => x !== m)) }));
  if (capNarrowed) appliedChips.push({ label: `${capLo}–${capHi} kW`, onRemove: () => setCapRange(null) });

  const mfrList = (store?.mfrCounts ?? []).slice(0, mfrExpanded ? 25 : 5);

  const fmtInt = (n: number) => n.toLocaleString('en-US');

  return (
    <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', minHeight: 0, height: 'calc(100vh - 46px)' }}>

      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 28px', borderBottom: '1px solid rgba(0,0,0,.08)', background: 'rgba(255,255,255,.9)', ...frosted, flex: 'none' }}>
        <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 600, letterSpacing: '-0.2px' }}>Products</span>
        <div style={{ display: 'flex', border: '1px solid #e0e0e0', borderRadius: 999, overflow: 'hidden', fontSize: 12.5 }}>
          {(['residential', 'commercial'] as const).map(s => {
            const on = app.segment === s;
            return (
              <span
                key={s}
                onClick={() => app.setSegment(s)}
                style={{
                  padding: '6px 16px', cursor: on ? 'default' : 'pointer',
                  ...(on ? { background: '#1d1d1f', color: '#fff', fontWeight: 600 } : { color: '#1d1d1f' }),
                }}
              >
                {s === 'residential' ? 'Residential' : 'Commercial'}
              </span>
            );
          })}
        </div>
        <span style={{ fontSize: 12, color: '#7a7a7a', border: '1px solid #e0e0e0', borderRadius: 999, padding: '5px 13px' }}>
          BAFA snapshot {app.bafaSnapshotDate} — verify eligibility before quoting
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#7a7a7a' }}>
          {fmtInt(filteredTotal)} of {fmtInt(store?.total ?? 0)} {app.segment} products
        </span>
        <div style={{ position: 'relative' }}>
          <span onClick={() => setSortOpen(o => !o)} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            Sort: {SORT_LABELS[sort]} <ChevronDown />
          </span>
          {sortOpen && (
            <>
              <div onClick={() => setSortOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 61, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.12)', padding: '6px 0', minWidth: 210 }}>
                {(Object.keys(SORT_LABELS) as ProductSort[]).map(key => (
                  <span
                    key={key}
                    onClick={() => { setSort(key); setSortOpen(false); }}
                    className="hp-row"
                    style={{ display: 'block', padding: '8px 16px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', ...(key === sort ? { fontWeight: 600, color: '#0066cc' } : {}) }}
                  >
                    {SORT_LABELS[key]}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowX: 'auto', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'stretch', minWidth: 1240, height: '100%', boxSizing: 'border-box' }}>

          {/* filter rail */}
          <div style={{ flex: '0 0 248px', boxSizing: 'content-box', borderRight: '1px solid rgba(0,0,0,.08)', padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 22, background: '#fff', overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={sectionLabel}>APPLIED</span>
                <span onClick={() => { app.setRefFilter(null); app.setMfrFilter([]); setCapRange(null); }} style={{ fontSize: 12, color: '#0066cc', cursor: 'pointer' }}>Clear all</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {appliedChips.map(chip => (
                  <span key={chip.label} onClick={chip.onRemove} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1d1d1f', color: '#fff', borderRadius: 999, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
                    {chip.label} <span style={{ opacity: 0.6 }}>×</span>
                  </span>
                ))}
                {appliedChips.length === 0 && <span style={{ fontSize: 12, color: '#7a7a7a' }}>No filters applied</span>}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={sectionLabel}>REFRIGERANT</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['R290', 'R32', 'R410A'].map(r => {
                  const on = app.refFilter === r;
                  return (
                    <span
                      key={r}
                      className="hp-press"
                      onClick={() => app.setRefFilter(on ? null : r)}
                      style={{
                        borderRadius: 999, padding: '5px 13px', fontSize: 12.5, cursor: 'pointer',
                        ...(on ? { background: '#0066cc', color: '#fff' } : { border: '1px solid #e0e0e0', color: '#1d1d1f' }),
                      }}
                    >
                      {r}
                    </span>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={sectionLabel}>MANUFACTURER</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13.5 }}>
                {mfrList.map(m => {
                  const on = app.mfrFilter.includes(m.name);
                  return (
                    <span
                      key={m.name}
                      onClick={() => app.setMfrFilter(on ? app.mfrFilter.filter(x => x !== m.name) : [...app.mfrFilter, m.name])}
                      style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}
                    >
                      <CheckBox on={on} size={15} radius={4} />
                      {m.name} <span style={{ marginLeft: 'auto', color: '#7a7a7a', fontSize: 12 }}>{m.count}</span>
                    </span>
                  );
                })}
                {!mfrExpanded && (
                  <span onClick={() => setMfrExpanded(true)} style={{ color: '#0066cc', fontSize: 12.5, cursor: 'pointer' }}>Show all 25 ›</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={sectionLabel}>CAPACITY (55°C)</span>
              {bounds ? (
                <div style={{ padding: '4px 2px 0' }}>
                  <div ref={trackRef} style={{ position: 'relative', height: 3, background: '#e0e0e0', borderRadius: 2, touchAction: 'none' }}>
                    <div style={{ position: 'absolute', left: `${pctOf(capLo)}%`, right: `${100 - pctOf(capHi)}%`, top: 0, bottom: 0, background: '#0066cc', borderRadius: 2 }} />
                    <span
                      onPointerDown={dragHandle('lo')}
                      style={{ position: 'absolute', left: `${pctOf(capLo)}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 15, height: 15, borderRadius: '50%', background: '#fff', border: '1px solid #d2d2d7', boxShadow: '0 1px 3px rgba(0,0,0,.15)', cursor: 'grab', touchAction: 'none' }}
                    />
                    <span
                      onPointerDown={dragHandle('hi')}
                      style={{ position: 'absolute', left: `${pctOf(capHi)}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 15, height: 15, borderRadius: '50%', background: '#fff', border: '1px solid #d2d2d7', boxShadow: '0 1px 3px rgba(0,0,0,.15)', cursor: 'grab', touchAction: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#7a7a7a', marginTop: 9 }}>
                    <span>{capLo} kW</span><span>{capHi} kW</span>
                  </div>
                </div>
              ) : (
                <span style={{ fontSize: 12, color: '#7a7a7a' }}>No capacity data in this segment.</span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={sectionLabel}>FÖRDERUNG · FUNDING</span>
              <span
                onClick={() => app.setBafaOnly(!app.bafaOnly)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, cursor: 'pointer', userSelect: 'none' }}
              >
                <span style={{ width: 34, height: 20, borderRadius: 999, background: app.bafaOnly ? '#0066cc' : '#d2d2d7', position: 'relative', display: 'inline-block', transition: 'background .18s ease' }}>
                  <span style={{ position: 'absolute', top: 2, left: app.bafaOnly ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .18s ease' }} />
                </span>
                BAFA-listed only
              </span>
              <span style={{ fontSize: 11.5, color: '#7a7a7a', lineHeight: 1.45 }}>BEG EM eligible units per BAFA list.</span>
              <span style={{ fontSize: 11, color: '#7a7a7a', lineHeight: 1.5, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                Between regular updates, list entries may change at a manufacturer's request or by decision of the issuing authority. All data is for reference only — final verification against the official sources is the user's responsibility.
              </span>
            </div>
          </div>

          {/* table */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: '1px solid rgba(0,0,0,.08)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: '0 12px', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid rgba(0,0,0,.08)', fontSize: 10.5, fontWeight: 600, letterSpacing: '.05em', color: '#7a7a7a', flex: 'none' }}>
              <span /><span>MODEL</span><span>MANUFACTURER</span>
              <span style={sort === 'kwAsc' || sort === 'kwDesc' ? { color: '#1d1d1f' } : undefined}>KW (55°){sort === 'kwDesc' ? ' ↓' : sort === 'kwAsc' ? ' ↑' : ''}</span>
              <span style={sort === 'cop2' ? { color: '#1d1d1f' } : undefined}>COP A2{sort === 'cop2' ? ' ↓' : ''}</span>
              <span style={sort === 'scop' ? { color: '#1d1d1f' } : undefined}>SCOP{sort === 'scop' ? ' ↓' : ''}</span>
              <span style={sort === 'noise' ? { color: '#1d1d1f' } : undefined}>NOISE{sort === 'noise' ? ' ↑' : ''}</span>
              <span>STATUS</span>
            </div>

            <div ref={scrollerRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {items.map(r => {
                const inCmp = app.compare.includes(r.id);
                const isSel = app.selectedId === r.id;
                return (
                  <div
                    key={r.id}
                    data-row-id={r.id}
                    className="hp-row"
                    onClick={() => app.setSelectedId(r.id)}
                    style={{
                      display: 'grid', gridTemplateColumns: GRID, gap: '0 12px', alignItems: 'center',
                      padding: '12px 20px', borderBottom: '1px solid #f0f0f0', fontSize: 13, cursor: 'pointer',
                      ...(isSel ? { background: '#f5f5f7', boxShadow: 'inset 2px 0 0 #0066cc' } : { background: '#fff' }),
                    }}
                  >
                    <CheckBox on={inCmp} size={16} radius={4} onClick={e => { e.stopPropagation(); app.toggleCompare(r.id); }} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 600, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.model}</span>
                      <span style={{ fontSize: 11, color: '#7a7a7a' }}>BAFA {r.bafaId}</span>
                    </span>
                    <span>{r.mfr}</span>
                    <span>{r.kw}</span>
                    <span style={{ fontWeight: 600 }}>{r.cop2}</span>
                    <span>{r.scop}</span>
                    <span>{r.noise === '—' ? '—' : `${r.noise} dB`}</span>
                    <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      <span style={{ border: '1px solid #e0e0e0', borderRadius: 999, padding: '2px 9px', fontSize: 10.5, background: '#fff' }}>BAFA</span>
                      {r.eprel && <span style={{ border: '1px solid #e0e0e0', borderRadius: 999, padding: '2px 9px', fontSize: 10.5, background: '#fff' }}>{r.label}</span>}
                      <span style={{ border: '1px solid #e0e0e0', borderRadius: 999, padding: '2px 9px', fontSize: 10.5, background: '#fff' }}>Sheet ready</span>
                    </span>
                  </div>
                );
              })}

              {/* skeleton rows — perceived-speed pattern while more rows stream in */}
              {(!store || nextCursor) && (
                <div ref={sentinelRef}>
                  <SkeletonRow widths={SK1} />
                  <SkeletonRow widths={SK2} dim />
                </div>
              )}
              <div style={{ padding: '11px 20px', fontSize: 12, color: '#7a7a7a' }}>
                Rows stream in as you scroll — no pagination. Click a row to inspect without leaving the list.
              </div>

              {/* compare expanded panel */}
              {showPanel && (
                <div ref={panelRef} style={{ borderTop: '1px solid rgba(0,0,0,.08)', background: '#f5f5f7', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 600, letterSpacing: '-0.2px' }}>Comparison</span>
                    <span style={{ fontSize: 12, color: '#7a7a7a' }}>{compareCount} of 4 products</span>
                    <span onClick={() => app.setShowCompare(false)} style={{ marginLeft: 'auto', fontSize: 13, color: '#0066cc', cursor: 'pointer' }}>Collapse ×</span>
                  </div>
                  <div style={{ display: 'flex', gap: 0, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 18, overflow: 'hidden' }}>
                    <div style={{ flex: '0 0 168px', display: 'flex', flexDirection: 'column', borderRight: '1px solid #f0f0f0', padding: '18px 0 14px 20px', fontSize: 12.5, color: '#7a7a7a' }}>
                      <span style={{ height: 52 }} />
                      {['Capacity 55°C', 'COP A7/W35', 'COP A2/W35', 'SCOP', 'Sound power', 'Refrigerant', 'Energy class', 'BAFA ID'].map(l => (
                        <span key={l} style={{ padding: '9px 0', borderTop: '1px solid #f0f0f0' }}>{l}</span>
                      ))}
                    </div>
                    {compareItems.map(c => (
                      <div key={c.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '18px 20px 14px', borderRight: '1px solid #f0f0f0', fontSize: 13.5, minWidth: 0 }}>
                        <span style={{ height: 52, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontWeight: 600, lineHeight: 1.25 }}>{c.model}</span>
                          <span style={{ fontSize: 11.5, color: '#7a7a7a' }}>
                            {c.mfr} · <span onClick={() => app.toggleCompare(c.id)} style={{ color: '#0066cc', cursor: 'pointer' }}>remove</span>
                          </span>
                        </span>
                        <span style={{ padding: '9px 0', borderTop: '1px solid #f0f0f0', fontWeight: 600 }}>{c.kw} kW</span>
                        <span style={{ padding: '9px 0', borderTop: '1px solid #f0f0f0' }}>{c.cop7}</span>
                        <span style={{ padding: '9px 0', borderTop: '1px solid #f0f0f0' }}>{c.cop2}</span>
                        <span style={{ padding: '9px 0', borderTop: '1px solid #f0f0f0' }}>{c.scop}</span>
                        <span style={{ padding: '9px 0', borderTop: '1px solid #f0f0f0' }}>{c.noise === '—' ? '—' : `${c.noise} dB(A)`}</span>
                        <span style={{ padding: '9px 0', borderTop: '1px solid #f0f0f0' }}>{c.refKg === '—' ? c.ref : `${c.ref} · ${c.refKg} kg`}</span>
                        <span style={{ padding: '9px 0', borderTop: '1px solid #f0f0f0' }}>{c.label}</span>
                        <span style={{ padding: '9px 0', borderTop: '1px solid #f0f0f0', fontSize: 12, color: '#7a7a7a' }}>{c.bafaId}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* compare tray — docked, frosted */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderTop: '1px solid rgba(0,0,0,.08)', background: 'rgba(245,245,247,.92)', ...frosted, flex: 'none' }}>
              <span style={sectionLabel}>COMPARE</span>
              {compareItems.map(t => (
                <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 999, padding: '6px 14px', fontSize: 12.5 }}>
                  {t.shortName} <span onClick={() => app.toggleCompare(t.id)} style={{ color: '#7a7a7a', cursor: 'pointer' }}>×</span>
                </span>
              ))}
              <span style={{ fontSize: 12, color: '#7a7a7a' }}>
                {compareCount >= 4 ? 'tray full' : `+ ${4 - compareCount} more slot${4 - compareCount === 1 ? '' : 's'}`}
              </span>
              <span
                className="hp-press"
                onClick={() => {
                  if (canCompare || app.showCompare) app.setShowCompare(!app.showCompare);
                  else app.notify(`Select at least 2 products to compare — tick the checkbox on each row (${compareCount} of 2 selected).`);
                }}
                style={{
                  marginLeft: 'auto', borderRadius: 999, padding: '9px 22px', fontSize: 13.5, cursor: 'pointer',
                  ...(canCompare ? { background: '#0066cc', color: '#fff' } : { background: '#d2d2d7', color: '#fff' }),
                }}
              >
                {app.showCompare ? 'Hide comparison' : `Compare ${compareCount} ›`}
              </span>
            </div>
          </div>

          {/* inspector */}
          {sel && (
            <div style={{ flex: '0 0 400px', display: 'flex', flexDirection: 'column', background: '#f5f5f7', minWidth: 0, overflow: 'auto' }}>
              <div style={{ padding: '20px 24px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#7a7a7a' }}>{sel.mfr} · BAFA {sel.bafaId}</span>
                  <span onClick={() => app.setSelectedId(null)} style={{ fontSize: 13, color: '#7a7a7a', cursor: 'pointer' }}>×</span>
                </div>
                <span style={{ fontFamily: FD, fontSize: 21, fontWeight: 600, letterSpacing: '-0.28px', lineHeight: 1.18 }}>{sel.model}</span>
              </div>
              <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 18, padding: '18px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px 12px' }}>
                  {([
                    ['Capacity 55°C', sel.kw === '—' ? '—' : `${sel.kw} kW`],
                    ['SCOP', sel.scop],
                    ['Class', sel.label],
                    ['COP A7/W35', sel.cop7],
                    ['COP A2/W35', sel.cop2],
                    ['COP A−7/W35', sel.copm7],
                    ['Refrigerant', sel.refKg === '—' ? sel.ref : `${sel.ref} · ${sel.refKg} kg`],
                    ['Sound power', sel.noise === '—' ? '—' : `${sel.noise} dB(A)`],
                    ['Type', sel.installType],
                  ] as [string, string][]).map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 10.5, color: '#7a7a7a' }}>{label}</span>
                      <span style={{ fontSize: 16, fontWeight: 600 }}>{value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 18, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <span style={{ ...sectionLabel, fontSize: 10.5 }}>FÖRDERSTATUS · FUNDING</span>
                  <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                    Listed in BAFA source snapshot ({app.bafaSnapshotDate}). Potentially eligible under BEG EM — up to 40% with the climate-speed bonus.
                  </span>
                  <span style={{ fontSize: 12, color: '#7a7a7a' }}>
                    Verify current eligibility with BAFA before quoting.{' '}
                    <span onClick={() => window.open('https://www.bafa.de', '_blank', 'noopener')} style={{ color: '#0066cc', cursor: 'pointer' }}>Open BAFA entry ›</span>
                  </span>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 18, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <span style={{ ...sectionLabel, fontSize: 10.5 }}>EU ENERGY LABEL</span>
                  {sel.eprel ? (
                    <>
                      <span style={{ fontSize: 13.5 }}>EPREL matched · class {sel.label} (W35) / {sel.labelMed} (W55)</span>
                      <span onClick={() => app.openLabelRecord(sel.id)} style={{ fontSize: 12.5, color: '#0066cc', cursor: 'pointer' }}>Open label record ›</span>
                    </>
                  ) : (
                    <span style={{ fontSize: 13.5, color: '#7a7a7a' }}>No EPREL match yet — label data pending.</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="hp-press" onClick={() => app.openDataSheet(sel.id, 'product')} style={pillPrimary}>Data sheet ›</span>
                  <span className="hp-press" onClick={() => app.toggleCompare(sel.id)} style={pillSecondary}>
                    {app.compare.includes(sel.id) ? 'Remove from compare' : 'Add to compare'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
