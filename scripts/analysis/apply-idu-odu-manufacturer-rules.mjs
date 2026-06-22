/**
 * apply-idu-odu-manufacturer-rules.mjs
 *
 * Applies the manufacturer-specific IDU/ODU rule registry to the BAFA master seed.
 * Produces three output files (all gitignored):
 *   - data_sources/bafa/idu_odu_mapping/2026-06/idu-odu-mapping.json   (full per-product mapping)
 *   - data_sources/bafa/idu_odu_mapping/2026-06/idu-odu-summary.json   (aggregate statistics)
 *   - data_sources/bafa/idu_odu_mapping/2026-06/manual-review-queue.json  (low-conf & research-needed)
 *
 * This script is READ-ONLY with respect to production data:
 * - Does NOT modify the master seed
 * - Does NOT modify public/data/
 * - Does NOT deploy anything
 *
 * Usage:
 *   node scripts/analysis/apply-idu-odu-manufacturer-rules.mjs
 *   node scripts/analysis/apply-idu-odu-manufacturer-rules.mjs --snapshot 2026-06
 *   node scripts/analysis/apply-idu-odu-manufacturer-rules.mjs --dry-run   (stdout only, no writes)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const args = process.argv.slice(2);
const SNAPSHOT = args.find(a => a.startsWith('--snapshot='))?.split('=')[1]
  || args[args.indexOf('--snapshot') + 1]?.replace(/^--/, '') === undefined
    ? '2026-06'
    : args[args.indexOf('--snapshot') + 1];
const DRY_RUN = args.includes('--dry-run');

function loadJSON(rel) {
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) { console.error('Not found:', abs); process.exit(1); }
  return JSON.parse(readFileSync(abs, 'utf8'));
}

// ── Load inputs ────────────────────────────────────────────────────────────────

const registry = loadJSON('data_sources/bafa/idu_odu_rules/manufacturer-idu-odu-rules.json');
const seed     = loadJSON(`data_sources/bafa/master_seed/${SNAPSHOT}/bafa-master-seed.json`);

// Support both v1.x flat structure (registry.rules) and v2.x manufacturer-nested structure
// Inactive rules (active === false) are skipped entirely
const rules = registry.manufacturers
  ? registry.manufacturers.flatMap(m => m.rules.filter(r => r.active !== false))
  : (registry.rules || []).filter(r => r.active !== false);
const items = seed.items || [];

const mfrCount = registry.manufacturers ? registry.manufacturers.length : '(flat)';
console.log(`Registry version: ${registry.version || '1.x'}`);
console.log(`Rules loaded:     ${rules.length}  (from ${mfrCount} manufacturer groups)`);
console.log(`Products loaded:  ${items.length}  (snapshot: ${SNAPSHOT})`);

// ── Component extractors ────────────────────────────────────────────────────────

const EXTRACTORS = {
  viessmann_idu_odu(model) {
    const parts = model.split(/\s*\/\s*|\s+(?=ODU\b)/);
    if (parts.length < 2) return null;
    return { idu: parts[0].trim(), odu: parts.slice(1).join(' ').trim() };
  },

  bracket_plus(model) {
    const m = model.match(/\[([^\[\]+]+)\s*\+\s*([^\[\]]+)\]/);
    return m ? { odu: m[1].trim(), idu: m[2].trim() } : null;
  },

  paren_ampersand(model) {
    const m = model.match(/\(([^()&]+)\s*&\s*([^()]+)\)/);
    return m ? { odu: m[1].trim(), idu: m[2].trim() } : null;
  },

  plus_separator(model) {
    // Prefer space-separated ' + ' first, then compact '+'
    const idx = model.indexOf(' + ');
    if (idx !== -1) {
      return { odu: model.slice(0, idx).trim(), idu: model.slice(idx + 3).trim() };
    }
    // Compact '+' (Hitachi-style, but also fallback)
    const idx2 = model.indexOf('+');
    if (idx2 !== -1) {
      return { odu: model.slice(0, idx2).trim(), idu: model.slice(idx2 + 1).trim() };
    }
    return null;
  },

  // Reversed plus_separator: position 1 (before +) = IDU, position 2 (after +) = ODU.
  // Used for Vaillant VAI-002 where BAFA name order is "indoor + outdoor" (flexoCOMPACT + aroCOLLECT).
  plus_separator_idu_first(model) {
    const idx = model.indexOf(' + ');
    if (idx !== -1) {
      return { idu: model.slice(0, idx).trim(), odu: model.slice(idx + 3).trim() };
    }
    const idx2 = model.indexOf('+');
    if (idx2 !== -1) {
      return { idu: model.slice(0, idx2).trim(), odu: model.slice(idx2 + 1).trim() };
    }
    return null;
  },

  // Like bracket_plus but assigns position 2 as control_box instead of idu.
  // Used for MTF-002 (and any manufacturer with bracket notation + controller pairing).
  bracket_plus_control_box(model) {
    const m = model.match(/\[([^\[\]+]+)\s*\+\s*([^\[\]]+)\]/);
    if (!m) return null;
    return { odu: m[1].trim(), idu: null, control_box: m[2].trim() };
  },

  // Samsung EHS Mono + MIM-E03 control box extractor.
  // Returns { odu, idu: null, control_box } — MIM-E03 is a controller, not an IDU.
  samsung_mim_e03(model) {
    const spaceIdx = model.indexOf(' + ');
    const compactIdx = model.indexOf('+');
    const idx = spaceIdx !== -1 ? spaceIdx : compactIdx;
    if (idx === -1) return null;
    const sepLen = spaceIdx !== -1 ? 3 : 1;
    const odu = model.slice(0, idx).trim();
    const controlBox = model.slice(idx + sepLen).trim();
    if (!controlBox.startsWith('MIM-E03')) return null;
    return { odu, idu: null, control_box: controlBox };
  },

  paren_plus(model) {
    const m = model.match(/\(([^()]+)\s*\+\s*([^()]+)\)/);
    return m ? { odu: m[1].trim(), idu: m[2].trim() } : null;
  },

  clivet_edge_wisan_hqcn(model) {
    // 'EDGE Evo 2.0 + Box / WiSAN-YME 1 S 2.1 + HQCN-NEE 1 BC A'
    // Note: BAFA name has a space between '/' and 'WiSAN' — \s* handles this.
    const m = model.match(/\/\s*(WiSAN-\S+(?:\s+\S+)*?)\s*\+\s*(HQCN-\S+(?:\s+\S+)*)$/);
    return m ? { odu: m[1].trim(), idu: m[2].trim() } : null;
  },

  clivet_edge_wisan_simple(model) {
    // 'EDGE Evo 2.0 / WiSAN-YME 1 S 10.1'
    // idu = EDGE controller name (product line identifier, not a serial model code)
    // odu = WiSAN model code
    const slashIdx = model.indexOf('/');
    if (slashIdx === -1) return null;
    const wiSAN = model.slice(slashIdx + 1).trim();
    const edgePart = model.slice(0, slashIdx).trim();
    if (!wiSAN.startsWith('WiSAN')) return null;
    return { idu: edgePart, odu: wiSAN };
  },

  clivet_sphera_misan(model) {
    // 'Sphera EVO 2.0 Box SQKN-YEE 1 BC + MiSAN-YEE 1 S 2.1'
    const m = model.match(/\b(SQKN-\S+(?:\s+\S+)*?)\s*\+\s*(MiSAN-\S+(?:\s+\S+)*)$/);
    return m ? { idu: m[1].trim(), odu: m[2].trim() } : null;
  },

  inventor_ats_hu(model) {
    // 'ATS08S/HU100WT190S3'
    const m = model.match(/^(ATS\w+)\/(HU\w+)$/);
    return m ? { odu: m[1].trim(), idu: m[2].trim() } : null;
  },

  jch_ras_rwm(model) {
    // 'airH2O 600 S (1.5HP) RAS-1.5WHVRP2E+RWM-1.5R3E' (standard water module)
    // 'airH2O 600 S Combi (1.5HP) RAS-1.5WHVRP2E+RWD-1.5RW3E-220S' (DHW combo module)
    const m = model.match(/(RAS-\S+)\+(RW[MD]-\S+)$/);
    return m ? { odu: m[1].trim(), idu: m[2].trim() } : null;
  },

  nibe_split_paren(model) {
    // 'NIBE SPLIT (AMS 10-12 + HK 200S)'
    const m = model.match(/SPLIT\s*\(([^)]+)\s*\+\s*([^)]+)\)/);
    return m ? { odu: m[1].trim(), idu: m[2].trim() } : null;
  },

  gdt_smkl_thf(model) {
    // Space-slash: 'SMKL-10D/HBp-B / THF-10D/HBpO-B'
    const spaceSlash = model.indexOf(' / ');
    if (spaceSlash !== -1) {
      return { idu: model.slice(0, spaceSlash).trim(), odu: model.slice(spaceSlash + 3).trim() };
    }
    // Compact: 'SMKL-6D/HBp-A/THF-4D/HBpO-A'  — split at the /THF boundary
    const thfIdx = model.indexOf('/THF-');
    if (thfIdx !== -1) {
      return { idu: model.slice(0, thfIdx).trim(), odu: model.slice(thfIdx + 1).trim() };
    }
    return null;
  },

  none() { return null; },
};

// ── Rule matching helpers ───────────────────────────────────────────────────────

function matchesPattern(value, spec) {
  if (!spec) return false;
  const { type, patterns, pattern } = spec;
  const str = value || '';
  if (type === 'contains_all') {
    return patterns.every(p => str.includes(p));
  }
  if (type === 'contains_any') {
    return patterns.some(p => str.includes(p));
  }
  if (type === 'regex') {
    return new RegExp(pattern).test(str);
  }
  if (type === 'regex_and') {
    return patterns.every(p => new RegExp(p).test(str));
  }
  return false;
}

function applyRule(item, rule) {
  if (!item.manufacturer.includes(rule.manufacturer_contains)) return null;
  if (!matchesPattern(item.model, rule.model_match)) return null;
  if (rule.model_exclude && matchesPattern(item.model, rule.model_exclude)) return null;
  return rule;
}

// ── Confidence band mapping ────────────────────────────────────────────────────

function confidenceBand(score) {
  if (score >= 0.95) return 'high';
  if (score >= 0.90) return 'medium_high';
  if (score >= 0.75) return 'medium';
  if (score >= 0.50) return 'low';
  return 'uncertain';
}

function reviewStatus(score, classification) {
  if (classification === 'requires_research') return 'manual_review_pending';
  if (score >= 0.95) return 'auto_classified_high_conf';
  if (score >= 0.90) return 'auto_classified_medium_conf';
  return 'auto_classified_low_conf';
}

// ── Run classification ──────────────────────────────────────────────────────────

const mapping = [];
const manualQueue = [];
const stats = {
  total: items.length,
  matched_by_rule: 0,
  unmatched: 0,
  by_classification: {},
  by_confidence_band: {},
  by_rule: {},
  confirmed_set_extractable: 0,
  confirmed_set_not_extractable: 0,
};

for (const item of items) {
  let matched = null;
  for (const rule of rules) {
    matched = applyRule(item, rule);
    if (matched) break;
  }

  let entry;
  if (!matched) {
    stats.unmatched++;
    entry = {
      source_id: item.source_id,
      bafa_id: item.bafa_id,
      manufacturer: item.manufacturer,
      model: item.model,
      manufacturer_rule_id: null,
      classification: 'unclassified',
      is_set_product: false,
      idu_model: null,
      odu_model: null,
      control_box_model: null,
      confidence_score: 0,
      confidence_band: 'uncertain',
      source_basis: 'no_rule_matched',
      review_status: 'unclassified',
    };
  } else {
    stats.matched_by_rule++;
    stats.by_rule[matched.rule_id] = (stats.by_rule[matched.rule_id] || 0) + 1;

    const isSet = matched.classification === 'confirmed_set';
    const isMaybeSet = matched.classification === 'standalone_odu';
    const extractor = EXTRACTORS[matched.extraction_method] || EXTRACTORS.none;
    const extracted = isSet ? extractor(item.model) : null;

    if (isSet) {
      if (extracted) stats.confirmed_set_extractable++;
      else stats.confirmed_set_not_extractable++;
    }

    entry = {
      source_id: item.source_id,
      bafa_id: item.bafa_id,
      manufacturer: item.manufacturer,
      model: item.model,
      manufacturer_rule_id: matched.rule_id,
      classification: matched.classification,
      is_set_product: isSet,
      idu_model: extracted?.idu || null,
      odu_model: extracted?.odu || null,
      control_box_model: extracted?.control_box || null,
      confidence_score: matched.confidence_score,
      confidence_band: confidenceBand(matched.confidence_score),
      source_basis: (() => {
        if (!matched.evidence) return matched.label;
        if (Array.isArray(matched.evidence)) {
          const best = matched.evidence.find(e => e.source_type === 'manufacturer_official')
            || matched.evidence.find(e => e.source_type === 'self_describing')
            || matched.evidence[0];
          return (best?.what_it_proves || best?.title || matched.label).slice(0, 120);
        }
        return matched.evidence.slice(0, 120);
      })(),
      review_status: reviewStatus(matched.confidence_score, matched.classification),
    };
  }

  const cls = entry.classification;
  stats.by_classification[cls] = (stats.by_classification[cls] || 0) + 1;
  stats.by_confidence_band[entry.confidence_band] =
    (stats.by_confidence_band[entry.confidence_band] || 0) + 1;

  mapping.push(entry);

  // Manual review queue: requires_research, confirmed_set with low confidence,
  // and standalone_odu (role needs human verification). NOT plain unclassified products.
  if (
    entry.classification === 'requires_research' ||
    entry.classification === 'standalone_odu' ||
    (entry.classification === 'confirmed_set' && entry.confidence_score < 0.90)
  ) {
    manualQueue.push(entry);
  }
}

// ── Build summary ───────────────────────────────────────────────────────────────

const confirmedSets = mapping.filter(e => e.classification === 'confirmed_set');
const highConfSets  = confirmedSets.filter(e => e.confidence_score >= 0.95);
const displayReady  = confirmedSets.filter(e => e.confidence_score >= 0.95 && e.idu_model);

const summary = {
  snapshot: SNAPSHOT,
  generated_at: new Date().toISOString().slice(0, 10),
  rule_registry_version: registry.version,
  totals: {
    all_products: stats.total,
    matched_by_rule: stats.matched_by_rule,
    unmatched_no_rule: stats.unmatched,
  },
  classification_breakdown: stats.by_classification,
  confidence_band_breakdown: stats.by_confidence_band,
  set_product_detail: {
    confirmed_set_total: confirmedSets.length,
    confirmed_set_high_conf_ge_095: highConfSets.length,
    confirmed_set_idu_odu_extractable: displayReady.length,
    confirmed_set_not_extractable: stats.confirmed_set_not_extractable,
  },
  rule_hit_counts: stats.by_rule,
  manual_review_queue_size: manualQueue.length,
  key_thresholds: {
    internal_confidence_min: 0.90,
    display_confidence_min: 0.95,
    display_ready_count: displayReady.length,
  },
};

// ── Output ─────────────────────────────────────────────────────────────────────

const OUT_DIR = resolve(ROOT, `data_sources/bafa/idu_odu_mapping/${SNAPSHOT}`);
if (!DRY_RUN) {
  mkdirSync(OUT_DIR, { recursive: true });
}

function writeOut(filename, data) {
  if (DRY_RUN) {
    console.log(`\n[DRY-RUN] Would write: ${filename}`);
    if (filename.endsWith('summary.json')) console.log(JSON.stringify(data, null, 2));
    return;
  }
  const path = resolve(OUT_DIR, filename);
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Wrote: ${path}  (${(JSON.stringify(data).length / 1024).toFixed(1)} kB)`);
}

writeOut('idu-odu-mapping.json', { snapshot: SNAPSHOT, generated_at: summary.generated_at, items: mapping });
writeOut('idu-odu-summary.json', summary);
writeOut('manual-review-queue.json', { snapshot: SNAPSHOT, generated_at: summary.generated_at, count: manualQueue.length, items: manualQueue });

// ── Console report ─────────────────────────────────────────────────────────────

console.log('');
console.log('═══════════════════════════════════════════════════════════════════');
console.log(' IDU/ODU Manufacturer Rule Application — Results');
console.log('═══════════════════════════════════════════════════════════════════');
console.log(`Snapshot:        ${SNAPSHOT}`);
console.log(`Products total:  ${stats.total}`);
console.log(`Matched by rule: ${stats.matched_by_rule}`);
console.log(`No rule matched: ${stats.unmatched}`);
console.log('');
console.log('── Classification breakdown ─────────────────────────────────────────');
Object.entries(stats.by_classification).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
  console.log(`  ${k.padEnd(25)} ${v.toString().padStart(6)}`);
});
console.log('');
console.log('── Set product detail ───────────────────────────────────────────────');
console.log(`  Confirmed set total:          ${confirmedSets.length}`);
console.log(`  High confidence (≥0.95):      ${highConfSets.length}`);
console.log(`  IDU+ODU extractable:          ${displayReady.length}  (display-ready)`);
console.log(`  Set confirmed, codes unclear: ${stats.confirmed_set_not_extractable}`);
console.log('');
console.log('── Confidence band breakdown ────────────────────────────────────────');
Object.entries(stats.by_confidence_band).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
  console.log(`  ${k.padEnd(25)} ${v.toString().padStart(6)}`);
});
console.log('');
console.log('── Top rule hits ────────────────────────────────────────────────────');
Object.entries(stats.by_rule).sort((a,b) => b[1]-a[1]).slice(0, 20).forEach(([k,v]) => {
  console.log(`  ${k.padEnd(15)} ${v.toString().padStart(5)}`);
});
console.log('');
console.log(`Manual review queue: ${manualQueue.length} products`);
console.log('═══════════════════════════════════════════════════════════════════');
