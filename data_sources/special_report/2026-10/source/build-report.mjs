#!/usr/bin/env node
/**
 * Builds data_sources/special_report/2026-10/report.html — the self-contained, five-language
 * Special Report "The Complete F-Gas Rulebook for Heat Pumps".
 *
 * Content lives in strings/<lang>.json (copy) and data.json (refrigerants, national layer);
 * every year in every table comes from the one rule function in pages.mjs, so no page or
 * language can disagree with another. The shell mirrors the September edition: top bar with
 * language, Print / Save PDF and Fullscreen; a 16:9 book with previous/next, keyboard and
 * swipe navigation; ?lang= and ?page= deep links.
 *
 *   node data_sources/special_report/2026-10/source/build-report.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANGS, render, LOGO_DARK } from './pages.mjs';

const D = dirname(fileURLToPath(import.meta.url));
const OUT = join(D, '..', 'report.html');

const UI = {
  en: { name: 'English', edition: 'October 2026 edition', print: 'Print / Save PDF', fs: 'Fullscreen', prev: 'Previous', next: 'Next', pageOf: 'Page {a} of {b}' },
  de: { name: 'Deutsch', edition: 'Ausgabe Oktober 2026', print: 'Drucken / PDF speichern', fs: 'Vollbild', prev: 'Zurück', next: 'Weiter', pageOf: 'Seite {a} von {b}' },
  fr: { name: 'Français', edition: 'Édition d’octobre 2026', print: 'Imprimer / Enregistrer en PDF', fs: 'Plein écran', prev: 'Précédent', next: 'Suivant', pageOf: 'Page {a} sur {b}' },
  pl: { name: 'Polski', edition: 'Wydanie październik 2026', print: 'Drukuj / Zapisz PDF', fs: 'Pełny ekran', prev: 'Wstecz', next: 'Dalej', pageOf: 'Strona {a} z {b}' },
  it: { name: 'Italiano', edition: 'Edizione ottobre 2026', print: 'Stampa / Salva PDF', fs: 'Schermo intero', prev: 'Indietro', next: 'Avanti', pageOf: 'Pagina {a} di {b}' },
};

const sets = Object.fromEntries(LANGS.map((l) => [l, render(l)]));
const en = sets.en.strings;
const plain = (s) => s.replace(/<[^>]+>/g, '').replace(/‑/g, '-');
const pageCss = readFileSync(join(D, 'pages.css'), 'utf8');

const shellCss = `
html,body{margin:0;height:100%;overflow:hidden;background:#071731}
body{background:radial-gradient(circle at 15% 20%,#163c6a 0,#071731 42%,#030b19 100%);color:#fff;font-family:var(--font)}
.rp{height:100%;display:grid;grid-template-rows:58px 1fr 58px}
.rp-top{display:flex;align-items:center;gap:14px;padding:8px 18px;background:rgba(3,11,25,.72);backdrop-filter:blur(16px);border-bottom:1px solid rgba(255,255,255,.1);z-index:20}
.rp-top img{height:24px;display:block}
.rp-ed{font-size:12px;font-weight:700;color:#a9b7cb;border-left:1px solid rgba(255,255,255,.16);padding-left:14px}
.rp-sp{flex:1}
.rp-c{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;font:inherit;font-size:13px}
.rp-c:hover{background:rgba(255,255,255,.14)}.rp-c:disabled{opacity:.35;cursor:default}
.rp-c:focus-visible{outline:2px solid #7fb8f2;outline-offset:2px}
select.rp-c option{color:#111}
.rp-stage{position:relative;display:grid;place-items:center;padding:16px 56px 8px;min-height:0}
.rp-book{position:relative;aspect-ratio:16/9;width:min(94vw,calc((100vh - 140px) * 16 / 9),1450px);border-radius:18px;box-shadow:0 28px 75px rgba(4,17,38,.4)}
.rp-pg{position:absolute;inset:0;opacity:0;pointer-events:none;transition:opacity .35s ease;overflow:hidden;border-radius:18px}
.rp-pg.on{opacity:1;pointer-events:auto}
.rp-pg>.page{transform-origin:0 0;position:absolute;left:0;top:0}
.rp-nav{position:absolute;top:50%;transform:translateY(-50%);width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font-size:20px;cursor:pointer;display:grid;place-items:center}
.rp-nav.l{left:10px}.rp-nav.r{right:10px}.rp-nav:disabled{opacity:.2;cursor:default}
.rp-foot{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 18px;border-top:1px solid rgba(255,255,255,.08)}
.rp-fn{grid-column:2;display:flex;align-items:center;gap:14px}
.rp-prog{width:min(360px,40vw);height:4px;border-radius:2px;background:rgba(255,255,255,.12);overflow:hidden}
.rp-prog i{display:block;height:100%;background:linear-gradient(90deg,#e0452c,#0066cc)}
.rp-pc{grid-column:3;justify-self:end;font-size:12px;color:#a9b7cb}
@media (max-width:700px){.rp-ed,#rpFs,.rp-pc{display:none}.rp-top{gap:8px;padding:8px 10px}.rp-top img{height:18px}.rp-c{font-size:12px;padding:6px 9px;white-space:nowrap}#rpPrint{min-width:0;max-width:38vw;overflow:hidden;text-overflow:ellipsis}#rpLang{flex:none}.rp-stage{padding:8px 8px 4px}.rp-nav{display:none}.rp-foot{grid-template-columns:1fr;padding:0 10px}.rp-fn{grid-column:1;justify-content:center}.rp-prog{width:30vw}}
@media (prefers-reduced-motion:reduce){.rp-pg{transition:none}}
@page{size:1280px 720px;margin:0}
@media print{
  html,body{height:auto;overflow:visible;background:#fff}
  .rp{display:block}.rp-top,.rp-foot,.rp-nav{display:none!important}
  .rp-stage{display:block;padding:0}.rp-book{width:1280px;aspect-ratio:auto;box-shadow:none;border-radius:0}
  .rp-pg{position:relative;opacity:1;width:1280px;height:720px;break-after:page;border-radius:0}
  .rp-pg>.page{transform:none!important;border-radius:0}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}`;

const templates = LANGS.map((l) => `<template data-lang="${l}">${sets[l].pages.map((p) => `<div class="rp-pg">${p}</div>`).join('')}</template>`).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${plain(en['cover.title'])} — HeatPump DataBase Europe Special Report, October 2026</title>
<meta name="description" content="${plain(en['cover.sub'])}">
<meta name="robots" content="noindex,nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
<style>${pageCss}
${shellCss}</style>
</head>
<body>
<div class="rp">
  <div class="rp-top"><img src="${LOGO_DARK}" alt="HeatPump DB"><span class="rp-ed" id="rpEd"></span><span class="rp-sp"></span>
    <select class="rp-c" id="rpLang" aria-label="Language">${LANGS.map((l) => `<option value="${l}">${UI[l].name}</option>`).join('')}</select>
    <button class="rp-c" id="rpPrint" type="button"></button><button class="rp-c" id="rpFs" type="button"></button></div>
  <div class="rp-stage"><button class="rp-nav l" id="rpL" type="button" aria-label="Previous">‹</button><div class="rp-book" id="rpBook"></div><button class="rp-nav r" id="rpR" type="button" aria-label="Next">›</button></div>
  <div class="rp-foot"><div class="rp-fn"><button class="rp-c" id="rpPrev" type="button"></button><div class="rp-prog"><i id="rpProg"></i></div><button class="rp-c" id="rpNext" type="button"></button></div><span class="rp-pc" id="rpPc"></span></div>
</div>
${templates}
<script>
(function(){
  var UI=${JSON.stringify(UI)};
  var LANGS=${JSON.stringify(LANGS)};
  var q=new URLSearchParams(location.search);
  var lang=(function(){var x=q.get('lang');if(x&&UI[x])return x;try{var s=localStorage.getItem('sr2610lang');if(s&&UI[s])return s}catch(e){}var n=(navigator.language||'en').slice(0,2);return UI[n]?n:'en'})();
  var cur=Math.max(0,(parseInt(q.get('page')||'1',10)||1)-1);
  var book=document.getElementById('rpBook'),pages=[];
  function $(id){return document.getElementById(id)}
  function fit(){var w=book.clientWidth,k=w/1280;pages.forEach(function(p){var pg=p.firstElementChild;if(pg)pg.style.transform='scale('+k+')'})}
  function build(){
    var tpl=document.querySelector('template[data-lang="'+lang+'"]');
    book.innerHTML='';book.appendChild(tpl.content.cloneNode(true));
    pages=[].slice.call(book.querySelectorAll('.rp-pg'));
    if(cur>=pages.length)cur=pages.length-1;
    var u=UI[lang];document.documentElement.lang=lang;$('rpLang').value=lang;
    $('rpEd').textContent=u.edition;$('rpPrint').textContent=u.print;$('rpFs').textContent=u.fs;
    $('rpPrev').textContent='‹ '+u.prev;$('rpNext').textContent=u.next+' ›';
    fit();show();
  }
  function show(){
    pages.forEach(function(p,i){p.classList.toggle('on',i===cur);p.setAttribute('aria-hidden',String(i!==cur))});
    $('rpProg').style.width=((cur+1)/pages.length*100)+'%';
    $('rpPc').textContent=UI[lang].pageOf.replace('{a}',cur+1).replace('{b}',pages.length);
    $('rpPrev').disabled=$('rpL').disabled=cur===0;$('rpNext').disabled=$('rpR').disabled=cur===pages.length-1;
    try{var u=new URL(location.href);u.searchParams.set('page',cur+1);u.searchParams.set('lang',lang);history.replaceState(null,'',u)}catch(e){}
  }
  function go(d){var n=cur+d;if(n<0||n>=pages.length)return;cur=n;show()}
  $('rpPrev').onclick=$('rpL').onclick=function(){go(-1)};$('rpNext').onclick=$('rpR').onclick=function(){go(1)};
  $('rpLang').onchange=function(e){lang=e.target.value;try{localStorage.setItem('sr2610lang',lang)}catch(_){}build()};
  $('rpPrint').onclick=function(){window.print()};
  $('rpFs').onclick=function(){if(document.fullscreenElement)document.exitFullscreen();else if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen()};
  document.addEventListener('keydown',function(e){if(e.target&&e.target.tagName==='SELECT')return;if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' '){e.preventDefault();go(1)}else if(e.key==='ArrowLeft'||e.key==='PageUp')go(-1);else if(e.key==='Home'){cur=0;show()}else if(e.key==='End'){cur=pages.length-1;show()}});
  var x0=null;book.addEventListener('touchstart',function(e){x0=e.touches[0].clientX},{passive:true});
  book.addEventListener('touchend',function(e){if(x0==null)return;var dx=e.changedTouches[0].clientX-x0;if(Math.abs(dx)>50)go(dx<0?1:-1);x0=null});
  var rt;addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(fit,100)});
  addEventListener('beforeprint',function(){pages.forEach(function(p){var pg=p.firstElementChild;if(pg)pg.style.transform='none'})});
  addEventListener('afterprint',fit);
  build();
})();
</script>
</body>
</html>
`;
writeFileSync(OUT, html);
console.log(`report.html: ${(html.length / 1024).toFixed(0)} KB · ${LANGS.length} languages × ${sets.en.pages.length} pages`);
