/**
 * fetch-zum.mjs — Lista ZUM public-list snapshot fetcher (PL market source).
 *
 * Downloads the public heat-pump entries of Lista ZUM (lista-zum.ios.edu.pl,
 * operator IOŚ-PIB) into data_sources/lista_zum/raw/YYYY-MM/:
 *   - per-category result-grid pages (identity rows + detail link tokens)
 *   - per-entry public detail pages (ben002.aspx — specs, EPREL id, dates)
 *   - _meta.json with fetch timestamps and counts
 *
 * Facts-only acquisition: NO attachment/document downloads, no logos, public
 * pages only, honest User-Agent, ≥1.5 s between requests, resumable via
 * checkpoint (safe to re-run; already-fetched detail pages are skipped).
 * Transport is curl (the host serves an incomplete TLS chain that the system
 * trust store resolves; TLS verification is never disabled).
 *
 * The site is ASP.NET WebForms: tab selection is a hidden field (hfPanel),
 * search and grid paging are __doPostBack calls carrying the full hidden-field
 * set of the PREVIOUS response (per-response __VIEWSTATE).
 *
 * Usage: node scripts/pl/fetch-zum.mjs [--snapshot=YYYY-MM] [--grid-only]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SNAPSHOT = (process.argv.find(a => a.startsWith('--snapshot=')) ?? '').split('=')[1]
  || new Date().toISOString().slice(0, 7);
const GRID_ONLY = process.argv.includes('--grid-only');
const OUT = path.join(ROOT, 'data_sources/lista_zum/raw', SNAPSHOT);
fs.mkdirSync(path.join(OUT, 'grid'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'detail'), { recursive: true });

const BASE = 'https://lista-zum.ios.edu.pl/bepub/ben001.aspx';
const UA = 'HeatPumpDB-market-research/1.0 (read-only; contact: owner of heatpumpdb.de)';
const JAR = path.join(OUT, 'cookies.txt');
const DELAY_MS = 1500;

// Heat-pump category tabs (sidebar panel ids) + the removed/suspended tab.
const PANELS = [
  { key: 'PW', panel: 'PW_p', label: 'Pompa ciepła powietrze/woda (55°C)' },
  { key: 'PWX', panel: 'PWxp', label: 'Pompa ciepła powietrze/woda o podwyższonej klasie' },
  { key: 'PU', panel: 'PU_p', label: 'Pompa ciepła powietrze/woda do C.W.U.' },
  { key: 'PG', panel: 'PG_p', label: 'Gruntowa pompa ciepła o podwyższonej klasie' },
  { key: 'PP', panel: 'PP_p', label: 'Pompa ciepła powietrze/powietrze' },
  { key: 'EX', panel: 'EX_p', label: 'Usunięte / zawieszone' },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
let requestCount = 0;

function curl(args) {
  requestCount++;
  return execFileSync('curl', ['-sS', '--max-time', '120', '-A', UA,
    '-c', JAR, '-b', JAR, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
async function get(url) { await sleep(DELAY_MS); return curl([url]); }
async function post(url, fields) {
  await sleep(DELAY_MS);
  const body = Object.entries(fields)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  const tmp = path.join(OUT, '.postbody.tmp');
  fs.writeFileSync(tmp, body);
  return curl(['--data', `@${tmp}`, url]);
}

const hiddenFields = html => {
  const out = {};
  for (const m of html.matchAll(/<input\b[^>]*>/g)) {
    const tag = m[0];
    if (!/type="hidden"/.test(tag)) continue;
    const name = tag.match(/name="([^"]+)"/)?.[1];
    if (!name) continue;
    out[name] = decodeEntities(tag.match(/value="([^"]*)"/)?.[1] ?? '');
  }
  return out;
};
function decodeEntities(s) {
  return s.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"').replaceAll('&#39;', "'");
}

export function parseGrid(html, categoryKey) {
  const rows = [];
  const table = html.match(/<table[^>]*id="MainContent_gvTable"[^>]*>([\s\S]*?)<\/table>/)?.[1] ?? '';
  for (const tr of table.matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/g)) {
    // The row tag carries the detail link: onclick="window.open(&#39;/bepub/ben002.aspx?rq=…&#39;…
    const onclick = tr[1].match(/window\.open\(&#39;([^&]*(?:&(?!#39;)[^&]*)*)&#39;/)
      ?? tr[1].match(/window\.open\(&#39;(.*?)&#39;/);
    const cells = [...tr[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
      .map(c => decodeEntities(c[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()));
    if (!cells.length) continue; // header row
    rows.push({ category: categoryKey, detailPath: onclick ? decodeEntities(onclick[1]) : null, cells });
  }
  const total = Number(html.match(/id="MainContent_lblRowCount"[^>]*>(\d+)</)?.[1] ?? NaN);
  return { rows, total };
}

// Pager: collect every distinct Page$N event argument present in the response.
const pagerArgs = html =>
  [...new Set([...html.matchAll(/__doPostBack\('([^']*gvTable[^']*)','(Page\$\d+)'\)/g)]
    .map(m => JSON.stringify([m[1].replace(/\\'/g, "'"), m[2]])))].map(s => JSON.parse(s));

async function fetchDetails(allRows, categories) {
  // Detail phase — one public detail page per row (resumable, keyed by ZUM id).
  let done = 0, skipped = 0, failed = 0;
  const idRe = /^[A-Z]{2,3}-\d+/;
  for (const row of allRows) {
    if (categories && !categories.includes(row.category)) { continue; }
    if (!idRe.test(row.cells[0] ?? '')) { continue; } // pager/footer rows
    const id = row.cells[0].replace(/[^A-Za-z0-9-]/g, '');
    const file = path.join(OUT, 'detail', `${id}.html`);
    if (!row.detailPath) { skipped++; continue; }
    if (fs.existsSync(file) && fs.statSync(file).size > 2000) { skipped++; continue; }
    try {
      const html = await get(`https://lista-zum.ios.edu.pl${row.detailPath}`);
      fs.writeFileSync(file, html);
      done++;
      if (done % 50 === 0) console.log(`[detail] ${done} fetched, ${skipped} skipped, ${failed} failed`);
    } catch (e) {
      failed++;
      console.warn(`[detail] FAIL ${id}: ${e.message}`);
      if (failed > 30) throw new Error('too many detail failures — aborting');
    }
  }
  console.log(`detail phase complete: ${done} fetched, ${skipped} skipped, ${failed} failed`);
}

async function run() {
  const startedAt = new Date().toISOString();

  // --details-from-rows[=CAT,CAT]: skip the grid phase, reuse grid-rows.json.
  const dfr = process.argv.find(a => a.startsWith('--details-from-rows'));
  if (dfr) {
    const cats = dfr.includes('=') ? dfr.split('=')[1].split(',') : null;
    const saved = JSON.parse(fs.readFileSync(path.join(OUT, 'grid-rows.json'), 'utf8'));
    // Dedupe by ZUM id across tabs (PWX is a filtered view of PW ids).
    const seen = new Set();
    const rows = saved.rows.filter(r => {
      const id = r.cells[0];
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    await fetchDetails(rows, cats);
    console.log(`requests this run: ${requestCount}`);
    return;
  }

  const allRows = [];
  const first = await get(BASE);
  fs.writeFileSync(path.join(OUT, 'grid', 'landing.html'), first);

  for (const { key, panel, label } of PANELS) {
    // Fresh search postback for this panel (fresh landing fields each time).
    const landing = await get(BASE);
    let fields = hiddenFields(landing);
    fields['ctl00$MainContent$hfPanel'] = panel;
    fields.__EVENTTARGET = 'ctl00$MainContent$btnSearch';
    fields.__EVENTARGUMENT = '';
    let page = await post(BASE, fields);
    let pageNo = 1;
    let expectedTotal = null;
    const seenPages = new Set([1]);
    for (;;) {
      fs.writeFileSync(path.join(OUT, 'grid', `${key}-page-${String(pageNo).padStart(3, '0')}.html`), page);
      const { rows, total } = parseGrid(page, key);
      if (expectedTotal == null && Number.isFinite(total)) expectedTotal = total;
      allRows.push(...rows);
      console.log(`[${key}] page ${pageNo}: +${rows.length} rows (category total ${expectedTotal ?? '?'})`);
      // find the next page link
      const next = pagerArgs(page).find(([, arg]) => Number(arg.slice(5)) === pageNo + 1
        || (arg === 'Page$Last' && false));
      if (!next) {
        // "..." pager: the next block may only be reachable via the literal next number;
        // if absent and we have fewer rows than total, try Page$<n+1> against the grid name.
        const gridName = pagerArgs(page)[0]?.[0] ?? 'ctl00$MainContent$gvTable';
        const rowsSoFar = allRows.filter(r => r.category === key).length;
        if (expectedTotal != null && rowsSoFar < expectedTotal) {
          const f = hiddenFields(page);
          f['ctl00$MainContent$hfPanel'] = panel;
          f.__EVENTTARGET = gridName;
          f.__EVENTARGUMENT = `Page$${pageNo + 1}`;
          const candidate = await post(BASE, f);
          const parsed = parseGrid(candidate, key);
          if (parsed.rows.length) { page = candidate; pageNo++; seenPages.add(pageNo); continue; }
        }
        break;
      }
      const f = hiddenFields(page);
      f['ctl00$MainContent$hfPanel'] = panel;
      f.__EVENTTARGET = next[0];
      f.__EVENTARGUMENT = next[1];
      page = await post(BASE, f);
      pageNo++;
      seenPages.add(pageNo);
    }
    const got = allRows.filter(r => r.category === key).length;
    console.log(`[${key}] done: ${got} rows${expectedTotal != null ? ` / expected ${expectedTotal}` : ''} — ${label}`);
    if (expectedTotal != null && got !== expectedTotal) {
      console.warn(`[${key}] WARNING: row count mismatch (${got} ≠ ${expectedTotal})`);
    }
  }

  fs.writeFileSync(path.join(OUT, 'grid-rows.json'), JSON.stringify({
    fetchedAt: startedAt, rows: allRows,
  }, null, 1));
  console.log(`grid phase complete: ${allRows.length} rows, ${requestCount} requests`);

  if (!GRID_ONLY) {
    await fetchDetails(allRows, null);
  }

  fs.writeFileSync(path.join(OUT, '_meta.json'), JSON.stringify({
    source: 'https://lista-zum.ios.edu.pl (Lista ZUM, IOŚ-PIB)',
    snapshot: SNAPSHOT,
    startedAt, finishedAt: new Date().toISOString(),
    requestCount, rowCount: allRows.length,
    politenessDelayMs: DELAY_MS,
    scope: 'public heat-pump grid pages + public detail pages; no attachments',
  }, null, 2));
  console.log('DONE');
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  run().catch(e => { console.error(e); process.exit(1); });
}
