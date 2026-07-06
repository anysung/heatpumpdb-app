/**
 * Cursor-paginated product access for the streamed Products list.
 *
 * The residential catalog is served today from the static dataset loaded by
 * dbService.getProducts() (there is no Firestore `products` collection yet —
 * see docs data-lineage notes). This service exposes a Firestore-shaped
 * cursor API — getPage({ filters, cursor, limit }) → { items, nextCursor } —
 * so the UI consumes pages exactly as it would consume
 * query(collection, orderBy('cop_A2W35','desc'), startAfter(cursor), limit(n));
 * migrating storage to Firestore later only changes this file.
 */
import { HeatPump } from '../types';
import { HpVM, toVM } from './model';

export interface ProductFilters {
  refrigerant: string | null;      // contains-match, e.g. 'R290'
  manufacturers: string[];         // manufacturer_short exact set
  bafaListedOnly: boolean;
}

export interface ProductPage {
  items: HpVM[];
  /** Opaque cursor (last item id) — pass back to fetch the next page. */
  nextCursor: string | null;
  filteredTotal: number;
}

export class ProductStore {
  readonly all: HpVM[];
  readonly total: number;
  readonly byId: Map<string, HpVM>;
  readonly mfrCounts: { name: string; count: number }[];
  readonly bafaSnapshotDate: string | null;
  readonly sourceSnapshotDate: string | null;

  constructor(products: HeatPump[]) {
    // Sorted by COP A2/W35 descending, nulls last — the list's fixed sort.
    this.all = products
      .map(toVM)
      .sort((a, b) => (b.cop2Num ?? -Infinity) - (a.cop2Num ?? -Infinity));
    this.total = this.all.length;
    this.byId = new Map(this.all.map(v => [v.id, v]));

    const counts = new Map<string, number>();
    for (const v of this.all) counts.set(v.mfr, (counts.get(v.mfr) || 0) + 1);
    this.mfrCounts = [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const first = products[0];
    this.bafaSnapshotDate = first?.bafa_snapshot_fetched_at ?? null;
    this.sourceSnapshotDate = first?.source_snapshot_generated_at ?? null;
  }

  private applyFilters(filters: ProductFilters): HpVM[] {
    let list = this.all;
    if (filters.refrigerant) {
      const r = filters.refrigerant;
      list = list.filter(v => v.ref.includes(r));
    }
    if (filters.manufacturers.length) {
      const set = new Set(filters.manufacturers);
      list = list.filter(v => set.has(v.mfr));
    }
    if (filters.bafaListedOnly) {
      list = list.filter(v => (v.raw.bafa_listing_status ?? 'listed_in_snapshot') === 'listed_in_snapshot');
    }
    return list;
  }

  /** Fetch one page after the given cursor (null = first page). */
  getPage(filters: ProductFilters, cursor: string | null, pageSize: number): ProductPage {
    const list = this.applyFilters(filters);
    let start = 0;
    if (cursor) {
      const idx = list.findIndex(v => v.id === cursor);
      start = idx >= 0 ? idx + 1 : 0;
    }
    const items = list.slice(start, start + pageSize);
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: start + pageSize < list.length && last ? last.id : null,
      filteredTotal: list.length,
    };
  }

  /** Live substring search over model / manufacturer / ODU / BAFA id. */
  search(q: string, max = 60): { items: HpVM[]; total: number } {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return { items: [], total: 0 };
    const items: HpVM[] = [];
    let total = 0;
    for (const v of this.all) {
      if (`${v.model} ${v.mfr} ${v.odu} ${v.bafaId}`.toLowerCase().includes(needle)) {
        total++;
        if (items.length < max) items.push(v);
      }
    }
    return { items, total };
  }

  /** Label records filtered by derived W35 class. */
  labelRecords(classFilter: string | null): HpVM[] {
    return classFilter ? this.all.filter(v => v.label === classFilter) : this.all;
  }
}
