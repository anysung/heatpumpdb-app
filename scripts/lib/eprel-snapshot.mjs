/**
 * EPREL list paging + snapshot completeness rules.
 *
 * Without an explicit sort the API's pages overlap: the 2026-11 crawl saved
 * 47,800 rows but only 36,521 distinct products, and it still reported
 * complete=true because it compared ROWS with the reported total. About a
 * quarter of the registry was silently missing, a different quarter each month.
 * Page by a unique composite key, and count distinct products.
 */
export const STABLE_SORT = Object.freeze({
  sort0: 'publishedOnDateTS',
  order0: 'ASC',
  sort1: 'eprelRegistrationNumber',
  order1: 'ASC',
});

// Products can be published or withdrawn while a crawl of ~500 pages runs.
const LIVE_REGISTRY_TOLERANCE = 0.005;

export function isSnapshotComplete({ total, uniqueRecords, lastPageReached }) {
  if (!lastPageReached || !Number.isFinite(total) || total <= 0) return false;
  return uniqueRecords >= total * (1 - LIVE_REGISTRY_TOLERANCE);
}
