/**
 * recover-seed-from-app-export.mjs — disaster-recovery tool.
 *
 * Re-injects products into the master seed from a recovered app export
 * (public/data/products*.json shape). Used on 2026-07-12 after parsed/2026-06
 * was cleaned from disk and a master-seed rebuild silently dropped the 289
 * June-only products (recovered via Firebase Hosting release rollback).
 *
 * Only products whose bafa_id is MISSING from the current master seed are
 * appended (flagged delisted, provenance 'recovered_from_app_export').
 *
 *   node scripts/bafa/recover-seed-from-app-export.mjs \
 *     --from data_sources/bafa/recovery/products-old.json \
 *     [--from <more files…>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const fromFiles = [];
for (let i = 0; i < args.length; i++) if (args[i] === '--from' && args[i + 1]) fromFiles.push(args[++i]);
if (!fromFiles.length) { console.error('Usage: --from <app-export.json> [--from …]'); process.exit(1); }

const SEED_DIR = path.join(ROOT, 'data_sources/bafa/master_seed');
const seedSnap = fs.readdirSync(SEED_DIR).filter(d => /^\d{4}-\d{2}$/.test(d)).sort().reverse()[0];
const seedPath = path.join(SEED_DIR, seedSnap, 'bafa-master-seed.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
const have = new Set(seed.items.map(i => String(i.source_id)));
console.log(`Master seed ${seedSnap}: ${seed.items.length} items`);

const SPEC_KEYS = [
  'manufacturer', 'manufacturer_normalized', 'model', 'type',
  'refrigerant', 'refrigerant_2', 'refrigerant_amount_kg', 'refrigerant_2_amount_kg',
  'power_35C_kw', 'power_55C_kw', 'efficiency_35C_percent', 'efficiency_55C_percent',
  'power_design_35C_kw', 'power_design_55C_kw',
  'cop_A7W35', 'cop_A2W35', 'cop_AMinus7W35', 'cop_A10W35', 'scop', 'seer',
  'cooling_capacity_kw', 'cooling_efficiency', 'noise_outdoor_dB', 'noise_indoor_dB',
  'max_electric_power_kw', 'drive_type', 'power_control', 'num_compressors',
  'grid_ready', 'grid_ready_type', 'ee_display', 'ee_display_type', 'heat_meter',
  'defrost_tested', 'defrost_type', 'temp_diff', 'website',
];

let added = 0;
for (const f of fromFiles) {
  const items = JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8')).items ?? [];
  for (const p of items) {
    const id = String(p.bafa_id ?? p.source_id);
    if (!id || have.has(id)) continue;
    have.add(id);
    const seen = (p.bafa_snapshot_fetched_at ?? '').slice(0, 7) || null;
    const rec = { source_id: id, bafa_id: id, country: 'DE', primary_source: 'BAFA' };
    for (const k of SPEC_KEYS) rec[k] = p[k] ?? null;
    Object.assign(rec, {
      seen_in_reference_baseline: false,
      reference_baseline_snapshot: seed.items[0]?.reference_baseline_snapshot ?? '2026-03',
      first_seen_snapshot: seen,
      last_seen_snapshot: seen,
      bafa_list_current: false,
      bafa_list_status: 'no',
      bafa_list_current_as_of: seedSnap,
      latest_source_record_hash: null,
      baseline_source_record_hash: null,
      recovered_from: 'app-export-rollback-2026-07-12',
    });
    seed.items.push(rec);
    added++;
  }
}

seed.items.sort((a, b) => String(a.source_id).localeCompare(String(b.source_id)));
fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2) + '\n');
console.log(`Recovered ${added} products → master seed now ${seed.items.length} items (${seedPath})`);
