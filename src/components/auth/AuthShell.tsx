/**
 * AuthShell — eco-futuristic authentication surface for HeatpumpIQ.
 *
 * Design concept: "Energy Field" — a deep near-black canvas with a slow-moving
 * aurora of emerald (renewable) and cyan (intelligence), a faint smart-grid
 * overlay, and animated heat-flow lines (cold blue → warm amber) along the
 * bottom edge as a heat-pump metaphor.
 *
 * Country expansion: the market badge is driven entirely by ACTIVE_COUNTRY
 * (countryProfiles.ts). A new market deployment changes the flag, name and
 * subsidy label here with zero component changes.
 */
import React from 'react';
import { Language } from '../../types';
import { ACTIVE_COUNTRY } from '../../config/countryProfiles';

/** ISO 3166-1 alpha-2 → regional-indicator flag emoji. */
const flagEmoji = (code: string) =>
  code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));

/* ── Shared style tokens (auth surface only) ─────────────────────────────── */

export const authLabel =
  'block text-[11px] font-semibold uppercase tracking-wider text-white/60 mb-1.5';

export const authInput =
  'w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white placeholder-white/35 outline-none transition focus:border-emerald-400/70 focus:bg-white/[0.08] focus:ring-2 focus:ring-emerald-400/25';

/** Selects need a solid dark background so native dropdown options stay legible. */
export const authSelect =
  'w-full px-4 py-3 rounded-xl bg-[#0e1c18] border border-white/15 text-white outline-none transition focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/25';

export const primaryBtn =
  'w-full py-3.5 px-4 rounded-xl font-bold text-[#04251d] bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 shadow-lg shadow-emerald-500/20 transition disabled:opacity-60 disabled:cursor-not-allowed';

export const ghostBtn =
  'w-full py-3.5 px-4 rounded-xl font-semibold text-white bg-white/[0.07] hover:bg-white/[0.13] border border-white/15 transition';

/* ── Icons (inline SVG, minimal 1.5px stroke) ────────────────────────────── */

export const LeafIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 20A7 7 0 0 1 4 13c0-5 4-9 16-9 0 12-4 16-9 16Z" />
    <path d="M4 21c4-4 6-6 9-9" />
  </svg>
);

export const HomeIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
    <path d="M10 21v-6h4v6" />
  </svg>
);

export const BuildingIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16" />
    <path d="M15 9h4a1 1 0 0 1 1 1v11" />
    <path d="M2 21h20" />
    <path d="M7.5 8h1M11 8h1M7.5 12h1M11 12h1M7.5 16h1M11 16h1M17.5 13h.5M17.5 17h.5" />
  </svg>
);

/* ── Primitives ──────────────────────────────────────────────────────────── */

export const GlassCard: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className = '',
  children,
}) => (
  <div className={`bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl shadow-black/40 ${className}`}>
    {children}
  </div>
);

const SegmentTile: React.FC<{
  icon: React.ReactNode;
  title: string;
  desc: string;
  accent: 'emerald' | 'cyan';
}> = ({ icon, title, desc, accent }) => (
  <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white/[0.05] border border-white/10 backdrop-blur">
    <span
      className={`shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl border ${
        accent === 'emerald'
          ? 'bg-emerald-400/15 border-emerald-400/25 text-emerald-300'
          : 'bg-cyan-400/15 border-cyan-400/25 text-cyan-300'
      }`}
    >
      {icon}
    </span>
    <div>
      <p className="font-semibold text-white text-sm">{title}</p>
      <p className="text-white/50 text-xs mt-0.5 leading-relaxed">{desc}</p>
    </div>
  </div>
);

/** Residential / Commercial duality — the two market segments the database covers. */
export const SegmentTiles: React.FC<{ t: any }> = ({ t }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <SegmentTile icon={<HomeIcon />} title={t.tabResidential} desc={t.authResidentialDesc} accent="emerald" />
    <SegmentTile icon={<BuildingIcon />} title={t.tabCommercial} desc={t.authCommercialDesc} accent="cyan" />
  </div>
);

/* ── Background layers ───────────────────────────────────────────────────── */

/** Heat-flow lines: cold blue → renewable emerald → warm amber, drifting right. */
const FlowWave: React.FC = () => (
  <svg
    className="absolute bottom-0 left-0 w-full h-40 md:h-56 opacity-60"
    viewBox="0 0 1440 240"
    fill="none"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="hpFlow" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#38bdf8" stopOpacity="0.5" />
        <stop offset="0.55" stopColor="#34d399" stopOpacity="0.7" />
        <stop offset="1" stopColor="#fbbf24" stopOpacity="0.45" />
      </linearGradient>
    </defs>
    <path className="hp-flow-line" d="M0 170 C 240 120, 420 220, 720 170 S 1200 120, 1440 160" stroke="url(#hpFlow)" strokeWidth="1.5" />
    <path className="hp-flow-line" style={{ animationDelay: '-2.5s' }} d="M0 200 C 260 150, 460 245, 760 195 S 1220 150, 1440 190" stroke="url(#hpFlow)" strokeWidth="1.25" opacity="0.6" />
    <path d="M0 140 C 240 90, 420 190, 720 140 S 1200 90, 1440 130" stroke="url(#hpFlow)" strokeWidth="1" opacity="0.3" />
  </svg>
);

/* ── Installation scenes (line-art, looping) ─────────────────────────────
 * Background-only concept animations: crews installing outdoor units.
 * Stroke-only drawing — structures in faint white, units in emerald,
 * people in cyan. Sits behind all content; cards/text overlap freely.
 */

const SCENE_STRUCT = 'rgba(255,255,255,0.32)';
const SCENE_UNIT = '#34d399';
const SCENE_CREW = '#67e8f9';

/** Bottom-left: detached house, one tech commissioning a unit, two carrying the next one in. */
const ResidentialInstallScene: React.FC = () => (
  <svg
    className="hp-scene absolute bottom-0 left-0 w-[clamp(180px,36vw,540px)] h-auto opacity-[0.55]"
    viewBox="0 0 520 260"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {/* ground */}
    <line x1="0" y1="248" x2="520" y2="248" stroke={SCENE_STRUCT} strokeWidth="1.6" />

    {/* house */}
    <g stroke={SCENE_STRUCT} strokeWidth="1.6">
      <path d="M52 248 V130 H198 V248" />
      <path d="M38 130 L125 66 L212 130" />
      <path d="M92 248 V196 H122 V248" />
      <circle cx="116" cy="222" r="1.5" />
      <rect x="66" y="150" width="38" height="34" rx="2" />
      <path d="M85 150 v34 M66 167 h38" opacity="0.6" />
      <rect x="140" y="150" width="38" height="34" rx="2" />
      <path d="M159 150 v34 M140 167 h38" opacity="0.6" />
    </g>

    {/* installed outdoor unit + spinning fan + refrigerant line to house */}
    <g stroke={SCENE_UNIT} strokeWidth="1.6">
      <line x1="252" y1="248" x2="352" y2="248" strokeWidth="2.5" opacity="0.7" />
      <rect x="258" y="192" width="88" height="52" rx="6" />
      <path d="M268 244 v4 M336 244 v4" />
      <circle cx="288" cy="218" r="17" />
      <circle cx="288" cy="218" r="2" />
      <g className="hp-fan">
        <line x1="288" y1="218" x2="288" y2="204" />
        <line x1="288" y1="218" x2="276" y2="225" />
        <line x1="288" y1="218" x2="300" y2="225" />
      </g>
      <path d="M318 202 v32 M326 202 v32 M334 202 v32" opacity="0.65" />
      <path className="hp-flow-line" d="M258 206 H198" opacity="0.9" />
    </g>

    {/* tech A — kneeling, torquing the service valve */}
    <g stroke={SCENE_CREW} strokeWidth="1.7">
      <circle cx="366" cy="196" r="5.5" />
      <path d="M366 202 L362 224" />
      <path d="M362 224 L354 248 M362 224 L368 248" />
      <path d="M365 207 L374 220" />
      <g className="hp-wrench-arm">
        <path d="M365 207 L348 214" />
        <path d="M348 214 l-5 -6" />
      </g>
    </g>

    {/* techs B + C — carrying the next unit in from the right (loops) */}
    <g className="hp-carry">
      <g className="hp-bob">
        <rect x="392" y="206" width="40" height="26" rx="3" stroke={SCENE_UNIT} strokeWidth="1.6" opacity="0.9" />
        <g stroke={SCENE_CREW} strokeWidth="1.7">
          <circle cx="378" cy="192" r="5.5" />
          <path d="M378 198 V222" />
          <path d="M378 222 L370 248 M378 222 L384 248" />
          <path d="M378 204 L392 213" />
          <circle cx="446" cy="192" r="5.5" />
          <path d="M446 198 V222" />
          <path d="M446 222 L440 248 M446 222 L454 248" />
          <path d="M446 204 L432 213" />
        </g>
      </g>
    </g>
  </svg>
);

/** Bottom-right: commercial rooftop — unit lowered by crane, two crew guiding, one servicing. */
const CommercialInstallScene: React.FC = () => (
  <svg
    className="hp-scene absolute bottom-0 right-0 w-[clamp(190px,38vw,560px)] h-auto opacity-[0.55]"
    viewBox="0 0 520 300"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {/* ground */}
    <line x1="0" y1="288" x2="520" y2="288" stroke={SCENE_STRUCT} strokeWidth="1.6" />

    {/* building */}
    <g stroke={SCENE_STRUCT} strokeWidth="1.6">
      <path d="M150 288 V112 H430 V288" />
      <path d="M144 112 H436" />
      {[136, 176, 216].map(y =>
        [170, 214, 258, 302, 346, 390].map(x => (
          <rect key={`${x}-${y}`} x={x} y={y} width="26" height="20" rx="1.5" opacity="0.5" />
        )),
      )}
      <path d="M274 288 V250 H306 V288" />
    </g>

    {/* existing rooftop unit, running */}
    <g stroke={SCENE_UNIT} strokeWidth="1.6">
      <rect x="170" y="74" width="84" height="38" rx="4" />
      <circle cx="196" cy="93" r="13" />
      <circle cx="196" cy="93" r="1.8" />
      <g className="hp-fan-slow">
        <line x1="196" y1="93" x2="196" y2="82" />
        <line x1="196" y1="93" x2="187" y2="99" />
        <line x1="196" y1="93" x2="205" y2="99" />
      </g>
      <path d="M222 82 v22 M230 82 v22 M238 82 v22 M246 82 v22" opacity="0.65" />
      {/* landing marks for the incoming unit */}
      <path d="M310 112 h12 M350 112 h12" strokeWidth="2.5" opacity="0.6" />
    </g>

    {/* hoisted unit descending from crane (loops) */}
    <g className="hp-hoist">
      <line x1="336" y1="-320" x2="336" y2="66" stroke={SCENE_STRUCT} strokeWidth="1.4" />
      <g stroke={SCENE_UNIT} strokeWidth="1.6">
        <line x1="318" y1="66" x2="354" y2="66" />
        <path d="M318 66 L310 78 M354 66 L362 78" />
        <rect x="306" y="78" width="60" height="34" rx="4" />
        <circle cx="324" cy="95" r="10" />
        <path d="M344 86 v18 M352 86 v18" opacity="0.65" />
      </g>
    </g>

    {/* crew — servicing tech + two riggers guiding the lift */}
    <g stroke={SCENE_CREW} strokeWidth="1.7">
      <circle cx="268" cy="66" r="5" />
      <path d="M268 71 L264 90" />
      <path d="M264 90 L258 112 M264 90 L270 112" />
      <g className="hp-wrench-arm">
        <path d="M267 76 L252 84" />
        <path d="M252 84 l-5 -5" />
      </g>

      <circle cx="290" cy="76" r="5" />
      <path d="M290 81 V98" />
      <path d="M290 98 L284 112 M290 98 L296 112" />
      <g className="hp-wave-arms">
        <path d="M290 84 L280 72 M290 84 L300 72" />
      </g>

      <circle cx="382" cy="76" r="5" />
      <path d="M382 81 V98" />
      <path d="M382 98 L376 112 M382 98 L388 112" />
      <g className="hp-wave-arms">
        <path d="M382 84 L372 72 M382 84 L392 72" />
      </g>
    </g>
  </svg>
);

const gridOverlayStyle: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
  backgroundSize: '48px 48px',
  maskImage: 'radial-gradient(ellipse 90% 70% at 50% 40%, black 30%, transparent 100%)',
  WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 40%, black 30%, transparent 100%)',
};

/* ── Chrome ──────────────────────────────────────────────────────────────── */

const Wordmark: React.FC = () => (
  <span className="text-xl font-bold tracking-tight text-white select-none">
    Heatpump
    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">IQ</span>
  </span>
);

/** Country-profile-driven market identity — swaps automatically per deployment. */
const MarketBadge: React.FC<{ t: any }> = ({ t }) => (
  <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/5 backdrop-blur text-xs font-medium text-white/80">
    <span className="text-sm leading-none">{flagEmoji(ACTIVE_COUNTRY.code)}</span>
    {t.authMarketLabel}: {ACTIVE_COUNTRY.name} · {ACTIVE_COUNTRY.subsidyTabLabel}
  </span>
);

const LanguagePill: React.FC<{ language: Language; setLanguage: (l: Language) => void }> = ({
  language,
  setLanguage,
}) => (
  <div className="flex items-center rounded-full border border-white/15 bg-white/5 backdrop-blur p-1 text-xs font-semibold">
    {(['de', 'en'] as Language[]).map(l => (
      <button
        key={l}
        onClick={() => setLanguage(l)}
        className={`px-3 py-1.5 rounded-full transition-colors ${
          language === l ? 'bg-white text-gray-900' : 'text-white/60 hover:text-white'
        }`}
      >
        {l.toUpperCase()}
      </button>
    ))}
  </div>
);

/* ── Shell ───────────────────────────────────────────────────────────────── */

export const AuthShell: React.FC<{
  t: any;
  language: Language;
  setLanguage: (l: Language) => void;
  children: React.ReactNode;
}> = ({ t, language, setLanguage, children }) => (
  <div className="min-h-screen relative overflow-hidden bg-[#060f0d] text-white font-sans flex flex-col">
    {/* Energy-field background */}
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      <div className="hp-aurora-a absolute -top-40 -left-40 w-[42rem] h-[42rem] rounded-full bg-emerald-500/20 blur-[120px]" />
      <div className="hp-aurora-b absolute top-1/3 -right-52 w-[40rem] h-[40rem] rounded-full bg-cyan-400/15 blur-[120px]" />
      <div className="absolute -bottom-52 left-1/4 w-[36rem] h-[36rem] rounded-full bg-amber-400/[0.07] blur-[130px]" />
      <div className="absolute inset-0" style={gridOverlayStyle} />
      <FlowWave />
      <ResidentialInstallScene />
      <CommercialInstallScene />
    </div>

    <header className="relative z-20 flex items-center justify-between gap-4 px-6 md:px-10 py-5">
      <div className="flex items-center gap-4">
        <Wordmark />
        <MarketBadge t={t} />
      </div>
      <LanguagePill language={language} setLanguage={setLanguage} />
    </header>

    <main className="relative z-20 flex-1 flex items-center justify-center px-4 py-8">
      {children}
    </main>

    <footer className="relative z-20 px-6 pb-6">
      <p className="text-xs text-white/40 flex items-center justify-center gap-1.5">
        <LeafIcon className="w-3.5 h-3.5 text-emerald-400/70" />
        {t.authEcoLine}
      </p>
    </footer>
  </div>
);
