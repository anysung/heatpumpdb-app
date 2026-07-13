/**
 * Company types — one controlled list for every country edition.
 *
 * Stored as a stable CODE (never the translated label), so the same value reads
 * correctly in EN/DE/FR and in any market we add later. Labels live in the i18n
 * dictionaries (`company.types`), so a new language needs no change here.
 *
 * 'other' requires a short free-text detail (companyTypeOther) — that is the only
 * free-text company field we collect, and it is capped.
 */
export type CompanyTypeCode =
  | 'manufacturer'
  | 'wholesaler'
  | 'installer'
  | 'engineering'
  | 'construction'
  | 'esco_utility'
  | 'housing'
  | 'public_research'
  | 'individual'
  | 'other';

/** Display order in the Sign Up / Company Profile selects. */
export const COMPANY_TYPES: CompanyTypeCode[] = [
  'manufacturer',
  'wholesaler',
  'installer',
  'engineering',
  'construction',
  'esco_utility',
  'housing',
  'public_research',
  'individual',
  'other',
];

/** Max length of the free-text detail shown when 'other' is selected. */
export const COMPANY_TYPE_OTHER_MAX = 80;

/**
 * Profiles created before Jul 2026 stored an English label instead of a code.
 * Map them on read so existing accounts keep rendering — we never rewrite the
 * stored value (no migration needed to run the app).
 */
const LEGACY_LABELS: Record<string, CompanyTypeCode> = {
  Manufacturer: 'manufacturer',
  Distributor: 'wholesaler',
  Installer: 'installer',
  'Private Individual': 'individual',
};

/** The stored value as a known code, or null when it is empty/unrecognized. */
export function normalizeCompanyType(value?: string | null): CompanyTypeCode | null {
  if (!value) return null;
  if ((COMPANY_TYPES as string[]).includes(value)) return value as CompanyTypeCode;
  return LEGACY_LABELS[value] ?? null;
}

export const isIndividualType = (value?: string | null): boolean =>
  normalizeCompanyType(value) === 'individual';

export const isOtherType = (value?: string | null): boolean =>
  normalizeCompanyType(value) === 'other';
