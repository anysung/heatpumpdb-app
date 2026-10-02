/**
 * WatchStar — the one-click "save to my watchlist" star for list rows and
 * search results (2026-10-02). ONE `useWatchStars` per page holds the live
 * list; rows only render the icon, so a 60-row table opens one listener.
 * Premium feature: Standard accounts get the upgrade prompt.
 */
import React, { useMemo, useState } from 'react';
import { HpApp } from '../../appState';
import { HpVM } from '../../model';
import { watchStrings } from './strings';
import { watchPageStrings } from './pageStrings';
import { useWatchlist, addWatch, removeWatch, watchDocId, MARKET, WATCH_LIMIT } from './watchModel';

export interface WatchStars {
  isOn: (id: string) => boolean;
  toggle: (v: Pick<HpVM, 'id' | 'mfr' | 'model'>) => void;
  count: number;
}

export function useWatchStars(app: HpApp): WatchStars {
  const s = watchStrings(app.lang);
  const uid = app.premium ? app.user?.id : null;
  const { items } = useWatchlist(uid);
  const [busy, setBusy] = useState(false);
  const ids = useMemo(() => new Set(items.filter(i => i.type === 'model' && i.market === MARKET).map(i => i.key)), [items]);
  const toggle: WatchStars['toggle'] = (v) => {
    if (!app.premium) { app.upsell(); return; }
    if (!uid || busy) return;
    const on = ids.has(v.id);
    if (!on && items.length >= WATCH_LIMIT) { app.notify(s.limit(WATCH_LIMIT)); return; }
    setBusy(true);
    (on ? removeWatch(uid, watchDocId('model', v.id)) : addWatch(uid, 'model', v.id, `${v.mfr} ${v.model}`, app.lang))
      .then(() => app.notify(on ? s.removed : s.added), () => app.notify(s.failed))
      .finally(() => setBusy(false));
  };
  return { isOn: id => ids.has(id), toggle, count: ids.size };
}

export const WatchStar: React.FC<{
  app: HpApp; stars: WatchStars; v: Pick<HpVM, 'id' | 'mfr' | 'model'>; size?: number; style?: React.CSSProperties;
}> = ({ app, stars, v, size = 17, style }) => {
  const p = watchPageStrings(app.lang);
  const on = stars.isOn(v.id);
  return (
    <span
      role="button" aria-pressed={on} title={on ? p.starOn : p.starOff} aria-label={on ? p.starOn : p.starOff}
      data-testid="watch-star" data-on={on} className="hp-press"
      onClick={e => { e.stopPropagation(); stars.toggle(v); }}
      style={{ display: 'inline-flex', cursor: 'pointer', color: on ? '#f5a623' : '#b0b0b5', flex: 'none', ...style }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill={on ? '#f5a623' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" />
      </svg>
    </span>
  );
};
