/**
 * dataset-diff.mjs — what changed for one market between the dataset that is
 * LIVE and the candidate that is about to be published (Premium watchlist +
 * change alerts, 2026-09-29).
 *
 * PURE: no I/O, no clock. The caller (scripts/compute-dataset-changes.mjs)
 * reads both sides; tests/dataset-diff.unit.mjs pins the behaviour.
 *
 * WHAT COUNTS AS A CHANGE
 *   listing   the market's OWN listing status, as the app shows it
 *             (src/hpiq/listing.ts): DE bafa_listing_status, GB pel_match_status,
 *             PL zum_match_status, IT gse_match_status, FR agrement_match_status.
 *             Only a change of the USER-FACING state is reported (listed ↔
 *             verification required / not listed) — 'unmatched' → 'review_required'
 *             reads identically in the app and would only be noise in a mail.
 *             FR also reports a changed agrément number or NF PAC reference.
 *   added     id present in the candidate, absent from the live set.
 *   removed   id present live, absent from the candidate ("removed from the
 *             dataset" — never "delisted": that is a listing fact, above).
 *   specs     SPEC_FIELDS whose value changed (numbers compared at 3 decimals;
 *             null ↔ value counts).
 *
 * Both segment files are pooled per market before diffing: the residential /
 * commercial split is by capacity at load time, so a product moving between the
 * two FILES is neither new nor removed.
 *
 * CANARY records (scripts/canary/canary-records.json) are excluded on both
 * sides: the live objects carry them, the local build does not, and a
 * honeytoken must never surface in a change list or a mail.
 */

export const SPEC_FIELDS = [
  'scop',
  'power_55C_kw', 'power_35C_kw',
  'efficiency_35C_percent', 'efficiency_55C_percent',
  'cop_A7W35', 'cop_A2W35', 'cop_AMinus7W35', 'cop_A10W35',
  'noise_outdoor_dB',
  'refrigerant',
];

/** market → the field(s) that carry its own listing status. */
export const LISTING = {
  DE: { field: 'bafa_listing_status', listed: (v) => (v ?? 'listed_in_snapshot') === 'listed_in_snapshot', off: 'not_listed' },
  GB: { field: 'pel_match_status', listed: (v) => v === 'confirmed', off: 'verification_required' },
  PL: { field: 'zum_match_status', listed: (v) => v === 'confirmed', off: 'verification_required' },
  IT: { field: 'gse_match_status', listed: (v) => v === 'confirmed', off: 'verification_required' },
  FR: { field: 'agrement_match_status', listed: (v) => v === 'confirmed', off: 'verification_required',
        extra: ['agrement_number', 'nf_pac_reference'] },
};

/** The app's product id (src/hpiq/model.ts toVM). */
export const recordId = (r) => String(r?.source_id || r?.bafa_id || r?.european_reference_id || '');
/** The app's manufacturer label (HpVM.mfr). */
export const recordMfr = (r) => String(r?.manufacturer_short || r?.manufacturer || '');

/**
 * Manufacturer slug — MUST stay identical to mfrSlug() in
 * src/hpiq/features/watch/watchModel.ts (a watched manufacturer is matched by
 * it). tests/dataset-diff.unit.mjs pins shared vectors.
 */
export function mfrSlug(name) {
  return String(name ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Set of canary ids + "manufacturer|model" keys across every market. */
export function canaryMatcher(canaries) {
  const ids = new Set();
  const names = new Set();
  for (const [cc, segs] of Object.entries(canaries ?? {})) {
    if (cc.startsWith('_') || !segs || typeof segs !== 'object') continue;
    for (const c of Object.values(segs)) {
      if (!c || typeof c !== 'object') continue;
      for (const k of ['source_id', 'bafa_id', 'european_reference_id']) if (c[k]) ids.add(String(c[k]));
      if (c.manufacturer && c.model) names.add(`${c.manufacturer}|${c.model}`);
    }
  }
  return (r) => ids.has(recordId(r)) || ids.has(String(r?.bafa_id ?? '')) || names.has(`${r?.manufacturer}|${r?.model}`);
}

const norm = (v) => {
  if (v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null;
  return v;
};
const same = (a, b) => {
  const x = norm(a), y = norm(b);
  if (typeof x === 'string' && typeof y === 'string') return x.trim() === y.trim();
  return x === y;
};

function index(records, isCanary) {
  const m = new Map();
  for (const r of records ?? []) {
    if (!r || isCanary(r)) continue;
    const id = recordId(r);
    if (!id) continue;
    if (!m.has(id)) m.set(id, r);
  }
  return m;
}

const ident = (id, r) => ({ id, mfr: recordMfr(r), model: String(r?.model ?? '') });

/**
 * Diff one market. `previous` / `candidate`: arrays of records (both segments
 * pooled). Returns full lists — capping for storage is capForStorage's job.
 */
export function diffMarket(cc, previous, candidate, { canaries } = {}) {
  const isCanary = canaryMatcher(canaries);
  const prev = index(previous, isCanary);
  const next = index(candidate, isCanary);
  const L = LISTING[cc];

  const listing = [], added = [], removed = [], specs = [];

  for (const [id, r] of next) {
    const p = prev.get(id);
    if (!p) { added.push(ident(id, r)); continue; }

    if (L) {
      const was = L.listed(p[L.field]), now = L.listed(r[L.field]);
      if (was !== now) {
        listing.push({ ...ident(id, r), field: L.field,
          from: was ? 'listed' : L.off, to: now ? 'listed' : L.off,
          rawFrom: p[L.field] ?? null, rawTo: r[L.field] ?? null });
      }
      for (const f of L.extra ?? []) {
        if (!same(p[f], r[f]) && (f !== 'agrement_number' || was || now)) {
          listing.push({ ...ident(id, r), field: f, from: norm(p[f]), to: norm(r[f]) });
        }
      }
    }

    const ch = [];
    for (const f of SPEC_FIELDS) if (!same(p[f], r[f])) ch.push({ f, a: norm(p[f]), b: norm(r[f]) });
    if (ch.length) specs.push({ ...ident(id, r), changes: ch });
  }
  for (const [id, p] of prev) if (!next.has(id)) removed.push(ident(id, p));

  const byId = (a, b) => (a.mfr.localeCompare(b.mfr) || a.model.localeCompare(b.model) || a.id.localeCompare(b.id));
  listing.sort(byId); added.sort(byId); removed.sort(byId); specs.sort(byId);

  return {
    market: cc,
    counts: {
      previous: prev.size, candidate: next.size,
      listing: listing.length, added: added.length, removed: removed.length, specs: specs.length,
    },
    listing, added, removed, specs,
  };
}

/**
 * Trim a diff so its Firestore document stays under `maxBytes` (JSON length is
 * a close, slightly pessimistic proxy for the Firestore document size).
 * Counts are never touched; `truncated` records which lists were cut and how
 * many entries were kept. Order of sacrifice: added, then specs, then removed,
 * then listing — listing changes are the rarest and the most valuable.
 */
export function capForStorage(diff, maxBytes = 900_000) {
  const out = { ...diff, listing: [...diff.listing], added: [...diff.added], removed: [...diff.removed], specs: [...diff.specs], truncated: null };
  const size = () => Buffer.byteLength(JSON.stringify(out), 'utf8');
  if (size() <= maxBytes) return out;
  const truncated = {};
  for (const key of ['added', 'specs', 'removed', 'listing']) {
    while (out[key].length && size() > maxBytes) {
      // Halve big lists quickly, then step finely near the limit.
      const drop = Math.max(1, Math.floor(out[key].length / (size() > maxBytes * 2 ? 2 : 20)));
      out[key].length = Math.max(0, out[key].length - drop);
      truncated[key] = out[key].length;
    }
    out.truncated = truncated;
    if (size() <= maxBytes) break;
  }
  out.truncated = Object.keys(truncated).length ? truncated : null;
  return out;
}

/** Every id a diff mentions, with the kinds of change — used by the alert selection. */
export function changesById(diff) {
  const m = new Map();
  const add = (e, kind, detail) => {
    if (!m.has(e.id)) m.set(e.id, { id: e.id, mfr: e.mfr, model: e.model, kinds: [] });
    m.get(e.id).kinds.push(detail ? { kind, ...detail } : { kind });
  };
  for (const e of diff.listing ?? []) add(e, 'listing', { field: e.field, from: e.from, to: e.to });
  for (const e of diff.added ?? []) add(e, 'added');
  for (const e of diff.removed ?? []) add(e, 'removed');
  for (const e of diff.specs ?? []) add(e, 'specs', { fields: e.changes.map(c => c.f) });
  return m;
}
