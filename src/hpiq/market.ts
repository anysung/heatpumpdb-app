/**
 * hpiq market config — the single place where the UI reads country-specific
 * registry semantics. Everything derives from ACTIVE_COUNTRY (countryProfiles);
 * do not scatter country checks across pages.
 */
import { ACTIVE_COUNTRY } from '../config/countryProfiles';
import { Language } from '../types';

export const MARKET = ACTIVE_COUNTRY;
export const IS_GB = ACTIVE_COUNTRY.code === 'GB';
export const IS_FR = ACTIVE_COUNTRY.code === 'FR';

/**
 * Short prefix shown next to the registry product id
 * (e.g. "BAFA 16010266" / "MCS 24.01.020"). The FR edition presents the id
 * as a neutral European reference ("Réf. 16010266") — non-national sources
 * are labelled as European per market policy; the data sheet fine print
 * still names BAFA for traceability.
 */
export const SOURCE_ID_ABBR = IS_GB ? 'MCS' : IS_FR ? 'Réf.' : 'BAFA';

/** Where "verify eligibility" links point on the products inspector. */
export const REGISTRY_VERIFY_URL = IS_GB
  ? 'https://www.ofgem.gov.uk/publications/boiler-upgrade-scheme-product-eligibility'
  : IS_FR
    ? 'https://france-renov.gouv.fr'
    : 'https://www.bafa.de';

/** Official-source link cards on the funding page (titles/subs come from i18n, zipped by index). */
export const FUNDING_SOURCE_LINKS = IS_GB
  ? [
      { link: 'ofgem.gov.uk ›', href: 'https://www.ofgem.gov.uk/environmental-and-social-schemes/boiler-upgrade-scheme-bus' },
      { link: 'mcscertified.com ›', href: 'https://mcscertified.com' },
      { link: 'gov.uk ›', href: 'https://www.gov.uk/apply-boiler-upgrade-scheme' },
    ]
  : IS_FR
    ? [
        { link: 'france-renov.gouv.fr ›', href: 'https://france-renov.gouv.fr' },
        { link: 'anah.gouv.fr ›', href: 'https://www.anah.gouv.fr' },
        { link: 'ademe.fr ›', href: 'https://www.ademe.fr' },
      ]
    : [
        { link: 'bafa.de ›', href: 'https://www.bafa.de' },
        { link: 'kfw.de ›', href: 'https://www.kfw.de' },
        { link: 'bmwk.de ›', href: 'https://www.bmwk.de' },
      ];

/**
 * Languages offered in the global nav. The GB edition is English-only
 * (the DE dictionary is Germany-market content, not just a translation);
 * DE and FR are bilingual (market language + English).
 */
export const UI_LANGUAGES: Language[] = IS_GB ? ['en'] : IS_FR ? ['fr', 'en'] : ['de', 'en'];

/** Language the app starts in for this edition. */
export const DEFAULT_LANGUAGE: Language = IS_FR ? 'fr' : 'en';

/**
 * This edition's public web domain (owned: heatpumpdb.de / .uk / .fr;
 * heatpumpdb.click is the market-neutral hub/short-link domain).
 */
export const MARKET_WEB_DOMAIN = IS_GB ? 'www.heatpumpdb.uk' : IS_FR ? 'www.heatpumpdb.fr' : 'www.heatpumpdb.de';

/** Sign-in entry URL shown on the Account page ("use on the web"). */
export const MARKET_ENTER_URL = `${MARKET_WEB_DOMAIN}/enter`;

/**
 * Catalogue composition + which search controls this market may offer
 * (config: countryProfiles.commercialCatalog / searchCapabilities).
 *
 * EUROPE scope = the catalogue is supplemented with Europe-market product
 * information. That provenance stays internal: it is never named in the UI.
 *
 * LOCAL_LISTING_FILTER is false where a national-listing filter would not
 * meaningfully divide the catalogue (UK: PEL splits it far too unevenly; France:
 * there is no national list at all), so the control is not offered there.
 */
export const MARKET_SCOPE = ACTIVE_COUNTRY.commercialCatalog.marketScope;
export const LOCAL_LISTING_FILTER = ACTIVE_COUNTRY.searchCapabilities.localListingFilter;

/**
 * Funding-guide explainer video per market — YouTube video ID (the 11-char
 * code from youtube.com/watch?v=XXXXXXXXXXX). null = the "coming soon" slot.
 * Upload per-market videos (Unlisted is fine — embeds still play), paste the
 * IDs here and redeploy; the player is a click-to-load privacy-enhanced
 * embed (youtube-nocookie.com), so no YouTube cookies load before the user
 * presses play.
 */
export const GUIDE_VIDEO_ID: string | null = IS_GB ? '5zkU-KQjzvo' : IS_FR ? 'L8FDkPmjd14' : 'JSkbYarh_iA';
