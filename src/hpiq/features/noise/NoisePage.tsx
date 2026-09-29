import React from 'react';
import { HpApp } from '../../appState';
import { WorkspaceTabs } from '../WorkspaceTabs';
/** Stub — feature 5 (noise check) replaces this. */
export const NoisePage: React.FC<{ app: HpApp }> = ({ app }) => (
  <div style={{ flex: 1, padding: 40 }} data-testid="noise-page"><WorkspaceTabs app={app} active="noise" /></div>
);
