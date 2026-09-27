/**
 * Basic-tier projection (Free + Premium split, 2026-09-27).
 *
 * The allowlist lives in ONE file, src/config/datasetBasicFields.json — the
 * upload pipeline builds the *.basic.json objects from it and storage.rules
 * serves those to Free accounts. In production the client simply downloads the
 * basic object; this helper exists so the DEV server (which reads the full
 * local public/data files) can mirror production exactly, and so any code that
 * must reason about "is this a basic field" reads the same list.
 *
 * Same semantics as projectBasicRecord in
 * google_cloud_function_billing/datasetChecks.js (tests/dataset-basic-fields.unit.mjs
 * asserts both agree): keys not listed are dropped; listed keys absent on the
 * record stay absent.
 */
import basicFields from '../config/datasetBasicFields.json';

export type DatasetTier = 'basic' | 'full';

export const BASIC_FIELDS: ReadonlySet<string> = new Set<string>(basicFields.fields);

/** Storage object name for a tier: products-fr.json → products-fr.basic.json. */
export const datasetFileForTier = (file: string, tier: DatasetTier): string =>
  tier === 'basic' ? file.replace(/\.json$/, '.basic.json') : file;

export function projectBasic<T extends object>(record: T): T {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(record)) {
    if (BASIC_FIELDS.has(k)) out[k] = (record as Record<string, unknown>)[k];
  }
  return out as T;
}
