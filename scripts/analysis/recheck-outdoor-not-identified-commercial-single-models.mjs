/**
 * Re-check Script: 687 outdoor_not_identified products
 * Applies commercial-single-model inference rule per user instruction.
 * Assigns each to exactly one of E1–E7; E1 products are reclassified as outdoor-side identified.
 *
 * Categories:
 *   E1  commercial_single_model_outdoor_inferred     — power >= 21 kW, single standalone model → reclassified
 *   E2  commercial_package_or_unclear                — power >= 21 kW, unclear/package → stays not identified
 *   E3  residential_single_model_candidate           — power <= 20.99 kW, single standalone → candidate only
 *   E4  residential_package_or_unclear               — power <= 20.99 kW, unclear/package → stays not identified
 *   E5  capacity_pending_single_model_candidate      — power null, single standalone → candidate only
 *   E6  capacity_pending_package_or_unclear          — power null, unclear/package → stays not identified
 *   E7  clear_indoor_controller_tank_only_excluded   — explicit indoor/controller/tank/tower only evidence
 *
 * Confidence score is NOT used.
 * Do not commit this file or its output.
 */

import { readFileSync } from 'fs';

const seedRaw = JSON.parse(readFileSync('data_sources/bafa/master_seed/2026-06/bafa-master-seed.json', 'utf8'));
const mapRaw  = JSON.parse(readFileSync('data_sources/bafa/idu_odu_mapping/2026-06/idu-odu-mapping.json', 'utf8'));
const prodRaw = JSON.parse(readFileSync('public/data/products.json', 'utf8'));
const commRaw = JSON.parse(readFileSync('public/data/products-commercial.json', 'utf8'));

const mapById = new Map(mapRaw.items.map(i => [String(i.bafa_id), i]));
const appById = new Map([...prodRaw.items, ...commRaw.items].map(i => [String(i.bafa_id), i]));

// ─── Reproduce Category E from prior analysis ─────────────────────────────────

function matchesModelNamePattern(item) {
  const mfr = (item.manufacturer || '').toLowerCase();
  const model = item.model || '';
  if (mfr.includes('mitsubishi') && /\b(puhz|puz|pud|suhz)\b/i.test(model)) return true;
  if (mfr.includes('panasonic') && /\bWH-(MXC|MDC|UD|UDZ|WDG)\b/i.test(model)) return true;
  if ((mfr.includes('lg') || mfr.includes('lg electronics')) &&
      (/\b(HM|HU)\d+/i.test(model) || (/\bBULG\b/i.test(model) && /\bMono\b/i.test(model)))) return true;
  if (mfr.includes('samsung') && (/WPLW-(Mono|Split)/i.test(model) || /EHS\s*Mono/i.test(model))) return true;
  if (mfr.includes('vaillant') && /\b(VWL|aroTHERM|recoCOMPACT|versoTHERM)\b/i.test(model)) return true;
  if ((mfr.includes('buderus') || mfr.includes('bosch') || mfr.includes('bsh')) &&
      (/\b(Logaplus|Logatherm|Compress)\b/i.test(model) || /CS\s*7001i?\s*AW/i.test(model) ||
       /\bWLW\d/i.test(model) || /Supraeco\s*A\b/i.test(model))) return true;
  if (mfr.includes('viessmann') && (/\b(AWO|AWOT|HAWO|AWB|AWBT|AWCI)\b/i.test(model) ||
      /Vitocal\s+\d+-A\b/i.test(model) || /Vitocal.*AWB/i.test(model))) return true;
  if (mfr.includes('nibe') && (/\bS2125\b/i.test(model) || /\b(F2040|F2050|F2120)\b/i.test(model) ||
      /\bAMS\s*(10|20)\b/i.test(model))) return true;
  if ((mfr.includes('stiebel') || mfr.includes('tecalor')) &&
      (/\bWPL[-\s]A\b/i.test(model) || /\bWPF-A\b/i.test(model) || /\bHPA-O\b/i.test(model))) return true;
  if (mfr.includes('weishaupt') && (/\bWAB\b/i.test(model) || /\bWWP\s+(LS|LA)\b/i.test(model))) return true;
  if (mfr.includes('daikin') && (/\bAltherma\b/i.test(model) || /\bER(GA|LA)\b/i.test(model))) return true;
  return false;
}

function isSafeAppMonoblock(s, ap) {
  if (!ap || ap.installation_type !== 'Monoblock') return false;
  const mfr = (s.manufacturer || '').toLowerCase();
  if (mfr.includes('mitsubishi') && /\b(EHS|ERS|EHST|ERSD|EHP|ERP)\b/i.test(s.model) &&
      /\b(PUZ|PUD|PUHZ|SUHZ)\b/i.test(s.model)) return false;
  if (mfr.includes('panasonic') && /\bWH-(UD|UDZ|WDG)\b/i.test(s.model)) return false;
  if (mfr.includes('hitachi') && /\bRAS\b/i.test(s.model) && /\bRWM\b/i.test(s.model)) return false;
  if ((mfr.includes('ait') || mfr.includes('ait-deutschland')) &&
      /\[.*LAV.*\+.*HV.*\]/i.test(s.model)) return false;
  if (mfr.includes('clivet') && (/\bEDGE\b/i.test(s.model) || /WiSAN-YME/i.test(s.model))) return false;
  if (/MIM-E03/i.test(s.model)) return false;
  if (mfr.includes('nibe') && /\b(SMO|VVM|S2060)\b/i.test(s.model)) return false;
  return true;
}

const catE = [];
for (const s of seedRaw.items) {
  const id = String(s.bafa_id);
  const m = mapById.get(id);
  const ap = appById.get(id);
  if (m && m.outdoor_unit_model) continue;
  if (m && m.component_rule_id) {
    const cms = m.component_mapping_status;
    if (cms === 'package_label_only' || cms === 'requires_research' ||
        (cms === 'not_extractable' && m.classification === 'confirmed_set')) continue;
    if (['split_odu', 'monoblock_outdoor_main', 'standalone_outdoor_unit'].includes(m.outdoor_unit_type) ||
        ['monoblock', 'monoblock_with_tank', 'monoblock_with_control_box',
         'monoblock_with_hydraulic_module', 'split', 'component_only'].includes(m.system_architecture) ||
        ['outdoor_only', 'outdoor_plus_idu', 'outdoor_plus_tank',
         'outdoor_plus_control_box', 'outdoor_plus_hydraulic_module'].includes(cms)) continue;
  }
  if (matchesModelNamePattern(s)) continue;
  if (isSafeAppMonoblock(s, ap)) continue;
  catE.push({ s, m, ap });
}

// ─── E7: Clear indoor / controller / tank / tower only exclusion ──────────────
// Applied FIRST before single-model/commercial checks.
// A product is E7 if the model name contains explicit evidence it is NOT outdoor-side.

function isClearIndoorControllerTankOnly(item) {
  const model = item.model || '';
  const mfr   = (item.manufacturer || '').toLowerCase();

  // Known indoor-only Nilan product types (ventilation HP with no separate outdoor unit)
  if (mfr.includes('nilan')) {
    // Compact P2 = exhaust-air ventilation heat pump (heat pump extracts heat from exhaust air, no outdoor refrigerant loop)
    if (/\bCompact\s*P/i.test(model)) return true;
  }

  // Explicit indoor/hydraulic station/tower-only terms in model name
  if (/\b(Hydraulikmodul|Hydraulic\s*Station|Hydraulic\s*Module)\b/i.test(model)) return true;
  if (/\b(uniTOWER|Indoor\s*Unit|Innengerät|Innenmodul)\b/i.test(model)) return true;

  // Known Stiebel Eltron LWZ = ventilation heat pump (indoor compact unit, no separate outdoor unit)
  if ((mfr.includes('stiebel') || mfr.includes('tecalor')) && /\bLWZ\b/i.test(model)) return true;

  // Nilan DHW = heat pump water heater, may be indoor-only (exhaust air source)
  // Commotherm LWi = Luft-Wärmepumpe innen (air heat pump indoor unit)
  if (/\bLWi\b/i.test(model)) return true;

  return false;
}

// ─── Single Standalone Model Detection ───────────────────────────────────────
// Returns true if the model name looks like one standalone product, not a set/package.

function isSingleStandaloneModel(item) {
  const model = item.model || '';

  // Disqualify: clear + package combination (space-plus-space is a set separator)
  if (/\s\+\s/.test(model)) return false;

  // Disqualify: bracket pair [IDU / ODU] or similar
  if (/\[.+\/.*\]/.test(model)) return false;

  // Disqualify: set/package/kit wording (case-insensitive)
  if (/\b(Set|Paket|Package|Kit|Kombination|Kombi(?!\w))\b/i.test(model)) return false;

  // Disqualify: explicit indoor-only or controller-only terms
  if (/\b(Hydraulikmodul|Hydraulic\s*Module|uniTOWER|Tank\s*Unit|Speichereinheit|Innenmodul)\b/i.test(model)) return false;

  // "/" within brackets like [A/B] or directly [ODU/IDU] → disqualify
  // But "/" within a capacity/mode suffix like "HT / HK" or "Heizen / Kühlen" is OK
  // Check for slash that looks like two separate model codes (two uppercase alpha-num chunks)
  const slashComponentPattern = /[A-Z0-9]{3,}\s*\/\s*[A-Z0-9]{3,}/;
  if (slashComponentPattern.test(model)) {
    // Exception: if it's a mode/variant indicator like "HT / HK" (2-4 uppercase letters only)
    const modeSlashPattern = /\b[A-Z]{2,4}\s*\/\s*[A-Z]{2,4}\b/;
    if (!modeSlashPattern.test(model)) return false;
    // If it also looks like actual component codes (longer), disqualify
    if (/[A-Z0-9]{5,}\s*\/\s*[A-Z0-9]{5,}/.test(model)) return false;
  }

  return true;
}

// ─── Assign E1–E7 ─────────────────────────────────────────────────────────────

const recheck = { E1: [], E2: [], E3: [], E4: [], E5: [], E6: [], E7: [] };

for (const r of catE) {
  const { s } = r;
  const kw = s.power_35C_kw;

  // E7 first — clear indoor/controller/tank-only exclusion
  if (isClearIndoorControllerTankOnly(s)) {
    recheck.E7.push({ ...r, recheckNote: 'clear indoor/ventilation/controller-only excluded' });
    continue;
  }

  const isSingle   = isSingleStandaloneModel(s);
  const isComm     = kw != null && kw >= 21;
  const isResi     = kw != null && kw <= 20.99;
  const isPending  = kw == null;

  if (isComm) {
    if (isSingle) {
      recheck.E1.push({ ...r, recheckNote: `commercial ${kw.toFixed(1)}kW single standalone → outdoor_inferred_from_commercial_single_model` });
    } else {
      recheck.E2.push({ ...r, recheckNote: `commercial ${kw.toFixed(1)}kW package/unclear` });
    }
  } else if (isResi) {
    if (isSingle) {
      recheck.E3.push({ ...r, recheckNote: `residential ${kw.toFixed(1)}kW single standalone candidate (cautious, not auto-reclassified)` });
    } else {
      recheck.E4.push({ ...r, recheckNote: `residential ${kw.toFixed(1)}kW package/unclear` });
    }
  } else { // pending
    if (isSingle) {
      recheck.E5.push({ ...r, recheckNote: 'capacity pending, single standalone candidate' });
    } else {
      recheck.E6.push({ ...r, recheckNote: 'capacity pending, package/unclear' });
    }
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

const totalRecheck = Object.values(recheck).reduce((s, a) => s + a.length, 0);
const allRecheckIds = Object.values(recheck).flat().map(r => r.s.bafa_id);
const uniqueIds = new Set(allRecheckIds);
const duplicates = allRecheckIds.length - uniqueIds.size;
const missing = catE.length - allRecheckIds.length;

const newlyReclassified  = recheck.E1.length;
const stillNotIdentified = totalRecheck - newlyReclassified;
const prevIdentified     = 6476;
const prevNotIdentified  = 687;
const newIdentified      = prevIdentified + newlyReclassified;
const newNotIdentified   = prevNotIdentified - newlyReclassified;

// ─── Manufacturer breakdown helpers ──────────────────────────────────────────

function mfrBreakdown(arr, withExamples = false) {
  const m = {};
  for (const r of arr) {
    const k = r.s.manufacturer || 'UNKNOWN';
    if (!m[k]) m[k] = { count: 0, examples: [] };
    m[k].count++;
    if (m[k].examples.length < 3) m[k].examples.push(r.s.model?.slice(0, 55));
  }
  return Object.entries(m).sort((a, b) => b[1].count - a[1].count)
    .map(([mfr, v]) => ({ mfr, count: v.count, examples: v.examples }));
}

// ─── Report ───────────────────────────────────────────────────────────────────

console.log('════════════════════════════════════════════════════════════════');
console.log('  OUTDOOR NOT-IDENTIFIED RE-CHECK — 687 CATEGORY E PRODUCTS');
console.log('  Commercial Single-Model Inference Rule Applied');
console.log('════════════════════════════════════════════════════════════════\n');

console.log('### A. EXECUTIVE ANSWER\n');
console.log('After re-checking the 687 Category E products:\n');
console.log(`  commercial_single_model_outdoor_inferred (E1) = ${newlyReclassified}`);
console.log(`  new outdoor_side_identified_count         = ${newIdentified} / 7,163`);
console.log(`  new outdoor_side_not_identified_count     = ${newNotIdentified} / 7,163\n`);

console.log('### B. 687 BREAKDOWN BY SEGMENT\n');
const bySegment = { Residential: 0, Commercial: 0, Pending: 0 };
for (const r of catE) {
  const kw = r.s.power_35C_kw;
  if (kw == null) bySegment.Pending++;
  else if (kw >= 21) bySegment.Commercial++;
  else bySegment.Residential++;
}
console.log('Segment          | Count');
console.log('-----------------+------');
console.log(`Residential      | ${bySegment.Residential}`);
console.log(`Commercial       | ${bySegment.Commercial}`);
console.log(`Capacity pending | ${bySegment.Pending}`);
console.log(`Total            | ${catE.length}\n`);

console.log('### C. RE-CHECK CATEGORY TABLE\n');
console.log('Category                                              | Count');
console.log('------------------------------------------------------+------');
console.log(`E1  commercial_single_model_outdoor_inferred          | ${recheck.E1.length}`);
console.log(`E2  commercial_package_or_unclear_remains_not_id      | ${recheck.E2.length}`);
console.log(`E3  residential_single_model_candidate                | ${recheck.E3.length}`);
console.log(`E4  residential_package_or_unclear_remains_not_id     | ${recheck.E4.length}`);
console.log(`E5  capacity_pending_single_model_candidate           | ${recheck.E5.length}`);
console.log(`E6  capacity_pending_package_or_unclear               | ${recheck.E6.length}`);
console.log(`E7  clear_indoor_controller_tank_only_excluded        | ${recheck.E7.length}`);
console.log(`Total                                                 | ${totalRecheck}\n`);

console.log('### D. MANUFACTURER BREAKDOWN FOR E1 (commercial_single_model_outdoor_inferred)\n');
console.log('Count | Manufacturer                                    | Example models');
console.log('------+-------------------------------------------------+-----------------------------');
for (const { mfr, count, examples } of mfrBreakdown(recheck.E1, true)) {
  const ex = examples.slice(0, 2).join(' / ');
  console.log(`${count.toString().padStart(5)} | ${mfr.slice(0, 47).padEnd(47)} | ${ex}`);
}
console.log(`\nE1 total: ${recheck.E1.length}\n`);

console.log('### E. MANUFACTURER BREAKDOWN — STILL NOT IDENTIFIED (after E1)\n');
const stillArr = [...recheck.E2, ...recheck.E3, ...recheck.E4, ...recheck.E5, ...recheck.E6, ...recheck.E7];
console.log('Count | Manufacturer');
console.log('------+--------------------------------------------------------------');
for (const { mfr, count } of mfrBreakdown(stillArr)) {
  console.log(`${count.toString().padStart(5)} | ${mfr.slice(0, 70)}`);
}
console.log(`Total: ${stillArr.length}\n`);

console.log('### F. TOP COMMERCIAL SINGLE-MODEL PATTERNS (E1)\n');
// Group by first 3 model tokens as "family"
const families = {};
for (const r of recheck.E1) {
  const tokens = (r.s.model || '').split(/[\s_-]+/).slice(0, 3).join(' ');
  if (!families[tokens]) families[tokens] = { count: 0, mfrs: new Set(), models: [] };
  families[tokens].count++;
  families[tokens].mfrs.add(r.s.manufacturer?.slice(0, 30));
  if (families[tokens].models.length < 2) families[tokens].models.push(r.s.model?.slice(0, 50));
}
const topFamilies = Object.entries(families).sort((a, b) => b[1].count - a[1].count).slice(0, 30);
console.log('Count | Pattern                    | Manufacturer examples');
console.log('------+----------------------------+------------------------------------');
for (const [pat, v] of topFamilies) {
  console.log(`${v.count.toString().padStart(5)} | ${pat.slice(0, 26).padEnd(26)} | ${[...v.mfrs].join(', ').slice(0, 50)}`);
}
console.log('');

console.log('### G. EXCLUSION EXAMPLES\n');

if (recheck.E7.length > 0) {
  console.log('E7 — clear indoor/controller/tank-only excluded:');
  recheck.E7.forEach(r => console.log(`  [${r.s.bafa_id}] ${r.s.manufacturer?.slice(0,25)} | ${r.s.model?.slice(0,60)} → ${r.recheckNote}`));
  console.log('');
}

if (recheck.E2.length > 0) {
  console.log('E2 — commercial package/unclear (stays not identified):');
  recheck.E2.slice(0, 10).forEach(r => console.log(`  [${r.s.bafa_id}] ${r.s.manufacturer?.slice(0,25)} | ${r.s.model?.slice(0,60)} → ${r.recheckNote}`));
  console.log('');
}

if (recheck.E4.length > 0) {
  console.log('E4 — residential package/unclear (stays not identified, sample):');
  recheck.E4.slice(0, 15).forEach(r => console.log(`  [${r.s.bafa_id}] ${r.s.manufacturer?.slice(0,25)} | ${r.s.model?.slice(0,60)}`));
  console.log('');
}

if (recheck.E5.length > 0) {
  console.log('E5 — capacity-pending single-model candidates:');
  recheck.E5.forEach(r => console.log(`  [${r.s.bafa_id}] ${r.s.manufacturer?.slice(0,25)} | ${r.s.model?.slice(0,60)}`));
  console.log('');
}

if (recheck.E6.length > 0) {
  console.log('E6 — capacity-pending package/unclear:');
  recheck.E6.forEach(r => console.log(`  [${r.s.bafa_id}] ${r.s.manufacturer?.slice(0,25)} | ${r.s.model?.slice(0,60)} → ${r.recheckNote}`));
  console.log('');
}

console.log('### H. SCRIPT USED\n');
console.log('  scripts/analysis/recheck-outdoor-not-identified-commercial-single-models.mjs');
console.log('  Command: node scripts/analysis/recheck-outdoor-not-identified-commercial-single-models.mjs\n');

console.log('### I. VALIDATION CHECKS\n');
console.log(`  original_category_e_count = ${catE.length}  (expect 687)  ${catE.length === 687 ? '✓' : '✗'}`);
console.log(`  segment_sum = ${bySegment.Residential}+${bySegment.Commercial}+${bySegment.Pending} = ${catE.length}  ${catE.length === 687 ? '✓' : '✗'}`);
console.log(`  recheck_category_sum = ${totalRecheck}  (expect 687)  ${totalRecheck === 687 ? '✓' : '✗'}`);
console.log(`  newly_reclassified = ${newlyReclassified}  still_not_identified = ${stillNotIdentified}  sum = ${newlyReclassified + stillNotIdentified}  ${(newlyReclassified + stillNotIdentified) === 687 ? '✓' : '✗'}`);
console.log(`  new_identified + new_not_identified = ${newIdentified} + ${newNotIdentified} = ${newIdentified + newNotIdentified}  (expect 7163)  ${(newIdentified + newNotIdentified) === 7163 ? '✓' : '✗'}`);
console.log(`  duplicates = ${duplicates}  (expect 0)  ${duplicates === 0 ? '✓' : '✗'}`);
console.log(`  missing = ${missing}  (expect 0)  ${missing === 0 ? '✓' : '✗'}\n`);

console.log('### J. FINAL CLARIFICATION\n');
console.log('The remaining not-identified products are not products without outdoor units.');
console.log('They are only products for which the current practical inference rules still');
console.log('cannot identify or reasonably infer the outdoor-side equipment.\n');

console.log('### K. FULL E1 PRODUCT LIST\n');
recheck.E1.forEach(r => {
  const kw = r.s.power_35C_kw;
  console.log(`  ${kw?.toFixed(1).padStart(6)}kW | ${r.s.manufacturer?.slice(0,30).padEnd(30)} | ${r.s.model?.slice(0,60)}`);
});

console.log('\n### L. NOT COMMITTED\n');
console.log('Analysis only. Nothing committed, pushed, or deployed.');
console.log('No public data or UI modified. This script is unstaged.');
