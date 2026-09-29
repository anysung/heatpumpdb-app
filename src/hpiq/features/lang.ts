/**
 * Per-feature string modules (2026-09-29): each Premium feature keeps its own
 * five-language strings next to its code instead of growing i18n.ts, so the
 * features can evolve independently. `pick` resolves the UI language with the
 * market dictionaries' rule: the market language, else English.
 */
import type { Language } from '../../types';
export type FeatureLang = 'en' | 'de' | 'fr' | 'pl' | 'it';
export function pick<T>(table: Record<FeatureLang, T>, lang: Language | string): T {
  return (table as Record<string, T>)[lang] ?? table.en;
}
