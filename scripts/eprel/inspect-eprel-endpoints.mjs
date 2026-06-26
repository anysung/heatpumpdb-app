#!/usr/bin/env node
/**
 * EPREL endpoint inspection — Heatpump Data Base internal data research.
 *
 * Documents and (optionally) re-verifies the findings of the 2026-06-12
 * inspection of the public EPREL website (https://eprel.ec.europa.eu/).
 *
 * POLICY: inspection only. Single 1-record requests per endpoint, paced at
 * 1 req/sec, identifying User-Agent. No bulk retrieval. Bulk download is done
 * exclusively via the official Public API key flow in fetch-eprel-raw.mjs.
 *
 * Usage:
 *    node scripts/eprel/inspect-eprel-endpoints.mjs            # print recorded findings only (offline)
 *    node scripts/eprel/inspect-eprel-endpoints.mjs --verify   # re-probe each endpoint with 1-record requests
 */

const USER_AGENT =
  'HeatpumpDataBase-internal-data-research/0.1 (endpoint inspection; contact: sungyongsoo1976@gmail.com)';

// Findings recorded on 2026-06-12. The public website's own JSON endpoints
// (used by the Angular SPA) answer 200 when a Referer header is present and
// 403 otherwise. These are inspection references only — NOT a bulk channel.
const FINDINGS = [
  { name: 'product groups',            url: 'https://eprel.ec.europa.eu/api/product-groups', total: '23 groups' },
  { name: 'spaceheaters (all)',        url: 'https://eprel.ec.europa.eu/api/products/spaceheaters?_page=1&_limit=1', total: 56475 },
  { name: 'spaceheaters HEAT_PUMP',    url: 'https://eprel.ec.europa.eu/api/products/spaceheaters?_page=1&_limit=1&type=HEAT_PUMP', total: 45295 },
  { name: '  └ category SPACE_HEATER', url: 'https://eprel.ec.europa.eu/api/products/spaceheaters?_page=1&_limit=1&type=HEAT_PUMP&category=SPACE_HEATER', total: 18328 },
  { name: '  └ category COMBINATION',  url: 'https://eprel.ec.europa.eu/api/products/spaceheaters?_page=1&_limit=1&type=HEAT_PUMP&category=COMBINATION_HEATER', total: 26967 },
  { name: 'spaceheaterpackages',       url: 'https://eprel.ec.europa.eu/api/products/spaceheaterpackages?_page=1&_limit=1', total: 111497 },
  { name: 'temperature controls',      url: 'https://eprel.ec.europa.eu/api/products/spaceheatertemperaturecontrol?_page=1&_limit=1', total: 840 },
  { name: 'solar devices',             url: 'https://eprel.ec.europa.eu/api/products/spaceheatersolardevice?_page=1&_limit=1', total: 207 },
  { name: 'waterheaters (out of scope)', url: 'https://eprel.ec.europa.eu/api/products/waterheaters?_page=1&_limit=1', total: 11887 },
  { name: 'product detail (sample)',   url: 'https://eprel.ec.europa.eu/api/products/spaceheaters/245385', total: '1 record, 119 fields' },
];

console.log('EPREL public-site endpoint findings (recorded 2026-06-12):\n');
for (const f of FINDINGS) {
  console.log(`  ${String(f.name).padEnd(28)} total=${String(f.total).padEnd(12)} ${f.url}`);
}
console.log(`
Access notes:
  - 403 without a Referer header; 200 with any eprel.ec.europa.eu Referer (CloudFront/WAF rule).
  - No API key, cookie, or token involved on the public site endpoints.
  - Official bulk access requires a Public API key: https://eprel.ec.europa.eu/screen/requestpublicapikey
  - Official T&C: data_sources/eprel_raw/terms/EPREL_Public_API_Terms_and_Conditions_EN.pdf`);

if (!process.argv.includes('--verify')) {
  console.log('\n(offline mode — pass --verify to re-probe each endpoint with single 1-record requests)');
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
console.log('\nRe-probing endpoints (1 request each, 1s apart)...\n');
for (const f of FINDINGS) {
  try {
    const res = await fetch(f.url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        Referer: 'https://eprel.ec.europa.eu/screen/home',
      },
    });
    const body = await res.text();
    let size = '';
    try { size = `size=${JSON.parse(body).size ?? 'n/a'}`; } catch { size = 'non-JSON'; }
    console.log(`  HTTP ${res.status}  ${size.padEnd(14)} ${f.name}`);
  } catch (err) {
    console.log(`  ERROR ${String(err).slice(0, 120)}  ${f.name}`);
  }
  await sleep(1000);
}
