/**
 * Outdoor-Side Identifiability Analysis
 * Registry v2.5.0 — assigns every BAFA master seed product to exactly one category:
 *   A. outdoor_exact_model          — outdoor_unit_model populated in mapping
 *   B. outdoor_inferred_from_rule   — active rule implies outdoor-side (no exact model string)
 *   C. outdoor_inferred_from_model_name — manufacturer pattern in BAFA model name
 *   D. outdoor_inferred_from_safe_app_fallback — app Monoblock + safe exclusions
 *   E. outdoor_not_identified       — none of the above
 *
 * Category counts must sum to 7,163.
 * Confidence score is NOT used as a filter.
 * Do not commit this file or its output.
 */

import { readFileSync } from 'fs';

// ─── Load Data ────────────────────────────────────────────────────────────────

const seedRaw  = JSON.parse(readFileSync('data_sources/bafa/master_seed/2026-06/bafa-master-seed.json', 'utf8'));
const mapRaw   = JSON.parse(readFileSync('data_sources/bafa/idu_odu_mapping/2026-06/idu-odu-mapping.json', 'utf8'));
const prodRaw  = JSON.parse(readFileSync('public/data/products.json', 'utf8'));
const commRaw  = JSON.parse(readFileSync('public/data/products-commercial.json', 'utf8'));

const seedItems = seedRaw.items;
const mapItems  = mapRaw.items;
const appItems  = [...prodRaw.items, ...commRaw.items];

// ─── Build Lookup Maps by bafa_id ────────────────────────────────────────────

const mapById = new Map();
for (const m of mapItems) {
  if (m.bafa_id) mapById.set(String(m.bafa_id), m);
}

const appById = new Map();
for (const p of appItems) {
  if (p.bafa_id) appById.set(String(p.bafa_id), p);
}

// ─── Category C: Model-Name Pattern Rules ────────────────────────────────────
// Applied only to products NOT already in A or B.
// Returns true if the model name matches an outdoor-side pattern.

function matchesModelNamePattern(item) {
  const model = (item.model || '').toLowerCase();
  const mfr   = (item.manufacturer || '').toLowerCase();

  // ── Mitsubishi Electric (safety net; v2.5.0 rules should fully cover)
  if (mfr.includes('mitsubishi')) {
    if (/\b(puhz|puz|pud|suhz|suZ)\b/i.test(item.model)) return true;
  }

  // ── Panasonic Aquarea (safety net; PAN rules should fully cover)
  if (mfr.includes('panasonic')) {
    if (/\bWH-(MXC|MDC|UD|UDZ|WDG)\b/i.test(item.model)) return true;
  }

  // ── LG Electronics / LG Group
  if (mfr.includes('lg') || mfr.includes('lg electronics')) {
    // HM / HU = outdoor monoblock / outdoor heat pump unit
    if (/\b(HM|HU)\d+/i.test(item.model)) return true;
    // BULG Mono (LG commercial monoblock line — "Mono" in the name is explicit)
    if (/\bBULG\b/i.test(item.model) && /\bMono\b/i.test(item.model)) return true;
  }

  // ── Samsung Klimatechnik (safety net)
  if (mfr.includes('samsung')) {
    if (/WPLW-(Mono|Split)/i.test(item.model)) return true;
    if (/EHS\s*Mono/i.test(item.model)) return true;
  }

  // ── Vaillant (safety net; VAI rules should fully cover)
  if (mfr.includes('vaillant')) {
    if (/\b(VWL|aroTHERM|recoCOMPACT|versoTHERM)\b/i.test(item.model)) return true;
  }

  // ── Buderus / Bosch / Logaplus / Logatherm
  if (mfr.includes('buderus') || mfr.includes('bosch') || mfr.includes('bsh')) {
    if (/\b(Logaplus|Logatherm|Compress)\b/i.test(item.model)) return true;
    // CS7001i AW outdoor (explicitly listed in task)
    if (/CS\s*7001i?\s*AW/i.test(item.model)) return true;
    // WLW prefix products with clear outdoor-side naming
    if (/\bWLW\d/i.test(item.model)) return true;
    // Supraeco A (Bosch monoblock outdoor line)
    if (/Supraeco\s*A\b/i.test(item.model)) return true;
  }

  // ── Viessmann — all AWO/AWOT/HAWO/AWB/AWBT/AWCI patterns
  if (mfr.includes('viessmann')) {
    if (/\b(AWO|AWOT|HAWO|AWB|AWBT|AWCI)\b/i.test(item.model)) return true;
    // Vitocal A-series by model suffix
    if (/Vitocal\s+\d+-A\b/i.test(item.model)) return true;
    // Vitocal 200-S with AWB outdoor variant (split outdoor unit)
    if (/Vitocal.*AWB/i.test(item.model)) return true;
  }

  // ── NIBE — outdoor-side families only (NOT S2060/SMO/VVM)
  if (mfr.includes('nibe')) {
    if (/\bS2125\b/i.test(item.model)) return true;
    if (/\b(F2040|F2050|F2120)\b/i.test(item.model)) return true;
    if (/\bAMS\s*(10|20)\b/i.test(item.model)) return true;
    // Explicitly exclude indoor/controller types
    if (/\b(SMO|VVM|S2060|S1155|S1255)\b/i.test(item.model)) return false;
  }

  // ── Stiebel Eltron / Tecalor — outdoor-side families only (WPL-A, WPF-A, HPA-O)
  if (mfr.includes('stiebel') || mfr.includes('tecalor')) {
    if (/\bWPL-A\b/i.test(item.model)) return true;
    if (/\bWPF-A\b/i.test(item.model)) return true;
    if (/\bHPA-O\b/i.test(item.model)) return true;
    // WPL A (with space, seen in some BAFA names)
    if (/\bWPL\s+A\b/i.test(item.model)) return true;
    // LWZ is ventilation HP (indoor main unit) — NOT outdoor-side
    // WPC, WPS, WPL without -A suffix — not in listed patterns → skip
  }

  // ── Weishaupt
  if (mfr.includes('weishaupt') || mfr.includes('wei')) {
    if (/\bWAB\b/i.test(item.model)) return true;
    if (/\bWWP\s+(LS|LA)\b/i.test(item.model)) return true;
  }

  // ── Wolf (CHA/FHA/CHC-MONOBLOCK/CHT-MONOBLOCK; WLF rules cover most)
  if (mfr.includes('wolf') || mfr.includes('robert bosch') && /\bCH[AC]\b/i.test(item.model)) {
    if (/\b(CHC|CHT)-?MONOBLOCK\b/i.test(item.model)) return true;
    if (/\bCHA\b/i.test(item.model)) return true;
    if (/\bFHA\b/i.test(item.model)) return true;
  }

  // ── Daikin — Altherma (monoblock outdoor heat pump product line)
  if (mfr.includes('daikin')) {
    if (/\bAltherma\b/i.test(item.model)) return true;
    // Component codes (if present)
    if (/\bER(GA|LA)\b/i.test(item.model)) return true;
  }

  return false;
}

// ─── Category D: Safe App Monoblock Fallback ─────────────────────────────────
// Returns true if the product qualifies for Category D.
// Requires app installation_type == "Monoblock" AND no exclusion match.

function isSafeAppMonoblock(seedItem, appItem) {
  if (!appItem || appItem.installation_type !== 'Monoblock') return false;

  const model = (seedItem.model || '').toLowerCase();
  const mfr   = (seedItem.manufacturer || '').toLowerCase();

  // ── Exclusion: Mitsubishi split package patterns misclassified as Monoblock
  if (mfr.includes('mitsubishi')) {
    // PUZ/PUD/PUHZ/SUHZ outdoor-only products registered with EHS/ERS indoor
    if (/\b(EHS|ERS|EHST|ERSD|EHP|ERP)\b/i.test(seedItem.model) &&
        /\b(PUZ|PUD|PUHZ|SUHZ)\b/i.test(seedItem.model)) return false;
  }

  // ── Exclusion: Panasonic WH-UD/WH-UDZ split outdoor patterns
  if (mfr.includes('panasonic')) {
    if (/\bWH-(UD|UDZ|WDG)\b/i.test(seedItem.model)) return false;
  }

  // ── Exclusion: Hitachi RAS + RWM split system patterns
  if (mfr.includes('hitachi')) {
    if (/\bRAS\b/i.test(seedItem.model) && /\bRWM\b/i.test(seedItem.model)) return false;
  }

  // ── Exclusion: AIT [LAV + HV] bracket split patterns
  if (mfr.includes('ait') || mfr.includes('ait-deutschland')) {
    if (/\[.*LAV.*\+.*HV.*\]/i.test(seedItem.model)) return false;
    if (/\[.*HV.*\+.*LAV.*\]/i.test(seedItem.model)) return false;
  }

  // ── Exclusion: CLIVET EDGE / WiSAN-YME ambiguous outdoor-only
  if (mfr.includes('clivet')) {
    if (/\bEDGE\b/i.test(seedItem.model)) return false;
    if (/WiSAN-YME/i.test(seedItem.model)) return false;
  }

  // ── Exclusion: Samsung MIM-E03 (controller, never IDU or outdoor)
  if (/MIM-E03/i.test(seedItem.model)) return false;

  // ── Exclusion: NIBE SMO controller / VVM indoor tower / S2060 indoor exhaust-air HP
  if (mfr.includes('nibe')) {
    if (/\b(SMO|VVM)\b/i.test(seedItem.model)) return false;
    if (/\bS2060\b/i.test(seedItem.model)) return false;
  }

  return true;
}

// ─── Main Category Assignment ─────────────────────────────────────────────────

const categories = {
  A: [], B: [], C: [], D: [], E: []
};

const OUTDOOR_TYPES_INDICATING_IDENTIFIED = new Set([
  'split_odu', 'monoblock_outdoor_main', 'standalone_outdoor_unit'
]);

const ARCH_INDICATING_IDENTIFIED = new Set([
  'monoblock', 'monoblock_with_tank', 'monoblock_with_control_box',
  'monoblock_with_hydraulic_module', 'split', 'component_only'
]);

const STATUS_INDICATING_IDENTIFIED = new Set([
  'outdoor_only', 'outdoor_plus_idu', 'outdoor_plus_tank',
  'outdoor_plus_control_box', 'outdoor_plus_hydraulic_module'
]);

for (const seedItem of seedItems) {
  const id = String(seedItem.bafa_id);
  const m  = mapById.get(id);
  const ap = appById.get(id);

  // ── Category A: outdoor_unit_model is populated in mapping
  if (m && m.outdoor_unit_model) {
    categories.A.push({ id, seedItem, mapItem: m, appItem: ap, reason: 'outdoor_unit_model populated' });
    continue;
  }

  // ── Category B: rule-matched but outdoor_unit_model not extracted,
  //               yet rule implies outdoor-side equipment
  if (m && m.component_rule_id) {
    const cms = m.component_mapping_status;
    // variant_label / package label → product IS a heat pump with outdoor-side
    if (cms === 'package_label_only') {
      categories.B.push({ id, seedItem, mapItem: m, appItem: ap, reason: 'package_label_only → variant/package with outdoor-side' });
      continue;
    }
    // requires_research → still a heat pump, outdoor-side exists
    if (cms === 'requires_research') {
      categories.B.push({ id, seedItem, mapItem: m, appItem: ap, reason: 'requires_research rule matched' });
      continue;
    }
    // confirmed_set + not_extractable → set implies outdoor+indoor; extraction failed but outdoor-side present
    if (cms === 'not_extractable' && m.classification === 'confirmed_set') {
      categories.B.push({ id, seedItem, mapItem: m, appItem: ap, reason: 'confirmed_set extraction_failed — outdoor-side implied by set classification' });
      continue;
    }
    // Any other mapping status that indicates outdoor-side (safety net)
    if (
      OUTDOOR_TYPES_INDICATING_IDENTIFIED.has(m.outdoor_unit_type) ||
      ARCH_INDICATING_IDENTIFIED.has(m.system_architecture) ||
      STATUS_INDICATING_IDENTIFIED.has(cms)
    ) {
      categories.B.push({ id, seedItem, mapItem: m, appItem: ap, reason: `mapping status: ${cms}` });
      continue;
    }
  }

  // ── Category C: manufacturer model-name pattern
  if (matchesModelNamePattern(seedItem)) {
    categories.C.push({ id, seedItem, mapItem: m, appItem: ap, reason: 'model-name pattern match' });
    continue;
  }

  // ── Category D: safe app monoblock fallback
  if (isSafeAppMonoblock(seedItem, ap)) {
    categories.D.push({ id, seedItem, mapItem: m, appItem: ap, reason: 'app installation_type=Monoblock (safe fallback)' });
    continue;
  }

  // ── Category E: outdoor-side not identified
  categories.E.push({ id, seedItem, mapItem: m, appItem: ap, reason: 'no identification possible' });
}

// ─── Validation ───────────────────────────────────────────────────────────────

const total = Object.values(categories).reduce((s, arr) => s + arr.length, 0);
const bafaYes = seedItems.filter(i => i.bafa_list_status === 'yes' || i.bafa_list_current === true).length;
const bafaNo  = seedItems.filter(i => i.bafa_list_status === 'no'  || i.bafa_list_current === false).length;

// Duplicate check
const allIds = Object.values(categories).flat().map(r => r.id);
const uniqueIds = new Set(allIds);
const duplicates = allIds.length - uniqueIds.size;
const missing = seedItems.length - allIds.length;

// ─── Manufacturer Breakdowns ──────────────────────────────────────────────────

function mfrBreakdown(catArr) {
  const m = {};
  for (const r of catArr) {
    const key = r.seedItem.manufacturer || 'UNKNOWN';
    m[key] = (m[key] || 0) + 1;
  }
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

const notIdentifiedMfr  = mfrBreakdown(categories.E);
const identifiedMfr     = mfrBreakdown([...categories.A, ...categories.B, ...categories.C, ...categories.D]);

// ─── Top Unresolved Patterns ──────────────────────────────────────────────────

function topPatterns(catArr, n = 50) {
  // Extract first 4 tokens of model name as "pattern"
  const pat = {};
  for (const r of catArr) {
    const tokens = (r.seedItem.model || '').replace(/[()[\]]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 4).join(' ');
    pat[tokens] = (pat[tokens] || 0) + 1;
  }
  return Object.entries(pat).sort((a, b) => b[1] - a[1]).slice(0, n);
}

const topNotIdentifiedPatterns = topPatterns(categories.E);

// ─── Report ───────────────────────────────────────────────────────────────────

const identified = categories.A.length + categories.B.length + categories.C.length + categories.D.length;
const notIdentified = categories.E.length;

console.log('════════════════════════════════════════════════════════════════');
console.log('  OUTDOOR-SIDE IDENTIFIABILITY ANALYSIS — v2.5.0');
console.log('════════════════════════════════════════════════════════════════\n');

console.log('### A. EXECUTIVE ANSWER\n');
console.log(`As of v2.5.0 + all practical outdoor-side inference rules:`);
console.log(`  outdoor_side_not_identified_count = ${notIdentified} out of ${total}`);
console.log(`  outdoor_side_identified_count     = ${identified} out of ${total}\n`);

console.log('### B. CALCULATION TABLE\n');
console.log(`Total BAFA products:                          ${total.toString().padStart(5)}`);
console.log(`  A. Outdoor exact model (mapping):           ${categories.A.length.toString().padStart(5)}`);
console.log(`  B. Outdoor inferred from active rule:       ${categories.B.length.toString().padStart(5)}`);
console.log(`  C. Outdoor inferred from model-name:        ${categories.C.length.toString().padStart(5)}`);
console.log(`  D. Outdoor inferred safe app fallback:      ${categories.D.length.toString().padStart(5)}`);
console.log(`  E. Outdoor NOT identified:                  ${categories.E.length.toString().padStart(5)}`);
console.log(`Check: A+B+C+D+E = ${total} (expect 7163): ${total === 7163 ? '✓ PASS' : '✗ FAIL'}\n`);

console.log('### C. MANUFACTURER BREAKDOWN — NOT IDENTIFIED\n');
console.log('Count | Manufacturer');
console.log('------+--------------------------------------------------------------');
for (const [mfr, cnt] of notIdentifiedMfr) {
  console.log(`${cnt.toString().padStart(5)} | ${mfr.slice(0, 70)}`);
}
console.log(`Total: ${notIdentified}\n`);

console.log('### D. MANUFACTURER BREAKDOWN — IDENTIFIED (all categories)\n');
console.log('Count | Manufacturer');
console.log('------+--------------------------------------------------------------');
for (const [mfr, cnt] of identifiedMfr) {
  console.log(`${cnt.toString().padStart(5)} | ${mfr.slice(0, 70)}`);
}
console.log(`Total: ${identified}\n`);

console.log('### E. TOP UNRESOLVED MODEL-NAME PATTERNS (among not-identified)\n');
topNotIdentifiedPatterns.forEach(([pat, cnt], i) => {
  console.log(`${(i+1).toString().padStart(3)}. (${cnt.toString().padStart(3)}x) ${pat}`);
});
console.log('');

console.log('### F. IMPORTANT CLARIFICATION\n');
console.log('Outdoor not identified does NOT mean the product has no outdoor unit.');
console.log('It only means the current data/rules/fallback cannot identify or');
console.log('reasonably infer the outdoor-side equipment yet.\n');

console.log('### G. FILES INSPECTED\n');
console.log('  data_sources/bafa/master_seed/2026-06/bafa-master-seed.json');
console.log('  data_sources/bafa/idu_odu_rules/manufacturer-idu-odu-rules.json');
console.log('  data_sources/bafa/idu_odu_mapping/2026-06/idu-odu-mapping.json');
console.log('  data_sources/bafa/idu_odu_mapping/2026-06/idu-odu-summary.json');
console.log('  public/data/products.json');
console.log('  public/data/products-commercial.json\n');

console.log('### H. SCRIPT USED\n');
console.log('  scripts/analysis/recalculate-outdoor-side-identifiability.mjs');
console.log('  Command: node scripts/analysis/recalculate-outdoor-side-identifiability.mjs\n');

console.log('### I. VALIDATION CHECKS\n');
console.log(`  total_products   = ${total}  (expect 7163)  ${total === 7163 ? '✓' : '✗'}`);
console.log(`  bafa_list_yes    = ${bafaYes}  (expect 6887)  ${bafaYes === 6887 ? '✓' : '? (check field name)'}`);
console.log(`  bafa_list_no     = ${bafaNo}  (expect 276)   ${bafaNo === 276 ? '✓' : '? (check field name)'}`);
console.log(`  category_sum     = ${total}  (expect 7163)  ${total === 7163 ? '✓' : '✗'}`);
console.log(`  identified +`);
console.log(`  not_identified   = ${identified + notIdentified}  (expect 7163)  ${(identified + notIdentified) === 7163 ? '✓' : '✗'}`);
console.log(`  duplicates       = ${duplicates}  (expect 0)     ${duplicates === 0 ? '✓' : '✗'}`);
console.log(`  missing          = ${missing}  (expect 0)     ${missing === 0 ? '✓' : '✗'}\n`);

// Verify bafa counts more carefully
const bafaListYesAlt = seedItems.filter(i => i.bafa_list_status === 'yes').length;
const bafaListNoAlt  = seedItems.filter(i => i.bafa_list_status === 'no').length;
const bafaListYesAlt2 = seedItems.filter(i => i.bafa_list_current === true).length;
console.log(`  (alt count) bafa_list_status=yes: ${bafaListYesAlt}, bafa_list_status=no: ${bafaListNoAlt}`);
console.log(`  (alt count) bafa_list_current=true: ${bafaListYesAlt2}\n`);

// Sample E records
console.log('### SAMPLE 20 — NOT IDENTIFIED (Category E)\n');
categories.E.slice(0, 20).forEach((r, i) => {
  console.log(`${(i+1).toString().padStart(3)}. [${r.id}] ${r.seedItem.manufacturer?.slice(0,25)} | ${r.seedItem.model?.slice(0,60)}`);
});

console.log('\n### CATEGORY B BREAKDOWN by mapping_status+rule\n');
const bReasons = {};
for (const r of categories.B) {
  const key = r.reason.slice(0, 60);
  bReasons[key] = (bReasons[key]||0)+1;
}
Object.entries(bReasons).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${v.toString().padStart(4)}  ${k}`));

console.log('\n### CATEGORY C BREAKDOWN by manufacturer\n');
const cMfr = {};
for (const r of categories.C) {
  const m = r.seedItem.manufacturer || 'UNKNOWN';
  cMfr[m] = (cMfr[m]||0)+1;
}
Object.entries(cMfr).sort((a,b)=>b[1]-a[1]).forEach(([m,c]) => console.log(`  ${c.toString().padStart(4)}  ${m.slice(0,60)}`));

console.log('\n### CATEGORY D BREAKDOWN by manufacturer\n');
const dMfr = {};
for (const r of categories.D) {
  const m = r.seedItem.manufacturer || 'UNKNOWN';
  dMfr[m] = (dMfr[m]||0)+1;
}
Object.entries(dMfr).sort((a,b)=>b[1]-a[1]).forEach(([m,c]) => console.log(`  ${c.toString().padStart(4)}  ${m.slice(0,60)}`));

console.log('\n### J. ANALYSIS ONLY — NOT COMMITTED\n');
console.log('This script and its output are analysis-only.');
console.log('Nothing has been committed, pushed, or deployed.');
console.log('Generated mapping files remain unstaged.\n');
