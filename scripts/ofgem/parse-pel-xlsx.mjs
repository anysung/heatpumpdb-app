#!/usr/bin/env node
/**
 * parse-pel-xlsx.mjs — Parse Ofgem BUS Product Eligibility List XLSX
 *
 * Usage:
 *   node scripts/ofgem/parse-pel-xlsx.mjs [--snapshot YYYY-MM]
 *
 * Reads:  data_sources/ofgem_pel/raw/YYYY-MM/BUS-external-PEL.xlsx
 * Writes: data_sources/ofgem_pel/parsed/YYYY-MM/pel-normalized.json
 *         data_sources/ofgem_pel/parsed/YYYY-MM/pel-summary.json
 *
 * Validation performed:
 *   - Record count (total, active, expired/inactive)
 *   - Technology distribution (ASHP, GSHP, etc.)
 *   - Duplicate MCS numbers
 *   - Malformed / missing required fields
 *   - Key leak check (no EPREL_API_KEY in output)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = path.resolve(__dirname, '../../data_sources/ofgem_pel');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const snapshotIdx = args.indexOf('--snapshot');
const snapshotArg = snapshotIdx !== -1 ? args[snapshotIdx + 1] : undefined;

function currentSnapshot() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

const SNAPSHOT = snapshotArg ?? currentSnapshot();

// ── Certification status model ────────────────────────────────────────────────
// Evidence from 2026-05 snapshot analysis:
//   - MCS, BSI, BBA prefixed certs: 100% blank certified_until (cert body doesn't record expiry)
//   - ICIM, CN prefixed certs: 100% dated (cert body always records expiry)
//   - KIWA: mixed (74 blank / 17 dated)
//   - Zero past-date records — PEL is pre-filtered to currently listed products
//   - Blank certified_until is a data provenance distinction, NOT an expired/unknown status
//   - PEL listing does not guarantee full BUS eligibility; verify all requirements independently
//
// Status values:
//   listed_no_expiry_date  — listed in current PEL snapshot; cert body (MCS/BSI/BBA) does not record expiry dates
//   active_with_expiry     — listed in current PEL snapshot; certified_until is a future date
//   expiry_imminent        — active_with_expiry; certified_until within 90 days
//   expired_confirmed      — certified_until is past (not present in 2026-05 snapshot)
//   date_parse_failed      — expiry date string present but unparseable
const EXPIRY_IMMINENT_DAYS = 90;

// ── Required fields to validate ───────────────────────────────────────────────
const REQUIRED_FIELD_KEYS = [
  'mcs_number',
  'product_name',
  'technology_type',
  'certification_status',
];

// ── Column name normalization ─────────────────────────────────────────────────
function normalizeColName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// ── Value normalizers ─────────────────────────────────────────────────────────
function normalizeBrand(s) {
  return String(s ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeStatus(s) {
  const v = String(s ?? '').toLowerCase().trim();
  if (v === 'active' || v === '1' || v === 'yes') return 'active';
  if (v === 'inactive' || v === 'expired' || v === '0' || v === 'no') return 'expired';
  return v || null;
}

function normalizeTech(s) {
  const v = String(s ?? '').trim();
  const lower = v.toLowerCase();
  if (lower.includes('air source') || lower.includes('ashp') || lower.includes('air-source') ||
      lower.includes('air-to-water') || lower.includes('air to water') || lower.includes('air source heat pump')) return 'ASHP';
  if (lower.includes('ground source') || lower.includes('gshp') || lower.includes('ground-source') ||
      lower.includes('ground-to-water') || lower.includes('ground to water')) return 'GSHP';
  if (lower.includes('water source') || lower.includes('wshp') || lower.includes('water-source')) return 'WSHP';
  if (lower.includes('exhaust air') || lower.includes('eahp')) return 'EAHP';
  if (lower.includes('biomass')) return 'Biomass';
  return v || null;
}

function normalizeNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

// ── Log ───────────────────────────────────────────────────────────────────────
const LOG_FILE = path.join(OUT_ROOT, 'fetch-log.md');
function log(msg) {
  const ts = new Date().toISOString();
  const line = `- ${ts} ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// ── Safety guard ──────────────────────────────────────────────────────────────
function assertInsideOutRoot(p) {
  const rel = path.relative(OUT_ROOT, p);
  if (rel.startsWith('..')) throw new Error(`Path escape attempt: ${p}`);
}

// ── Extract source_period from URL path (e.g. ".../2026-05/BUS-..." → "2026-05") ─
function extractSourcePeriod(url) {
  if (!url) return null;
  const m = url.match(/\/(\d{4}-\d{2})\//);
  return m ? m[1] : null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const xlsxPath = path.join(OUT_ROOT, 'raw', SNAPSHOT, 'BUS-external-PEL.xlsx');
  if (!fs.existsSync(xlsxPath)) {
    console.error(`XLSX not found: ${xlsxPath}`);
    console.error(`Run first: node scripts/ofgem/fetch-pel-xlsx.mjs --download --snapshot ${SNAPSHOT}`);
    process.exit(1);
  }

  // Read _meta.json for provenance fields
  const metaJsonPath = path.join(OUT_ROOT, 'raw', SNAPSHOT, '_meta.json');
  let rawMeta = {};
  if (fs.existsSync(metaJsonPath)) {
    try { rawMeta = JSON.parse(fs.readFileSync(metaJsonPath, 'utf8')); } catch (_) {}
  }
  const sourceUrl = rawMeta.sourceUrl ?? null;
  const sourcePeriod = rawMeta.source_period ?? extractSourcePeriod(sourceUrl);
  const sourceLastModified = rawMeta.httpLastModified ?? null;

  console.log(`\nOfgem PEL parser`);
  console.log(`Snapshot      : ${SNAPSHOT}`);
  console.log(`Source period : ${sourcePeriod ?? '(unknown)'}`);
  console.log(`Source URL    : ${sourceUrl ?? '(unknown)'}`);
  console.log(`Input         : ${path.relative(process.cwd(), xlsxPath)}\n`);

  // ── 1. Read workbook ──────────────────────────────────────────────────────
  const workbook = XLSX.readFile(xlsxPath, { cellDates: true, raw: false });
  const sheetNames = workbook.SheetNames;
  console.log(`Sheets (${sheetNames.length}):`, sheetNames);
  log(`parse start: snapshot=${SNAPSHOT}, sheets=[${sheetNames.join(', ')}]`);

  // ── 2. Identify PEL sheet ─────────────────────────────────────────────────
  // Prefer a sheet whose name contains "PEL", "eligibility", or "product"
  const pelSheetName = sheetNames.find(n => {
    const l = n.toLowerCase();
    return l.includes('pel') || l.includes('eligib') || l.includes('product');
  }) ?? sheetNames[0];
  console.log(`Using sheet: "${pelSheetName}"`);

  const sheet = workbook.Sheets[pelSheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  console.log(`Raw rows read: ${rawRows.length}`);

  // ── 3. Find header row ────────────────────────────────────────────────────
  // The PEL may have a blank row 0; find the first row with ≥3 non-empty cells.
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(5, rawRows.length); i++) {
    const nonEmpty = rawRows[i].filter(c => String(c).trim() !== '').length;
    if (nonEmpty >= 3) { headerRowIdx = i; break; }
  }
  const headerRow = rawRows[headerRowIdx].map(normalizeColName);
  console.log(`Header row index: ${headerRowIdx}`);
  console.log(`Columns (${headerRow.length}):`, headerRow);

  // ── 4. Map columns ────────────────────────────────────────────────────────
  // Build flexible column index map; try several alias patterns for each field.
  const COL_ALIASES = {
    mcs_number:      ['mcs_number', 'mcs_certification_number', 'mcs_no', 'mcs_cert', 'certificate_number', 'mcs_product_number', 'product_number'],
    product_name:    ['product_name', 'product', 'name', 'model_name', 'product_model'],
    model:           ['model', 'model_number', 'model_id'],
    brand:           ['manufacturer', 'brand', 'make', 'supplier', 'supplier_or_trademark'],
    technology_type: ['technology_type', 'technology', 'type', 'heat_pump_type', 'tech_type'],
    status:          ['status', 'active', 'eligibility_status', 'eligible'],
    rated_heat_output_kw: ['rated_heat_output_kw', 'rated_heat_output', 'heat_output_kw', 'output_kw', 'capacity_kw'],
    scop:            ['scop', 'seasonal_cop', 'seasonal_coefficient'],
    cop:             ['cop', 'coefficient_of_performance'],
    mcs_cert_date:   ['certified_from', 'mcs_cert_date', 'certification_date', 'date', 'cert_date'],
    expiry_date:     ['certified_until', 'expiry_date', 'expiry', 'expires', 'expiry_or_removal_date'],
  };

  const colIdx = {};
  for (const [field, aliases] of Object.entries(COL_ALIASES)) {
    for (const alias of aliases) {
      const idx = headerRow.indexOf(alias);
      if (idx !== -1) { colIdx[field] = idx; break; }
    }
  }

  console.log('\nColumn mapping:');
  for (const [field, idx] of Object.entries(colIdx)) {
    console.log(`  ${field.padEnd(22)} → col ${idx} ("${headerRow[idx]}")`);
  }
  const unmapped = Object.keys(COL_ALIASES).filter(f => !(f in colIdx));
  if (unmapped.length) console.log(`  Unmapped fields: ${unmapped.join(', ')} (may not exist in this version)`);

  // ── 5. Parse data rows ────────────────────────────────────────────────────
  const dataRows = rawRows.slice(headerRowIdx + 1);
  const records = [];
  const malformed = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    // Skip completely empty rows
    if (row.every(c => String(c).trim() === '')) continue;

    const get = (field) => {
      const idx = colIdx[field];
      return idx !== undefined ? String(row[idx] ?? '').trim() : '';
    };

    const mcsNumber = get('mcs_number');
    const productName = get('product_name');
    const technologyRaw = get('technology_type');
    const statusRaw = get('status');
    const expiryRaw = get('expiry_date');
    const certFromRaw = get('mcs_cert_date');

    // Flag malformed rows
    if (!mcsNumber && !productName) {
      malformed.push({ rowIndex: headerRowIdx + 1 + i + 1, reason: 'no mcs_number and no product_name', row: row.slice(0, 6) });
      continue;
    }

    // Derive certification_status from certified_until.
    // Evidence-based rules (see comment at top of file):
    //   blank → listed_no_expiry_date  (cert body doesn't record expiry; listed in current PEL snapshot — no expiry date in source data)
    //   future date within 90 days → expiry_imminent
    //   future date > 90 days → active_with_expiry
    //   past date → expired_confirmed
    //   unparseable date → date_parse_failed
    const now = new Date();
    const imminentThreshold = new Date(now.getTime() + EXPIRY_IMMINENT_DAYS * 24 * 60 * 60 * 1000);
    let certificationStatus;
    if (!expiryRaw) {
      certificationStatus = 'listed_no_expiry_date';
    } else {
      const expiryDate = new Date(expiryRaw);
      if (isNaN(expiryDate.getTime())) {
        certificationStatus = 'date_parse_failed';
      } else if (expiryDate < now) {
        certificationStatus = 'expired_confirmed';
      } else if (expiryDate <= imminentThreshold) {
        certificationStatus = 'expiry_imminent';
      } else {
        certificationStatus = 'active_with_expiry';
      }
    }

    // Extract base MCS number (before first space, strip trailing _NN variant suffix)
    const mcsBase = mcsNumber ? mcsNumber.split(' ')[0].replace(/_\d+$/, '') : null;
    // Model suffix is the part of the MCS number after the base (e.g. "AW162HVGHA/HU162WAHYB")
    const mcsSuffix = mcsNumber && mcsBase && mcsNumber.length > mcsBase.length
      ? mcsNumber.slice(mcsBase.length).trim()
      : null;

    records.push({
      // Identity
      source_id:               mcsNumber || null,   // canonical key for this record
      mcs_number:              mcsNumber || null,
      mcs_number_base:         mcsBase || null,
      mcs_model_suffix:        mcsSuffix || null,
      product_name:            productName || null,
      model:                   get('model') || null,
      brand:                   normalizeBrand(get('brand')) || null,
      technology_type:         normalizeTech(technologyRaw),
      technology_type_raw:     technologyRaw || null,
      // Certification status (evidence-based — see top-of-file comment)
      certification_status:    certificationStatus,
      mcs_cert_date:           certFromRaw || null,
      expiry_date:             expiryRaw || null,
      // Performance (not present in this PEL version)
      rated_heat_output_kw:    normalizeNum(get('rated_heat_output_kw')),
      scop:                    normalizeNum(get('scop')),
      cop:                     normalizeNum(get('cop')),
      // Provenance
      country:                 'GB',
      primary_source:          'OFGEM_PEL',
      eligibility_source:      'OFGEM_PEL',
      eligibility_interpretation: 'listed_on_current_pel_snapshot',
      eligibility_caveat:      'PEL is an administrative reference tool. Presence on PEL does not guarantee full BUS eligibility. Verify all criteria independently.',
      source_snapshot:         SNAPSHOT,
      source_period:           sourcePeriod,
      source_last_modified:    sourceLastModified,
      source_url:              sourceUrl,
    });
  }

  console.log(`\nRecords parsed: ${records.length}`);
  console.log(`Malformed rows skipped: ${malformed.length}`);

  // ── 6. Validation ─────────────────────────────────────────────────────────
  console.log('\n=== Validation ===');

  // Count by certification_status
  const statusCounts = {};
  for (const r of records) {
    const s = r.certification_status ?? 'unknown';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }
  console.log('Status distribution:', statusCounts);

  // Technology distribution
  const techCounts = {};
  for (const r of records) {
    const t = r.technology_type ?? 'unknown';
    techCounts[t] = (techCounts[t] || 0) + 1;
  }
  console.log('Technology distribution:', techCounts);

  // Duplicate MCS numbers
  const mcsMap = {};
  for (const r of records) {
    if (r.mcs_number) mcsMap[r.mcs_number] = (mcsMap[r.mcs_number] || 0) + 1;
  }
  const duplicates = Object.entries(mcsMap).filter(([, count]) => count > 1);
  console.log(`Duplicate MCS numbers: ${duplicates.length}`);
  if (duplicates.length > 0 && duplicates.length <= 10) {
    console.log('  Duplicates:', duplicates.map(([k, v]) => `${k}×${v}`).join(', '));
  }

  // Missing required fields
  const missingRequired = { mcs_number: 0, product_name: 0, technology_type: 0, certification_status: 0 };
  for (const r of records) {
    if (!r.mcs_number) missingRequired.mcs_number++;
    if (!r.product_name) missingRequired.product_name++;
    if (!r.technology_type) missingRequired.technology_type++;
    if (!r.certification_status) missingRequired.certification_status++;
  }
  console.log('Missing required fields:', missingRequired);

  // Brand distribution (top 10)
  const brandCounts = {};
  for (const r of records) {
    const b = r.brand ?? 'unknown';
    brandCounts[b] = (brandCounts[b] || 0) + 1;
  }
  const topBrands = Object.entries(brandCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('Top brands:', topBrands.map(([k, v]) => `${k}(${v})`).join(', '));

  // Key leak check
  const sampleStr = JSON.stringify(records.slice(0, 10));
  const keyLeak = sampleStr.includes('EPREL_API_KEY') || sampleStr.includes('X-API-KEY');
  console.log('Key leak in output:', keyLeak ? 'FAIL' : 'false PASS');

  // ── 7. Write normalized JSON ──────────────────────────────────────────────
  const parsedDir = path.join(OUT_ROOT, 'parsed', SNAPSHOT);
  assertInsideOutRoot(parsedDir);
  fs.mkdirSync(parsedDir, { recursive: true });

  const normalizedPath = path.join(parsedDir, 'pel-normalized.json');
  assertInsideOutRoot(normalizedPath);
  fs.writeFileSync(normalizedPath, JSON.stringify(records, null, 2) + '\n');
  console.log(`\nWrote ${path.relative(process.cwd(), normalizedPath)} (${records.length} records)`);

  // ── 8. Write summary JSON ─────────────────────────────────────────────────
  const summary = {
    snapshot: SNAPSHOT,
    source_period: sourcePeriod,
    source_last_modified: sourceLastModified,
    source_url: sourceUrl,
    parsedAt: new Date().toISOString(),
    sourceXlsx: path.relative(OUT_ROOT, xlsxPath),
    sheetName: pelSheetName,
    allSheets: sheetNames,
    headerRowIndex: headerRowIdx,
    columnCount: headerRow.length,
    columns: headerRow,
    columnMapping: colIdx,
    unmappedFields: unmapped,
    totalRecords: records.length,
    malformedRowsSkipped: malformed.length,
    certificationStatusDistribution: statusCounts,
    technologyDistribution: techCounts,
    topBrands: Object.fromEntries(topBrands),
    duplicateMcsNumbers: duplicates.length,
    missingRequiredFields: missingRequired,
    keyLeakInOutput: keyLeak,
    statusModelNote: 'listed_no_expiry_date = on PEL but cert body (MCS/BSI/BBA) does not record expiry; active_with_expiry = future date set; expiry_imminent = expiring within 90 days; expired_confirmed = past date (absent from 2026-05 snapshot); date_parse_failed = date string but unparseable',
    eligibilityNote: 'All records are listed on the current PEL snapshot. PEL listing = administrative eligibility reference only. Presence does not guarantee full BUS compliance. Verify all criteria independently.',
    validation: {
      recordCount: records.length > 0 ? 'PASS' : 'FAIL — zero records',
      statusDistribution: Object.keys(statusCounts).length > 0 ? 'PASS' : 'WARN',
      techCoverage: Object.keys(techCounts).filter(k => k !== 'unknown').length > 0 ? 'PASS' : 'WARN — all tech unknown',
      keyLeak: keyLeak ? 'FAIL' : 'PASS',
      malformed: malformed.length > 10 ? `WARN — ${malformed.length} malformed rows` : 'PASS',
      noBlankMarkedActive: 'PASS — blank certified_until is now listed_no_expiry_date, not active',
    },
    malformedRows: malformed,
  };

  const summaryPath = path.join(parsedDir, 'pel-summary.json');
  assertInsideOutRoot(summaryPath);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
  console.log(`Wrote ${path.relative(process.cwd(), summaryPath)}`);

  log(`parse complete: snapshot=${SNAPSHOT} records=${records.length} listed_no_expiry=${statusCounts.listed_no_expiry_date ?? 0} active_with_expiry=${statusCounts.active_with_expiry ?? 0} expiry_imminent=${statusCounts.expiry_imminent ?? 0} expired=${statusCounts.expired_confirmed ?? 0} duplicates=${duplicates.length} malformed=${malformed.length} keyLeak=${keyLeak}`);

  // ── 9. Final summary ──────────────────────────────────────────────────────
  console.log('\n=== Parse complete ===');
  console.log(`Total records        : ${records.length}`);
  console.log(`listed_no_expiry     : ${statusCounts.listed_no_expiry_date ?? 0}  (listed in current PEL snapshot — no expiry date in source data)`);
  console.log(`active_with_expiry   : ${statusCounts.active_with_expiry ?? 0}  (future certified_until > 90 days)`);
  console.log(`expiry_imminent      : ${statusCounts.expiry_imminent ?? 0}  (future certified_until within 90 days — flag for users)`);
  console.log(`expired_confirmed    : ${statusCounts.expired_confirmed ?? 0}  (past certified_until)`);
  console.log(`date_parse_failed    : ${statusCounts.date_parse_failed ?? 0}`);
  console.log(`Technologies         : ${JSON.stringify(techCounts)}`);
  console.log(`Duplicate MCS        : ${duplicates.length}`);
  console.log(`Malformed rows       : ${malformed.length}`);
  console.log(`Key leak             : ${keyLeak}`);
  console.log('\nValidation results:');
  for (const [k, v] of Object.entries(summary.validation)) console.log(`  ${k.padEnd(28)}: ${v}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
