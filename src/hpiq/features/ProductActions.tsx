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

export const ProductActions: React.FC<{ app: HpApp; v: HpVM; compact?: boolean }> = ({ app, v, compact }) => (
  <div data-testid="product-actions" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <WatchButton app={app} v={v} />
      <AddToProject app={app} ids={[v.id]} />
    </div>
    <SimilarModels app={app} v={v} compact={compact} />
  </div>
);
