/**
 * Plausibility marks (owner decision 2026-09-29; rules in src/shared/plausibility.mjs).
 *  · A value whose source record contradicts itself (category B) is painted red.
 *  · The model then carries a small red "!" — "manufacturer check needed".
 * Values are never changed; the mark only says "verify this with the maker".
 */
import React from 'react';
import type { Language } from '../types';
import { HpVM } from './model';
import { pick } from './features/lang';

export const QA_RED = '#c0262d';

const TIP = {
  en: 'Manufacturer check needed — values in the source record do not agree with each other. Verify with the manufacturer before quoting.',
  de: 'Herstellerprüfung nötig — die Werte im Quelldatensatz passen nicht zusammen. Vor dem Angebot beim Hersteller prüfen.',
  fr: 'Vérification fabricant requise — les valeurs de l’enregistrement source ne concordent pas. À vérifier auprès du fabricant avant tout devis.',
  pl: 'Wymagana weryfikacja u producenta — wartości w rekordzie źródłowym są ze sobą niespójne. Sprawdź u producenta przed ofertą.',
  it: 'Verifica del produttore necessaria — i valori del record di origine non sono coerenti tra loro. Verificare con il produttore prima del preventivo.',
};
export const qaTip = (lang: Language | string) => pick(TIP, lang);

/** Style for one displayed value: red when that field is flagged. */
export const qaStyle = (v: HpVM | null | undefined, field: string): React.CSSProperties =>
  v && v.qaFlags.includes(field) ? { color: QA_RED } : {};

export const qaFlagged = (v: HpVM | null | undefined, field: string): boolean =>
  !!v && v.qaFlags.includes(field);

/** The red "!" next to a model name. */
export const QaMark: React.FC<{ v: HpVM | null | undefined; lang: Language | string; size?: number }> = ({ v, lang, size = 15 }) =>
  v && v.qaCheck ? (
    <span
      data-testid="qa-mark"
      title={qaTip(lang)}
      aria-label={qaTip(lang)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
        width: size, height: size, borderRadius: '50%', background: QA_RED, color: '#fff',
        fontSize: Math.round(size * 0.72), fontWeight: 800, lineHeight: 1, marginLeft: 6, verticalAlign: 'middle', cursor: 'help',
      }}
    >!</span>
  ) : null;
