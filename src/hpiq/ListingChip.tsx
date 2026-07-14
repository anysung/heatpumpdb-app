/**
 * The ONE place a local listing status becomes a visible chip.
 *
 * Three states, and the difference between the last two is the whole point:
 *
 *   listed                 the local registry lists this product
 *   verification_required  we could not confirm a match. That is a statement about
 *                          OUR matching — never rendered as "not on the list",
 *                          because a failed match is not evidence of absence.
 *   not_listed             VERIFIED absence. Only Germany can produce this: its
 *                          catalogue IS the registry, so a product missing from the
 *                          current snapshot really has been delisted.
 *
 * Markets with no national list (France) render nothing at all.
 */
import React from 'react';
import { HeatPump } from '../types';
import { tr } from './i18n';
import { localListingStatus, LOCAL_LISTING_SOURCE } from './listing';

const base: React.CSSProperties = {
  border: '1px solid #e0e0e0', borderRadius: 999, padding: '2px 9px',
  fontSize: 10.5, background: '#fff', whiteSpace: 'nowrap',
};
/** Amber, not red: "we have not verified this" is not a failure of the product. */
const warn: React.CSSProperties = { ...base, border: '1px solid #e8dcc0', background: '#fdf9f0', color: '#8a6a1f' };
const negative: React.CSSProperties = { ...base, border: '1px solid #e8c9c9', background: '#fdf3f3', color: '#a33' };

export const ListingChip: React.FC<{ raw: HeatPump; t: ReturnType<typeof tr>; style?: React.CSSProperties }> =
  ({ raw, t, style }) => {
    if (!LOCAL_LISTING_SOURCE) return null;
    const status = localListingStatus(raw);
    if (status === 'listed') {
      return <span style={{ ...base, ...style }} data-testid="local-listing-chip">{t.products.chipBafa}</span>;
    }
    if (status === 'not_listed') {
      return <span style={{ ...negative, ...style }} data-testid="local-listing-chip">{t.products.chipDelisted}</span>;
    }
    return <span style={{ ...warn, ...style }} data-testid="local-listing-chip">{t.products.chipVerify}</span>;
  };
