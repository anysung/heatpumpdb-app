/**
 * Brand key for matching when the curated short-name table has no entry
 * (2026-10-01).
 *
 * The curated table (scraper/pricing/manufacturer-short-names.json) is keyed by
 * BAFA's exact `manufacturer_normalized`. When BAFA renames a manufacturer the
 * table silently stops covering it — in October BAFA began printing 53 Hitachi
 * products as plain "Hitachi" instead of "Johnson Controls Hitachi Air
 * Conditioning Europe SAS". Those products got no short name, and the two
 * matchers that gate candidates on it found nothing: 16 UK PEL confirmations
 * and (through the lost EPREL links) 31 French agrément confirmations went to
 * "verification required" while both registers still listed them.
 *
 * This is only a MATCHING key. It never becomes a display name: the published
 * `manufacturer_short` stays curated-or-null, so no brand is renamed by a
 * heuristic. The matchers keep their own confirming rules — a brand key only
 * decides which candidates are looked at.
 */
const LEGAL = new Set([
  'GMBH', 'MBH', 'AG', 'KG', 'CO', 'COKG', 'UG', 'HAFTUNGSBESCHRANKT', 'EK', 'OHG', 'GBR', 'SE',
  'LTD', 'LIMITED', 'LLC', 'INC', 'PLC', 'CORP', 'CORPORATION', 'COMPANY',
  'SA', 'SAS', 'SAU', 'SARL', 'SPA', 'SRL', 'SL', 'BV', 'NV', 'AB', 'AS', 'OY', 'APS',
  'SP', 'Z', 'O', 'OO', 'SPK', 'DOO', 'SRO', 'AS', 'KFT', 'ZRT', 'TICARET', 'SANAYI', 'VE',
  'UND', 'AND', 'THE',
  // dotted forms split into single letters: d.o.o. → D O O, A/S → A S, Sp.k. → SP K
  'A', 'D', 'K', 'R', 'S',
]);

/**
 * "REMKO GmbH & Co. KG" → "REMKO", "KRONOTERM d.o.o." → "KRONOTERM",
 * "Hitachi" → "HITACHI". Upper-case, accents folded, legal-form words dropped
 * from the END only (a legal word inside a name is part of the name).
 */
export function derivedBrandKey(manufacturer) {
  const words = String(manufacturer ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\(.*?\)/g, ' ')
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  while (words.length > 1 && LEGAL.has(words[words.length - 1])) words.pop();
  return words.join(' ');
}

/** Curated short name if the table has one, else the derived key — for matching only. */
export function matchBrand(record, curated) {
  const short = record.manufacturer_short
    ?? (curated && record.manufacturer_normalized ? curated.get(record.manufacturer_normalized) : null);
  return (short || derivedBrandKey(record.manufacturer)).toUpperCase();
}
