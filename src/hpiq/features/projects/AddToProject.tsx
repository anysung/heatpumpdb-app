/**
 * "Add to project" (Premium feature 4). `ids` is one product (inspector /
 * phone detail) or every compared model (comparison header). Renders nothing
 * without ids. Standard accounts get the button with a Premium pill → upsell.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HpApp } from '../../appState';
import { PremiumPill } from '../../Premium';
import { MergeResult, MAX_CANDIDATES, MAX_NAME } from './projectModel';
import { useProjects } from './useProjects';
import { projectStrings } from './strings';

const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  border: '1px solid #d2d2d7', borderRadius: 999, padding: '7px 14px',
  fontSize: 12.5, fontWeight: 600, background: '#fff', color: '#1d1d1f', cursor: 'pointer', whiteSpace: 'nowrap',
};

const FolderIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M12 11v5M9.5 13.5h5" />
  </svg>
);

export const AddToProject: React.FC<{ app: HpApp; ids: string[]; label?: string }> = ({ app, ids, label }) => {
  const s = projectStrings(app.lang);
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const { backend, projects, error } = useProjects(app.user, open && app.premium);

  if (!ids.length) return null;
  // Readable names for the project's history line ("Candidate added: …").
  const labels = Object.fromEntries(ids.map(id => { const m = app.allStore?.byId.get(id); return [id, m ? `${m.mfr} ${m.model}` : id]; }));
  const text = label ?? (ids.length > 1 ? s.addToN(ids.length) : s.addTo);

  return (
    <>
      <span
        ref={anchor}
        className="hp-press"
        data-testid="add-to-project"
        onClick={e => { e.stopPropagation(); if (!app.premium) { app.upsell(); return; } setOpen(o => !o); }}
        style={btn}
      >
        <FolderIcon />{text}{!app.premium && <PremiumPill app={app} style={{ marginLeft: 2 }} />}
      </span>
      {open && app.premium && (
        <Popover
          anchor={anchor.current}
          onClose={() => setOpen(false)}
          app={app}
          ids={ids}
          projects={projects}
          error={error}
          onAdd={async pid => {
            const p = projects?.find(x => x.id === pid);
            try {
              const r = await backend.addItems(pid, ids, labels);
              app.notify(toast(s, r, p?.name ?? ''));
              setOpen(false);
            } catch (e) { console.warn('[projects] add failed', e); app.notify(s.saveFailed); }
          }}
          onCreate={async name => {
            try {
              const { merge } = await backend.create({ name }, ids);
              app.notify(toast(s, merge, name));
              setOpen(false);
            } catch (e) { console.warn('[projects] create failed', e); app.notify(s.saveFailed); }
          }}
        />
      )}
    </>
  );
};

function toast(s: ReturnType<typeof projectStrings>, r: MergeResult, name: string): string {
  if (r.added === 0) return r.overCap ? s.full(MAX_CANDIDATES) : s.already(name);
  if (r.overCap) return `${s.addedSome(r.added, name)} · ${s.full(MAX_CANDIDATES)}`;
  if (r.duplicates) return s.addedSome(r.added, name);
  return s.added(name);
}

const Popover: React.FC<{
  anchor: HTMLElement | null;
  onClose: () => void;
  app: HpApp;
  ids: string[];
  projects: import('./projectModel').Project[] | null;
  error: boolean;
  onAdd: (pid: string) => void;
  onCreate: (name: string) => void;
}> = ({ anchor, onClose, app, ids, projects, error, onAdd, onCreate }) => {
  const s = projectStrings(app.lang);
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const W = 290;

  useLayoutEffect(() => {
    const place = () => {
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8));
      const h = box.current?.offsetHeight ?? 260;
      const below = r.bottom + 6;
      const top = below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 6) : below;
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [anchor, projects]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (box.current?.contains(t) || anchor?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [anchor, onClose]);

  const run = async (fn: () => Promise<void> | void) => { if (busy) return; setBusy(true); try { await fn(); } finally { setBusy(false); } };

  return createPortal(
    <div
      ref={box}
      className="hpiq-root"
      data-testid="add-to-project-popover"
      onClick={e => e.stopPropagation()}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: W, zIndex: 300, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 14, boxShadow: '0 12px 32px rgba(0,0,0,.18)', padding: 8, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {projects == null && !error && <span style={{ fontSize: 12.5, color: '#7a7a7a', padding: '8px 10px' }}>…</span>}
        {error && <span style={{ fontSize: 12.5, color: '#a33', padding: '8px 10px' }}>{s.loadFailed}</span>}
        {projects?.map(p => {
          const all = ids.every(id => p.items.some(i => i.id === id));
          return (
            <span
              key={p.id}
              className="hp-press"
              data-testid="add-to-project-item"
              onClick={() => run(() => onAdd(p.id))}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, cursor: 'pointer', fontSize: 13 }}
            >
              <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>{p.name}</span>
              <span style={{ flex: 'none', fontSize: 11.5, color: all ? '#0a6847' : '#7a7a7a' }}>{all ? '✓' : ''} {Math.min(p.items.length, MAX_CANDIDATES)}/{MAX_CANDIDATES}</span>
            </span>
          );
        })}
      </div>
      {!!projects?.length && <div style={{ height: 1, background: '#f0f0f0', margin: '2px 4px' }} />}
      <form
        onSubmit={e => { e.preventDefault(); const n = name.trim(); if (n) run(() => onCreate(n)); }}
        style={{ display: 'flex', gap: 6, padding: 4 }}
      >
        <input
          data-testid="add-to-project-new"
          value={name}
          maxLength={MAX_NAME}
          autoFocus={!projects?.length}
          onChange={e => setName(e.target.value)}
          placeholder={s.newProject}
          style={{ flex: 1, minWidth: 0, border: '1px solid #d2d2d7', borderRadius: 9, padding: '7px 10px', fontSize: 13, fontFamily: 'inherit' }}
        />
        <button
          type="submit"
          data-testid="add-to-project-create"
          disabled={!name.trim() || busy}
          style={{ flex: 'none', border: 'none', borderRadius: 9, padding: '7px 11px', fontSize: 12.5, fontWeight: 600, background: name.trim() ? '#0066cc' : '#d2d2d7', color: '#fff', cursor: name.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}
        >
          {s.createAndAdd}
        </button>
      </form>
      {app.user.orgId && <span style={{ fontSize: 10.5, color: '#7a7a7a', padding: '0 8px 4px' }}>{s.shared}</span>}
    </div>,
    document.body,
  );
};
