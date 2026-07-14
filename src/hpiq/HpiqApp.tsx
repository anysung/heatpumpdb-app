/**
 * HeatPump DB — app shell (global nav, page routing, footer).
 * Implements the approved design in design_handoff_heatpumpiq/ pixel-faithfully.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './hpiq.css';
import { HeatPumpDatabase, Language, User } from '../types';
import { ProductStore } from './productService';
import { shortDate } from './model';
import { HpApp, HpPage, HpSegment, DsMode, DsSectionKey } from './appState';
import { tr } from './i18n';
import { UI_LANGUAGES, SOURCE_ID_ABBR, IS_GB, COMMERCIAL_LISTING_APPLIES } from './market';
import { ACTIVE_COUNTRY } from '../config/countryProfiles';
import { buildDataSheetPdf, pdfFileName } from './pdf/dataSheetPdf';
import { preloadBrandArtwork } from './pdf/brandArtwork';
import { downloadPdf, printPdfViaShareSheet } from './pdf/deliverPdf';
import { isIos } from './pwaInstall';
import { FD, SignOutIcon } from './ui';
import { BrandLogo, WavingFlag } from '../components/BrandLogo';
import { useViewport } from './useViewport';
import { MobileApp } from './mobile/MobileApp';
import { FindPage } from './pages/FindPage';
import { ProductsPage } from './pages/ProductsPage';
import { LabelPage } from './pages/LabelPage';
import { DataSheetPage, DataSheetDoc } from './pages/DataSheetPage';
import { BafaPage } from './pages/BafaPage';
import { GuidePage } from './pages/GuidePage';
import { NewsPage } from './pages/NewsPage';
import { AccountPage } from './pages/AccountPage';

interface Props {
  user: User;
  onLogout: () => void;
  onAdminAccess?: () => void;
  dbData: HeatPumpDatabase | null;
  language: Language;
  setLanguage: (l: Language) => void;
}

const NAV_IDS: Exclude<HpPage, 'account'>[] = ['find', 'products', 'label', 'datasheet', 'bafa', 'guide', 'news'];


export const HpiqApp: React.FC<Props> = ({ user: userProp, onLogout, onAdminAccess, dbData, language, setLanguage }) => {
  // Profile edits are written to Firestore; this overlay reflects them at once
  // (the auth listener would only refresh the profile on the next sign-in).
  const [userPatch, setUserPatch] = useState<Partial<User>>({});
  const user = { ...userProp, ...userPatch };
  const patchUser = (patch: Partial<User>) => setUserPatch(prev => ({ ...prev, ...patch }));
  const t = tr(language);
  const viewport = useViewport();
  // Shared-article deep links (?article=<id>) land on the news page directly.
  const [page, setPage] = useState<HpPage>(() =>
    new URLSearchParams(window.location.search).has('article') ? 'news' : 'find');
  const [query, setQuery] = useState('');
  const [compare, setCompare] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [labelSelId, setLabelSelId] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [dsMode, setDsMode] = useState<DsMode>('product');
  const [dsId, setDsId] = useState<string | null>(null);
  const [dsSections, setDsSections] = useState<Record<DsSectionKey, boolean>>({
    identity: true, performance: true, env: true, bafa: true,
  });
  const [segment, setSegment] = useState<HpSegment>('residential');
  const [bafaOnly, setBafaOnly] = useState(true);
  /**
   * The "listed only" filter is meaningless for a commercial catalogue whose
   * records carry no local listing (see market.ts COMMERCIAL_LISTING_APPLIES).
   * Leaving it on there filters every record away — this is the UK Commercial
   * empty-results bug. Neutralise it for that segment rather than trusting the
   * UI to hide the toggle.
   */
  const listingFilterApplies = (s: HpSegment) => s === 'residential' || COMMERCIAL_LISTING_APPLIES;
  const effectiveBafaOnly = bafaOnly && listingFilterApplies(segment);
  const [refFilter, setRefFilter] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [mfrFilter, setMfrFilter] = useState<string[]>([]);
  const [guideTab, setGuideTab] = useState<'home' | 'pro'>('home');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [faqOpen, setFaqOpen] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2600);
  };

  const resStore = useMemo(
    () => (dbData?.products?.length ? new ProductStore(dbData.products) : null),
    [dbData?.products],
  );
  const comStore = useMemo(
    () => (dbData?.commercialProducts?.length ? new ProductStore(dbData.commercialProducts) : null),
    [dbData?.commercialProducts],
  );
  const store = segment === 'commercial' ? comStore : resStore;
  // Full catalog for the EU energy label page — every downloaded product, both segments.
  const allStore = useMemo(() => {
    const src = [...(dbData?.products ?? []), ...(dbData?.commercialProducts ?? [])];
    return src.length ? new ProductStore(src) : null;
  }, [dbData?.products, dbData?.commercialProducts]);

  /** Which segment dataset a product id belongs to (label page spans both). */
  const segmentOf = (id: string): HpSegment | null =>
    resStore?.byId.has(id) ? 'residential' : comStore?.byId.has(id) ? 'commercial' : null;

  // Segment switch swaps the dataset — ids/manufacturers from the other
  // segment do not resolve, so selection-dependent state is reset (the
  // default-selection effect below refills it from the new store).
  const switchSegment = (s: HpSegment) => {
    if (s === segment) return;
    setSegment(s);
    setSelectedId(null);
    setLabelSelId(null);
    setDsId(null);
    setCompare([]);
    setShowCompare(false);
    setMfrFilter([]);
  };

  // The PDF header draws the app's own logo + flag SVGs; rasterize them up front
  // so buildDataSheetPdf() can stay synchronous (iOS needs navigator.share to be
  // reached inside the click gesture — an await in between loses it).
  useEffect(() => { void preloadBrandArtwork(ACTIVE_COUNTRY.code); }, []);

  // Default selections once data arrives (inspector patterns are always-on).
  useEffect(() => {
    if (!store) return;
    setSelectedId(prev => prev ?? store.all[0]?.id ?? null);
    setLabelSelId(prev => prev ?? store.all[0]?.id ?? null);
    setDsId(prev => prev ?? store.all[0]?.id ?? null);
  }, [store]);

  const dataStatusDate = shortDate(dbData?.generatedAt ?? new Date().toISOString(), t.locale);
  // Derived from the data files themselves (bafa_snapshot_fetched_at /
  // source_snapshot_generated_at) — they move automatically with each
  // regular data update; read from allStore so they are segment-independent.
  const bafaSnapshotDate = shortDate((allStore ?? store)?.bafaSnapshotDate ?? undefined, t.locale);
  const eprelSyncDate = shortDate((allStore ?? store)?.sourceSnapshotDate ?? undefined, t.locale);
  const totalListed = (dbData?.products?.length ?? 0) + (dbData?.commercialProducts?.length ?? 0);

  const toggleCompare = (id: string) => {
    setCompare(prev => {
      const has = prev.includes(id);
      if (!has && prev.length >= 4) return prev;
      return has ? prev.filter(x => x !== id) : [...prev, id];
    });
  };

  /** The generated A4 PDF for the currently selected model (null if no data). */
  const makePdf = () => {
    const v = (dsId && store ? store.byId.get(dsId) : null) ?? store?.all[0] ?? null;
    if (!v) return null;
    return {
      doc: buildDataSheetPdf({
        v, t,
        sections: dsSections,
        isLabelMode: dsMode === 'label',
        sourceAbbr: SOURCE_ID_ABBR,
        isGb: IS_GB,
      }),
      filename: pdfFileName(v),
    };
  };

  /**
   * PRINT.
   * Chrome (desktop + Android) and macOS Safari print the DOM correctly and give
   * a real print dialog — keep that, it is what users expect and it works.
   * ONLY iOS (iPhone/iPad) is broken there (WebKit lays print out against the
   * meta-viewport and ignores @page margins → clipped, edge-to-edge sheets, and
   * a web page cannot override the print dialog). For iOS we hand our own,
   * correctly-sized A4 PDF to the system share sheet, whose actions include
   * "Print" — the only reliable way to reach a printer with the right geometry.
   */
  const printSheet = () => {
    if (!isIos()) { window.print(); return; }
    const made = makePdf();
    if (!made) return;
    printPdfViaShareSheet(made.doc, made.filename).catch(() => notify(t.ds.pdfFailed));
  };

  /** PDF DOWNLOAD: always just saves the generated file. Never a share sheet. */
  const downloadSheetPdf = () => {
    const made = makePdf();
    if (!made) return;
    try { downloadPdf(made.doc, made.filename); }
    catch { notify(t.ds.pdfFailed); }
  };

  const app: HpApp = {
    store, allStore, user, patchUser,
    news: dbData?.newsFeed ?? [],
    dataStatusDate, bafaSnapshotDate, eprelSyncDate, totalListed,
    page, go: setPage,
    query, setQuery,
    compare, toggleCompare,
    selectedId, setSelectedId,
    labelSelId, setLabelSelId,
    showCompare, setShowCompare,
    dsMode, setDsMode, dsId, setDsId,
    dsSections, toggleDsSection: (k) => setDsSections(s => ({ ...s, [k]: !s[k] })),
    segment, setSegment: switchSegment,
    bafaOnly: effectiveBafaOnly, setBafaOnly,
    listingFilterOffered: listingFilterApplies(segment),
    refFilter, setRefFilter, classFilter, setClassFilter, mfrFilter, setMfrFilter,
    guideTab, setGuideTab,
    checked, toggleChecked: (k) => setChecked(c => ({ ...c, [k]: !c[k] })),
    faqOpen, setFaqOpen,
    lang: language, setLang: setLanguage,
    onLogout, printSheet, downloadSheetPdf, notify,
    // Label records span both segments — switch to the id's segment first
    // (switchSegment clears selection; the setters below win within the batch).
    openProduct: (id) => {
      const s = segmentOf(id);
      if (s && s !== segment) switchSegment(s);
      setSelectedId(id); setPage('products');
    },
    openDataSheet: (id, mode) => {
      const s = segmentOf(id);
      if (s && s !== segment) switchSegment(s);
      setDsId(id); setDsMode(mode); setPage('datasheet');
    },
    openLabelRecord: (id) => { setLabelSelId(id); setPage('label'); },
    goProductsR290: () => { setRefFilter('R290'); setPage('products'); },
  };

  const initials = (
    ((user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')) || user.email?.[0] || 'U'
  ).toUpperCase();

  // The one printable document, mounted at <body> level (outside #root) so that
  // `@media print { #root { display:none } }` can't clip or blank it. It is
  // display:none on screen and shown only during printing. Rendered for both
  // the phone and desktop shells.
  const printPortal = createPortal(
    <div id="hpiq-print-mount"><DataSheetDoc app={app} /></div>,
    document.body,
  );

  // Phones get the curated mobile shell. Tablets get the FULL desktop UI
  // (owner decision 2026-07-12 — no curated subset on tablets); the <1100px
  // nav/typography tolerances live in hpiq.css (@media max-width:1099px).
  if (viewport === 'phone') {
    return (
      <>
        {printPortal}
        <MobileApp app={app} viewport={viewport} />
        {notice && (
          <div style={{ position: 'fixed', bottom: 84, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: '#1d1d1f', color: '#fff', borderRadius: 999, padding: '11px 22px', fontSize: 13.5, boxShadow: '0 8px 24px rgba(0,0,0,.22)', maxWidth: '86vw' }}>
            {notice}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="hpiq-root" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      {printPortal}

      {/* ============ Global nav ============ */}
      <div className="hp-gnav" style={{ background: '#000', color: '#fff', display: 'flex', alignItems: 'center', gap: 28, padding: '0 28px', height: 60, position: 'sticky', top: 0, zIndex: 50, flex: 'none' }}>
        <span
          onDoubleClick={onAdminAccess}
          style={{ display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <BrandLogo height={30} theme="dark" />
          <WavingFlag height={26} className="waving-flag" />
        </span>
        <div className="hp-gnav-links" style={{ display: 'flex', gap: 5, fontSize: 14 }}>
          {NAV_IDS.map(id => {
            const active = page === id;
            return (
              <span
                key={id}
                className={active ? undefined : 'hp-navlink'}
                onClick={() => setPage(id)}
                style={{
                  padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
                  ...(active
                    ? { color: '#fff', fontWeight: 600, background: 'rgba(255,255,255,.12)' }
                    : { color: 'rgba(255,255,255,.65)' }),
                }}
              >
                {t.nav[id]}
              </span>
            );
          })}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14, fontSize: 13, color: 'rgba(255,255,255,.75)', flex: 'none' }}>
          {UI_LANGUAGES.length > 1 && (
            <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,.3)', borderRadius: 999, overflow: 'hidden', fontSize: 12.5 }}>
              {UI_LANGUAGES.map(l => (
                <span
                  key={l}
                  onClick={() => setLanguage(l)}
                  style={{
                    padding: '6px 12px', cursor: 'pointer',
                    ...(language === l ? { background: '#fff', color: '#1d1d1f', fontWeight: 600 } : { color: 'rgba(255,255,255,.75)' }),
                  }}
                >
                  {l.toUpperCase()}
                </span>
              ))}
            </div>
          )}
          <span
            onClick={() => setPage('account')}
            title="Account"
            style={{
              width: 27, height: 27, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, cursor: 'pointer', boxSizing: 'border-box',
              ...(page === 'account'
                ? { background: '#fff', color: '#1d1d1f', border: '1px solid #fff', fontWeight: 600 }
                : { background: '#2a2a2c', color: '#fff', border: '1px solid rgba(255,255,255,.25)' }),
            }}
          >
            {initials}
          </span>
          <span
            className="hp-press"
            onClick={onLogout}
            title="Sign out"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(255,255,255,.3)', borderRadius: 999, padding: '6px 14px', fontSize: 12.5, color: 'rgba(255,255,255,.85)', cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none' }}
          >
            <SignOutIcon />
            {t.nav.signOut}
          </span>
        </div>
      </div>

      {/* ============ Pages ============ */}
      {page === 'find' && <FindPage app={app} />}
      {page === 'products' && <ProductsPage app={app} />}
      {page === 'label' && <LabelPage app={app} />}
      {page === 'datasheet' && <DataSheetPage app={app} />}
      {page === 'bafa' && <BafaPage app={app} />}
      {page === 'guide' && <GuidePage app={app} />}
      {page === 'news' && <NewsPage app={app} />}
      {page === 'account' && <AccountPage app={app} />}

      {/* ============ Toast ============ */}
      {notice && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: '#1d1d1f', color: '#fff', borderRadius: 999, padding: '11px 22px', fontSize: 13.5, boxShadow: '0 8px 24px rgba(0,0,0,.22)', maxWidth: '80vw' }}>
          {notice}
        </div>
      )}

      {/* ============ Footer ============ */}
      <div style={{ borderTop: '1px solid rgba(0,0,0,.08)', background: '#f5f5f7', padding: '18px 28px', display: 'flex', alignItems: 'center', gap: 18, fontSize: 11.5, color: '#7a7a7a', flex: 'none', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, color: '#1d1d1f' }}>HeatPump DB</span>
        <span>{t.footer.edition}</span>
        <span>{t.footer.copyright(new Date().getFullYear())}</span>
        <span style={{ marginLeft: 'auto' }}>{t.footer.note}</span>
      </div>
    </div>
  );
};
