/**
 * BrandLogo / WavingFlag — HeatPump DB dynamic logo (brand-assets/svg 4a).
 *
 * The artwork itself lives in brandSvg.ts and is shared with the PDF data sheet
 * (hpiq/pdf/brandArtwork.ts), so screen and print can never show two different
 * logos. This file only wraps it in React and supplies the animation hooks:
 * the half-turn spin and the alternating " DB" color run from keyframes in
 * index.css (.hp-logo-spin / .hp-logo-db / .hp-flag-sway).
 *
 * `animated={false}` freezes the artwork in its canonical orientation — use it
 * on documents (the data sheet), where the PDF cannot spin along.
 */
import React from 'react';
import { ACTIVE_COUNTRY, CountryCode } from '../config/countryProfiles';
import {
  BRAND_COLORS,
  BrandTheme,
  FLAG_ASPECT,
  LOGO_ASPECT,
  SYMBOL_ASPECT,
  flagInner,
  flagLabel,
  logoInner,
} from './brandSvg';

export const BrandLogo: React.FC<{
  height?: number;
  theme?: BrandTheme;
  symbolOnly?: boolean;
  animated?: boolean;
  className?: string;
}> = ({ height = 32, theme = 'dark', symbolOnly = false, animated = true, className }) => {
  const c = BRAND_COLORS[theme];
  const aspect = symbolOnly ? SYMBOL_ASPECT : LOGO_ASPECT;
  const vbW = symbolOnly ? 64 : 348;
  return (
    <svg
      className={className}
      height={height}
      width={height * aspect}
      viewBox={`0 0 ${vbW} 64`}
      fill="none"
      role="img"
      aria-label="HeatPump DB"
      style={{ display: 'block', '--hp-db-a': c.red, '--hp-db-b': c.blue } as React.CSSProperties}
      dangerouslySetInnerHTML={{ __html: logoInner({ theme, symbolOnly, animated }) }}
    />
  );
};

/**
 * WavingFlag — market flag as waving cloth, driven by the active country
 * profile. A new country deployment (VITE_COUNTRY_CODE) switches the flag
 * everywhere it is used with no component changes; add a face in brandSvg.ts
 * when onboarding a country.
 */
export const WavingFlag: React.FC<{
  height?: number;
  className?: string;
  country?: CountryCode;
  /** Set on light backgrounds (e.g. the printed data sheet) for a dark hairline. */
  onLight?: boolean;
  animated?: boolean;
}> = ({ height = 40, className, country = ACTIVE_COUNTRY.code, onLight = false, animated = true }) => {
  const uid = React.useId().replace(/:/g, '');
  return (
    <svg
      className={className}
      height={height}
      width={height * FLAG_ASPECT}
      viewBox="0 0 96 66"
      fill="none"
      role="img"
      aria-label={flagLabel(country)}
      dangerouslySetInnerHTML={{ __html: flagInner({ country, onLight, animated, uid }) }}
    />
  );
};
