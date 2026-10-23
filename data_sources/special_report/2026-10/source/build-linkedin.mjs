#!/usr/bin/env node
/**
 * LinkedIn edition of the October 2026 Special Report — one carousel PDF per language.
 *
 * LinkedIn hosts documents (PDF), not HTML, so the PDF is the advertisement for the
 * report. Pages open: cover, pages 2–3 and the last page (the national layer). Pages
 * 4–7 keep their headline sharp and show the evidence blurred, with a call to sign up.
 * A closing page carries the link.
 *
 * Every page is captured as an image FIRST and blurred as an image, so a gated page
 * carries no text layer — nothing behind the blur can be copied or searched out of
 * the PDF. Only the call-to-action text on top is real text.
 *
 * Links: LinkedIn's viewer does not make PDF links clickable, so every destination is
 * printed as text too; the post's first comment carries the real link (?ref=li-report-<cc>).
 *
 *   node data_sources/special_report/2026-10/source/build-linkedin.mjs [outDir]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOGO_DARK } from './pages.mjs';

const D = dirname(fileURLToPath(import.meta.url));
const REPORT = resolve(D, '..', 'report.html');
const OUT = resolve(process.argv[2] || join(D, '..', 'linkedin'));
mkdirSync(OUT, { recursive: true });

const OPEN = new Set([0, 1, 2, 7]);          // cover, p2, p3, last page
// One carousel per LinkedIn market: the link must land on that market's own site.
const MARKETS = [
  { m: 'eu', lang: 'en', host: 'www.heatpumpdb.eu' }, { m: 'gb', lang: 'en', host: 'www.heatpumpdb.uk' },
  { m: 'de', lang: 'de', host: 'www.heatpumpdb.de' }, { m: 'fr', lang: 'fr', host: 'www.heatpumpdb.fr' },
  { m: 'pl', lang: 'pl', host: 'www.heatpumpdb.pl' }, { m: 'it', lang: 'it', host: 'www.heatpumpdb.it' },
];

const CTA = {
  en: { k: 'HeatPump DB Premium', h: 'The full page is in the report', p: 'Pages 4–7 — year by year, nine key dates, three snapshots and ten refrigerant passports — are part of HeatPump DB Premium. New accounts include a 30-day Premium trial, no credit card.', u: 'Read the full report',
        fk: 'Special Report · October 2026', fh: 'The complete F-gas rulebook, in one place', fp: '8 pages · 15 refrigerants · every date to 2050 · five markets · five languages', fb: 'Create a free account — 30-day Premium trial included' },
  de: { k: 'HeatPump DB Premium', h: 'Die ganze Seite steht im Report', p: 'Seiten 4–7 — Jahr für Jahr, neun Stichtage, drei Momentaufnahmen und zehn Kältemittel-Steckbriefe — sind Teil von HeatPump DB Premium. Neue Konten enthalten einen 30-tägigen Premium-Test, ohne Kreditkarte.', u: 'Zum vollständigen Report',
        fk: 'Special Report · Oktober 2026', fh: 'Das vollständige F-Gas-Regelwerk an einem Ort', fp: '8 Seiten · 15 Kältemittel · jeder Stichtag bis 2050 · fünf Märkte · fünf Sprachen', fb: 'Kostenloses Konto anlegen — inkl. 30 Tage Premium-Test' },
  fr: { k: 'HeatPump DB Premium', h: 'La page complète est dans le rapport', p: 'Les pages 4 à 7 — année par année, neuf dates clés, trois instantanés et dix passeports de fluides — font partie de HeatPump DB Premium. Les nouveaux comptes incluent un essai Premium de 30 jours, sans carte bancaire.', u: 'Lire le rapport complet',
        fk: 'Rapport spécial · octobre 2026', fh: 'Toute la réglementation F-gaz, au même endroit', fp: '8 pages · 15 fluides · chaque date jusqu’en 2050 · cinq marchés · cinq langues', fb: 'Créer un compte gratuit — essai Premium de 30 jours inclus' },
  pl: { k: 'HeatPump DB Premium', h: 'Pełna strona jest w raporcie', p: 'Strony 4–7 — rok po roku, dziewięć kluczowych dat, trzy przekroje i dziesięć paszportów czynników — są częścią HeatPump DB Premium. Nowe konta mają 30-dniowy okres próbny Premium, bez karty.', u: 'Przeczytaj pełny raport',
        fk: 'Raport specjalny · październik 2026', fh: 'Wszystkie przepisy F-gazowe w jednym miejscu', fp: '8 stron · 15 czynników · każda data do 2050 · pięć rynków · pięć języków', fb: 'Załóż bezpłatne konto — 30 dni Premium w cenie' },
  it: { k: 'HeatPump DB Premium', h: 'La pagina completa è nel report', p: 'Le pagine 4–7 — anno per anno, nove date chiave, tre istantanee e dieci passaporti dei refrigeranti — fanno parte di HeatPump DB Premium. I nuovi account includono una prova Premium di 30 giorni, senza carta di credito.', u: 'Leggi il report completo',
        fk: 'Report speciale · ottobre 2026', fh: 'Tutto il regolamento F-gas, in un unico posto', fp: '8 pagine · 15 refrigeranti · ogni data fino al 2050 · cinque mercati · cinque lingue', fb: 'Crea un account gratuito — prova Premium di 30 giorni inclusa' },
};

const css = `
@page{size:1280px 720px;margin:0}
*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{position:relative;width:1280px;height:720px;overflow:hidden;break-after:page;background:#fff}
.sheet>img.full{position:absolute;inset:0;width:1280px;height:720px}
.blur{position:absolute;left:0;right:0;bottom:0;overflow:hidden}
.blur img{position:absolute;left:0;width:1280px;height:720px;filter:blur(9px) saturate(.85);opacity:.9}
.veil{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(rgba(255,255,255,.35),rgba(255,255,255,.6))}
.cta{position:absolute;left:50%;transform:translateX(-50%);width:640px;background:#071731;color:#fff;border-radius:20px;padding:26px 30px;display:grid;gap:10px;text-align:center;box-shadow:0 20px 50px rgba(7,23,49,.35);border-top:5px solid #e0452c}
.cta .k{font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#7fb8f2}
.cta .h{font-size:26px;font-weight:800;letter-spacing:-.02em;line-height:1.15}
.cta .p{font-size:14px;line-height:1.5;color:#d6e2f1}
.cta .u{margin-top:4px;display:inline-block;justify-self:center;background:#0066cc;color:#fff;border-radius:999px;padding:10px 18px;font-size:14px;font-weight:700;text-decoration:none}
.cta .u small{display:block;font-size:12px;font-weight:600;color:#cfe3fa;margin-top:2px}
.end{background:radial-gradient(circle at 78% 28%,#1b4f86 0,#0d2a52 34%,#071731 72%);color:#fff;display:grid;place-items:center;text-align:center}
.end::before{content:"";position:absolute;left:0;right:0;top:0;height:6px;background:linear-gradient(90deg,#e0452c 0 50%,#0066cc 50%)}
.end .in{display:grid;gap:16px;justify-items:center;max-width:900px}
.end img{height:30px}
.end .k{font-size:13px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#7fb8f2}
.end .h{font-size:52px;font-weight:800;letter-spacing:-.04em;line-height:1.05}
.end .p{font-size:17px;color:#c9d6e6}
.end .u{background:#fff;color:#071731;border-radius:999px;padding:14px 26px;font-size:18px;font-weight:800;text-decoration:none}
.end .l{font-size:15px;font-weight:700;color:#ff8a73}`;

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 2 })).newPage();
for (const { m, lang, host } of MARKETS) {
  const url = () => `${host}/special-report/2026-10/?ref=li-report-${m}`;
  await page.goto(`file://${REPORT}?lang=${lang}&page=1`);
  await page.waitForTimeout(1200);
  await page.addStyleTag({ content: '.rp-pg{transition:none!important}.rp-top,.rp-foot,.rp-nav{visibility:hidden}' });
  const shots = [];
  const n = await page.locator('.rp-pg').count();
  for (let i = 0; i < n; i++) {
    const cut = await page.evaluate((i) => {
      const host = document.querySelectorAll('.rp-pg')[i], pg = host.firstElementChild;
      document.querySelectorAll('.rp-pg').forEach((h) => { h.classList.remove('on'); h.removeAttribute('style'); });
      host.classList.add('on'); pg.style.transform = 'none'; pg.style.borderRadius = '0';
      Object.assign(host.style, { position: 'fixed', left: '0', top: '0', width: '1280px', height: '720px', zIndex: 999, borderRadius: '0', opacity: '1' });
      const ph = pg.querySelector('.ph');
      return ph ? Math.round(ph.getBoundingClientRect().bottom - pg.getBoundingClientRect().top) : 0;
    }, i);
    await page.waitForTimeout(150);
    const buf = await page.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 720 }, type: 'jpeg', quality: 88 });
    shots.push({ src: 'data:image/jpeg;base64,' + buf.toString('base64'), cut: cut + 4 });
  }
  const c = CTA[lang];
  const sheets = shots.map((s, i) => {
    if (OPEN.has(i)) return `<div class="sheet"><img class="full" src="${s.src}" alt=""></div>`;
    const top = s.cut, mid = top + (720 - top) / 2;
    return `<div class="sheet"><img class="full" src="${s.src}" alt="">
      <div class="blur" style="top:${top}px"><img src="${s.src}" alt="" style="top:${-top}px"></div><div class="veil" style="top:${top}px"></div>
      <div class="cta" style="top:${Math.max(top + 14, mid - 120)}px"><span class="k">${c.k}</span><span class="h">${c.h}</span><span class="p">${c.p}</span>
        <a class="u" href="https://${url(lang)}">${c.u} →<small>${url(lang)}</small></a></div></div>`;
  }).join('');
  const end = `<div class="sheet end"><div class="in"><img src="${LOGO_DARK}" alt="HeatPump DB"><span class="k">${c.fk}</span><span class="h">${c.fh}</span><span class="p">${c.fp}</span>
    <a class="u" href="https://${url(lang)}">${c.fb}</a><span class="l">${url(lang)}</span></div></div>`;
  const doc = await browser.newPage();
  await doc.setContent(`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap"><style>${css}</style></head><body>${sheets}${end}</body></html>`, { waitUntil: 'networkidle' });
  const file = join(OUT, `HeatPumpDB_SpecialReport_Oct2026_carousel_${m}.pdf`);
  await doc.pdf({ path: file, width: '1280px', height: '720px', printBackground: true, preferCSSPageSize: true });
  await doc.close();
  console.log(`${m}: ${file}`);
}
await browser.close();
