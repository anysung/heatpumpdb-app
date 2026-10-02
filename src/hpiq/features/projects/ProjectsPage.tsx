/**
 * Projects page — the installer's job file (v2, owner 2026-10-02).
 *
 * ONE page: the project sheet on top (new-project form, or the opened project:
 * customer + site, building + system via drop-downs, status + planning, up to
 * four candidate models with the SAME comparison as Products, to-dos with due
 * dates, history), and below it two lists — Open projects and All projects —
 * collapsed by default, each with its own show/hide button.
 *
 * Candidates resolve from the FULL catalogue (app.allStore); ids that vanished
 * read "no longer in the current catalogue". Standard accounts see a teaser
 * that routes to the one upgrade prompt.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HpApp } from '../../appState';
import { HpVM, shortDate } from '../../model';
import { tr } from '../../i18n';
import { FD, sectionLabel, pillPrimary, pillSecondary } from '../../ui';
import { QaMark, QA_RED } from '../../QaMark';
import { ListingChip } from '../../ListingChip';
import { PremiumPill } from '../../Premium';
import { useViewport } from '../../useViewport';
import { SOURCE_ID_ABBR } from '../../market';
import { isIos } from '../../pwaInstall';
import { downloadPdf, printPdfViaShareSheet } from '../../pdf/deliverPdf';
import { compareRows, bestOf, cellFlagged } from '../../compareRows';
import { classifyProductSegment } from '../../../config/segmentation';
import { ComparePdfButton } from '../branding/ComparePdfButton';
import { setDocBrandingOptions } from '../branding/brandingState';
import { setToolTarget } from '../toolTarget';
import {
  Project, ProjectDetails, ProjectStatus, ProjectTask, DetailChoiceKey, DetailTextKey,
  STATUSES, CHOICES, MAX_CANDIDATES, MAX_TASKS, MAX_TASK_TEXT, MAX_NAME, MAX_CUSTOMER, MAX_NOTES,
  MAX_ITEM_NOTE, MAX_DETAIL, emptyDetails, isOpen, isStatus, sortTasks, nextTask, dueState, localDay, summarize, projectsCsv,
} from './projectModel';
import { ProjectBackend } from './projectStore';
import { useProjects } from './useProjects';
import { projectStrings, ProjectStrings } from './strings';
import { projectFormStrings, ProjectFormStrings } from './formStrings';
import { buildProjectPdf, projectPdfFileName } from './projectPdf';

const PAGE: React.CSSProperties = { flex: 1, background: '#f5f5f7', minHeight: 'calc(100vh - 60px)' };
const INNER: React.CSSProperties = { maxWidth: 1160, width: '100%', margin: '0 auto', padding: '24px clamp(16px, 4vw, 48px) 56px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 18 };
const TITLE: React.CSSProperties = { fontFamily: FD, fontSize: 'clamp(25px, 4vw, 34px)', fontWeight: 600, letterSpacing: '-0.374px', color: '#1d1d1f' };
const CARD: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: 18, boxSizing: 'border-box' };
const INPUT: React.CSSProperties = { border: '1px solid #d2d2d7', borderRadius: 10, padding: '9px 12px', fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', background: '#fff', color: '#1d1d1f', minWidth: 0 };
const LINK: React.CSSProperties = { color: '#0066cc', cursor: 'pointer', fontSize: 13 };
const SMALL_BTN: React.CSSProperties = { ...pillSecondary, padding: '7px 14px', fontSize: 12.5, color: '#1d1d1f', whiteSpace: 'nowrap' };
const SEC_TITLE: React.CSSProperties = { ...sectionLabel, textTransform: 'uppercase' };

const STATUS_COLOR: Record<ProjectStatus, [string, string]> = {
  lead: ['#eef0f3', '#3a3a3c'], survey: ['#eef5fd', '#0b5cad'], quote: ['#fff4e5', '#a15c00'], won: ['#e8f5ee', '#0a6847'],
  install: ['#e6f0ff', '#1d4ed8'], done: ['#e4efe6', '#1f6b3a'], hold: ['#f3eefc', '#5b3fa0'], lost: ['#fdecea', '#b3261e'],
};

const fmtMs = (ms: number | null, locale: string) => (ms ? shortDate(new Date(ms).toISOString(), locale) : '—');
const fmtDay = (d: string, locale: string) => (d ? shortDate(`${d}T12:00:00`, locale) : '—');

type Strs = { s: ProjectStrings; f: ProjectFormStrings };

export const ProjectsPage: React.FC<{ app: HpApp }> = ({ app }) => {
  const s = projectStrings(app.lang);
  const f = projectFormStrings(app.lang);
  const { backend, projects, error } = useProjects(app.user, app.premium);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? projects?.find(p => p.id === openId) ?? null : null;
  const sheetRef = useRef<HTMLDivElement>(null);
  const today = localDay();

  // A project deleted elsewhere (team member) closes its sheet.
  useEffect(() => { if (openId && projects && !open) setOpenId(null); }, [openId, projects, open]);

  const openProject = (id: string | null) => {
    setOpenId(id);
    requestAnimationFrame(() => sheetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  if (!app.premium) {
    return (
      <div style={PAGE} data-testid="projects-page">
        <div style={INNER}><Teaser app={app} s={s} /></div>
      </div>
    );
  }

  const sum = summarize(projects ?? [], today);
  const openList = (projects ?? []).filter(isOpen);

  return (
    <div style={PAGE} data-testid="projects-page">
      <div style={INNER}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ ...TITLE, flex: '0 1 auto' }}>{s.title}</span>
          <div data-testid="projects-summary" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: '1 1 auto' }}>
            <Chip bg="#eef0f3" color="#3a3a3c">{f.sumOpen(sum.open)}</Chip>
            {sum.dueSoon > 0 && <Chip bg="#eef5fd" color="#0b5cad">{f.sumDue(sum.dueSoon)}</Chip>}
            {sum.overdue > 0 && <Chip bg="#fdecea" color="#b3261e">{f.sumOverdue(sum.overdue)}</Chip>}
          </div>
          {open && (
            <span className="hp-press" data-testid="project-new" onClick={() => openProject(null)} style={{ ...pillPrimary, fontWeight: 600 }}>+ {s.newProject}</span>
          )}
        </div>
        <span style={{ fontSize: 14, color: '#6e6e73', lineHeight: 1.5, marginTop: -8 }}>{f.subtitle}</span>
        <ScopeLine s={s} backend={backend} />
        {error && <span style={{ fontSize: 13, color: '#a33' }}>{s.loadFailed}</span>}

        <div ref={sheetRef} style={{ scrollMarginTop: 150 }}>
          {open ? (
            <ProjectSheet key={open.id} app={app} s={s} f={f} backend={backend} project={open} onClose={() => openProject(null)} />
          ) : (
            <NewProjectForm app={app} s={s} f={f} backend={backend} onCreated={openProject} />
          )}
        </div>

        <ProjectListCard app={app} s={s} f={f} kind="open" projects={projects == null ? null : openList} openId={openId} onOpen={openProject} today={today} />
        <ProjectListCard app={app} s={s} f={f} kind="all" projects={projects} openId={openId} onOpen={openProject} today={today} />
        <span data-testid="projects-records" style={{ fontSize: 12, color: '#7a7a7a', lineHeight: 1.5 }}>{backend.shared ? f.recordNoteTeam : f.recordNote}</span>
      </div>
    </div>
  );
};

const Chip: React.FC<{ bg: string; color: string; children: React.ReactNode; testId?: string }> = ({ bg, color, children, testId }) => (
  <span data-testid={testId} style={{ fontSize: 11.5, fontWeight: 600, borderRadius: 999, padding: '3px 10px', background: bg, color, whiteSpace: 'nowrap' }}>{children}</span>
);
const StatusChip: React.FC<{ status: ProjectStatus; f: ProjectFormStrings }> = ({ status, f }) => (
  <Chip bg={STATUS_COLOR[status][0]} color={STATUS_COLOR[status][1]} testId="project-status-chip">{f.status[status]}</Chip>
);

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

const ScopeLine: React.FC<{ s: ProjectStrings; backend: ProjectBackend }> = ({ s, backend }) => (
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
    <span data-testid="projects-scope" style={{ fontSize: 11.5, fontWeight: 600, borderRadius: 999, padding: '3px 10px', background: backend.shared ? '#e8f5ee' : '#eef0f3', color: backend.shared ? '#0a6847' : '#555' }}>
      {backend.shared ? s.shared : s.personal}
    </span>
    {backend.memory && <span style={{ fontSize: 11.5, color: '#8a6a1f' }}>{s.previewNote}</span>}
  </div>
);

/* ── The form (shared by "new" and the opened project) ─────────────────── */

interface FormState {
  name: string; customer: string; notes: string;
  status: ProjectStatus; targetDate: string; details: ProjectDetails;
}
const blankForm = (): FormState => ({ name: '', customer: '', notes: '', status: 'lead', targetDate: '', details: emptyDetails() });
const formOf = (p: Project): FormState => ({ name: p.name, customer: p.customer, notes: p.notes, status: p.status, targetDate: p.targetDate, details: { ...p.details } });
const sameForm = (a: FormState, b: FormState) => JSON.stringify(a) === JSON.stringify(b);

const Field: React.FC<{ label: string; required?: boolean; wide?: boolean; children: React.ReactNode }> = ({ label, required, wide, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600, color: '#555', minWidth: 0, ...(wide ? { gridColumn: '1 / -1' } : {}) }}>
    <span>{label}{required && <span style={{ color: '#b3261e' }}> *</span>}</span>
    {children}
  </label>
);

const TEXT_FIELDS: { key: DetailTextKey; label: keyof ProjectFormStrings; type?: string; mode?: 'numeric' | 'decimal' | 'tel' | 'email'; wide?: boolean }[] = [
  { key: 'phone', label: 'fPhone', type: 'tel', mode: 'tel' },
  { key: 'email', label: 'fEmail', type: 'email', mode: 'email' },
  { key: 'address', label: 'fAddress', wide: true },
  { key: 'postcode', label: 'fPostcode' },
  { key: 'city', label: 'fCity' },
];
const BUILDING_CHOICES: { key: DetailChoiceKey; label: keyof ProjectFormStrings }[] = [
  { key: 'buildingType', label: 'fBuildingType' },
  { key: 'projectType', label: 'fProjectType' },
  { key: 'existing', label: 'fExisting' },
  { key: 'distribution', label: 'fDistribution' },
  { key: 'dhw', label: 'fDhw' },
  { key: 'supply', label: 'fSupply' },
];
const BUILDING_NUMBERS: { key: DetailTextKey; label: keyof ProjectFormStrings; mode: 'numeric' | 'decimal' }[] = [
  { key: 'area', label: 'fArea', mode: 'decimal' },
  { key: 'buildYear', label: 'fBuildYear', mode: 'numeric' },
  { key: 'heatLoad', label: 'fHeatLoad', mode: 'decimal' },
];

const FormFields: React.FC<{
  f: ProjectFormStrings; v: FormState; set: (v: FormState) => void;
  /** Existing project: a status change is saved at once (and logged). */
  onStatus?: (st: ProjectStatus) => void;
}> = ({ f, v, set, onStatus }) => {
  const det = (k: DetailTextKey | DetailChoiceKey, val: string) => set({ ...v, details: { ...v.details, [k]: val } });
  const section: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 };
  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(136px, 1fr))', gap: '11px 12px' };
  const select = (k: DetailChoiceKey) => (
    <select data-testid={`project-${k}`} style={INPUT} value={v.details[k]} onChange={e => det(k, e.target.value)}>
      <option value="">{f.choose}</option>
      {CHOICES[k].map(id => <option key={id} value={id}>{f.opt[k][id]}</option>)}
    </select>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '22px 28px' }}>
      <div style={section}>
        <span style={SEC_TITLE}>{f.secCustomer}</span>
        <div style={grid}>
          <Field label={f.fName} required wide>
            <input data-testid="project-name" style={INPUT} maxLength={MAX_NAME} value={v.name} onChange={e => set({ ...v, name: e.target.value })} />
          </Field>
          <Field label={f.fCustomer} required wide>
            <input data-testid="project-customer" style={INPUT} maxLength={MAX_CUSTOMER} value={v.customer} onChange={e => set({ ...v, customer: e.target.value })} />
          </Field>
          {TEXT_FIELDS.map(x => (
            <Field key={x.key} label={f[x.label] as string} wide={x.wide}>
              <input data-testid={`project-${x.key}`} style={INPUT} type={x.type ?? 'text'} inputMode={x.mode} maxLength={MAX_DETAIL} value={v.details[x.key]} onChange={e => det(x.key, e.target.value)} />
            </Field>
          ))}
        </div>
      </div>
      <div style={section}>
        <span style={SEC_TITLE}>{f.secBuilding}</span>
        <div style={grid}>
          {BUILDING_CHOICES.map(x => <Field key={x.key} label={f[x.label] as string}>{select(x.key)}</Field>)}
          {BUILDING_NUMBERS.map(x => (
            <Field key={x.key} label={f[x.label] as string}>
              <input data-testid={`project-${x.key}`} style={INPUT} inputMode={x.mode} maxLength={12} value={v.details[x.key]} onChange={e => det(x.key, e.target.value)} />
            </Field>
          ))}
        </div>
      </div>
      <div style={section}>
        <span style={SEC_TITLE}>{f.secPlanning}</span>
        <div style={grid}>
          <Field label={f.fStatus} required wide>
            <select
              data-testid="project-status" style={INPUT} value={v.status}
              onChange={e => { const st = e.target.value; if (!isStatus(st)) return; if (onStatus) onStatus(st); else set({ ...v, status: st }); }}
            >
              {STATUSES.map(st => <option key={st} value={st}>{f.status[st]}</option>)}
            </select>
          </Field>
          <Field label={f.fTarget} wide>
            <input data-testid="project-target" style={INPUT} type="date" value={v.targetDate} onChange={e => set({ ...v, targetDate: e.target.value })} />
          </Field>
          <Field label={f.fFunding} wide>{select('funding')}</Field>
          <Field label={f.fNotes} wide>
            <textarea data-testid="project-notes" style={{ ...INPUT, minHeight: 92, resize: 'vertical' }} maxLength={MAX_NOTES} value={v.notes} onChange={e => set({ ...v, notes: e.target.value })} />
          </Field>
        </div>
      </div>
    </div>
  );
};

/* ── New project ───────────────────────────────────────────────────────── */

const NewProjectForm: React.FC<Strs & { app: HpApp; backend: ProjectBackend; onCreated: (id: string) => void }> = ({ app, s, f, backend, onCreated }) => {
  const [v, setV] = useState<FormState>(blankForm);
  const [busy, setBusy] = useState(false);
  const ok = !!v.name.trim() && !!v.customer.trim();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!ok) { app.notify(f.needNameCustomer); return; }
    setBusy(true);
    try {
      const { id } = await backend.create(v);
      setV(blankForm());
      onCreated(id);
    } catch (err) { console.warn('[projects] create failed', err); app.notify(s.saveFailed); } finally { setBusy(false); }
  };
  return (
    <form data-testid="project-form" onSubmit={submit} style={{ ...CARD, padding: 'clamp(16px, 2.4vw, 24px)', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontFamily: FD, fontSize: 20, fontWeight: 650 }}>{f.newTitle}</span>
        <span style={{ fontSize: 12.5, color: '#7a7a7a' }}>{f.newHint}</span>
      </div>
      <FormFields f={f} v={v} set={setV} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="submit" data-testid="project-submit" disabled={busy} style={{ ...pillPrimary, border: 'none', fontFamily: 'inherit', fontWeight: 600, opacity: ok ? 1 : 0.55, cursor: 'pointer' }}>{f.createProject}</button>
        {!sameForm(v, blankForm()) && <span onClick={() => setV(blankForm())} style={LINK}>{f.discard}</span>}
      </div>
    </form>
  );
};

/* ── Opened project ────────────────────────────────────────────────────── */

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

const ProjectSheet: React.FC<Strs & { app: HpApp; backend: ProjectBackend; project: Project; onClose: () => void }> = ({ app, s, f, backend, project, onClose }) => {
  const t = tr(app.lang);
  const [v, setV] = useState<FormState>(() => formOf(project));
  const [busy, setBusy] = useState(false);
  const stored = formOf(project);
  const dirty = !sameForm({ ...v, status: stored.status }, stored);

  // Documents made while this project is open default to its customer.
  useEffect(() => { if (project.customer) setDocBrandingOptions({ preparedFor: project.customer }); }, [project.id, project.customer]);
  // A status saved here or by a team member shows at once (the rest of the form is the user's draft).
  useEffect(() => { setV(cur => (cur.status === project.status ? cur : { ...cur, status: project.status })); }, [project.status]);

  const fail = (e: unknown) => { console.warn('[projects] write failed', e); app.notify(s.saveFailed); };
  const labelOf = (id: string) => { const m = app.allStore?.byId.get(id); return m ? `${m.mfr} ${m.model}` : id; };

  const save = async () => {
    if (busy) return;
    if (!v.name.trim() || !v.customer.trim()) { app.notify(f.needNameCustomer); return; }
    setBusy(true);
    try {
      await backend.mutate(project.id, () => ({
        patch: { name: v.name, customer: v.customer, notes: v.notes, targetDate: v.targetDate, details: v.details },
        log: [{ k: 'details' }],
      }));
      app.notify(f.saved);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const setStatus = (st: ProjectStatus) => {
    if (st === project.status) return;
    backend.mutate(project.id, p => ({ patch: { status: st }, log: [{ k: 'status', a: p.status, b: st }] })).catch(fail);
  };
  const del = () => {
    if (!window.confirm(s.confirmDelete(project.name))) return;
    backend.remove(project.id).then(onClose, fail);
  };

  const rows = useMemo(
    () => project.items.map(it => ({ item: it, v: app.allStore?.byId.get(it.id) ?? null as HpVM | null })),
    [project.items, app.allStore],
  );
  const makePdf = () => {
    try {
      const doc = buildProjectPdf({
        project,
        rows: rows.map(r => ({ id: r.item.id, note: r.item.note, v: r.v })),
        s, f, t, sourceAbbr: SOURCE_ID_ABBR,
      });
      const name = projectPdfFileName(project);
      if (isIos()) printPdfViaShareSheet(doc, name).catch(() => app.notify(s.pdfFailed));
      else downloadPdf(doc, name);
    } catch (e) { console.warn('[projects] pdf failed', e); app.notify(s.pdfFailed); }
  };

  return (
    <div data-testid="project-sheet" style={{ ...CARD, padding: 'clamp(16px, 2.4vw, 24px)', display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span data-testid="project-title" style={{ fontFamily: FD, fontSize: 'clamp(20px, 2.6vw, 26px)', fontWeight: 650, letterSpacing: '-0.2px', overflowWrap: 'anywhere' }}>{project.name}</span>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13.5, color: '#3a3a3c' }}>
            <StatusChip status={project.status} f={f} />
            {project.customer}{project.details.city ? ` · ${project.details.city}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="hp-press" data-testid="project-pdf" onClick={makePdf} style={{ ...SMALL_BTN, background: '#1d1d1f', color: '#fff', border: '1px solid #1d1d1f' }}>{s.pdf}</span>
          <span className="hp-press" data-testid="project-delete" onClick={del} style={{ ...SMALL_BTN, color: '#a33' }}>{s.del}</span>
          <span className="hp-press" data-testid="project-back" onClick={onClose} style={SMALL_BTN}>{f.closeSheet}</span>
        </div>
      </div>

      <FormFields f={f} v={v} set={setV} onStatus={setStatus} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: -6 }}>
        <span
          className="hp-press" data-testid="project-save" onClick={save}
          style={{ ...pillPrimary, fontWeight: 600, opacity: dirty && !busy ? 1 : 0.45, cursor: dirty ? 'pointer' : 'default' }}
        >{f.saveChanges}</span>
        {dirty && <>
          <span data-testid="project-unsaved" style={{ fontSize: 12.5, color: '#a15c00', fontWeight: 600 }}>{f.unsaved}</span>
          <span onClick={() => setV(formOf(project))} style={LINK}>{f.discard}</span>
        </>}
      </div>

      <Candidates app={app} s={s} f={f} backend={backend} project={project} rows={rows} labelOf={labelOf} fail={fail} />
      <Tasks app={app} f={f} backend={backend} project={project} fail={fail} />
      <History app={app} f={f} project={project} />
    </div>
  );
};

/* ── Candidates: up to four, compared exactly like Products → Compare ───── */

type Row = { item: Project['items'][number]; v: HpVM | null };

const Candidates: React.FC<Strs & {
  app: HpApp; backend: ProjectBackend; project: Project; rows: Row[];
  labelOf: (id: string) => string; fail: (e: unknown) => void;
}> = ({ app, s, f, backend, project, rows, labelOf, fail }) => {
  const t = tr(app.lang);
  const [q, setQ] = useState('');
  const store = app.allStore ?? app.store;
  const have = new Set(project.items.map(i => i.id));
  const full = project.items.length >= MAX_CANDIDATES;
  const hits = useMemo(() => (store && q.trim().length >= 2 ? store.search(q, 7).items : null), [store, q]);

  const shown = rows.slice(0, MAX_CANDIDATES);
  const extra = rows.slice(MAX_CANDIDATES);
  const live = shown.filter((r): r is { item: Row['item']; v: HpVM } => !!r.v);
  const cmpRows = compareRows(t);

  const add = async (v: HpVM) => {
    try {
      const r = await backend.addItems(project.id, [v.id], { [v.id]: `${v.mfr} ${v.model}` });
      if (r.overCap) app.notify(f.candFull(MAX_CANDIDATES));
      setQ('');
    } catch (e) { fail(e); }
  };
  const remove = (id: string) => backend.mutate(project.id, p => ({
    patch: { items: p.items.filter(i => i.id !== id) }, log: [{ k: 'remove', a: labelOf(id) }],
  })).catch(fail);
  const choose = (id: string) => backend.mutate(project.id, p => (p.selectedId === id
    ? { patch: { selectedId: '' }, log: [{ k: 'unselect' }] }
    : { patch: { selectedId: id }, log: [{ k: 'select', a: labelOf(id) }] })).catch(fail);
  const note = (id: string, n: string) => backend.mutate(project.id, p => ({
    patch: { items: p.items.map(i => (i.id === id ? { ...i, note: n } : i)) },
  })).catch(fail);

  // The large modal on the Products page: same segment only (its own rule).
  const openLarge = () => {
    const vs = live.map(r => r.v);
    const seg = vs.length ? classifyProductSegment(vs[0].ratedKwNum) : 'unclassified';
    const ids = vs.filter(v => classifyProductSegment(v.ratedKwNum) === seg && seg !== 'unclassified').map(v => v.id);
    if (ids.length < 2) { app.notify(s.compareHint); return; }
    if (ids.length < vs.length) app.notify(s.compareSegment);
    app.compare.forEach(id => app.toggleCompare(id));
    app.openProduct(ids[0]);
    ids.forEach(id => app.toggleCompare(id));
    app.setShowCompare(true);
  };
  const tool = (page: 'noise' | 'cost') => {
    const id = (project.selectedId && have.has(project.selectedId) ? project.selectedId : live[0]?.v.id) ?? null;
    if (!id) return;
    setToolTarget(id);
    app.go(page);
  };

  const n = shown.length;
  return (
    <div data-testid="project-candidates" style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid #ececec', paddingTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={SEC_TITLE}>{f.secCandidates} · {Math.min(project.items.length, MAX_CANDIDATES)}/{MAX_CANDIDATES}</span>
        <span style={{ fontSize: 12.5, color: '#7a7a7a', flex: '1 1 240px' }}>{f.candHint(MAX_CANDIDATES)}</span>
      </div>

      {/* add */}
      {full ? (
        <span data-testid="project-cand-full" style={{ fontSize: 12.5, color: '#a15c00' }}>{f.candFull(MAX_CANDIDATES)}</span>
      ) : (
        <div style={{ position: 'relative', maxWidth: 560 }}>
          <input data-testid="project-cand-search" style={INPUT} value={q} placeholder={f.candSearchPh} onChange={e => setQ(e.target.value)} />
          {hits && (
            <div style={{ position: 'absolute', zIndex: 20, top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, boxShadow: '0 12px 28px rgba(0,0,0,.14)', overflow: 'hidden' }}>
              {hits.length === 0 && <span style={{ display: 'block', padding: '10px 12px', fontSize: 12.5, color: '#7a7a7a' }}>{f.candNoResults}</span>}
              {hits.map(h => {
                const inIt = have.has(h.id);
                return (
                  <span
                    key={h.id} data-testid="project-cand-hit" className="hp-press"
                    onClick={() => { if (!inIt) void add(h); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid #f0f0f2', cursor: inIt ? 'default' : 'pointer', opacity: inIt ? 0.5 : 1 }}
                  >
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, overflowWrap: 'anywhere' }}>{h.model}</span>
                      <span style={{ fontSize: 11.5, color: '#7a7a7a' }}>{h.mfr} · {h.ratedKw} kW · SCOP {h.scop}</span>
                    </span>
                    <span style={{ flex: 'none', fontSize: 12, fontWeight: 600, color: inIt ? '#0a6847' : '#0066cc' }}>{inIt ? '✓' : `+ ${f.candAdd}`}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {n === 0 ? (
        <div style={{ background: '#fafafa', border: '1px dashed #d2d2d7', borderRadius: 14, padding: '18px 18px', fontSize: 13.5, color: '#6e6e73', lineHeight: 1.55 }}>{f.candEmpty}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          {/* One CSS grid, as in the Products comparison: row heights stay in sync across columns. */}
          <div data-testid="project-compare-grid" style={{ display: 'grid', gridTemplateColumns: `minmax(120px, 170px) repeat(${n}, minmax(170px, 1fr))`, minWidth: 130 + n * 180, border: '1px solid #e0e0e0', borderRadius: 16, overflow: 'hidden', fontSize: 14 }}>
            <div style={{ background: '#f5f5f7', borderBottom: '2px solid #e0e0e0' }} />
            {shown.map(({ item, v }) => {
              const picked = project.selectedId === item.id;
              return (
                <div key={`h-${item.id}`} data-testid="project-item" style={{ background: picked ? '#eaf6ee' : '#f5f5f7', borderBottom: '2px solid #e0e0e0', borderLeft: '1px solid #e0e0e0', padding: '14px 14px 12px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                  {picked && <span data-testid="project-chosen" style={{ alignSelf: 'flex-start', fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', background: '#0a7a43', color: '#fff', borderRadius: 999, padding: '2.5px 9px' }}>{f.chosen}</span>}
                  {v ? (
                    <>
                      <span onClick={() => app.openProduct(v.id)} style={{ fontWeight: 650, fontSize: 14.5, lineHeight: 1.3, overflowWrap: 'anywhere', cursor: 'pointer' }}>{v.model}<QaMark v={v} lang={app.lang} size={13} /></span>
                      <span style={{ fontSize: 12, color: '#7a7a7a', overflowWrap: 'anywhere' }}>{v.mfr}</span>
                      <span><ListingChip raw={v.raw} t={t} /></span>
                    </>
                  ) : (
                    <span data-testid="project-item-gone" style={{ fontSize: 12.5, color: '#8a6a1f', overflowWrap: 'anywhere' }}>{item.id} — {s.gone}</span>
                  )}
                  <span style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 2 }}>
                    {v && <span data-testid="project-choose" onClick={() => choose(item.id)} style={{ ...LINK, fontSize: 12.5, fontWeight: 600 }}>{picked ? f.unchoose : f.choose1}</span>}
                    <span data-testid="project-item-remove" onClick={() => remove(item.id)} style={{ ...LINK, fontSize: 12.5, color: '#a33' }}>{s.remove}</span>
                  </span>
                </div>
              );
            })}
            {cmpRows.map((row, ri) => {
              const best = bestOf(row, live.map(r => r.v));
              const bg = ri % 2 ? '#fafafa' : '#fff';
              return (
                <React.Fragment key={row.label}>
                  <div style={{ padding: '11px 12px', background: bg, borderTop: '1px solid #ececec', fontSize: 12.5, fontWeight: 650, color: '#555', display: 'flex', alignItems: 'center' }}>{row.label}</div>
                  {shown.map(({ item, v }) => {
                    const isBest = !!v && best != null && row.metric!(v) === best;
                    return (
                      <div
                        key={`${row.label}-${item.id}`}
                        style={{
                          padding: '11px 14px', background: bg, borderTop: '1px solid #ececec', borderLeft: '1px solid #ececec',
                          minWidth: 0, overflowWrap: 'anywhere', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                          ...(row.strong ? { fontWeight: 600 } : {}),
                          ...(row.dim ? { fontSize: 12, color: '#7a7a7a' } : {}),
                          ...(isBest ? { color: '#0a7a43', fontWeight: 650 } : {}),
                          ...(v && cellFlagged(row, v) ? { color: QA_RED, fontWeight: 650 } : {}),
                        }}
                      >
                        {v ? row.value(v) : '—'}
                        {isBest && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', background: '#e7f6ee', color: '#0a7a43', borderRadius: 999, padding: '2px 8px' }}>{t.products.bestBadge}</span>}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
            <div style={{ padding: '11px 12px', background: '#fff', borderTop: '1px solid #ececec', fontSize: 12.5, fontWeight: 650, color: '#555', display: 'flex', alignItems: 'center' }}>{s.colNote}</div>
            {shown.map(({ item }) => (
              <div key={`n-${item.id}`} style={{ padding: '9px 10px', background: '#fff', borderTop: '1px solid #ececec', borderLeft: '1px solid #ececec', minWidth: 0 }}>
                <NoteInput value={item.note ?? ''} placeholder={f.candNotePh} onSave={v => note(item.id, v)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {extra.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: '#6e6e73' }}>
          <span>{f.legacyMore(extra.length)}</span>
          {extra.map(({ item, v }) => (
            <span key={item.id} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <span style={{ color: '#1d1d1f', fontWeight: 600, overflowWrap: 'anywhere' }}>{v ? `${v.mfr} ${v.model}` : `${item.id} — ${s.gone}`}</span>
              <span onClick={() => remove(item.id)} style={{ ...LINK, fontSize: 12.5, color: '#a33' }}>{s.remove}</span>
            </span>
          ))}
        </div>
      )}

      {live.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {live.length > 1 && <ComparePdfButton app={app} ids={live.map(r => r.v.id)} />}
          {live.length > 1 && <span className="hp-press" data-testid="project-compare" onClick={openLarge} style={SMALL_BTN}>{f.openCompare}</span>}
          <span className="hp-press" data-testid="project-open-noise" onClick={() => tool('noise')} style={SMALL_BTN}>{t.nav.noise}</span>
          <span className="hp-press" data-testid="project-open-cost" onClick={() => tool('cost')} style={SMALL_BTN}>{t.nav.cost}</span>
        </div>
      )}
    </div>
  );
};

/* ── To-dos ────────────────────────────────────────────────────────────── */

const DUE_COLOR: Record<string, [string, string]> = {
  overdue: ['#fdecea', '#b3261e'], today: ['#fff4e5', '#a15c00'], soon: ['#eef5fd', '#0b5cad'], later: ['#eef0f3', '#555'], none: ['#f3f3f5', '#8a8a8e'],
};
const DueChip: React.FC<{ due: string; today: string; f: ProjectFormStrings; locale: string; done?: boolean }> = ({ due, today, f, locale, done }) => {
  const st = done ? (due ? 'later' : 'none') : dueState(due, today);
  const text = !due ? f.due.noDate
    : st === 'overdue' ? `${fmtDay(due, locale)} · ${f.due.overdue}`
    : st === 'today' ? f.due.today
    : fmtDay(due, locale);
  return <span data-due={st} style={{ fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '2.5px 9px', background: DUE_COLOR[st][0], color: DUE_COLOR[st][1], whiteSpace: 'nowrap' }}>{text}</span>;
};

const Tasks: React.FC<{ app: HpApp; f: ProjectFormStrings; backend: ProjectBackend; project: Project; fail: (e: unknown) => void }> = ({ app, f, backend, project, fail }) => {
  const t = tr(app.lang);
  const today = localDay();
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const tasks = sortTasks(project.tasks);
  const doneN = project.tasks.filter(x => x.done).length;

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const tx = text.trim();
    if (!tx) return;
    if (project.tasks.length >= MAX_TASKS) { app.notify(f.taskFull(MAX_TASKS)); return; }
    const task: ProjectTask = { id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, text: tx, due, done: false };
    backend.mutate(project.id, p => (p.tasks.length >= MAX_TASKS ? null : { patch: { tasks: [...p.tasks, task] }, log: [{ k: 'task', a: tx }] }))
      .then(() => { setText(''); setDue(''); }, fail);
  };
  const toggle = (id: string) => backend.mutate(project.id, p => {
    const cur = p.tasks.find(x => x.id === id);
    if (!cur) return null;
    const done = !cur.done;
    return {
      patch: { tasks: p.tasks.map(x => (x.id === id ? { ...x, done, doneAt: done ? new Date().toISOString() : undefined } : x)) },
      log: [{ k: done ? 'taskDone' : 'taskUndone', a: cur.text }],
    };
  }).catch(fail);
  const remove = (id: string) => backend.mutate(project.id, p => {
    const cur = p.tasks.find(x => x.id === id);
    return cur ? { patch: { tasks: p.tasks.filter(x => x.id !== id) }, log: [{ k: 'taskRemoved', a: cur.text }] } : null;
  }).catch(fail);

  return (
    <div data-testid="project-tasks" style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid #ececec', paddingTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={SEC_TITLE}>{f.secTasks}</span>
        {project.tasks.length > 0 && <span style={{ fontSize: 12.5, color: '#7a7a7a' }}>{f.taskProgress(doneN, project.tasks.length)}</span>}
      </div>
      <form onSubmit={add} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, alignItems: 'center' }}>
        <input data-testid="project-task-text" style={{ ...INPUT, gridColumn: 'span 2' }} maxLength={MAX_TASK_TEXT} value={text} placeholder={f.taskPh} onChange={e => setText(e.target.value)} />
        <select data-testid="project-task-template" style={INPUT} value="" onChange={e => { if (e.target.value) setText(e.target.value); }}>
          <option value="">{f.taskFrequent}</option>
          {f.taskTemplates.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
        <input data-testid="project-task-due" style={INPUT} type="date" value={due} onChange={e => setDue(e.target.value)} />
        <button type="submit" data-testid="project-task-add" style={{ ...pillPrimary, border: 'none', fontFamily: 'inherit', fontWeight: 600, opacity: text.trim() ? 1 : 0.5, cursor: 'pointer', justifySelf: 'start' }}>+ {f.taskAdd}</button>
      </form>
      {tasks.length === 0 ? (
        <span style={{ fontSize: 13, color: '#7a7a7a' }}>{f.taskNone}</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {tasks.map(x => (
            <div key={x.id} data-testid="project-task" data-done={x.done} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 2px', borderTop: '1px solid #f0f0f0', flexWrap: 'wrap' }}>
              <input type="checkbox" data-testid="project-task-check" checked={x.done} onChange={() => toggle(x.id)} style={{ width: 17, height: 17, flex: 'none', accentColor: '#0a7a43', cursor: 'pointer' }} />
              <span style={{ flex: '1 1 200px', minWidth: 0, fontSize: 14, overflowWrap: 'anywhere', ...(x.done ? { color: '#9a9aa0', textDecoration: 'line-through' } : {}) }}>{x.text}</span>
              <DueChip due={x.due} today={today} f={f} locale={t.locale} done={x.done} />
              <span data-testid="project-task-remove" onClick={() => remove(x.id)} aria-label="remove" style={{ ...LINK, color: '#a33', fontSize: 16, lineHeight: 1, padding: '0 4px' }}>×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── History ───────────────────────────────────────────────────────────── */

const History: React.FC<{ app: HpApp; f: ProjectFormStrings; project: Project }> = ({ app, f, project }) => {
  const t = tr(app.lang);
  const entries = [...project.history].reverse();
  const when = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString(t.locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const line = (e: Project['history'][number]) => {
    const fn = f.log[e.k];
    if (!fn) return e.k;
    const lab = (x?: string) => (e.k === 'status' && isStatus(x) ? f.status[x] : x ?? '');
    return fn(lab(e.a), lab(e.b));
  };
  return (
    <details data-testid="project-history" style={{ borderTop: '1px solid #ececec', paddingTop: 16 }}>
      <summary style={{ ...SEC_TITLE, cursor: 'pointer' }}>{f.secHistory} · {entries.length}</summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
        {entries.length === 0 && <span style={{ fontSize: 13, color: '#7a7a7a' }}>{f.historyEmpty}</span>}
        {entries.map((e, i) => (
          <div key={`${e.at}-${i}`} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12.5, lineHeight: 1.45 }}>
            <span style={{ flex: '0 0 148px', color: '#7a7a7a' }}>{when(e.at)}</span>
            <span style={{ flex: '1 1 220px', minWidth: 0, overflowWrap: 'anywhere' }}>{line(e)}</span>
            {e.by && <span style={{ color: '#9a9aa0' }}>{e.by}</span>}
          </div>
        ))}
      </div>
    </details>
  );
};

/* ── Lists: Open projects / All projects (collapsed by default) ─────────── */

const LIST_GRID = 'minmax(150px, 2fr) minmax(110px, 1.3fr) minmax(80px, 1fr) 128px minmax(150px, 1.8fr) 96px 62px 92px';

const ProjectListCard: React.FC<Strs & {
  app: HpApp; kind: 'open' | 'all'; projects: Project[] | null; openId: string | null;
  onOpen: (id: string) => void; today: string;
}> = ({ app, s, f, kind, projects, openId, onOpen, today }) => {
  const t = tr(app.lang);
  const viewport = useViewport();
  const phone = viewport === 'phone';
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<'' | ProjectStatus>('');
  const list = (projects ?? []).filter(p => kind === 'open' || !filter || p.status === filter);
  const count = projects?.length ?? 0;
  const modelOf = (id: string) => { const m = app.allStore?.byId.get(id); return m ? `${m.mfr} ${m.model}` : id; };

  const exportCsv = () => {
    const d = (p: Project, k: DetailChoiceKey) => (p.details[k] ? f.opt[k][p.details[k]] ?? p.details[k] : '');
    const csv = projectsCsv(
      projects ?? [],
      [f.colProject, f.colCustomer, f.fPhone, f.fEmail, f.fAddress, f.fPostcode, f.fCity, f.fStatus, f.fTarget,
        f.fBuildingType, f.fProjectType, f.fExisting, f.fDistribution, f.fDhw, f.fSupply, f.fArea, f.fBuildYear, f.fHeatLoad, f.fFunding,
        f.csvCandidates, f.chosen, f.csvOpenTasks, f.fNotes, f.csvCreated, f.colUpdated],
      p => [p.name, p.customer, p.details.phone, p.details.email, p.details.address, p.details.postcode, p.details.city, f.status[p.status], p.targetDate,
        d(p, 'buildingType'), d(p, 'projectType'), d(p, 'existing'), d(p, 'distribution'), d(p, 'dhw'), d(p, 'supply'), p.details.area, p.details.buildYear, p.details.heatLoad, d(p, 'funding'),
        p.items.map(i => modelOf(i.id)).join(' | '), p.selectedId ? modelOf(p.selectedId) : '',
        sortTasks(p.tasks).filter(x => !x.done).map(x => (x.due ? `${x.text} (${x.due})` : x.text)).join(' | '),
        p.notes.replace(/\r?\n/g, ' '),
        p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : '', p.updatedAt ? new Date(p.updatedAt).toISOString().slice(0, 10) : ''],
    );
    // BOM so Excel reads UTF-8; ';' separator opens correctly in European locales.
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `HeatPumpDB_Projects_${today}.csv`; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const next = (p: Project) => {
    const n = nextTask(p.tasks);
    return n ? (
      <span style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0, flexWrap: 'wrap' }}>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: phone ? 'normal' : 'nowrap' }}>{n.text}</span>
        <DueChip due={n.due} today={today} f={f} locale={t.locale} />
      </span>
    ) : <span style={{ color: '#b0b0b5' }}>—</span>;
  };

  return (
    <div data-testid={`projects-list-${kind}`} data-expanded={expanded} style={{ ...CARD, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', flexWrap: 'wrap' }}>
        <span onClick={() => setExpanded(x => !x)} style={{ fontFamily: FD, fontSize: 17, fontWeight: 650, cursor: 'pointer' }}>{kind === 'open' ? f.listOpen : f.listAll}</span>
        <Chip bg="#eef0f3" color="#3a3a3c">{projects == null ? '…' : count}</Chip>
        <span style={{ flex: '1 1 auto' }} />
        {expanded && kind === 'all' && count > 0 && (
          <>
            <select data-testid="projects-filter" value={filter} onChange={e => setFilter(e.target.value as '' | ProjectStatus)} style={{ ...INPUT, width: 'auto', padding: '6px 10px', fontSize: 12.5 }}>
              <option value="">{f.filterAll}</option>
              {STATUSES.map(st => <option key={st} value={st}>{f.status[st]}</option>)}
            </select>
            <span className="hp-press" data-testid="projects-csv" onClick={exportCsv} style={SMALL_BTN}>{f.exportCsv}</span>
          </>
        )}
        <span
          className="hp-press" role="button" aria-expanded={expanded} data-testid={`projects-list-${kind}-toggle`}
          onClick={() => setExpanded(x => !x)}
          style={{ ...SMALL_BTN, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {expanded ? f.collapse : f.expand}
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
        </span>
      </div>

      {expanded && (
        list.length === 0 ? (
          <div style={{ padding: '4px 18px 18px', fontSize: 13.5, color: '#7a7a7a' }}>{kind === 'open' ? f.listEmptyOpen : f.listEmptyAll}</div>
        ) : phone ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {list.map(p => (
              <div key={p.id} className="hp-press" data-testid="project-card" onClick={() => onOpen(p.id)}
                style={{ padding: '12px 18px', borderTop: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: 5, cursor: 'pointer', background: p.id === openId ? '#f0f6ff' : undefined }}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14.5, fontWeight: 650, overflowWrap: 'anywhere' }}>{p.name}</span>
                  <StatusChip status={p.status} f={f} />
                </span>
                <span style={{ fontSize: 12.5, color: '#6e6e73' }}>{[p.customer, p.details.city].filter(Boolean).join(' · ') || '—'}</span>
                <span style={{ fontSize: 12.5 }}>{next(p)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', borderTop: '1px solid #e8e8ed' }}>
            <div style={{ minWidth: 900 }}>
              <div style={{ display: 'grid', gridTemplateColumns: LIST_GRID, gap: 10, padding: '9px 18px', fontSize: 11, fontWeight: 600, color: '#7a7a7a', letterSpacing: '.02em', background: '#fafafa', borderBottom: '1px solid #ececec' }}>
                <span>{f.colProject}</span><span>{f.colCustomer}</span><span>{f.colCity}</span><span>{f.colStatus}</span>
                <span>{f.colNext}</span><span>{f.colTarget}</span><span>{f.colModels}</span><span>{f.colUpdated}</span>
              </div>
              {list.map(p => (
                <div key={p.id} className="hp-press" data-testid="project-card" onClick={() => onOpen(p.id)}
                  style={{ display: 'grid', gridTemplateColumns: LIST_GRID, gap: 10, padding: '11px 18px', fontSize: 13, alignItems: 'center', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', background: p.id === openId ? '#f0f6ff' : undefined }}>
                  <span style={{ fontWeight: 650, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.name}>{p.name}</span>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.customer || '—'}</span>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.details.city || '—'}</span>
                  <span><StatusChip status={p.status} f={f} /></span>
                  {next(p)}
                  <span style={{ whiteSpace: 'nowrap' }}>{fmtDay(p.targetDate, t.locale)}</span>
                  <span>{Math.min(p.items.length, 99)}{p.selectedId ? ' ✓' : ''}</span>
                  <span style={{ color: '#7a7a7a', whiteSpace: 'nowrap' }}>{fmtMs(p.updatedAt, t.locale)}</span>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
};
