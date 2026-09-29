/**
 * ProductActions — the Premium feature slot under a product's detail view
 * (desktop inspector + phone/tablet detail). Each feature owns its component;
 * this file only composes them so the pages never import feature internals.
 */
import React from 'react';
import { HpApp } from '../appState';
import { HpVM } from '../model';
import { WatchButton } from './watch/WatchButton';
import { AddToProject } from './projects/AddToProject';
import { SimilarModels } from './similar/SimilarModels';
import { setToolTarget } from './toolTarget';
import { tr } from '../i18n';

const toolBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #d2d2d7', borderRadius: 999,
  padding: '7px 13px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#1d1d1f',
};

export const ProductActions: React.FC<{ app: HpApp; v: HpVM; compact?: boolean }> = ({ app, v, compact }) => (
  <div data-testid="product-actions" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <WatchButton app={app} v={v} />
      <AddToProject app={app} ids={[v.id]} />
    </div>
    {/* Calculators open with this model preselected (Premium tools; the pages gate). */}
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <span className="hp-press" data-testid="open-noise" style={toolBtn} onClick={() => { setToolTarget(v.id); app.go('noise'); }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" /></svg>
        {tr(app.lang).nav.noise}
      </span>
      <span className="hp-press" data-testid="open-cost" style={toolBtn} onClick={() => { setToolTarget(v.id); app.go('cost'); }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15 8.5a3.5 3.5 0 1 0 0 7M8 11h5M8 13h5" /></svg>
        {tr(app.lang).nav.cost}
      </span>
    </div>
    <SimilarModels app={app} v={v} compact={compact} />
  </div>
);
