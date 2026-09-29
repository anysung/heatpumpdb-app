/**
 * WatchButton — "Watch model" (star) + "Watch all <manufacturer> models"
 * under a product's detail (desktop inspector + phone/tablet detail).
 * Premium feature: Standard accounts get the upgrade prompt.
 */
import React, { useState } from 'react';
import { HpApp } from '../../appState';
import { HpVM } from '../../model';
import { PremiumPill } from '../../Premium';
import { watchStrings } from './strings';
import { useWatchlist, addWatch, removeWatch, watchDocId, mfrSlug, WATCH_LIMIT, WatchType } from './watchModel';

const Star: React.FC<{ on: boolean }> = ({ on }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill={on ? '#f5a623' : 'none'} stroke={on ? '#f5a623' : 'currentColor'} strokeWidth="2" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" />
  </svg>
);
const Bell: React.FC<{ on: boolean }> = ({ on }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={on ? '#0066cc' : 'none'} stroke={on ? '#0066cc' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" />
  </svg>
);

const pill = (on: boolean, primary: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 999, cursor: 'pointer',
  padding: primary ? '8px 15px' : '7px 13px', fontSize: primary ? 13 : 12.5, fontWeight: primary ? 600 : 500,
  border: `1px solid ${on ? (primary ? '#f5c46b' : '#9cc3ee') : '#d2d2d7'}`,
  background: on ? (primary ? '#fff8e8' : '#eef5fd') : '#fff', color: '#1d1d1f', userSelect: 'none',
});

export const WatchButton: React.FC<{ app: HpApp; v: HpVM }> = ({ app, v }) => {
  const s = watchStrings(app.lang);
  const uid = app.premium ? app.user?.id : null;
  const { items } = useWatchlist(uid);
  const [busy, setBusy] = useState(false);

  const modelId = watchDocId('model', v.id);
  const slug = mfrSlug(v.mfr);
  const mfrId = watchDocId('manufacturer', slug);
  const modelOn = items.some(i => i.docId === modelId);
  const mfrOn = items.some(i => i.docId === mfrId);

  const toggle = async (type: WatchType) => {
    if (!app.premium) { app.upsell(); return; }
    if (!uid || busy) return;
    const on = type === 'model' ? modelOn : mfrOn;
    const docId = type === 'model' ? modelId : mfrId;
    if (!on && items.length >= WATCH_LIMIT) { app.notify(s.limit(WATCH_LIMIT)); return; }
    setBusy(true);
    try {
      if (on) await removeWatch(uid, docId);
      else if (type === 'model') await addWatch(uid, 'model', v.id, `${v.mfr} ${v.model}`, app.lang);
      else await addWatch(uid, 'manufacturer', slug, v.mfr, app.lang);
      app.notify(on ? s.removed : s.added);
    } catch {
      app.notify(s.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="watch-controls" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <span
        role="button" aria-pressed={modelOn} className="hp-press" data-testid="watch-model"
        onClick={() => toggle('model')} style={pill(modelOn, true)}
      >
        <Star on={modelOn} />
        {modelOn ? s.watching : s.watchModel}
        {!app.premium && <PremiumPill app={app} style={{ marginLeft: 2 }} />}
      </span>
      {slug && (
        <span
          role="button" aria-pressed={mfrOn} className="hp-press" data-testid="watch-manufacturer"
          onClick={() => toggle('manufacturer')} style={pill(mfrOn, false)}
        >
          <Bell on={mfrOn} />
          {mfrOn ? s.watchingMfr(v.mfr) : s.watchMfr(v.mfr)}
        </span>
      )}
    </div>
  );
};
