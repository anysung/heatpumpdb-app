#!/usr/bin/env node
/**
 * fetch-pel-xlsx.mjs — Ofgem BUS Product Eligibility List downloader
 *
 * Modes:
 *   (default)    dry-run: probe URL, print metadata, exit — no files written
 *   --download   download XLSX to raw/YYYY-MM/ snapshot folder + write _meta.json
 *   --snapshot YYYY-MM   override snapshot label (default: current UTC month)
 *
 * Output: data_sources/ofgem_pel/raw/YYYY-MM/BUS-external-PEL.xlsx
 *         data_sources/ofgem_pel/raw/YYYY-MM/_meta.json
 *
 * Security rules (enforced by this script):
 *   - EPREL_API_KEY is never read, used, or referenced here
 *   - No Ofgem authentication is required (public file)
 *   - Raw XLSX snapshot is gitignored by .gitignore pattern: raw/20xx/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = path.resolve(__dirname, '../../data_sources/ofgem_pel');

// ── Publication page and direct file URL ──────────────────────────────────────
const PUBLICATION_PAGE = 'https://www.ofgem.gov.uk/publications/boiler-upgrade-scheme-product-eligibility';
// Canonical URL pattern; fetch-pel-xlsx.mjs probes this at runtime.
// The filename is updated by Ofgem when a new version is published.
// Known latest (confirmed 2026-06-18): 2026-05/BUS-external-PEL.xlsx
const KNOWN_URL = 'https://www.ofgem.gov.uk/sites/default/files/2026-05/BUS-external-PEL.xlsx';

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const MODE_DOWNLOAD = args.includes('--download');
const snapshotIdx = args.indexOf('--snapshot');
const snapshotArg = snapshotIdx !== -1 ? args[snapshotIdx + 1] : undefined;

function currentSnapshot() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

const SNAPSHOT = snapshotArg ?? currentSnapshot();

// ── Safety guard ──────────────────────────────────────────────────────────────
function assertInsideOutRoot(p) {
  const rel = path.relative(OUT_ROOT, p);
  if (rel.startsWith('..')) throw new Error(`Path escape attempt: ${p}`);
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function httpHead(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'HEAD' }, (res) => {
      resolve({
        status: res.statusCode,
        contentType: res.headers['content-type'] ?? '',
        contentLength: res.headers['content-length'] ?? '',
        lastModified: res.headers['last-modified'] ?? '',
        etag: res.headers['etag'] ?? '',
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function httpDownload(url, destPath) {
  return new Promise((resolve, reject) => {
    const tmp = destPath + '.tmp';
    const out = fs.createWriteStream(tmp);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        out.close();
        fs.unlinkSync(tmp);
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(out);
      out.on('finish', () => {
        out.close();
        fs.renameSync(tmp, destPath);
        resolve(res.headers);
      });
    }).on('error', (err) => {
      out.close();
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      reject(err);
    });
  });
}

// ── Log ───────────────────────────────────────────────────────────────────────
const LOG_FILE = path.join(OUT_ROOT, 'fetch-log.md');
function log(msg) {
  const ts = new Date().toISOString();
  const line = `- ${ts} ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nOfgem PEL fetcher — mode: ${MODE_DOWNLOAD ? 'download' : 'dry-run'}`);
  console.log(`Snapshot : ${SNAPSHOT}`);
  console.log(`Source   : ${KNOWN_URL}`);
  console.log(`Page     : ${PUBLICATION_PAGE}\n`);

  // 1. Probe URL
  console.log('Probing URL...');
  let meta;
  try {
    meta = await httpHead(KNOWN_URL);
  } catch (err) {
    console.error(`Probe failed: ${err.message}`);
    process.exit(1);
  }

  const isXlsx = meta.contentType.includes('spreadsheetml') ||
                 meta.contentType.includes('openxmlformats') ||
                 meta.contentType.includes('excel') ||
                 meta.contentType.includes('octet-stream');

  console.log(`HTTP status   : ${meta.status}`);
  console.log(`Content-Type  : ${meta.contentType}`);
  console.log(`Content-Length: ${meta.contentLength ? (parseInt(meta.contentLength) / 1024).toFixed(1) + ' KB' : 'unknown'}`);
  console.log(`Last-Modified : ${meta.lastModified}`);
  console.log(`ETag          : ${meta.etag}`);
  console.log(`XLSX format   : ${isXlsx ? 'YES' : 'WARN — unexpected content-type'}`);

  if (meta.status !== 200) {
    console.error(`\nAbort: HTTP ${meta.status}. URL may have changed — check ${PUBLICATION_PAGE}`);
    process.exit(1);
  }

  if (!MODE_DOWNLOAD) {
    log(`dry-run: probe OK — ${KNOWN_URL} HTTP ${meta.status} ${meta.contentLength ? Math.round(parseInt(meta.contentLength)/1024)+'KB' : ''} last-modified=${meta.lastModified}`);
    console.log('\nDry-run complete. Use --download to fetch the file.');
    return;
  }

  // 2. Download
  const outDir = path.join(OUT_ROOT, 'raw', SNAPSHOT);
  assertInsideOutRoot(outDir);
  fs.mkdirSync(outDir, { recursive: true });

  const fileName = 'BUS-external-PEL.xlsx';
  const destPath = path.join(outDir, fileName);

  if (fs.existsSync(destPath)) {
    const existing = fs.statSync(destPath);
    console.log(`\nFile already exists (${(existing.size / 1024).toFixed(1)} KB). Re-downloading to refresh.`);
  }

  console.log(`\nDownloading to ${path.relative(process.cwd(), destPath)} ...`);
  log(`download start: ${KNOWN_URL} → raw/${SNAPSHOT}/${fileName}`);

  const headers = await httpDownload(KNOWN_URL, destPath);
  const size = fs.statSync(destPath).size;
  console.log(`Downloaded: ${(size / 1024).toFixed(1)} KB`);
  log(`download complete: ${(size / 1024).toFixed(1)} KB saved to raw/${SNAPSHOT}/${fileName}`);

  // 3. Write _meta.json
  // source_period: the YYYY-MM in the URL path (when Ofgem published this file version)
  // snapshot: the local collection month (when we downloaded it)
  const sourcePeriodMatch = KNOWN_URL.match(/\/(\d{4}-\d{2})\//);
  const sourcePeriod = sourcePeriodMatch ? sourcePeriodMatch[1] : null;

  const metaObj = {
    snapshot: SNAPSHOT,
    source_period: sourcePeriod,
    source: 'Ofgem BUS Product Eligibility List',
    publicationPage: PUBLICATION_PAGE,
    sourceUrl: KNOWN_URL,
    fileName,
    fileSizeBytes: size,
    fileSizeKb: parseFloat((size / 1024).toFixed(1)),
    httpLastModified: meta.lastModified,
    etag: meta.etag,
    downloadedAt: new Date().toISOString(),
    complete: true,
  };

  const metaPath = path.join(outDir, '_meta.json');
  assertInsideOutRoot(metaPath);
  fs.writeFileSync(metaPath, JSON.stringify(metaObj, null, 2) + '\n');
  log(`wrote _meta.json (snapshot=${SNAPSHOT}, complete=true, ${(size / 1024).toFixed(1)}KB)`);

  console.log('\nDone.');
  console.log(`  XLSX : ${path.relative(process.cwd(), destPath)}`);
  console.log(`  Meta : ${path.relative(process.cwd(), metaPath)}`);
  console.log(`\nNext: node scripts/ofgem/parse-pel-xlsx.mjs --snapshot ${SNAPSHOT}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
