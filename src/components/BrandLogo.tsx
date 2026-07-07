/**
 * BrandLogo — HeatPump DB dynamic logo (brand-assets/svg 4a, inlined).
 *
 * Inlined as JSX rather than <img src>: the shipped animated SVG carries no
 * embedded <style>, so it cannot self-play inside an <img>. The half-turn
 * spin and the alternating " DB" color (red ↔ blue) run from keyframes in
 * index.css (.hp-logo-spin / .hp-logo-db), matching the 4a spec.
 *
 * Colors follow brand-assets/README.md:
 *   red #e0452c (dark bg: #ff6b52) · blue #0066cc (dark bg: #2997ff) · ink #1d1d1f
 */
import React from 'react';
import { ACTIVE_COUNTRY, COUNTRY_PROFILES, CountryCode } from '../config/countryProfiles';

const COLORS = {
  dark: { red: '#ff6b52', blue: '#2997ff', ink: '#f5f5f7', hub: '#f5f5f7' },
  light: { red: '#e0452c', blue: '#0066cc', ink: '#1d1d1f', hub: '#fff' },
};

export const BrandLogo: React.FC<{
  height?: number;
  theme?: 'dark' | 'light';
  symbolOnly?: boolean;
  className?: string;
}> = ({ height = 32, theme = 'dark', symbolOnly = false, className }) => {
  const c = COLORS[theme];
  const vbW = symbolOnly ? 64 : 348;
  return (
    <svg
      className={className}
      height={height}
      width={height * (vbW / 64)}
      viewBox={`0 0 ${vbW} 64`}
      fill="none"
      role="img"
      aria-label="HeatPump DB"
      style={{ display: 'block', '--hp-db-a': c.red, '--hp-db-b': c.blue } as React.CSSProperties}
    >
      <g className="hp-logo-spin">
        <path d="M10 32 A22 22 0 0 1 54 32" stroke={c.red} strokeWidth="5.5" strokeLinecap="round" />
        <path d="M54 32 A22 22 0 0 1 10 32" stroke={c.blue} strokeWidth="5.5" strokeLinecap="round" />
        <path d="M49 31 L54 38 L59 31" stroke={c.red} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 33 L10 26 L15 33" stroke={c.blue} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <circle cx="32" cy="32" r="6.5" fill={c.hub} />
      {!symbolOnly && (
        <text
          x="82"
          y="46"
          fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
          fontWeight={600}
          fontSize={40}
          letterSpacing="-0.7"
          fill={c.ink}
        >
          HeatPump
          <tspan className="hp-logo-db"> DB</tspan>
        </text>
      )}
    </svg>
  );
};

/** Outer cloth boundary shared by every flag face (wave shape + hairline). */
const CLOTH = 'M0 6 C16 0 32 12 48 6 C64 0 80 12 96 6 L96 60 C80 66 64 54 48 60 C32 66 16 54 0 60 Z';

/**
 * WavingFlag — market flag as waving cloth, driven by the active country
 * profile. A new country deployment (VITE_COUNTRY_CODE) switches the flag
 * everywhere it is used with no component changes; add a face below when
 * onboarding a country.
 */
export const WavingFlag: React.FC<{
  height?: number;
  className?: string;
  country?: CountryCode;
  /** Set on light backgrounds (e.g. the printed data sheet) for a dark hairline. */
  onLight?: boolean;
}> = ({ height = 40, className, country = ACTIVE_COUNTRY.code, onLight = false }) => {
  const clipId = React.useId();
  return (
    <svg
      className={className}
      height={height}
      width={height * (96 / 66)}
      viewBox="0 0 96 66"
      fill="none"
      role="img"
      aria-label={COUNTRY_PROFILES[country]?.name ?? country}
    >
      <g className="hp-flag-sway">
        {country === 'DE' ? (
          /* Germany: bands drawn wavy themselves — richer cloth than a clip */
          <>
            <path d="M0 6 C16 0 32 12 48 6 C64 0 80 12 96 6 L96 24 C80 30 64 18 48 24 C32 30 16 18 0 24 Z" fill="#1a1a1a" />
            <path d="M0 24 C16 18 32 30 48 24 C64 18 80 30 96 24 L96 42 C80 48 64 36 48 42 C32 48 16 36 0 42 Z" fill="#dd0000" />
            <path d="M0 42 C16 36 32 48 48 42 C64 36 80 48 96 42 L96 60 C80 66 64 54 48 60 C32 66 16 54 0 60 Z" fill="#ffcc00" />
          </>
        ) : (
          /* Other markets: flat flag face clipped by the wavy cloth shape */
          <>
            <clipPath id={clipId}>
              <path d={CLOTH} />
            </clipPath>
            <g clipPath={`url(#${clipId})`}>
              {country === 'GB' ? (
                <>
                  <rect x="0" y="0" width="96" height="66" fill="#012169" />
                  <path d="M0 0 L96 66 M96 0 L0 66" stroke="#fff" strokeWidth="13" />
                  <path d="M0 0 L96 66 M96 0 L0 66" stroke="#C8102E" strokeWidth="5" />
                  <path d="M48 0 V66 M0 33 H96" stroke="#fff" strokeWidth="20" />
                  <path d="M48 0 V66 M0 33 H96" stroke="#C8102E" strokeWidth="11" />
                </>
              ) : country === 'FR' ? (
                <>
                  <rect x="0" y="0" width="32" height="66" fill="#000091" />
                  <rect x="32" y="0" width="32" height="66" fill="#ffffff" />
                  <rect x="64" y="0" width="32" height="66" fill="#E1000F" />
                </>
              ) : (
                <rect x="0" y="0" width="96" height="66" fill="#7a7a7a" />
              )}
            </g>
          </>
        )}
        {/* hairline so dark bands read on dark backgrounds (and vice versa) */}
        <path d={CLOTH} stroke={onLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.3)'} strokeWidth="1.5" />
      </g>
    </svg>
  );
};
