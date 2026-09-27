/**
 * special-report-store — one place that knows the Special Report content
 * layout, so the page builder, the sitemap, the hub promo and the market
 * footers all read the same editions instead of each re-deriving the folder
 * convention.
 *
 * Layout: data_sources/special_report/<YYYY-MM>/
 *           article.json   published copy, one object per UI language
 *           report.html    the owner's self-contained interactive report
 *           img/           cover renders, one per report language
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Every edition with a published article, newest first. */
export function editions(root) {
  const store = join(root, 'data_sources', 'special_report');
  if (!existsSync(store)) return [];
  return readdirSync(store)
    .filter((d) => /^\d{4}-\d{2}$/.test(d)
      && statSync(join(store, d)).isDirectory()
      && existsSync(join(store, d, 'article.json')))
    .sort().reverse()
    .map((id) => ({
      id,
      dir: join(store, id),
      meta: JSON.parse(readFileSync(join(store, id, 'article.json'), 'utf8')),
    }));
}

/** The newest edition, or null when nothing is published yet. */
export const newestEdition = (root) => editions(root)[0] ?? null;

/** Copy for a language, falling back to English so a not-yet-translated
 *  edition still renders complete rather than empty. */
export const copyOf = (edition, lang) => edition.meta.copy[lang] ?? edition.meta.copy.en;

/**
 * THE NEWS PIN WINDOW (owner, 2026-08-25).
 *
 * A Special Report leads its market's news feed for its own month AND the
 * month after, so a reader arriving on any day finds the current report and
 * the previous one at the top, and older editions fall back into the ordinary
 * newest-first order.
 *
 * Why an expiry date rather than a boolean the next publish clears: unpinning
 * the predecessor by hand is precisely the step that gets skipped in month
 * four, and a missed unpin is invisible — the feed simply grows a stack of old
 * reports above the news. A date retires the article whether or not a
 * successor is ever published.
 *
 *   '2026-08' → '2026-09-30'   (inclusive: it still leads that day)
 */
export const pinnedThrough = (editionId) => {
  const [y, m] = String(editionId).split('-').map(Number);
  // Day 0 of month+2 is the last day of month+1. JS months are 0-based and our
  // edition ids are 1-based, so the +1 in the index IS that offset — the
  // "month after" comes from asking for day 0, not from the +1.
  return new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
};

/**
 * Is an article still holding the top of the feed on `today` (YYYY-MM-DD)?
 *
 * Compared as date STRINGS, never Dates: the pin is an editorial window
 * ("through the end of September"), and parsing it would end the last day at
 * midnight UTC — i.e. mid-morning for the European readers it is written for.
 * A missing pinnedUntil is an indefinite pin: the first editions were written
 * before this window existed, and they must not silently drop out.
 *
 * The app applies the identical rule in src/services/dbService.ts
 * (isPinnedOn) — the two sides of the TS/mjs boundary, keep them in sync.
 */
export const isPinnedOn = (pinned, pinnedUntil, today) =>
  pinned === true && (!pinnedUntil || pinnedUntil >= today);

/**
 * PREMIUM EDITIONS (owner, 2026-09-27). The August and September 2026 editions
 * stay public free samples; from October 2026 the report FILE is a Premium
 * member benefit. A Premium edition still gets its public article page (the
 * SEO landing and teaser) but the interactive report is NOT copied to hosting
 * — it lives in the auth-protected datasets bucket
 * (gs://heatpumpdb-datasets/special-report/<edition>/<reportFile>, storage.rules:
 * isEntitled) and the app downloads it for Premium members only.
 * `article.json` may set `"premium": true|false` to override the date rule.
 */
export const PREMIUM_FROM_EDITION = '2026-10';
export const isPremiumEdition = (edition) =>
  typeof edition.meta?.premium === 'boolean' ? edition.meta.premium : edition.id >= PREMIUM_FROM_EDITION;

/** Bucket object path of a Premium edition's report file. */
export const premiumReportPath = (edition) => `special-report/${edition.id}/${edition.meta.reportFile}`;
