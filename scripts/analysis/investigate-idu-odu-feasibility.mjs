/**
 * investigate-idu-odu-feasibility.mjs
 *
 * Read-only analysis script: classifies all BAFA products by
 * IDU/ODU set-product status using only locally available data.
 *
 * Does NOT modify any production files.
 * Output is written to stdout only (no file writes by default).
 *
 * Usage:
 *   node scripts/analysis/investigate-idu-odu-feasibility.mjs
 *   node scripts/analysis/investigate-idu-odu-feasibility.mjs --json > /tmp/idu-odu-analysis.json
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const JSON_OUTPUT = process.argv.includes('--json');

function loadJSON(rel) {
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) return null;
  return JSON.parse(readFileSync(abs, 'utf8'));
}

// ── Load sources ──────────────────────────────────────────────────────────────

const seed = loadJSON('data_sources/bafa/master_seed/2026-06/bafa-master-seed.json');
if (!seed) {
  console.error('Master seed not found. Run build-master-seed.mjs first.');
  process.exit(1);
}
const items = seed.items || [];

// ── Classification rules ──────────────────────────────────────────────────────

function extractIDUODU(model) {
  if (!model) return null;

  // Viessmann explicit IDU/ODU notation: split on '/' or space-before-ODU
  if (/(?:^|\s)IDU[\-\s]/.test(model) && /\bODU[\s\-]/.test(model)) {
    const parts = model.split(/\s*\/\s*|\s+(?=ODU\b)/);
    if (parts.length >= 2) {
      return { idu: parts[0].trim(), odu: parts.slice(1).join(' ').trim() };
    }
  }

  // Bracket + plus notation: [ODU_MODEL + IDU_MODEL]
  const bp = model.match(/\[([^\[\]+]+)\s*\+\s*([^\[\]]+)\]/);
  if (bp) return { odu: bp[1].trim(), idu: bp[2].trim() };

  // Paren + ampersand: (MODEL_A & MODEL_B)
  const amp = model.match(/\(([^()&]+)\s*&\s*([^()]+)\)/);
  if (amp) return { odu: amp[1].trim(), idu: amp[2].trim() };

  // Slash two distinct models: XYZNN/ABCNN
  const slash2 = model.match(/^([A-Z]{3,}\d+[A-Z0-9]*)\/([A-Z]{3,}\d+[A-Z0-9]+)$/);
  if (slash2) return { odu: slash2[1].trim(), idu: slash2[2].trim() };

  return null;
}

function classify(item) {
  const m = item.model || '';

  // 1. Viessmann explicit IDU/ODU
  if (/(?:^|\s)IDU[\-\s]/.test(m) && /\bODU[\s\-]/.test(m)) {
    const ex = extractIDUODU(m);
    return {
      classification: 'confirmed_set',
      idu_odu_extractable: !!ex,
      confidence: 'high',
      method: 'viessmann_idu_odu',
      idu: ex?.idu || null,
      odu: ex?.odu || null,
    };
  }

  // 2. Bracket + plus: most manufacturers embed [ODU + IDU]
  const bp = m.match(/\[([^\[\]+]+)\s*\+\s*([^\[\]]+)\]/);
  if (bp) {
    return {
      classification: 'confirmed_set',
      idu_odu_extractable: true,
      confidence: 'high',
      method: 'bracket_plus',
      odu: bp[1].trim(),
      idu: bp[2].trim(),
    };
  }

  // 3. Paren + ampersand: Buderus style
  const amp = m.match(/\(([^()&]+)\s*&\s*([^()]+)\)/);
  if (amp) {
    return {
      classification: 'confirmed_set',
      idu_odu_extractable: true,
      confidence: 'high',
      method: 'paren_ampersand',
      odu: amp[1].trim(),
      idu: amp[2].trim(),
    };
  }

  // 4. Slash two distinct model codes: INVENTOR style
  const slash2 = m.match(/^([A-Z]{3,}\d+[A-Z0-9]*)\/([A-Z]{3,}\d+[A-Z0-9]+)$/);
  if (slash2) {
    return {
      classification: 'confirmed_set',
      idu_odu_extractable: true,
      confidence: 'medium',
      method: 'inventor_slash',
      odu: slash2[1].trim(),
      idu: slash2[2].trim(),
    };
  }

  // 5. Explicit set/package words
  if (/\bpackage\b|\bset\b|\bsatz\b|\bpaket\b|\bkombi\b/i.test(m)) {
    return { classification: 'confirmed_set', idu_odu_extractable: false, confidence: 'low', method: 'set_word' };
  }

  // 6. System M (Dimplex compound code)
  if (/System M/.test(m)) {
    return { classification: 'confirmed_set', idu_odu_extractable: false, confidence: 'medium', method: 'dimplex_system_m' };
  }

  // 7. Enpal EODU (outdoor-only registration)
  if (/^EODU/.test(m)) {
    return { classification: 'likely_set', idu_odu_extractable: false, confidence: 'medium', method: 'enpal_eodu_only', note: 'ODU registered standalone; IDU may be separate BAFA record' };
  }

  // 8. Split + component indicator
  if (/split/i.test(m) && /[\-\+]/.test(m)) {
    return { classification: 'likely_set', idu_odu_extractable: false, confidence: 'medium', method: 'split_name_pattern' };
  }

  // 9. Hydrobox / Hydraulik terms
  if (/hydrobox|hydraulik|innengerät|außengerät/i.test(m)) {
    return { classification: 'likely_set', idu_odu_extractable: false, confidence: 'low', method: 'hydrobox_term' };
  }

  // 10. Single model in brackets → likely monoblock
  const bsingle = m.match(/\[([^\[\]\+&]+)\]$/);
  if (bsingle) {
    return { classification: 'not_set', idu_odu_extractable: false, confidence: 'medium', method: 'bracket_single_model' };
  }

  // 11. Slash with non-model-code pattern → ambiguous config variant
  if (/\//.test(m)) {
    return { classification: 'ambiguous', idu_odu_extractable: false, confidence: 'low', method: 'slash_ambiguous' };
  }

  // 12. No set indicators at all
  return { classification: 'not_set', idu_odu_extractable: false, confidence: 'high', method: 'no_indicators' };
}

// ── Run classification ─────────────────────────────────────────────────────────

const classified = items.map(item => ({ ...item, _c: classify(item) }));
const total = items.length;
const bafaYes = classified.filter(i => i.bafa_list_current === true);

const confirmedSets = classified.filter(i => i._c.classification === 'confirmed_set');
const likelySets    = classified.filter(i => i._c.classification === 'likely_set');
const ambiguous     = classified.filter(i => i._c.classification === 'ambiguous');
const notSet        = classified.filter(i => i._c.classification === 'not_set');

const bothExtractable = confirmedSets.filter(i => i._c.idu_odu_extractable);
const notExtractable  = confirmedSets.filter(i => !i._c.idu_odu_extractable);

const byMethod = {};
classified.forEach(i => {
  byMethod[i._c.method] = (byMethod[i._c.method] || 0) + 1;
});

// ── Output ────────────────────────────────────────────────────────────────────

if (JSON_OUTPUT) {
  console.log(JSON.stringify({
    summary: {
      total, bafa_yes: bafaYes.length,
      confirmed_set: confirmedSets.length,
      idu_odu_extractable_from_name: bothExtractable.length,
      confirmed_not_extractable: notExtractable.length,
      likely_set: likelySets.length,
      ambiguous_slash: ambiguous.length,
      not_set: notSet.length,
    },
    by_method: byMethod,
    confirmed_sample: confirmedSets.slice(0, 30).map(i => ({
      source_id: i.source_id,
      manufacturer: i.manufacturer,
      model: i.model,
      classification: i._c.classification,
      confidence: i._c.confidence,
      method: i._c.method,
      idu: i._c.idu || null,
      odu: i._c.odu || null,
    })),
  }, null, 2));
  process.exit(0);
}

// Human-readable output
const pct = n => (n / total * 100).toFixed(1) + '%';

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log(' IDU/ODU Feasibility — BAFA Master Seed Classification');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log(`Total BAFA products:                ${total}`);
console.log(`BAFA List Yes:                      ${bafaYes.length}`);
console.log(`BAFA List No:                       ${total - bafaYes.length}`);
console.log('');
console.log('── Set product classification ─────────────────────────────────');
console.log(`Confirmed set products:             ${confirmedSets.length.toString().padStart(5)}  ${pct(confirmedSets.length)}`);
console.log(`  ↳ Both IDU+ODU in model name:    ${bothExtractable.length.toString().padStart(5)}  ${pct(bothExtractable.length)}  [HIGH/MEDIUM conf]`);
console.log(`  ↳ Set confirmed, units unclear:  ${notExtractable.length.toString().padStart(5)}  ${pct(notExtractable.length)}  [needs external]`);
console.log(`Likely set (needs research):        ${likelySets.length.toString().padStart(5)}  ${pct(likelySets.length)}`);
console.log(`Ambiguous slash (false-pos risk):   ${ambiguous.length.toString().padStart(5)}  ${pct(ambiguous.length)}`);
console.log(`Not set / single unit:              ${notSet.length.toString().padStart(5)}  ${pct(notSet.length)}`);
console.log('');
console.log('── By detection method ────────────────────────────────────────');
Object.entries(byMethod).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  ${k.padEnd(34)} ${v.toString().padStart(5)}  ${pct(v)}`);
});
console.log('');
console.log('── BAFA List Yes subset ───────────────────────────────────────');
const yConf = bafaYes.filter(i => i._c.classification === 'confirmed_set');
const yExtr = yConf.filter(i => i._c.idu_odu_extractable);
console.log(`Confirmed sets in Yes list:         ${yConf.length}  (${(yConf.length/bafaYes.length*100).toFixed(1)}% of Yes)`);
console.log(`IDU+ODU extractable in Yes list:    ${yExtr.length}  (${(yExtr.length/bafaYes.length*100).toFixed(1)}% of Yes)`);
console.log('');
console.log('── Top manufacturers with confirmed sets ───────────────────────');
const mfrCount = {};
confirmedSets.forEach(i => { const n = i.manufacturer.substring(0, 40); mfrCount[n] = (mfrCount[n] || 0) + 1; });
Object.entries(mfrCount).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([n, c]) => {
  console.log(`  ${n.padEnd(42)} ${c}`);
});
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
