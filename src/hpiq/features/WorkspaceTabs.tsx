/**
 * The workspace group's sub-navigation — one component so every workspace page
 * shows the same four tabs in the same order (2026-09-29).
 */
import React from 'react';
import { HpApp, HpPage } from '../appState';
import { tr } from '../i18n';
import { SubTabs } from '../ui';

export type WorkspacePage = 'projects' | 'watchlist' | 'noise' | 'cost';
export const WORKSPACE_PAGES: WorkspacePage[] = ['projects', 'watchlist', 'noise', 'cost'];

export const WorkspaceTabs: React.FC<{ app: HpApp; active: WorkspacePage; style?: React.CSSProperties }> = ({ app, active, style }) => {
  const n = tr(app.lang).nav;
  return (
    <SubTabs
      group="workspace"
      tabs={WORKSPACE_PAGES.map(id => ({ id, label: (n as Record<string, string>)[id] }))}
      active={active}
      onSelect={id => app.go(id as HpPage)}
      style={style}
    />
  );
};
