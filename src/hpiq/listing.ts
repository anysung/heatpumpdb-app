/**
 * Local listing status — read ONLY from the displayed country's own source.
 *
 * The internal field `bafa_listing_status` is reused by the GB builder to carry
 * the PEL result, which is a naming accident, not a semantic licence: a German
 * registry listing is NOT a UK listing and NOT a French listing. This resolver is
 * the single place that decides what (if anything) a market may say about a
 * product's local listing, and it reads only that market's own source.
 *
 *   DE → BAFA registry snapshot          (the German national list)
 *   GB → Ofgem PEL                       (only for records that came FROM the PEL)
 *   FR → no national list exists here    → no local listing status is shown at all
 *
 * A Europe-market record supplementing a catalogue carries no local listing: it
 * was checked against the local list and did not match (`not_listed`), or it was
 * never evaluated (`not_evaluated`). Neither is ever rendered as "listed", and a
 * German BAFA listing is never rendered as a UK/French one.
 */
import { HeatPump } from '../types';
import { ACTIVE_COUNTRY } from '../config/countryProfiles';

export type LocalListingStatus = 'listed' | 'not_listed' | 'not_evaluated';

/** The national list this market may talk about, or null when it has none. */
export const LOCAL_LISTING_SOURCE = ACTIVE_COUNTRY.commercialCatalog.localListingSource;

/**
 * A record is local to this market's own registry when it actually came from it.
 * Europe-market supplements are identified by their cross-reference provenance —
 * they are real products, but the local list has nothing to say about them.
 */
const isFromLocalSource = (p: HeatPump): boolean => {
  const raw = p as unknown as Record<string, unknown>;
  if (LOCAL_LISTING_SOURCE === 'PEL') return raw.primary_source === 'OFGEM_PEL';
  if (LOCAL_LISTING_SOURCE === 'BAFA') return true;   // the German catalogue IS the registry
  return false;
};

/**
 * The local listing status to show for this product, or null when this market
 * has no national list of its own (nothing may be claimed).
 */
export function localListingStatus(p: HeatPump): LocalListingStatus | null {
  if (!LOCAL_LISTING_SOURCE) return null;              // e.g. France — no national list

  const raw = p as unknown as Record<string, unknown>;

  if (LOCAL_LISTING_SOURCE === 'PEL') {
    // Only PEL records can be PEL-listed. Everything else in the UK catalogue is
    // Europe-market supplement: the build matched it against the PEL and excluded
    // the ones that DID match, so what remains is a genuine non-match.
    if (!isFromLocalSource(p)) return 'not_listed';
    return raw.bafa_listing_status === 'listed_in_snapshot' ? 'listed' : 'not_listed';
  }

  // DE — the BAFA registry snapshot is this market's own list.
  return (raw.bafa_listing_status ?? 'listed_in_snapshot') === 'listed_in_snapshot'
    ? 'listed'
    : 'not_listed';
}
