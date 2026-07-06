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
  <div className={`bg-white/[0.035] backdrop-blur-md border border-white/10 rounded-3xl shadow-2xl shadow-black/40 ${className}`}>
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

const SCENE_STRUCT = 'rgba(255,255,255,0.38)';
const SCENE_FILL = 'rgba(255,255,255,0.30)';
const SCENE_UNIT = '#34d399';
const SCENE_CREW = '#67e8f9';

/** Pictogram figure: filled head + thick round limbs (movers-style). */
const CrewHead: React.FC<{ cx: number; cy: number; r?: number }> = ({ cx, cy, r = 7 }) => (
  <circle cx={cx} cy={cy} r={r} fill={SCENE_CREW} stroke="none" />
);

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
    <line x1="0" y1="248" x2="520" y2="248" stroke={SCENE_STRUCT} strokeWidth="4" />

    {/* house — bold pictogram: heavy outline, filled door/windows, chimney */}
    <g stroke={SCENE_STRUCT} strokeWidth="4">
      <path d="M48 246 V132 H204 V246" fill="rgba(255,255,255,0.06)" />
      <path d="M34 132 L126 58 L218 132" strokeWidth="5" />
      <path d="M172 94 V70 H192 V110" />
      <rect x="88" y="198" width="32" height="48" rx="2" fill={SCENE_FILL} stroke="none" />
      <rect x="62" y="152" width="32" height="30" rx="2" fill={SCENE_FILL} stroke="none" />
      <rect x="142" y="152" width="32" height="30" rx="2" fill={SCENE_FILL} stroke="none" />
    </g>

    {/* installed outdoor unit — bold outline, petal fan, chunky grill */}
    <g stroke={SCENE_UNIT} strokeWidth="3.5">
      <line x1="248" y1="247" x2="358" y2="247" strokeWidth="6" opacity="0.7" />
      <rect x="256" y="184" width="94" height="58" rx="8" />
      <circle cx="288" cy="213" r="20" />
      <circle cx="288" cy="213" r="3.5" fill={SCENE_UNIT} stroke="none" />
      <g className="hp-fan">
        <path d="M288 213 C282 207 282 199 288 195" />
        <path d="M288 213 C290 221 297 224 303 221" />
        <path d="M288 213 C280 215 275 222 278 228" transform="rotate(-125 288 213)" />
      </g>
      <path d="M322 198 V230 M333 198 V230 M344 198 V230" strokeWidth="3" opacity="0.75" />
      <path className="hp-flow-line" d="M256 200 H204" strokeWidth="3" opacity="0.9" />
    </g>

    {/* tech A — kneeling, torquing the service valve (pictogram) */}
    <g stroke={SCENE_CREW} strokeWidth="5">
      <CrewHead cx={374} cy={191} />
      <path d="M373 199 L367 226" />
      <path d="M367 226 L356 246 M367 226 L376 246" />
      <path d="M372 205 L382 220" />
      <g className="hp-wrench-arm">
        <path d="M372 205 L352 213" />
        <path d="M352 213 l-7 -8" strokeWidth="4" />
      </g>
    </g>

    {/* techs B + C — carrying the next unit in from the right (movers pictogram, loops) */}
    <g className="hp-carry">
      <g className="hp-bob">
        <g stroke={SCENE_UNIT} strokeWidth="3">
          <rect x="394" y="198" width="46" height="34" rx="4" />
          <circle cx="408" cy="215" r="8" strokeWidth="2.5" />
          <path d="M426 205 V225" strokeWidth="2.5" opacity="0.75" />
        </g>
        <g stroke={SCENE_CREW} strokeWidth="5">
          <CrewHead cx={376} cy={184} />
          <path d="M377 192 L373 220" />
          <path d="M373 220 L361 246 M373 220 L383 246" />
          <path d="M376 198 L394 208" />
          <path d="M375 202 L394 222" />
          <CrewHead cx={458} cy={184} />
          <path d="M457 192 L461 220" />
          <path d="M461 220 L451 246 M461 220 L471 246" />
          <path d="M458 198 L440 208" />
          <path d="M459 202 L440 222" />
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
    <line x1="0" y1="286" x2="520" y2="286" stroke={SCENE_STRUCT} strokeWidth="4" />

    {/* building — bold pictogram: stepped towers, filled window grid, filled door */}
    <g stroke={SCENE_STRUCT} strokeWidth="4">
      <path d="M160 284 V120 H380 V284" fill="rgba(255,255,255,0.06)" />
      <path d="M380 284 V170 H450 V284" fill="rgba(255,255,255,0.06)" />
      <path d="M154 120 H386" strokeWidth="5" />
      <path d="M380 170 H456" strokeWidth="4.5" />
      {[138, 168, 198, 228].map(y =>
        [174, 226, 278, 330].map(x => (
          <rect key={`${x}-${y}`} x={x} y={y} width="28" height="17" rx="1.5" fill={SCENE_FILL} stroke="none" />
        )),
      )}
      {[184, 212, 240].map(y =>
        [392, 422].map(x => (
          <rect key={`${x}-${y}`} x={x} y={y} width="20" height="14" rx="1.5" fill={SCENE_FILL} stroke="none" />
        )),
      )}
      <rect x="252" y="250" width="36" height="34" rx="2" fill={SCENE_FILL} stroke="none" />
    </g>

    {/* existing rooftop unit, running — twin-fan commercial pictogram */}
    <g stroke={SCENE_UNIT} strokeWidth="3.5">
      <rect x="168" y="78" width="92" height="42" rx="5" />
      <path d="M168 108 H260" strokeWidth="2.5" opacity="0.7" />
      <circle cx="192" cy="94" r="13" />
      <circle cx="192" cy="94" r="2.5" fill={SCENE_UNIT} stroke="none" />
      <g className="hp-fan-slow">
        <path d="M192 94 C188 90 188 84 192 82" />
        <path d="M192 94 C194 99 199 101 203 99" />
        <path d="M192 94 C187 95 184 100 186 104" transform="rotate(-125 192 94)" />
      </g>
      <circle cx="234" cy="94" r="13" />
      <circle cx="234" cy="94" r="2.5" fill={SCENE_UNIT} stroke="none" />
      <g className="hp-fan-slow" style={{ animationDelay: '-2s' }}>
        <path d="M234 94 C230 90 230 84 234 82" />
        <path d="M234 94 C236 99 241 101 245 99" />
        <path d="M234 94 C229 95 226 100 228 104" transform="rotate(-125 234 94)" />
      </g>
      {/* landing marks for the incoming unit */}
      <path d="M292 120 h14 M342 120 h14" strokeWidth="5" opacity="0.65" />
    </g>

    {/* hoisted unit descending from crane (loops) */}
    <g className="hp-hoist">
      <line x1="316" y1="-320" x2="316" y2="64" stroke={SCENE_STRUCT} strokeWidth="3" />
      <g stroke={SCENE_UNIT} strokeWidth="3.5">
        <line x1="292" y1="64" x2="340" y2="64" strokeWidth="4" />
        <path d="M292 64 L286 76 M340 64 L346 76" strokeWidth="3" />
        <rect x="284" y="76" width="64" height="44" rx="5" />
        <circle cx="306" cy="98" r="12" />
        <circle cx="306" cy="98" r="2.5" fill={SCENE_UNIT} stroke="none" />
        <path d="M330 86 V110 M340 86 V110" strokeWidth="3" opacity="0.75" />
      </g>
    </g>

    {/* crew — servicing tech + two riggers guiding the lift (pictogram) */}
    <g stroke={SCENE_CREW} strokeWidth="5">
      <CrewHead cx={270} cy={84} r={6.5} />
      <path d="M269 91 L264 106" />
      <path d="M264 106 L256 120 M264 106 L270 120" />
      <g className="hp-wrench-arm">
        <path d="M268 95 L252 102" />
        <path d="M252 102 l-6 -7" strokeWidth="4" />
      </g>

      {/* rigger on the main roof, right of the landing marks */}
      <CrewHead cx={366} cy={80} r={6.5} />
      <path d="M366 87 V106" />
      <path d="M366 106 L358 120 M366 106 L374 120" />
      <g className="hp-wave-arms">
        <path d="M366 91 L354 78 M366 91 L378 78" />
      </g>

      {/* rigger guiding from the lower side-tower roof */}
      <CrewHead cx={410} cy={130} r={6.5} />
      <path d="M410 137 V156" />
      <path d="M410 156 L402 170 M410 156 L418 170" />
      <g className="hp-wave-arms">
        <path d="M410 141 L398 128 M410 141 L422 128" />
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
