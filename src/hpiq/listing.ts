/**
 * Local listing status — an OVERLAY on a canonical technical product.
 *
 * Every market publishes the same canonical products. The local registry answers
 * one question only: has this country listed this product? It never creates a
 * product, never supplies a spec, and never removes one when a match fails.
 * (docs/CANONICAL_TECHNICAL_BASELINE_AND_LOCAL_MARKET_OVERLAY.md)
 *
 *   DE → BAFA registry   the German catalogue IS the registry, so a product's
 *                        absence from the current snapshot is verified fact.
 *                        Germany is the only market that may say "no longer listed".
 *   GB → Ofgem PEL       an overlay. A confirmed match says "PEL Listed". Anything
 *                        else says "verification required" — a failed automated
 *                        match is a fact about OUR MATCHING, not about the PEL.
 *                        Absence of a match is not evidence of absence.
 *   FR → none            France has no national product list. Nothing is shown; a
 *                        foreign registry's listing is never relabelled as French.
 */
import { HeatPump } from '../types';
import { ACTIVE_COUNTRY } from '../config/countryProfiles';

/**
 * 'listed'                — the local registry lists this product (verified).
 * 'verification_required' — no reliable match. NOT a claim of absence.
 * 'not_listed'            — verified absence. Only a market that owns its registry
 *                           (Germany) can ever produce this.
 */
export type LocalListingStatus = 'listed' | 'verification_required' | 'not_listed';

/** The national list this market may talk about, or null when it has none. */
export const LOCAL_LISTING_SOURCE = ACTIVE_COUNTRY.localListingOverlay.source;

/** Offer a "listed only" search filter here? */
export const LOCAL_LISTING_FILTER = ACTIVE_COUNTRY.localListingOverlay.filterEnabled;

/** The listing status to show, or null when this market has no national list. */
export function localListingStatus(p: HeatPump): LocalListingStatus | null {
  if (!LOCAL_LISTING_SOURCE) return null;             // France — nothing may be claimed

  const raw = p as unknown as Record<string, unknown>;

  if (LOCAL_LISTING_SOURCE === 'PEL') {
    // Only a CONFIRMED overlay match may say "listed". 'review_required' — a
    // previously confirmed mapping that stopped matching — is deliberately shown as
    // verification-required too: a matcher or parser regression is far likelier than
    // Ofgem delisting a product, and we will not assert a removal we cannot prove.
    return raw.pel_match_status === 'confirmed' ? 'listed' : 'verification_required';
  }

  // DE — the registry snapshot IS this market's own list, so absence is evidence.
  return (raw.bafa_listing_status ?? 'listed_in_snapshot') === 'listed_in_snapshot'
    ? 'listed'
    : 'not_listed';
}

/** The local registry's identifier, shown only where the listing is confirmed. */
export function localListingId(p: HeatPump): string | null {
  if (LOCAL_LISTING_SOURCE !== 'PEL') return null;
  const raw = p as unknown as Record<string, unknown>;
  if (raw.pel_match_status !== 'confirmed') return null;
  return typeof raw.mcs_number === 'string' && raw.mcs_number ? raw.mcs_number : null;
}
