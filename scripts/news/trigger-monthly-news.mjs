#!/usr/bin/env node
/**
 * trigger-monthly-news.mjs — run the news/policies function and WAIT for it.
 *
 * The Cloud Scheduler fires this same function and forgets about it, which is
 * fine when news is a thing that happens on its own. Inside the maintenance
 * window it is not: the site build reads the exported news snapshot, so the run
 * has to finish before the build starts. This calls the function directly and
 * blocks until it answers.
 *
 * Ordering is deliberate — news runs AFTER the database it describes (owner's
 * instruction, 2026-08-19). The month's articles talk about the data that has
 * just landed, so writing them first would describe last month's catalogue.
 *
 * AUTH: the function accepts either a Cloud Scheduler header or an x-api-key.
 * We are not the scheduler, so the key is required and comes from the
 * environment — never from a file in the repo.
 *
 *   NEWS_FN_KEY=… node scripts/news/trigger-monthly-news.mjs [--countries DE,FR]
 */
import https from 'node:https';

const FN = process.env.NEWS_FN_URL
  ?? 'https://us-central1-gen-lang-client-0324244302.cloudfunctions.net/autoUpdateDatabase';
const KEY = process.env.NEWS_FN_KEY ?? process.env.SECRET_KEY;

if (!KEY) {
  console.error('NEWS_FN_KEY (or SECRET_KEY) is not set — refusing to call the news function.');
  console.error('The maintenance window treats this as non-fatal: the catalogue still ships,');
  console.error('and the month simply carries last month\'s news until the key is supplied.');
  process.exit(1);
}

const i = process.argv.indexOf('--countries');
const countries = i >= 0 ? process.argv[i + 1].split(',').map(s => s.trim().toUpperCase()) : undefined;

const body = { newsOnly: true, ...(countries ? { countries } : {}) };
console.log(`news: calling ${FN} ${countries ? `for ${countries.join(', ')}` : 'for all markets'}`);

// NOT global fetch: undici gives up after 300 s without response headers
// (UND_ERR_HEADERS_TIMEOUT), but writing every market's articles takes ~8 min.
// On 2026-10-01 that made the window record news as FAILED — and skip the
// public-news export and trend cards — while the function went on and wrote
// all five markets. A plain https request with our own ceiling waits properly.
const TIMEOUT_MIN = Number(process.env.NEWS_FN_TIMEOUT_MIN ?? 30);

function post(url, payload, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(payload) } }, (r) => {
      let data = '';
      r.setEncoding('utf8');
      r.on('data', (c) => { data += c; });
      r.on('end', () => resolve({ status: r.statusCode ?? 0, text: data }));
    });
    req.setTimeout(TIMEOUT_MIN * 60_000, () => req.destroy(new Error(`no answer within ${TIMEOUT_MIN} min`)));
    req.on('error', reject);
    req.end(payload);
  });
}

const started = Date.now();
let res;
try {
  res = await post(FN, JSON.stringify(body), { 'Content-Type': 'application/json', 'x-api-key': KEY });
} catch (e) {
  console.error(`news: request failed after ${Math.round((Date.now() - started) / 1000)}s — ${e.message}`);
  console.error('The function may still be running server-side; check countries/<cc>/news before re-triggering.');
  process.exit(1);
}
const text = res.text;
const secs = Math.round((Date.now() - started) / 1000);

if (res.status < 200 || res.status >= 300) {
  console.error(`news: HTTP ${res.status} after ${secs}s — ${text.slice(0, 400)}`);
  process.exit(1);
}
console.log(`news: completed in ${secs}s`);
console.log(text.slice(0, 800));
