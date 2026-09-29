import React from 'react';
import { HpApp } from '../../appState';
import { WorkspaceTabs } from '../WorkspaceTabs';
/** Stub — feature 6 (running cost & CO2) replaces this. */
export const CostPage: React.FC<{ app: HpApp }> = ({ app }) => (
  <div style={{ flex: 1, padding: 40 }} data-testid="cost-page"><WorkspaceTabs app={app} active="cost" /></div>
);
