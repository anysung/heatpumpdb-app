/**
 * countryProfiles.ts — Country-level configuration for the Heat Pump Intelligence Platform.
 *
 * PURPOSE:
 *   Centralises every public, non-secret, country-specific config value so that
 *   future country expansion requires only adding a profile entry here — not
 *   scattering country logic across components, services, or utility files.
 *
 * USAGE:
 *   Import ACTIVE_COUNTRY from this file wherever country-specific config is needed.
 *   ACTIVE_COUNTRY is a build-time constant resolved from VITE_COUNTRY_CODE.
 *   One deployment = one country; there is no runtime country-switching.
 *
 * ADDING A NEW COUNTRY:
 *   1. Add the country code to CountryCode.
 *   2. Add a full profile entry to COUNTRY_PROFILES.
 *   3. Set VITE_COUNTRY_CODE=<code> in the deployment environment.
 *   4. Do not modify any other file for basic country config.
 *
 * SECRET VALUES DO NOT BELONG HERE.
 *   Use .env.local (local) or Google Secret Manager (production) for API keys.
 */

import { PUBLIC_ENV } from './env';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CountryCode = 'DE' | 'GB' | 'FR';

/** Identifies the primary eligibility/registry data source for a country. */
export type PrimaryRegistry = 'BAFA' | 'OFGEM_PEL';

/** Enrichment sources that may be layered on top of the primary registry. */
export type EnrichmentLayer = 'EPREL' | 'BAFA_REFERENCE' | 'NF_PAC';

export interface CountryProfile {
  /** ISO 3166-1 alpha-2. */
  code: CountryCode;

  /** Display name for this country/market. */
  name: string;

  /** Short market description used in AI prompts and UI copy. */
  marketName: string;

  /** ISO 4217 currency code. */
  currency: string;

  /** Single character currency symbol for UI display. */
  currencySymbol: string;

  /** BCP 47 locale tag used for number/date formatting. */
  locale: string;

  /**
   * Firestore root path for this country's collections.
   * Format: 'countries/<code>'
   * All news, policy, eligibility, and metadata docs live under this root.
   */
  firestoreRoot: string;

  /**
   * The primary data source that determines product eligibility in this market.
   * Eligibility data from this source has legal meaning in this country only.
   */
  primaryRegistry: PrimaryRegistry;

  /**
   * The HeatPump field that stores the primary registry's product identifier.
   * Used as the display-level stable product ID (source_id) for this market.
   */
  primaryRegistryIdField: keyof { bafa_id: string; mcs_number: string };

  /** Full name of the subsidy authority shown in UI disclaimers. */
  subsidyAuthorityLabel: string;

  /** Short label for the subsidy/eligibility tab in the main navigation. */
  subsidyTabLabel: string;

  /** Injected into AI system prompts to scope news/policy to this market. */
  aiMarketContext: string;

  /** i18n label for the primary registry ID shown on data sheets. */
  sourceIdLabel: { en: string; de?: string };

  /**
   * Enrichment layers active for this country build.
   * EPREL: EU energy label data (server-side only, requires API key).
   * BAFA_REFERENCE: BAFA used as technical spec cross-reference (non-DE markets only).
   */
  enabledEnrichmentLayers: EnrichmentLayer[];

  /** Static JSON dataset paths served from /public/data/. */
  datasetPaths: {
    products: string;
    commercialProducts: string;
  };

  /**
   * Where this market's COMMERCIAL catalogue comes from, and what its records
   * mean here.
   *
   * Some markets have too small a national commercial registry to be useful
   * (the UK's Ofgem PEL lists <100 suitable commercial models), so their
   * commercial catalogue is DERIVED from another market's registry — the same
   * hardware, cross-referenced. Those records are real products, but they carry
   * NO national listing and therefore no national subsidy status: they are
   * shown as "not listed" against the local eligibility source, and never as
   * eligible for the local scheme.
   *
   * `sourceCountry === code` means the catalogue is native (Germany, France).
   */
  commercialCatalog: {
    /** Registry the records are derived from. */
    sourceCountry: CountryCode;
    /** Market they are shown in. */
    displayCountry: CountryCode;
    /** The national list that decides eligibility here ('BAFA', 'PEL', …). */
    localEligibilitySource: string;
    /** Listing status an imported record carries until a local match is found. */
    defaultEligibilityStatus: 'listed' | 'non-listed';
  };
}

// ─── Profiles ────────────────────────────────────────────────────────────────

export const COUNTRY_PROFILES: Record<CountryCode, CountryProfile> = {
  DE: {
    code: 'DE',
    name: 'Germany',
    marketName: 'German market',
    currency: 'EUR',
    currencySymbol: '€',
    locale: 'de-DE',
    firestoreRoot: 'countries/DE',
    primaryRegistry: 'BAFA',
    primaryRegistryIdField: 'bafa_id',
    subsidyAuthorityLabel: 'BAFA (Bundesamt für Wirtschaft und Ausfuhrkontrolle)',
    subsidyTabLabel: 'BAFA / KfW',
    aiMarketContext: 'German market',
    sourceIdLabel: { en: 'BAFA ID', de: 'BAFA-ID' },
    enabledEnrichmentLayers: ['EPREL'],
    datasetPaths: {
      products: '/data/products.json',
      commercialProducts: '/data/products-commercial.json',
    },
    commercialCatalog: {
      sourceCountry: 'DE',
      displayCountry: 'DE',
      localEligibilitySource: 'BAFA',
      defaultEligibilityStatus: 'listed',
    },
  },

  FR: {
    code: 'FR',
    name: 'France',
    marketName: 'French market',
    currency: 'EUR',
    currencySymbol: '€',
    locale: 'fr-FR',
    firestoreRoot: 'countries/FR',
    // FR catalogue is derived from the German BAFA registry (same hardware sold
    // in both markets — user decision 2026-07-07). BAFA is the data source;
    // NF PAC references are attached as an enrichment layer only where a
    // confident match exists (uncertain → no reference shown, never guessed).
    primaryRegistry: 'BAFA',
    primaryRegistryIdField: 'bafa_id',
    subsidyAuthorityLabel: "MaPrimeRénov' (ANAH) / CEE",
    subsidyTabLabel: "MaPrimeRénov' / CEE",
    aiMarketContext: 'French market',
    sourceIdLabel: { en: 'BAFA ID (reference)' },
    enabledEnrichmentLayers: ['EPREL', 'NF_PAC'],
    datasetPaths: {
      products: '/data/products-fr.json',
      commercialProducts: '/data/products-commercial-fr.json',
    },
    // France derives its commercial catalogue from the German registry too, but
    // its records keep the registry listing, which the FR UI presents as the
    // "European reference list" (never as MaPrimeRénov'/CEE eligibility). So the
    // listing filter is meaningful here — unchanged behaviour.
    commercialCatalog: {
      sourceCountry: 'DE',
      displayCountry: 'FR',
      localEligibilitySource: 'BAFA_REFERENCE',
      defaultEligibilityStatus: 'listed',
    },
  },

  GB: {
    code: 'GB',
    name: 'United Kingdom',
    marketName: 'UK market',
    currency: 'GBP',
    currencySymbol: '£',
    locale: 'en-GB',
    firestoreRoot: 'countries/GB',
    primaryRegistry: 'OFGEM_PEL',
    primaryRegistryIdField: 'mcs_number',
    subsidyAuthorityLabel: 'Ofgem BUS (Boiler Upgrade Scheme)',
    subsidyTabLabel: 'BUS / MCS',
    aiMarketContext: 'UK market',
    sourceIdLabel: { en: 'MCS Number' },
    enabledEnrichmentLayers: ['BAFA_REFERENCE', 'EPREL'],
    datasetPaths: {
      products: '/data/products-gb.json',
      commercialProducts: '/data/products-commercial-gb.json',
    },
    // The Ofgem PEL lists too few commercial models to be a usable catalogue, so
    // the UK commercial catalogue is derived from the German registry (same
    // hardware). None of it is PEL-listed, so none of it is BUS-eligible.
    commercialCatalog: {
      sourceCountry: 'DE',
      displayCountry: 'GB',
      localEligibilitySource: 'PEL',
      defaultEligibilityStatus: 'non-listed',
    },
  },
};

// ─── Active Profile ───────────────────────────────────────────────────────────

function resolveActiveCountry(): CountryProfile {
  const code = PUBLIC_ENV.COUNTRY_CODE;
  if (code in COUNTRY_PROFILES) {
    return COUNTRY_PROFILES[code as CountryCode];
  }
  // Unknown code → safe fallback to DE; log a warning in non-production builds.
  if (import.meta.env.DEV) {
    console.warn(
      `[countryProfiles] Unknown VITE_COUNTRY_CODE="${code}". Falling back to DE.`,
    );
  }
  return COUNTRY_PROFILES.DE;
}

/**
 * The active CountryProfile for this build.
 * Resolved once at module load from VITE_COUNTRY_CODE; constant thereafter.
 * Import this wherever country-specific config is needed.
 */
export const ACTIVE_COUNTRY: CountryProfile = resolveActiveCountry();
