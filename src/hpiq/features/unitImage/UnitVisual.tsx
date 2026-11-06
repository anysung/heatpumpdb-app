/**
 * The picture beside a model: the brand's image, or the plain line graphic for a brand without one.
 * Which of the two, or none, is decided by src/shared/outdoorUnit.mjs.
 */
import React from 'react';
import { outdoorVisual, unitFile, unitWidths, OutdoorVisual } from '../../../shared/outdoorUnit.mjs';
import { classifyProductSegment } from '../../../config/segmentation';
import type { HpVM } from '../../model';
import { unitImageStrings } from './strings';

/** Outline and fan grille only. Deliberately not a picture of any product. */
export const UNIT_GRAPHIC_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" fill="none" stroke="#a6a6ac" stroke-width="3"><rect x="24" y="52" width="192" height="136" rx="6"/><path d="M156 52v136M44 188v10M196 188v10"/><circle cx="90" cy="120" r="50"/><circle cx="90" cy="120" r="36"/><circle cx="90" cy="120" r="22"/><circle cx="90" cy="120" r="7"/><path d="M90 70v43M90 127v43M40 120h43M97 120h43M55 85l30 30M95 125l30 30M125 85l-30 30M85 125l-30 30"/></svg>`;
export const UNIT_GRAPHIC_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(UNIT_GRAPHIC_SVG)}`;

export const visualOf = (v: HpVM): OutdoorVisual =>
  outdoorVisual(v.mfr, v.raw.type, classifyProductSegment(v.ratedKwNum));

export const UnitVisual: React.FC<{ v: HpVM; size: number; style?: React.CSSProperties }> = ({ v, size, style }) => {
  const visual = visualOf(v);
  if (!visual) return null;
  const box: React.CSSProperties = { width: size, height: size, flex: 'none', display: 'block', objectFit: 'contain', ...style };
  if (visual.kind === 'graphic') return <img src={UNIT_GRAPHIC_URL} width={size} height={size} alt="" data-testid="unit-graphic" draggable={false} style={box} />;
  return (
    <img
      src={unitFile(visual.id, 400)}
      srcSet={unitWidths.map(w => `${unitFile(visual.id, w)} ${w}w`).join(', ')}
      sizes={`${size}px`}
      width={size}
      height={size}
      alt={v.mfr}
      loading="lazy"
      decoding="async"
      draggable={false}
      data-testid="unit-photo"
      data-unit={visual.id}
      style={box}
    />
  );
};

/** One small line under a brand image. The line graphic is plainly not a photo, so it needs none. */
export const UnitCaption: React.FC<{ items: HpVM[]; lang: string; style?: React.CSSProperties }> = ({ items, lang, style }) => {
  if (!items.some(v => visualOf(v)?.kind === 'photo')) return null;
  return <span data-testid="unit-caption" style={{ fontSize: 10.5, lineHeight: 1.4, color: '#9a9aa0', ...style }}>{unitImageStrings(lang).caption}</span>;
};

/** The site's small print: where data comes from and how to ask for a correction. */
export const DataCorrectionNote: React.FC<{ lang: string; style?: React.CSSProperties }> = ({ lang, style }) => {
  const s = unitImageStrings(lang);
  return <span data-testid="data-correction-note" style={{ fontSize: 11, lineHeight: 1.5, color: '#9a9aa0', ...style }}>{s.dataNote} {s.correctionNote}</span>;
};
