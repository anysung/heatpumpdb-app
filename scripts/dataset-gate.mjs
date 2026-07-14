#!/usr/bin/env node
/**
 * dataset-gate.mjs — the gate between GENERATING datasets and PUBLISHING them.
 *
 *   generate → validate → review → publish
 *
 * Nothing reaches the production bucket without passing here. A failed or
 * half-finished update leaves the live datasets exactly as they were: this script
 * only ever READS the candidate files and compares them with the last approved
 * manifest. It writes no dataset and uploads nothing.
 *
 *   node scripts/dataset-gate.mjs                 validate the candidate, print the report
 *   node scripts/dataset-gate.mjs --approve       record the candidate as the new baseline
 *                                                 (only after a clean pass; do this when the
 *                                                 upload succeeded)
 *   node scripts/dataset-gate.mjs --override --reason="..."   publish anyway, on the record
 *
 * The approved baseline lives in data_manifests/production.json — a small,
 * committed summary (counts and hashes, never the products themselves), so any
 * checkout can tell what production is supposed to look like.
 *
 * THRESHOLDS: every number below is justified in-line. They are deliberately
 * loose enough to let a normal monthly update through and tight enough that a
 * catastrophic regression — a parser returning half the file, a matcher collapsing,
 * a builder emitting duplicates — cannot reach users silently.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ratedCapacityKw, segmentOf, isDataSheetEligible } from './lib/data-sheet-eligibility.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const APPROVE = args.includes('--approve');
const OVERRIDE = args.includes('--override');
const REASON = args.find(a => a.startsWith('--reason='))?.slice(9) ?? null;

const BASELINE = 'data_manifests/production.json';
const CANDIDATE = 'data_manifests/candidate.json';

const DATASETS = {
  DE: ['public/data/products.json', 'public/data/products-commercial.json'],
  GB: ['public/data/products-gb.json', 'public/data/products-commercial-gb.json'],
  FR: ['public/data/products-fr.json', 'public/data/products-commercial-fr.json'],
};

/** German registry status/funding fields must never leave Germany. */
const GERMAN_ONLY_FIELDS = ['bafa_listing_status', 'bafa_foerderung_von', 'bafa_foerderung_bis'];

// ── Thresholds ───────────────────────────────────────────────────────────────
const T = {
  // A month of registry churn moves the catalogue by well under 1 %. 2 % is a
  // generous ceiling; a parser truncation or a lost source blows straight past it.
  productDropPct: 2,
  // Same reasoning: eligibility is a property of the data, not of the weather.
  eligibleDropPct: 2,
  // Local matching is the brittle part (brand strings, model formats). A fifth of
  // the confirmed listings vanishing at once is a matcher or parser regression,
  // not Ofgem delisting a fifth of the market.
  localMatchDropPct: 20,
  // Products moving segment is possible (a spec correction) but a mass shift means
  // the capacity field changed meaning.
  segmentShiftPct: 5,
  // A source snapshot older than this is stale enough to question publishing.
  sourceAgeDays: 120,
};

const fmtPct = (a, b) => (b === 0 ? 0 : ((a - b) / b) * 100);

// ── Build the candidate manifest ─────────────────────────────────────────────
function loadItems(rel) {
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) return null;
  const j = JSON.parse(readFileSync(abs, 'utf8'));
  return { items: j.items ?? [], meta: j._meta ?? {} };
}

const blockers = [];
const warnings = [];
const block = m => blockers.push(m);
const warn = m => warnings.push(m);

const manifest = { generated_at: new Date().toISOString(), markets: {} };

for (const [cc, files] of Object.entries(DATASETS)) {
  const parts = files.map(f => ({ file: f, data: loadItems(f) }));

  // A missing or unreadable dataset is never "zero products" — it is a failure.
  const missing = parts.filter(p => !p.data);
  if (missing.length) {
    block(`[${cc}] dataset missing: ${missing.map(m => m.file).join(', ')} — the source or builder failed`);
    continue;
  }
  const items = parts.flatMap(p => p.data.items);
  if (!items.length) {
    block(`[${cc}] dataset parsed to ZERO records — refusing to publish an empty catalogue`);
    continue;
  }

  const seg = { residential: 0, commercial: 0, unclassified: 0 };
  items.forEach(i => seg[segmentOf(i)]++);

  const ids = items.map(i => String(i.source_id));
  const dupIds = ids.length - new Set(ids).size;

  const eligible = items.filter(isDataSheetEligible).length;
  const withCapacity = items.filter(i => ratedCapacityKw(i) != null).length;
  const missingModel = items.filter(i => !i.model).length;
  const badCapacity = items.filter(i => {
    const kw = ratedCapacityKw(i);
    return kw != null && (!Number.isFinite(kw) || kw <= 0 || kw > 2000);
  }).length;

  // Local listing overlay
  const confirmed = items.filter(i => i.pel_match_status === 'confirmed').length;
  const reviewReq = items.filter(i => i.pel_match_status === 'review_required').length;
  const verifyReq = items.filter(i => i.pel_match_status === 'verification_required').length;
  const localIds = items.filter(i => i.mcs_number).map(i => String(i.mcs_number));

  // One local registration id covering SEVERAL canonical products is normal, not an
  // error: an MCS certificate is issued for a heat pump, and the canonical baseline
  // registers each package built around it (bare, +tank, +tower …). Clivet's
  // 041-K008-02 covers five packages, all 5.5 kW.
  //
  // What IS a contradiction is one certificate covering products that land in
  // DIFFERENT SEGMENTS — that would mean the overlay is pulling a product across the
  // 23 kW line, and the catalogue would be lying about one of them.
  const byLocalId = {};
  items.filter(i => i.mcs_number).forEach(i => {
    (byLocalId[String(i.mcs_number)] ??= []).push(i);
  });
  const sharedLocalIds = Object.values(byLocalId).filter(v => v.length > 1).length;
  const conflictingLocalIds = Object.values(byLocalId)
    .filter(v => new Set(v.map(segmentOf)).size > 1).length;

  const m = {
    products: items.length,
    data_sheet_eligible: eligible,
    with_rated_capacity: withCapacity,
    residential: seg.residential,
    commercial: seg.commercial,
    unclassified: seg.unclassified,
    duplicate_source_ids: dupIds,
    invalid_capacities: badCapacity,
    missing_model: missingModel,
    manufacturers: new Set(items.map(i => i.manufacturer_short ?? i.manufacturer)).size,
    local_confirmed: confirmed,
    local_review_required: reviewReq,
    local_verification_required: verifyReq,
    local_ids: new Set(localIds).size,
    shared_local_ids: sharedLocalIds,
    conflicting_local_ids: conflictingLocalIds,
    source_snapshot: parts[0].data.meta.pel_snapshot ?? parts[0].data.meta.source_snapshot ?? null,
    generated_at: parts[0].data.meta.generated_at ?? null,
    hash: createHash('sha256').update(JSON.stringify(items.map(i => i.source_id).sort())).digest('hex').slice(0, 16),
  };
  manifest.markets[cc] = m;

  // ── Absolute rules (no baseline needed) ────────────────────────────────────
  if (dupIds > 0) block(`[${cc}] ${dupIds} duplicate canonical ids (source_id) — the catalogue would show the same product twice`);
  if (conflictingLocalIds > 0) block(`[${cc}] ${conflictingLocalIds} local registration ids cover canonical products in DIFFERENT SEGMENTS — the overlay is contradicting itself`);
  if (sharedLocalIds > 0) warn(`[${cc}] ${sharedLocalIds} local registration ids cover several canonical packages (normal: one certificate, several packages — all in the same segment)`);
  if (badCapacity > 0) block(`[${cc}] ${badCapacity} records have an implausible rated capacity`);
  if (missingModel > 0) block(`[${cc}] ${missingModel} records have no model name`);
  if (seg.unclassified > 0) block(`[${cc}] ${seg.unclassified} published products have no segment — every public product must be classifiable`);
  if (eligible !== items.length) block(`[${cc}] ${items.length - eligible} published products fail Data Sheet eligibility`);

  // Germany's registry status must not travel to another market.
  if (cc !== 'DE') {
    const leaked = GERMAN_ONLY_FIELDS.filter(f => f in items[0]);
    if (leaked.length) block(`[${cc}] German registry/funding fields present in a non-German dataset: ${leaked.join(', ')}`);
  }
  // A "confirmed" listing must have the registry's own id behind it.
  const confirmedWithoutId = items.filter(i => i.pel_match_status === 'confirmed' && !i.mcs_number).length;
  if (confirmedWithoutId > 0) block(`[${cc}] ${confirmedWithoutId} products are marked listed with no local registration id`);
}

// ── Compare with the last approved baseline ──────────────────────────────────
const baseline = existsSync(resolve(ROOT, BASELINE)) ? JSON.parse(readFileSync(resolve(ROOT, BASELINE), 'utf8')) : null;
const rows = [];

if (!baseline) {
  warn('No approved baseline yet — this run establishes one. Change gates are not evaluated.');
} else {
  for (const [cc, cur] of Object.entries(manifest.markets)) {
    const prev = baseline.markets?.[cc];
    if (!prev) { warn(`[${cc}] no previous baseline for this market — change gates skipped`); continue; }

    const d = (k) => fmtPct(cur[k], prev[k]);
    rows.push({ cc, prev, cur });

    if (d('products') < -T.productDropPct) {
      block(`[${cc}] product count fell ${d('products').toFixed(1)}% (${prev.products} → ${cur.products}), limit ${T.productDropPct}% — looks like a truncated source or a failed builder`);
    }
    if (d('data_sheet_eligible') < -T.eligibleDropPct) {
      block(`[${cc}] Data Sheet eligible fell ${d('data_sheet_eligible').toFixed(1)}% (${prev.data_sheet_eligible} → ${cur.data_sheet_eligible}), limit ${T.eligibleDropPct}% — products are losing technical fields`);
    }
    if (prev.local_confirmed > 0 && d('local_confirmed') < -T.localMatchDropPct) {
      block(`[${cc}] confirmed local listings collapsed ${d('local_confirmed').toFixed(1)}% (${prev.local_confirmed} → ${cur.local_confirmed}), limit ${T.localMatchDropPct}% — a matcher or parser regression is far likelier than a mass delisting`);
    }
    const segShift = Math.abs(fmtPct(cur.residential, prev.residential));
    if (prev.residential > 0 && segShift > T.segmentShiftPct) {
      block(`[${cc}] residential/commercial split moved ${segShift.toFixed(1)}% (${prev.residential} → ${cur.residential}), limit ${T.segmentShiftPct}% — the capacity field may have changed meaning`);
    }
    if (cur.manufacturers < prev.manufacturers * 0.9) {
      block(`[${cc}] ${prev.manufacturers - cur.manufacturers} manufacturers disappeared — a normalization or parser regression`);
    }
  }
}

// ── Source freshness ─────────────────────────────────────────────────────────
for (const [cc, m] of Object.entries(manifest.markets)) {
  if (!m.generated_at) { warn(`[${cc}] dataset carries no generation timestamp`); continue; }
  const ageDays = (Date.now() - Date.parse(m.generated_at)) / 86_400_000;
  if (ageDays > T.sourceAgeDays) warn(`[${cc}] dataset was generated ${Math.round(ageDays)} days ago — regenerate before publishing`);
}

// ── Report ───────────────────────────────────────────────────────────────────
const pad = (v, n) => String(v).padStart(n);
console.log('\n════ Dataset gate ════════════════════════════════════════════════');
for (const [cc, cur] of Object.entries(manifest.markets)) {
  const prev = baseline?.markets?.[cc];
  console.log(`\n[${cc}]  ${'metric'.padEnd(28)} ${pad('previous', 9)} ${pad('candidate', 10)} ${pad('change', 8)}`);
  const metrics = ['products', 'data_sheet_eligible', 'residential', 'commercial', 'unclassified',
    'with_rated_capacity', 'local_confirmed', 'local_review_required', 'local_verification_required',
    'duplicate_source_ids', 'conflicting_local_ids', 'manufacturers'];
  for (const k of metrics) {
    const p = prev?.[k];
    const c = cur[k];
    const delta = p == null ? '—' : (c - p >= 0 ? `+${c - p}` : `${c - p}`);
    console.log(`     ${k.padEnd(28)} ${pad(p ?? '—', 9)} ${pad(c, 10)} ${pad(delta, 8)}`);
  }
  console.log(`     source snapshot: ${cur.source_snapshot ?? '—'} | generated: ${cur.generated_at ?? '—'}`);
}

if (warnings.length) {
  console.log('\n── Warnings ──');
  warnings.forEach(w => console.log(`  ⚠ ${w}`));
}

mkdirSync(resolve(ROOT, 'data_manifests'), { recursive: true });
writeFileSync(resolve(ROOT, CANDIDATE), JSON.stringify(manifest, null, 2) + '\n');

if (blockers.length) {
  console.log('\n── PUBLICATION BLOCKED ──');
  blockers.forEach(b => console.error(`  ✗ ${b}`));
  if (OVERRIDE) {
    if (!REASON) {
      console.error('\n--override requires --reason="why this is safe". Refusing.');
      process.exit(1);
    }
    // An override is a decision, so it is recorded next to the data it overrode.
    manifest.override = { at: new Date().toISOString(), reason: REASON, blockers };
    writeFileSync(resolve(ROOT, CANDIDATE), JSON.stringify(manifest, null, 2) + '\n');
    console.warn(`\n⚠ OVERRIDDEN by the operator: "${REASON}"`);
    console.warn('  The blockers above were NOT fixed. This is recorded in data_manifests/candidate.json.');
    process.exit(0);
  }
  console.error('\nNothing was uploaded; the live datasets are untouched.');
  console.error('Fix the cause, or rerun with --override --reason="…" if you know it is safe.');
  process.exit(1);
}

console.log('\n✓ Gate passed — the candidate may be published.');
console.log('  next: node scripts/upload-datasets.mjs   then   node scripts/dataset-gate.mjs --approve');

if (APPROVE) {
  writeFileSync(resolve(ROOT, BASELINE), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\n✓ Approved: ${BASELINE} now describes production.`);
}
console.log('══════════════════════════════════════════════════════════════════');
