/**
 * newsLocales.ts — the ONE place that maps a target country to its news
 * publishing locale/language, plus the shared YouTube + slug helpers used by
 * the manual news CMS (admin editor, client service) and mirrored by the
 * server function. Future countries are added HERE only.
 *
 * Locale is derived from countryProfiles (single source of truth), so this file
 * never re-hardcodes de-DE/en-GB/… — it only names which markets accept news.
 */
import { COUNTRY_PROFILES, CountryCode } from './countryProfiles';

export interface NewsTarget {
  country: CountryCode;   // 'DE' | 'GB' | 'FR' | 'PL' | 'IT'
  locale: string;         // 'de-DE' | 'en-GB' | 'fr-FR' | 'pl-PL' | 'it-IT'
  lang: string;           // 'de' | 'en' | 'fr' | 'pl' | 'it' — the title_<lang> suffix
  name: string;           // 'Germany' | … (English display name)
  /** The GB edition is the English source with light en-GB localization only. */
  isSource: boolean;
}

/** Every market that can receive a manual news article, in menu order. */
export const NEWS_TARGETS: NewsTarget[] = (['DE', 'GB', 'FR', 'PL', 'IT'] as CountryCode[]).map(cc => {
  const p = COUNTRY_PROFILES[cc];
  return {
    country: cc,
    locale: p.locale,
    lang: p.locale.slice(0, 2),
    name: p.name,
    isSource: p.locale === 'en-GB',
  };
});

export const NEWS_TARGET_BY_COUNTRY: Record<string, NewsTarget> =
  Object.fromEntries(NEWS_TARGETS.map(t => [t.country, t]));

export const isNewsCountry = (cc: string): boolean => cc in NEWS_TARGET_BY_COUNTRY;

/* ── YouTube ──────────────────────────────────────────────────────────────
 * Only YouTube is allowed. Accept watch, youtu.be and shorts URLs; reject
 * everything else (iframes, embeds, other platforms). Return the validated
 * 11-char id, or null. Never trusts arbitrary HTML.
 */
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
export function parseYouTubeId(input: string | null | undefined): string | null {
  const s = String(input ?? '').trim();
  if (!s) return null;
  if (YT_ID.test(s)) return s;                                    // already a bare id
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    return YT_ID.test(id) ? id : null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') { const id = u.searchParams.get('v') ?? ''; return YT_ID.test(id) ? id : null; }
    const m = u.pathname.match(/^\/(?:shorts|embed|v)\/([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }
  return null;
}
/** Privacy-enhanced, non-autoplay watch URL stored/rendered for a valid id. */
export const youTubeWatchUrl = (id: string): string => `https://www.youtube.com/watch?v=${id}`;

/* ── Slug ─────────────────────────────────────────────────────────────────
 * SEO-friendly, locale-aware-ish slug (folds diacritics to ASCII for URL
 * safety). Collisions are resolved by the caller appending a stable suffix.
 */
export function slugify(text: string, max = 70): string {
  const base = String(text ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')     // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return base || 'article';
}

/* ── Content sanitation (shared shape; server re-validates authoritatively) ──
 * News bodies are PLAIN TEXT with blank-line paragraph breaks — never HTML.
 * Strip any tags/handlers/script/URLs-as-js so nothing executable is stored
 * or rendered. The public renderer already treats body as text; this guards
 * the input at the CMS boundary too (defense in depth).
 */
export function sanitizeNewsText(input: string | null | undefined): string {
  return String(input ?? '')
    .replace(/<\/?[^>]*>/g, '')                    // any HTML tag
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')                    // collapse >2 blank lines
    .trim();
}

/** A safe external http(s) URL for source links, or '' if unsafe. */
export function safeHttpUrl(input: string | null | undefined): string {
  const s = String(input ?? '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.toString() : '';
  } catch { return ''; }
}

/**
 * The FIVE canonical editorial categories — one per curated news-image pool
 * (policy / market / tech / install / energy). ENERGY was previously reachable
 * only by keyword guessing; it is a first-class category so the manual editor
 * matches the image taxonomy the auto flow already uses.
 *   FUNDING          → policy·subsidy·regulation
 *   MARKET           → market·sales·industry
 *   TECHNOLOGY       → new products·technology
 *   INSTALLER INSIGHT→ installation·field projects
 *   ENERGY           → energy transition·environment·industrial
 */
export const NEWS_CATEGORIES = ['FUNDING', 'MARKET', 'TECHNOLOGY', 'INSTALLER INSIGHT', 'ENERGY'] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

/** Byline options offered in the editor (canonical brand strings). */
export const NEWS_AUTHORS = [
  'HeatPump DataBase Germany Editorial Team',
  'HeatPump DataBase UK Editorial Team',
  'HeatPump DataBase France Editorial Team',
  'HeatPump DataBase Poland Editorial Team',
  'HeatPump DataBase Italy Editorial Team',
  'HeatPump DataBase Europe Editorial Team',
] as const;

/** Manual-article lifecycle. */
export type ManualNewsStatus = 'draft' | 'translating' | 'published' | 'translation_failed';
