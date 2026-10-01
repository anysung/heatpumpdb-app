/**
 * The month a data snapshot belongs to — ONE definition for every fetcher,
 * parser and monthly job (2026-10-01).
 *
 * WHY NOT THE UTC MONTH: the monthly window opens at 00:05 Europe/Berlin on
 * the 1st, which is still the LAST day of the previous month in UTC (22:05 in
 * summer, 23:05 in winter). Labelling by UTC month made the October run try to
 * write `2026-09` again — the fetchers refused to overwrite last month's
 * snapshot and the window stopped at its first step.
 *
 * The business month is Berlin's: the window, the notice and the owner all
 * live on Berlin time.
 *
 * Precedence: an explicit label (a --snapshot flag the caller parsed) →
 * SNAPSHOT_MONTH in the environment (monthly-maintenance.mjs sets it once for
 * the whole run, so a run that crosses midnight cannot split across two
 * labels) → the current month in Europe/Berlin.
 */
const LABEL = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Current calendar month in Europe/Berlin as YYYY-MM. */
export function berlinMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit',
  }).formatToParts(now);
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  return `${y}-${m}`;
}

/** The snapshot label to use. Throws on a malformed explicit/env label. */
export function snapshotMonth(explicit) {
  const pick = explicit || process.env.SNAPSHOT_MONTH || '';
  if (pick) {
    if (!LABEL.test(pick)) throw new Error(`invalid snapshot month "${pick}" (expected YYYY-MM)`);
    return pick;
  }
  return berlinMonth();
}
