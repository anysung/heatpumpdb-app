/**
 * Shared profile helpers — used by Sign Up, the Company Profile card and the
 * Team company settings, so all three validate identically.
 */

export const trim = (v?: string | null): string => (v ?? '').trim();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isValidEmail = (v: string): boolean => EMAIL_RE.test(trim(v));

const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i;

/**
 * Company website is optional and typed by hand, so accept "example.com" as
 * readily as "https://www.example.com/". Stored WITHOUT a scheme (bare domain),
 * which keeps the stored value short and lets the UI render it either way.
 * Returns '' for empty input, or null when the value is not a plausible domain.
 */
export function normalizeWebsite(value?: string | null): string | null {
  const raw = trim(value);
  if (!raw) return '';
  const bare = raw
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .trim();
  if (!DOMAIN_RE.test(bare)) return null;
  return bare.toLowerCase();
}

/** A stored website as a clickable URL. */
export const websiteHref = (value?: string | null): string =>
  (trim(value) ? `https://${trim(value).replace(/^https?:\/\//i, '')}` : '');

/** Drop empty/undefined keys — Firestore rejects `undefined` values. */
export function compact<T extends Record<string, any>>(obj: T): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = v;
  }
  return out;
}
