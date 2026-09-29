/**
 * Projects page (Premium feature 4, 2026-09-29) — customer shortlists.
 *
 * Workspace group (Projects | Watchlist sub-tabs). List → create / open;
 * detail → edit, delete, items table resolved from the FULL catalogue
 * (app.allStore; ids that vanished read "no longer in the current catalogue"),
 * per-item notes, compare (desktop), open product, Project PDF.
 * Standard accounts see a teaser that routes to the one upgrade prompt.
 */
import { WorkspaceTabs } from '../WorkspaceTabs';
import { QaMark, qaStyle } from '../../QaMark';
import React, { useEffect, useMemo, useState } from 'react';
import { HpApp } from '../../appState';
import { HpVM, shortDate } from '../../model';
import { tr } from '../../i18n';
import { FD, SubTabs, CheckBox, sectionLabel, pillPrimary, pillSecondary } from '../../ui';
import { ListingChip } from '../../ListingChip';
import { PremiumPill } from '../../Premium';
import { useViewport } from '../../useViewport';
import { SOURCE_ID_ABBR } from '../../market';
import { isIos } from '../../pwaInstall';
import { downloadPdf, printPdfViaShareSheet } from '../../pdf/deliverPdf';
import { classifyProductSegment } from '../../../config/segmentation';
import { Project, MAX_NAME, MAX_CUSTOMER, MAX_NOTES, MAX_ITEM_NOTE } from './projectModel';
import { ProjectBackend } from './projectStore';
import { useProjects } from './useProjects';
import { projectStrings, ProjectStrings } from './strings';
import { buildProjectPdf, projectPdfFileName } from './projectPdf';

const PAGE: React.CSSProperties = { flex: 1, background: '#f5f5f7', minHeight: 'calc(100vh - 60px)' };
const INNER: React.CSSProperties = { maxWidth: 1160, width: '100%', margin: '0 auto', padding: '24px clamp(16px, 4vw, 48px) 56px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 18 };
const TITLE: React.CSSProperties = { fontFamily: FD, fontSize: 'clamp(25px, 4vw, 34px)', fontWeight: 600, letterSpacing: '-0.374px', color: '#1d1d1f' };
const CARD: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: 18, boxSizing: 'border-box' };
const INPUT: React.CSSProperties = { border: '1px solid #d2d2d7', borderRadius: 10, padding: '9px 12px', fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', background: '#fff', color: '#1d1d1f' };
const LINK: React.CSSProperties = { color: '#0066cc', cursor: 'pointer', fontSize: 13 };
const SMALL_BTN: React.CSSProperties = { ...pillSecondary, padding: '7px 14px', fontSize: 12.5 };

const fmtDate = (ms: number | null, locale: string) => (ms ? shortDate(new Date(ms).toISOString(), locale) : '—');

export const ProjectsPage: React.FC<{ app: HpApp }> = ({ app }) => {
  const s = projectStrings(app.lang);
  const t = tr(app.lang);
  const { backend, projects, error } = useProjects(app.user, app.premium);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? projects?.find(p => p.id === openId) ?? null : null;

  // A project deleted elsewhere (team member) closes its detail view.
  useEffect(() => { if (openId && projects && !open) setOpenId(null); }, [openId, projects, open]);

  return (
    <div style={PAGE} data-testid="projects-page">
      <div style={INNER}>
        {!app.premium ? (
          <Teaser app={app} s={s} />
        ) : open ? (
          <ProjectDetail app={app} s={s} backend={backend} project={open} onBack={() => setOpenId(null)} />
        ) : (
          <ProjectList app={app} s={s} backend={backend} projects={projects} error={error} onOpen={setOpenId} />
        )}
      </div>
    </div>
  );
};

/* ── Standard: teaser ──────────────────────────────────────────────────── */

const Teaser: React.FC<{ app: HpApp; s: ProjectStrings }> = ({ app, s }) => (
  <>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
      <span style={TITLE}>{s.title}</span><PremiumPill app={app} />
    </div>
    <div data-testid="projects-teaser" style={{ ...CARD, padding: '26px 26px 24px', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
      <span style={{ fontFamily: FD, fontSize: 20, fontWeight: 700 }}>{s.teaserTitle}</span>
      <span style={{ fontSize: 14, color: '#3a3a3c', lineHeight: 1.55 }}>{s.teaserBody}</span>
      <span className="hp-press" data-testid="projects-unlock" onClick={app.upsell} style={{ ...pillPrimary, alignSelf: 'flex-start', fontWeight: 700 }}>{s.unlock}</span>
    </div>
  </>
);

/* ── List ──────────────────────────────────────────────────────────────── */

const ScopeLine: React.FC<{ app: HpApp; s: ProjectStrings; backend: ProjectBackend }> = ({ app, s, backend }) => (
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
    <span data-testid="projects-scope" style={{ fontSize: 11.5, fontWeight: 600, borderRadius: 999, padding: '3px 10px', background: backend.shared ? '#e8f5ee' : '#eef0f3', color: backend.shared ? '#0a6847' : '#555' }}>
      {backend.shared ? s.shared : s.personal}
    </span>
    {backend.memory && <span style={{ fontSize: 11.5, color: '#8a6a1f' }}>{s.previewNote}</span>}
  </div>
);

const ProjectForm: React.FC<{
  s: ProjectStrings;
  initial?: { name: string; customer: string; notes: string };
  submitLabel: string;
  onSubmit: (v: { name: string; customer: string; notes: string }) => Promise<void>;
  onCancel: () => void;
}> = ({ s, initial, submitLabel, onSubmit, onCancel }) => {
  const [v, setV] = useState(initial ?? { name: '', customer: '', notes: '' });
  const [busy, setBusy] = useState(false);
  return (
    <form
      data-testid="project-form"
      onSubmit={async e => {
        e.preventDefault();
        if (!v.name.trim() || busy) return;
        setBusy(true);
        try { await onSubmit(v); } finally { setBusy(false); }
      }}
      style={{ ...CARD, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <input data-testid="project-name" style={INPUT} autoFocus maxLength={MAX_NAME} placeholder={s.namePh} value={v.name} onChange={e => setV({ ...v, name: e.target.value })} />
      <input data-testid="project-customer" style={INPUT} maxLength={MAX_CUSTOMER} placeholder={s.customerPh} value={v.customer} onChange={e => setV({ ...v, customer: e.target.value })} />
      <textarea data-testid="project-notes" style={{ ...INPUT, minHeight: 70, resize: 'vertical' }} maxLength={MAX_NOTES} placeholder={s.notesPh} value={v.notes} onChange={e => setV({ ...v, notes: e.target.value })} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" data-testid="project-submit" disabled={!v.name.trim() || busy} style={{ ...pillPrimary, border: 'none', fontFamily: 'inherit', opacity: v.name.trim() ? 1 : 0.5 }}>{submitLabel}</button>
        <button type="button" onClick={onCancel} style={{ ...pillSecondary, fontFamily: 'inherit', color: '#1d1d1f' }}>{s.cancel}</button>
      </div>
    </form>
  );
};

const ProjectList: React.FC<{
  app: HpApp; s: ProjectStrings; backend: ProjectBackend;
  projects: Project[] | null; error: boolean; onOpen: (id: string) => void;
}> = ({ app, s, backend, projects, error, onOpen }) => {
  const t = tr(app.lang);
  const [creating, setCreating] = useState(false);
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ ...TITLE, flex: '1 1 auto' }}>{s.title}</span>
        {!creating && (
          <span className="hp-press" data-testid="project-new" onClick={() => setCreating(true)} style={{ ...pillPrimary, fontWeight: 600 }}>+ {s.newProject}</span>
        )}
      </div>
      <span style={{ fontSize: 14, color: '#6e6e73', lineHeight: 1.5, marginTop: -8 }}>{s.subtitle}</span>
      <ScopeLine app={app} s={s} backend={backend} />
      {creating && (
        <ProjectForm
          s={s}
          submitLabel={s.create}
          onCancel={() => setCreating(false)}
          onSubmit={async v => {
            try {
              const { id } = await backend.create(v);
              setCreating(false);
              onOpen(id);
            } catch (e) { console.warn('[projects] create failed', e); app.notify(s.saveFailed); }
          }}
        />
      )}
      {error && <span style={{ fontSize: 13, color: '#a33' }}>{s.loadFailed}</span>}
      {projects == null && !error && <span style={{ fontSize: 13, color: '#7a7a7a' }}>…</span>}
      {projects?.length === 0 && !creating && (
        <div style={{ ...CARD, padding: '26px 22px', fontSize: 14, color: '#6e6e73', lineHeight: 1.55 }}>{s.empty}</div>
      )}
      {!!projects?.length && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14 }}>
          {projects.map(p => (
            <div
              key={p.id}
              className="hp-press"
              data-testid="project-card"
              onClick={() => onOpen(p.id)}
              style={{ ...CARD, padding: '16px 18px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}
            >
              <span style={{ fontFamily: FD, fontSize: 17, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
              <span style={{ fontSize: 13, color: '#3a3a3c', minHeight: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.customer || ' '}</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#7a7a7a', marginTop: 4 }}>
                <span>{s.models(p.items.length)}</span>
                <span>{s.updated(fmtDate(p.updatedAt, t.locale))}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

/* ── Detail ────────────────────────────────────────────────────────────── */

const NoteInput: React.FC<{ value: string; placeholder: string; onSave: (v: string) => void }> = ({ value, placeholder, onSave }) => {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      data-testid="project-item-note"
      value={v}
      maxLength={MAX_ITEM_NOTE}
      placeholder={placeholder}
      onChange={e => setV(e.target.value)}
      onBlur={() => { if (v.trim() !== value) onSave(v.trim()); }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      style={{ ...INPUT, padding: '6px 9px', fontSize: 12.5 }}
    />
  );
};

const ProjectDetail: React.FC<{
  app: HpApp; s: ProjectStrings; backend: ProjectBackend; project: Project; onBack: () => void;
}> = ({ app, s, backend, project, onBack }) => {
  const t = tr(app.lang);
  const viewport = useViewport();
  const phone = viewport === 'phone';
  const [editing, setEditing] = useState(false);
  const [sel, setSel] = useState<string[]>([]);

  const rows = useMemo(
    () => project.items.map(it => ({ item: it, v: app.allStore?.byId.get(it.id) ?? null as HpVM | null })),
    [project.items, app.allStore],
  );
  // Drop selections that no longer exist in the project.
  useEffect(() => { setSel(prev => prev.filter(id => project.items.some(i => i.id === id))); }, [project.items]);

  const fail = (e: unknown) => { console.warn('[projects] write failed', e); app.notify(s.saveFailed); };

  const toggleSel = (id: string) => setSel(prev => {
    if (prev.includes(id)) return prev.filter(x => x !== id);
    if (prev.length >= 4) { app.notify(s.compareHint); return prev; }
    return [...prev, id];
  });

  const compareSelected = () => {
    const vs = sel.map(id => app.allStore?.byId.get(id)).filter((v): v is HpVM => !!v);
    const seg = vs.length ? classifyProductSegment(vs[0].ratedKwNum) : 'unclassified';
    const ids = vs.filter(v => classifyProductSegment(v.ratedKwNum) === seg && seg !== 'unclassified').map(v => v.id).slice(0, 4);
    if (ids.length < 2) { app.notify(s.compareHint); return; }
    if (ids.length < sel.length) app.notify(s.compareSegment);
    // Replace the tray: clear it, land on the right segment, then fill it.
    // Every setter is a functional update, so the order holds within the batch.
    app.compare.forEach(id => app.toggleCompare(id));
    app.openProduct(ids[0]);
    ids.forEach(id => app.toggleCompare(id));
    app.setShowCompare(true);
  };

  const openProduct = (id: string) => {
    // The phone shell has no inspector on the products list — its full
    // product view is the data sheet.
    if (phone) app.openDataSheet(id, 'product');
    else app.openProduct(id);
  };

  const makePdf = () => {
    try {
      const doc = buildProjectPdf({
        project,
        rows: rows.map(r => ({ id: r.item.id, note: r.item.note, v: r.v })),
        s, t, sourceAbbr: SOURCE_ID_ABBR,
      });
      const name = projectPdfFileName(project);
      if (isIos()) printPdfViaShareSheet(doc, name).catch(() => app.notify(s.pdfFailed));
      else downloadPdf(doc, name);
    } catch (e) { console.warn('[projects] pdf failed', e); app.notify(s.pdfFailed); }
  };

  const del = () => {
    if (!window.confirm(s.confirmDelete(project.name))) return;
    backend.remove(project.id).then(onBack, fail);
  };

  const soundOf = (v: HpVM) => (/^\d/.test(v.noise) ? `${v.noise} dB(A)` : v.noise);

  return (
    <>
      <span data-testid="project-back" onClick={onBack} style={{ ...LINK, alignSelf: 'flex-start', fontSize: 14 }}>{s.back}</span>

      {editing ? (
        <ProjectForm
          s={s}
          initial={{ name: project.name, customer: project.customer, notes: project.notes }}
          submitLabel={s.save}
          onCancel={() => setEditing(false)}
          onSubmit={async v => { try { await backend.update(project.id, v); setEditing(false); } catch (e) { fail(e); } }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span data-testid="project-title" style={{ ...TITLE, overflowWrap: 'anywhere' }}>{project.name}</span>
              {project.customer && <span style={{ fontSize: 15, color: '#3a3a3c' }}>{project.customer}</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="hp-press" data-testid="project-edit" onClick={() => setEditing(true)} style={SMALL_BTN}>{s.edit}</span>
              <span className="hp-press" data-testid="project-delete" onClick={del} style={{ ...SMALL_BTN, color: '#a33' }}>{s.del}</span>
            </div>
          </div>
          {project.notes && <span style={{ fontSize: 14, color: '#3a3a3c', lineHeight: 1.55, whiteSpace: 'pre-wrap', maxWidth: 760 }}>{project.notes}</span>}
          <ScopeLine app={app} s={s} backend={backend} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ ...sectionLabel, textTransform: 'uppercase', flex: '1 1 auto' }}>{s.models(project.items.length)}</span>
        {viewport === 'desktop' && project.items.length > 1 && (
          <span
            className="hp-press"
            data-testid="project-compare"
            onClick={compareSelected}
            title={s.compareHint}
            style={{ ...SMALL_BTN, opacity: sel.length >= 2 ? 1 : 0.55 }}
          >
            {s.compareSel(sel.length)}
          </span>
        )}
        {project.items.length > 0 && (
          <span className="hp-press" data-testid="project-pdf" onClick={makePdf} style={{ ...SMALL_BTN, background: '#1d1d1f', color: '#fff', border: '1px solid #1d1d1f' }}>{s.pdf}</span>
        )}
      </div>

      {project.items.length === 0 ? (
        <div style={{ ...CARD, padding: '24px 22px', fontSize: 14, color: '#6e6e73', lineHeight: 1.55 }}>{s.noItems}</div>
      ) : phone ? (
        /* Phone: one card per model. */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(({ item, v }) => (
            <div key={item.id} data-testid="project-item" style={{ ...CARD, borderRadius: 14, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {v ? (
                <>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span onClick={() => openProduct(v.id)} style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600, cursor: 'pointer', overflowWrap: 'anywhere' }}>{v.model}<QaMark v={v} lang={app.lang} size={13} /></span>
                    <ListingChip raw={v.raw} t={t} />
                  </div>
                  <span style={{ fontSize: 12, color: '#6e6e73' }}>
                    {v.mfr} · {v.ratedKw} kW · SCOP {v.scop} · {soundOf(v)} · {v.ref}
                  </span>
                </>
              ) : (
                <span data-testid="project-item-gone" style={{ fontSize: 13, color: '#8a6a1f' }}>{item.id} — {s.gone}</span>
              )}
              <NoteInput value={item.note ?? ''} placeholder={s.notePh} onSave={n => backend.setItemNote(project.id, item.id, n).catch(fail)} />
              <div style={{ display: 'flex', gap: 14 }}>
                {v && <span onClick={() => openProduct(v.id)} style={LINK}>{s.open}</span>}
                <span onClick={() => backend.removeItem(project.id, item.id).catch(fail)} style={{ ...LINK, color: '#a33' }}>{s.remove}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Tablet / desktop: table (scrolls sideways inside its card if needed). */
        <div style={{ ...CARD, overflowX: 'auto' }}>
          <div style={{ minWidth: 980 }}>
            <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 10, padding: '11px 16px', fontSize: 11, fontWeight: 600, color: '#7a7a7a', borderBottom: '1px solid #e0e0e0', letterSpacing: '.02em' }}>
              <span />
              <span>{s.colModel}</span><span>{s.colMfr}</span><span>{s.colKw}</span><span>{s.colScop}</span>
              <span>{s.colSound}</span><span>{s.colRef}</span><span>{s.colListing}</span><span>{s.colNote}</span><span />
            </div>
            {rows.map(({ item, v }) => (
              <div key={item.id} data-testid="project-item" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 10, padding: '10px 16px', fontSize: 13, alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
                <span style={{ display: 'inline-flex' }}>
                  {v && <CheckBox on={sel.includes(item.id)} size={16} onClick={() => toggleSel(item.id)} />}
                </span>
                {v ? (
                  <>
                    <span style={{ minWidth: 0 }}>
                      <span onClick={() => openProduct(v.id)} style={{ fontWeight: 600, display: 'block', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={v.model}>{v.model}<QaMark v={v} lang={app.lang} size={13} /></span>
                      <span style={{ fontSize: 11, color: '#7a7a7a' }}>{SOURCE_ID_ABBR} {v.sourceId}</span>
                    </span>
                    <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.mfr}</span>
                    <span>{v.ratedKw}</span>
                    <span style={qaStyle(v, 'scop')}>{v.scop}</span>
                    <span style={{ whiteSpace: 'nowrap' }}>{soundOf(v)}</span>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.ref}</span>
                    <span><ListingChip raw={v.raw} t={t} /></span>
                  </>
                ) : (
                  <span data-testid="project-item-gone" style={{ gridColumn: 'span 7', color: '#8a6a1f', fontSize: 12.5 }}>{item.id} — {s.gone}</span>
                )}
                <NoteInput value={item.note ?? ''} placeholder={s.notePh} onSave={n => backend.setItemNote(project.id, item.id, n).catch(fail)} />
                <span style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                  {v && <span onClick={() => openProduct(v.id)} style={LINK}>{s.open}</span>}
                  <span data-testid="project-item-remove" onClick={() => backend.removeItem(project.id, item.id).catch(fail)} style={{ ...LINK, color: '#a33' }}>{s.remove}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {viewport === 'desktop' && project.items.length > 1 && (
        <span style={{ fontSize: 12, color: '#7a7a7a' }}>{s.compareHint}</span>
      )}
    </>
  );
};

const GRID = '22px minmax(170px, 2.2fr) minmax(90px, 1fr) 58px 50px 78px 70px 120px minmax(150px, 1.6fr) 100px';
