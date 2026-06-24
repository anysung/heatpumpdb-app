/**
 * Centralized display helpers for HeatPump product fields.
 *
 * These functions decouple UI display values from raw data fields,
 * so the UI does not depend on how the storage layer encodes them.
 */

import { HeatPump } from '../types';

// ─── Text Truncation ─────────────────────────────────────────────────────────

/** Truncate to at most maxChars visible characters, appending '...' if cut. */
export function truncateChars(value: string, maxChars: number): string {
  if (!value || value.length <= maxChars) return value;
  return value.slice(0, maxChars) + '...';
}

/** Truncate to at most maxWords whitespace-separated words, appending '...' if cut. */
export function truncateWords(value: string, maxWords: number): string {
  if (!value) return value;
  const words = value.trim().split(/\s+/);
  if (words.length <= maxWords) return value;
  return words.slice(0, maxWords).join(' ') + '...';
}

// ─── Component Lines ─────────────────────────────────────────────────────────

export interface ComponentLines {
  /** Formatted ODU line text, e.g. "ODU : PUHZ-SW75", or null if absent/redundant. */
  oduLine: string | null;
  /** Full ODU model value for title/tooltip. */
  oduFull: string | null;
  /** Formatted inner line combining all indoor-side components, or null if none. */
  innerLine: string | null;
}

/**
 * Build up to two component display lines for a product row.
 *
 * ODU line is suppressed when outdoor_unit_model equals the main BAFA model
 * name (monoblock/standalone products where the product IS the outdoor unit —
 * showing the same name twice adds no information).
 *
 * Inner line lists indoor-side components in priority order, joined by ' · '.
 */
export function buildComponentLines(item: HeatPump): ComponentLines {
  const odu = item.outdoor_unit_model ?? null;
  const showOdu = odu !== null && odu !== item.model;

  const innerParts: string[] = [];
  if (item.idu_model)                 innerParts.push(`IDU : ${item.idu_model}`);
  if (item.control_box_model)         innerParts.push(`Con. Unit : ${item.control_box_model}`);
  if (item.tank_model)                innerParts.push(`Tank : ${item.tank_model}`);
  if (item.tower_model)               innerParts.push(`Tower : ${item.tower_model}`);
  if (item.hydraulic_module_model)    innerParts.push(`Hyd. Unit : ${item.hydraulic_module_model}`);
  if (item.indoor_side_equipment_model) innerParts.push(`Indoor Eq. : ${item.indoor_side_equipment_model}`);

  return {
    oduLine: showOdu ? `ODU : ${odu}` : null,
    oduFull: showOdu ? odu : null,
    innerLine: innerParts.length > 0 ? innerParts.join(' · ') : null,
  };
}

// ─── Manufacturer Display ────────────────────────────────────────────────────

/** Return the shortest usable manufacturer name for display. */
export function getDisplayName(item: HeatPump): string {
  return item.manufacturer_short || item.manufacturer;
}

// ─── Installation Type ──────────────────────────────────────────────────────

/**
 * Display the installation type directly from the raw data field.
 *   installation_type "Monoblock" → "Monoblock"
 *   installation_type "Split"     → "Split"
 */
export function getInstallationTypeDisplay(item: HeatPump): string {
  if (item.installation_type) return item.installation_type;
  return '—';
}

/**
 * Check whether a product matches an installation-type filter value.
 * Matches directly against the raw installation_type field.
 */
export function matchesInstallationTypeFilter(item: HeatPump, filterValue: string): boolean {
  return item.installation_type === filterValue;
}

// ─── Grid Ready (formerly SG Ready) ─────────────────────────────────────────

/** Format grid_ready + grid_ready_type for display. */
export function fmtGridReady(ready: boolean, type: string | null): string {
  if (!ready) return '—';
  if (type) return type.replace(/_/g, ' ');
  return 'Yes';
}
