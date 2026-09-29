/**
 * The workspace bar (owner 2026-09-29): ONE fixed bar rendered by the app shell
 * above every workspace page — so it never moves or resizes between Projects,
 * Watchlist, Noise check and Running cost. Four equal segments of equal weight;
 * hover enlarges the label and highlights the segment.
 */
import React from 'react';
import { HpApp, HpPage } from '../appState';
import { tr } from '../i18n';

export type WorkspacePage = 'projects' | 'watchlist' | 'noise' | 'cost';
export const WORKSPACE_PAGES: WorkspacePage[] = ['projects', 'watchlist', 'noise', 'cost'];
export const isWorkspacePage = (p: HpPage): p is WorkspacePage => (WORKSPACE_PAGES as string[]).includes(p);

const ICON: Record<WorkspacePage, string> = {
  projects: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  watchlist: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z',
  noise: 'M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4',
  cost: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15 8.5a3.5 3.5 0 1 0 0 7M8 11h5M8 13h5',
};

export const WorkspaceBar: React.FC<{ app: HpApp; compact?: boolean }> = ({ app, compact }) => {
  const n = tr(app.lang).nav as Record<string, string>;
  const active = app.page;
  return (
    <div
      data-tour="workspace"
      data-testid="workspace-bar"
      style={{ background: '#f5f5f7', borderBottom: '1px solid #e5e5ea', flex: 'none' }}
    >
      <div
        role="tablist"
        style={{
          maxWidth: 1160, margin: '0 auto', boxSizing: 'border-box',
          padding: compact ? '10px 10px' : '16px clamp(16px, 4vw, 48px)',
          display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: compact ? 6 : 12,
        }}
      >
        {WORKSPACE_PAGES.map(id => {
          const on = active === id;
          return (
            <span
              key={id}
              role="tab"
              aria-selected={on}
              data-testid={`workspace-tab-${id}`}
              className={on ? 'hp-ws-tab hp-ws-on' : 'hp-ws-tab'}
              onClick={() => app.go(id)}
              style={{
                display: 'flex', flexDirection: compact ? 'column' : 'row', alignItems: 'center', justifyContent: 'center',
                gap: compact ? 3 : 9, minWidth: 0, height: compact ? 60 : 52, borderRadius: 14, cursor: 'pointer',
                fontSize: compact ? 10.5 : 15, fontWeight: 650, textAlign: 'center', padding: compact ? '0 4px' : '0 8px', boxSizing: 'border-box',
                ...(on
                  ? { background: '#1d1d1f', color: '#fff', border: '1px solid #1d1d1f', boxShadow: '0 6px 18px -8px rgba(0,0,0,.45)' }
                  : { background: '#fff', color: '#1d1d1f', border: '1px solid #d2d2d7' }),
              }}
            >
              <svg width={compact ? 17 : 18} height={compact ? 17 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d={ICON[id]} /></svg>
              {/* Phone: long labels (DE "Betriebskosten & CO₂") wrap to two lines instead of being cut off. */}
              <span
                className="hp-ws-label"
                lang={app.lang}
                style={compact
                  ? { whiteSpace: 'normal', lineHeight: 1.12, hyphens: 'auto', overflowWrap: 'anywhere', maxWidth: '100%' }
                  : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}
              >{n[id]}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** @deprecated The shell renders WorkspaceBar; pages no longer place tabs. */
export const WorkspaceTabs: React.FC<{ app: HpApp; active: WorkspacePage; style?: React.CSSProperties }> = () => null;
