/**
 * hpiq market config — the single place where the UI reads country-specific
 * registry semantics. Everything derives from ACTIVE_COUNTRY (countryProfiles);
 * do not scatter country checks across pages.
 */
import { ACTIVE_COUNTRY } from '../config/countryProfiles';
import { Language } from '../types';

export const MARKET = ACTIVE_COUNTRY;
export const IS_GB = ACTIVE_COUNTRY.code === 'GB';

/** Short prefix shown next to the registry product id (e.g. "BAFA 16010266" / "MCS 24.01.020"). */
export const SOURCE_ID_ABBR = IS_GB ? 'MCS' : 'BAFA';

/** Where "verify eligibility" links point on the products inspector. */
export const REGISTRY_VERIFY_URL = IS_GB
  ? 'https://www.ofgem.gov.uk/publications/boiler-upgrade-scheme-product-eligibility'
  : 'https://www.bafa.de';

/** Official-source link cards on the funding page (titles/subs come from i18n, zipped by index). */
export const FUNDING_SOURCE_LINKS = IS_GB
  ? [
      { link: 'ofgem.gov.uk ›', href: 'https://www.ofgem.gov.uk/environmental-and-social-schemes/boiler-upgrade-scheme-bus' },
      { link: 'mcscertified.com ›', href: 'https://mcscertified.com' },
      { link: 'gov.uk ›', href: 'https://www.gov.uk/apply-boiler-upgrade-scheme' },
    ]
  : [
      { link: 'bafa.de ›', href: 'https://www.bafa.de' },
      { link: 'kfw.de ›', href: 'https://www.kfw.de' },
      { link: 'bmwk.de ›', href: 'https://www.bmwk.de' },
    ];

/**
 * Languages offered in the global nav. The GB edition is English-only
 * (the DE dictionary is Germany-market content, not just a translation).
 */
export const UI_LANGUAGES: Language[] = IS_GB ? ['en'] : ['de', 'en'];
