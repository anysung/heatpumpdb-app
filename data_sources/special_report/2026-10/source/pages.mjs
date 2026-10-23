// Special Report 2026-10 page renderer: cover + 7 pages per language (strings/<lang>.json).
// Used by build-report.mjs. Run from anywhere: paths resolve relative to this file.
// Every table derives its years from ONE rule function, so no page or language can disagree.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const D = dirname(fileURLToPath(import.meta.url));
const svg = (f) => 'data:image/svg+xml;base64,' + Buffer.from(readFileSync(join(D, 'assets', f))).toString('base64');
const LOGO_DARK = svg('logo-dark.svg');
const FLAG = Object.fromEntries(['DE', 'GB', 'FR', 'PL', 'IT'].map((c) => [c, svg(`flag-${c}.svg`)]));
const data = JSON.parse(readFileSync(join(D, 'data.json'), 'utf8'));
const LANGS = ['en', 'de', 'fr', 'pl', 'it'].filter((l) => existsSync(join(D, 'strings', `${l}.json`)));
const EN = JSON.parse(readFileSync(join(D, 'strings', 'en.json'), 'utf8'));
const TOTAL = 8;

/* ── Annex IV, reduced to: last calendar year a NEW unit may be placed on the EU market ── */
const COLS = [
  { id: 'mono_le12', seg: 'res', cap: '≤ 12 kW', typ: 'typ.mono', k: 'm', c: '≤ 12' },
  { id: 'split_le12', seg: 'res', cap: '≤ 12 kW', typ: 'typ.splitAW', k: 's', c: '≤ 12' },
  { id: 'mono_12_23', seg: 'res', cap: '12–23 kW', typ: 'typ.mono', k: 'm', c: '12–23' },
  { id: 'split_12_23', seg: 'res', cap: '12–23 kW', typ: 'typ.split', k: 's', c: '12–23' },
  { id: 'mono_23_50', seg: 'com', cap: '23–50 kW', typ: 'typ.mono', k: 'm', c: '23–50' },
  { id: 'split_gt23', seg: 'com', cap: '> 23 kW', typ: 'typ.split', k: 's', c: '> 23' },
  { id: 'mono_gt50', seg: 'com', cap: '> 50 kW', typ: 'typ.mono', k: 'm', c: '> 50' },
];
function lastYear(col, gwp, natural) {
  if (natural) return null;
  switch (col) {
    case 'mono_le12': return gwp >= 150 ? 2026 : 2031;
    case 'split_le12': return gwp >= 750 ? 2024 : gwp >= 150 ? 2026 : 2034;
    case 'mono_12_23': case 'mono_23_50': return gwp >= 150 ? 2026 : null;
    case 'split_12_23': case 'split_gt23': return gwp >= 750 ? 2028 : gwp >= 150 ? 2032 : null;
    case 'mono_gt50': return gwp >= 150 ? 2029 : null;
  }
}
const openAt = (col, r, year) => { const y = lastYear(col, r.gwp, r.natural); return y == null || y >= year; };
const GROUP_KEY = { 'Natural': 'cls.natural', 'GWP &lt; 150': 'cls.low', 'GWP < 150': 'cls.low', 'GWP 150–749': 'cls.mid', 'GWP ≥ 750': 'cls.high' };
const KIND_KEY = { 'Natural (propane)': 'kind.propane', 'Natural (CO₂)': 'kind.co2', 'HFC/HFO blend': 'kind.hfcHfo', 'HFC': 'kind.hfc', 'HFC blend': 'kind.hfcBlend' };

const ICON_M = `<svg width="26" height="16" viewBox="0 0 26 16" fill="none"><rect x="4" y="1.5" width="18" height="13" rx="2" stroke="#1d1d1f" stroke-width="1.4"/><circle cx="11" cy="8" r="3.6" stroke="#1d1d1f" stroke-width="1.3"/><path d="M17 5h2.5M17 8h2.5M17 11h2.5" stroke="#1d1d1f" stroke-width="1.2"/></svg>`;
const ICON_S = `<svg width="30" height="16" viewBox="0 0 30 16" fill="none"><rect x="1" y="3.5" width="13" height="11" rx="2" stroke="#1d1d1f" stroke-width="1.4"/><circle cx="7.5" cy="9" r="3" stroke="#1d1d1f" stroke-width="1.3"/><rect x="20" y="1.5" width="9" height="13" rx="1.5" stroke="#1d1d1f" stroke-width="1.4"/><path d="M14 7h6M14 10h6" stroke="#0066cc" stroke-width="1.3" stroke-dasharray="1.6 1.4"/></svg>`;

function render(lang) {
  const S = JSON.parse(readFileSync(join(D, 'strings', `${lang}.json`), 'utf8'));
  const missing = Object.keys(EN).filter((k) => !k.startsWith('_') && !(k in S));
  if (missing.length) throw new Error(`${lang}: missing ${missing.join(', ')}`);
  const loc = S._locale;
  const nf = (n) => n.toLocaleString(loc);
  const T = (k, v = {}) => S[k].replace(/\{(\w+)\}/g, (_, p) => (p === 'stock' ? S['ui.stock'] : v[p] ?? `{${p}}`));
  const gwpTxt = (g, nat) => (nat && g < 1 ? '≈ 0' : g < 1 ? '< 1' : nf(g));
  const refs = data.groups.flatMap((g) => g.refs.map((r) => ({ ...r, group: g.label })));
  const sh = data.share;

  const page = (n, { kicker, title, dek, body, sources, note }) => `<article class="page">
  <header class="ph"><span class="kicker">${kicker}</span><span class="pageno">${n} / ${TOTAL}</span>
    <h3 class="title">${title}</h3>${dek ? `<p class="dek">${dek}</p>` : ''}</header>
  <div class="pb">${body}</div>
  <footer class="pf"><span class="sl">${S['ui.sources']}</span>${sources.map((s) => `<span class="chip">${s}</span>`).join('')}
    <span class="note">${note ?? ''}</span>
    <span class="brand"><span class="badge"><img src="${LOGO_DARK}" alt=""></span>${S['ui.brandline']}</span></footer></article>`;

  const cell = (y, foot = '') => y == null ? `<div class="cell c-open">${S['cell.noLimit']}</div>`
    : y <= 2024 ? `<div class="cell c-ended">${S['cell.banned']}${foot}</div>`
    : y === 2026 ? `<div class="cell c-2026">${T('cell.until', { y })}</div>`
    : `<div class="cell c-later">${T('cell.until', { y })}</div>`;
  const legendCells = `<div class="legend"><span class="lg"><i class="sw" style="background:var(--ink)"></i>${S['leg.banned']}</span><span class="lg"><i class="sw" style="background:var(--red)"></i>${S['leg.ends2026']}</span><span class="lg"><i class="sw" style="background:var(--red-tint)"></i>${S['leg.later']}</span><span class="lg"><i class="sw" style="background:var(--parchment)"></i>${S['leg.noLimit']}</span></div>`;

  /* cover */
  const cover = `<article class="page cover"><div class="cv">
    <div><span class="cv-badge"><img src="${LOGO_DARK}" alt="HeatPump DB"></span>
      <div class="cv-kicker">${S['cover.kicker']}</div>
      <h3 class="cv-title">${S['cover.title']}</h3>
      <p class="cv-sub">${S['cover.sub']}</p>
      <div class="cv-meta">${S['cover.meta']}</div>
      <div class="cv-flags">${['GB', 'DE', 'FR', 'PL', 'IT'].map((c) => `<img src="${FLAG[c]}" alt="">`).join('')}</div>
      <span class="cv-reg"><i></i>${S['cover.reg']}</span></div>
    <div class="cv-stats">
      <div class="cv-stat"><div class="n red">${S['cover.s1n']}</div><div class="t">${S['cover.s1t']}</div></div>
      <div class="cv-stat"><div class="n blue">${S['cover.s2n']}</div><div class="t">${S['cover.s2t']}</div></div>
      <div class="cv-stat"><div class="n">${S['cover.s3n']}</div><div class="t">${S['cover.s3t']}</div></div></div></div>
    <div class="cv-toc"><b>${S['cover.contents']}</b><span>${S['cover.toc']}</span></div></article>`;

  /* 1 */
  const p1rows = data.groups.map((g) => g.refs.map((r, i) => `
  <tr class="${i === 0 ? 'g-first' : ''}">${i === 0 ? `<td class="cls" rowspan="${g.refs.length}"><span>${S[GROUP_KEY[g.label]]}</span></td>` : ''}<td class="ref">${r.name}</td><td class="gwp">${gwpTxt(r.gwp, r.natural)}</td>
    ${COLS.slice(0, 4).map((c) => `<td>${cell(lastYear(c.id, r.gwp, r.natural), c.id === 'split_le12' && !r.natural && r.gwp >= 750 ? '¹' : '')}</td>`).join('')}<td></td>
    ${COLS.slice(4).map((c) => `<td>${cell(lastYear(c.id, r.gwp, r.natural))}</td>`).join('')}</tr>`).join('')).join('');
  const p1 = page(2, {
    kicker: S['p1.kicker'], title: S['p1.title'], dek: T('p1.dek'),
    body: `<div class="row-between"><span class="hint">${S['p1.hint']}</span>${legendCells}</div>
  <table class="mx"><colgroup><col style="width:92px"><col style="width:78px"><col style="width:66px"><col><col><col><col><col style="width:14px"><col><col><col></colgroup>
    <thead><tr class="seg"><th colspan="3"></th><th class="res" colspan="4">${S['seg.res']}</th><th></th><th class="com" colspan="3">${S['seg.com']}</th></tr>
    <tr><th class="l">${S['p1.thClass']}</th><th class="l">${S['p1.thRef']}</th><th style="text-align:right;padding-right:14px">GWP</th>
      ${COLS.slice(0, 4).map((c) => `<th><span class="cp">${c.cap}</span>${S[c.typ]}</th>`).join('')}<th></th>
      ${COLS.slice(4).map((c) => `<th><span class="cp">${c.cap}</span>${S[c.typ]}</th>`).join('')}</tr></thead>
    <tbody>${p1rows}</tbody></table>
  <div class="nat">${['DE', 'GB', 'FR', 'PL', 'IT'].map((c) => `<div><img src="${FLAG[c]}" alt=""><span class="cn">${S['nat.' + c]}</span><span class="tx">${S['natShort.' + c]}</span></div>`).join('')}</div>`,
    sources: [S['src.reg']], note: S['p1.note'],
  });

  /* 2 */
  const Y0 = 2025, SPAN = 12, x = (y) => ((y - Y0) / SPAN) * 100;
  const KINDS = [{ k: 'k-hi', gwp: 2088 }, { k: 'k-mid', gwp: 675 }, { k: 'k-low', gwp: 146 }, { k: 'k-nat', natural: true }];
  const lane = (col, kd) => {
    const y = lastYear(col, kd.gwp ?? 0, kd.natural);
    if (y != null && y <= 2024) return `<div class="lane"><span style="position:absolute;left:0;top:50%;transform:translateY(-50%);font-size:9.5px;font-weight:700;color:var(--muted)">${S['p2.bannedSince']}</span></div>`;
    if (y == null) return `<div class="lane"><div class="bar open ${kd.k}" style="width:100%"></div></div>`;
    return `<div class="lane"><div class="bar ${kd.k}" style="width:${x(y + 1)}%"><span class="yl">${y}</span></div></div>`;
  };
  const tlRows = (seg) => COLS.filter((c) => c.seg === seg).map((c) => ({
    l: `<div class="tl-row-l"><span class="cp">${c.cap}</span><span class="typ">${S[c.typ]}</span></div>`,
    c: `<div class="tl-row-c">${KINDS.map((k) => lane(c.id, k)).join('')}</div>`,
  }));
  const tr = tlRows('res'), tc = tlRows('com');
  const keys = [['var(--ink)', 'p2.keyHigh', 'p2.keyHighRefs'], ['var(--red)', 'p2.keyMid', 'p2.keyMidRefs'], ['var(--red-mid)', 'p2.keyLow', 'p2.keyLowRefs'], ['var(--blue)', 'p2.keyNat', 'p2.keyNatRefs']];
  const p2 = page(3, {
    kicker: S['p2.kicker'], title: S['p2.title'], dek: S['p2.dek'],
    body: `<div class="tl">
    <div><div style="height:32px"></div><div class="tl-grp">${S['seg.res']}</div>${tr.map((r) => r.l).join('')}<div class="tl-grp">${S['seg.com']}</div>${tc.map((r) => r.l).join('')}</div>
    <div style="position:relative;min-width:0"><div style="height:14px"></div><div class="tl-years">${Array.from({ length: SPAN }, (_, i) => `<span>${Y0 + i}</span>`).join('')}</div>
      <div style="position:relative"><div class="tl-grp" style="border-bottom-color:transparent"></div>${tr.map((r) => r.c).join('')}<div class="tl-grp" style="border-bottom-color:transparent"></div>${tc.map((r) => r.c).join('')}
        <div class="vline today" style="left:${x(2026 + 9.7 / 12)}%"></div><span class="vlabel l" style="left:${x(2026 + 9.7 / 12)}%;color:var(--blue)">${S['p2.today']}</span>
        <div class="vline" style="left:${x(2027)}%"></div><span class="vlabel" style="left:${x(2027)}%">${S['p2.firstBan']}</span></div></div>
    <div class="tl-key">${keys.map(([c, l, r]) => `<div class="key-item"><i class="sw" style="background:${c}"></i><span class="kt">${S[l]}</span><span class="kr">${S[r]}</span></div>`).join('')}</div></div>`,
    sources: [S['src.reg']], note: T('p2.note'),
  });

  /* 3 */
  const YEARS = Array.from({ length: 11 }, (_, i) => 2025 + i);
  const oxTable = (seg, groups) => {
    const cols = COLS.filter((c) => c.seg === seg);
    const rows = groups.map(([label, list]) => `<tr class="gl"><td colspan="${YEARS.length + 1}">${S[GROUP_KEY[label]]}</td></tr>` + list.map(([name, gwp, natural]) => {
      const r = { gwp, natural }; let wasOpen = true;
      return `<tr><td class="nmc"><span class="nm">${name}</span><span class="gv">${gwpTxt(gwp, natural)}</span></td>${YEARS.map((y) => {
        const n = cols.filter((c) => openAt(c.id, r, y)).length;
        const st = n === cols.length ? 'O' : n === 0 ? 'X' : 'P';
        const first = st === 'X' && wasOpen; wasOpen = st !== 'X';
        return `<td class="${st}${first ? ' first' : ''}">${st === 'O' ? '○' : st === 'X' ? '×' : '△'}</td>`; }).join('')}</tr>`; }).join('')).join('');
    return `<table class="ox"><colgroup><col style="width:112px">${YEARS.map(() => '<col>').join('')}</colgroup>
    <thead><tr><th style="text-align:left;font-weight:600;color:var(--muted)">${S['p3.thRef']}</th>${YEARS.map((y) => `<th class="${y === 2027 ? 'yr27' : ''}">${y}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
  };
  const P = `<span class="sym" style="background:#fff1dc;color:#9a5b00">△</span>`, O = `<span class="sym" style="background:var(--blue-tint);color:var(--blue)">○</span>`;
  const p3 = page(4, {
    kicker: S['p3.kicker'], title: S['p3.title'], dek: S['p3.dek'],
    body: `<div class="oxwrap">
    <div style="min-width:0"><div class="oxh"><b>${S['p3.resHead']}</b><span>${S['p3.resSub']}</span></div>${oxTable('res', data.ox.res)}
      <p class="oxnote">${P}${S['p3.resNote']}</p><p class="oxnote">${O}${S['p3.natNote']}</p></div>
    <div style="min-width:0"><div class="oxh"><b>${S['p3.comHead']}</b><span>${S['p3.comSub']}</span></div>${oxTable('com', data.ox.com)}
      <p class="oxnote">${P}${S['p3.comNote']}</p></div></div>`,
    sources: [S['src.reg']], note: T('p3.note'),
  });

  /* 4 */
  const E = (k, c = 'ban') => `<span class="ev ${c}">${S[k]}</span>`;
  const MS = [
    { y: 2025, c: [[2, E('ev.2025split')], [1, ''], [1, ''], [1, E('ev.2025quota', 'q')]] },
    { y: 2026, c: [[1, ''], [1, ''], [1, ''], [1, ''], [1, E('ev.2026serv', 'q')]] },
    { y: 2027, hot: true, c: [[1, E('ev.2027le12', 'ban full')], [1, E('ev.2027mono', 'ban full')], [1, E('ev.2027mono', 'ban full')], [1, E('ev.2027chill')], [1, E('ev.2027quota', 'q')]] },
    { y: 2029, c: [[1, E('ev.2029aa')], [3, E('ev.2029split')], [1, '']] },
    { y: 2030, c: [[1, ''], [1, ''], [1, ''], [1, E('ev.2030mono')], [1, E('ev.2030quota', 'q')]] },
    { y: 2032, c: [[1, E('ev.2032mono', 'ban full')], [1, ''], [1, ''], [1, ''], [1, E('ev.2032serv', 'q')]] },
    { y: 2033, c: [[1, ''], [3, E('ev.2033split')], [1, E('ev.2033quota', 'q')]] },
    { y: 2035, c: [[1, E('ev.2035split', 'ban full')], [1, ''], [1, ''], [1, ''], [1, '']] },
    { y: 2050, c: [[1, ''], [1, ''], [1, ''], [1, ''], [1, E('ev.2050quota', 'q')]] },
  ];
  const p4 = page(5, {
    kicker: S['p4.kicker'], title: S['p4.title'], dek: S['p4.dek'],
    body: `<div class="row-between"><span class="hint">${S['p4.hint']}</span>
    <div class="legend"><span class="lg"><i class="sw" style="background:var(--red)"></i>${S['p4.legFull']}</span><span class="lg"><i class="sw" style="background:var(--red-tint)"></i>${S['p4.legPart']}</span><span class="lg"><i class="sw" style="background:var(--parchment)"></i>${S['p4.legQuota']}</span></div></div>
  <table class="ms"><colgroup><col style="width:84px"><col><col><col><col><col style="width:220px"></colgroup>
    <thead><tr class="seg"><th class="blank"></th><th colspan="2">${S['seg.res']}</th><th colspan="2">${S['seg.com']}</th><th>${S['p4.thAll']}</th></tr>
    <tr><th>${S['p4.thDate']}</th><th><span class="cp">≤ 12 kW</span></th><th><span class="cp">12–23 kW</span></th><th><span class="cp">23–50 kW</span></th><th><span class="cp">> 50 kW</span></th><th><span class="cp">${S['p4.thQuota']}</span></th></tr></thead>
    <tbody>${MS.map((m) => `<tr><td class="y${m.hot ? ' hot' : ''}">${m.y}</td>${m.c.map(([span, v]) => `<td${span > 1 ? ` colspan="${span}"` : ''}>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
    sources: [S['src.reg'], S['src.quota']], note: S['ui.stock'],
  });

  /* 5 */
  const CLS = [{ l: S['cls.high'], gwp: 2088 }, { l: S['cls.mid'], gwp: 675 }, { l: S['p5.rowLow'], gwp: 146 }, { l: S['cls.natural'], natural: true }];
  const SNAPS = [{ y: 2027, prev: 2026, f: 'p5.f2027' }, { y: 2030, prev: 2027, f: 'p5.f2030' }, { y: 2035, prev: 2030, f: 'p5.f2035' }];
  const snap = (s) => {
    let open = 0;
    const rows = CLS.map((k) => `<tr><td class="rl">${k.l}</td>${COLS.map((c) => {
      const ok = openAt(c.id, k, s.y); if (ok) open++;
      const newly = !ok && openAt(c.id, k, s.prev);
      return `<td class="${ok ? 'ok' : 'no' + (newly ? ' newly' : '')}">${ok ? '✓' : '×'}</td>`; }).join('')}</tr>`).join('');
    return `<div class="snap"><div class="snap-h"><span class="d">${T('p5.date', { y: s.y })}</span><span class="n">${T('p5.open', { n: open })}</span></div>
    <table class="sg"><colgroup><col style="width:72px">${COLS.map(() => '<col>').join('')}</colgroup>
      <thead><tr><th></th><th class="grp" colspan="4">${S['seg.resShort']}</th><th class="grp" colspan="3">${S['seg.comShort']}</th></tr>
      <tr><th></th>${COLS.map((c) => `<th class="ic ${c.k}">${c.k === 'm' ? ICON_M : ICON_S}<span>${c.c}</span></th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
    <p class="snap-f" style="margin:0">${S[s.f]}</p></div>`;
  };
  const p5 = page(6, {
    kicker: S['p5.kicker'], title: S['p5.title'], dek: S['p5.dek'],
    body: `<div class="snaps">${SNAPS.map(snap).join('')}</div>
  <div class="lower">
    <table class="ct"><colgroup><col style="width:112px"><col><col style="width:160px"></colgroup>
      <thead><tr><th>${S['p5.ctClass']}</th><th>${S['p5.ctRefs']}</th><th>${S['p5.ctFgas']}</th></tr></thead>
      <tbody>
        <tr><td class="k">${S['cls.high']}</td><td>R410A ${nf(2088)} · R407C ${nf(1774)} · R134a ${nf(1430)}</td><td><span class="tag t-yes">${S['p5.tagHfc']}</span></td></tr>
        <tr><td class="k">${S['cls.mid']}</td><td>R32 675 · R452B 697 · R513A 630 · R454B 465</td><td><span class="tag t-yes">${S['p5.tagBlend']}</span></td></tr>
        <tr><td class="k">${S['cls.low']}</td><td>R454C 146 · R1234ze(E) 1 · R1234yf &lt; 1</td><td><span class="tag t-yes">${S['p5.tagHfo']}</span></td></tr>
        <tr><td class="k">${S['cls.natural']}</td><td>${S['p5.ctNatRefs']}</td><td><span class="tag t-no">${S['p5.tagNo']}</span></td></tr></tbody></table>
    <div class="legend-box">
      <div class="lr"><span class="ib m">${ICON_M}</span><span>${S['p5.mono']}</span></div>
      <div class="lr"><span class="ib s">${ICON_S}</span><span>${S['p5.split']}</span></div>
      <div class="legend"><span class="lg"><i class="sw" style="background:var(--blue-tint)"></i>${S['p5.legOpen']}</span><span class="lg"><i class="sw" style="background:var(--red)"></i>${S['p5.legNew']}</span><span class="lg"><i class="sw" style="background:var(--ink)"></i>${S['p5.legOld']}</span></div>
      <span style="font-size:10.5px;color:var(--muted)">${S['p5.units']}</span></div></div>
  <div class="callout blue slim"><span class="big2" style="color:var(--blue)">${(Math.round((100 * sh.res.nat) / sh.res.total) / 100).toLocaleString(loc, { style: 'percent' })}</span><span class="t">${S['p5.callout']}</span></div>`,
    sources: [S['src.reg'], S['src.db']], note: S['ui.stock'],
  });

  /* 6 */
  const tagY = (y) => y == null ? `<span class="tag t-open">${S['p6.noEnd']}</span>` : y <= 2024 ? `<span class="tag t-ink">${S['p6.legBanned']}</span>` : y === 2026 ? `<span class="tag t-red">${T('cell.until', { y })}</span>` : `<span class="tag t-soft">${T('cell.until', { y })}</span>`;
  const sTag = (s) => `<span class="tag ${s === 'A3' ? 't-a3' : s === 'A2L' ? 't-a2l' : 't-a1'}">${s}</span>`;
  const PP_COLS = [['mono_le12', 'p6.colMonoLe12'], ['split_le12', 'p6.colSplitLe12'], ['mono_23_50', 'p6.colMono1250'], ['split_gt23', 'p6.colSplitGt12'], ['mono_gt50', 'p6.colMonoGt50']];
  const p6 = page(7, {
    kicker: S['p6.kicker'], title: S['p6.title'], dek: S['p6.dek'],
    body: `<div class="ppleg"><b>${S['p6.legLabel']}</b><span class="tag t-ink">${S['p6.legBanned']}</span><span class="tag t-red">${S['p6.legUntil2026']}</span>${S['p6.legThisYear']}<span class="tag t-soft">${S['p6.legUntil2029']}</span>${S['p6.legLater']}<span class="tag t-open">${S['p6.legNoEnd']}</span>${S['p6.legFuture']}</div>
  <table class="pp"><colgroup><col style="width:176px"><col style="width:60px"><col style="width:70px"><col style="width:156px">${PP_COLS.map(() => '<col>').join('')}<col style="width:118px"></colgroup>
    <thead><tr><th colspan="4" style="border-bottom:0"></th><th class="grp" colspan="5"><span>${S['p6.grp']}</span></th><th style="border-bottom:0"></th></tr>
    <tr><th style="padding-left:0">${S['p6.thRef']}</th><th style="text-align:right">GWP</th><th>${S['p6.thSafety']}</th><th>${S['p6.thPfas']}</th>${PP_COLS.map(([, l]) => `<th>${S[l]}</th>`).join('')}<th>${S['p6.thBeg']}</th></tr></thead>
    <tbody>${refs.map((r) => { const p = data.passport[r.name]; return `<tr><td class="rf">${r.name} <span style="font-size:10.5px;font-weight:500;color:var(--muted)">${S[KIND_KEY[p.kind]]}</span></td>
      <td class="num">${gwpTxt(r.gwp, r.natural)}</td><td>${sTag(p.safety)}</td>
      <td>${p.pfas === 'No' ? `<span class="tag t-no">${S['p6.no']}</span>` : `<span class="tag t-yes">${S['p6.yes']}</span> <span style="font-size:10.5px;color:var(--muted)">${p.pfas.replace('Yes · ', '').replace('Yes', '')}</span>`}</td>
      ${PP_COLS.map(([c]) => `<td>${tagY(lastYear(c, r.gwp, r.natural))}</td>`).join('')}
      <td>${r.natural ? `<span class="tag t-no">${S['p6.funded']}</span>` : `<span class="tag t-yes">${S['p6.notFunded']}</span>`}</td></tr>`; }).join('')}</tbody></table>
  <div class="ppnotes"><span>${S['p6.nGwp']}</span><span>${S['p6.nSafety']}</span><span>${S['p6.nPfas']}</span></div>`,
    sources: [S['src.reg'], S['src.iso'], 'BAnz AT 27.08.2026 B1'], note: S['p6.note'],
  });

  /* 7 */
  const p7 = page(8, {
    kicker: S['p7.kicker'], title: S['p7.title'], dek: S['p7.dek'],
    body: `<div class="pills">${data.pills.map((n) => `
      <div class="pillc${n.cc === 'DE' ? ' neg' : ''}">
        <div class="top"><img src="${FLAG[n.cc]}" alt=""><span class="cn">${S['nat.' + n.cc]}</span><span class="pill ${n.eu ? 'eu' : 'own'}">${n.eu ? S['p7.euDates'] : S['p7.own']}</span></div>
        <div class="sec"><span class="k">${S['p7.ban']}</span><span class="v">${S[`pill.${n.cc}.ban`]}</span></div>
        <div class="sec"><span class="k">${S['p7.inst']}</span><span class="v">${S[`pill.${n.cc}.inst`]}</span></div>
        <div class="sub"><span class="k">${S['p7.sub']}</span><span class="h">${S[`pill.${n.cc}.head`]}</span><span class="d">${S[`pill.${n.cc}.sub`]}</span></div></div>`).join('')}</div>
    <div class="callout slim"><span class="big2">${(0.56).toLocaleString(loc, { style: 'percent' })}</span><span class="t">${S['p7.callout']}</span></div>`,
    sources: ['BAnz AT 27.08.2026 B1', 'gov.uk F-gas bans', 'CEE BAR-TH-171', 'Czyste Powietrze', 'DM 7 Aug 2025'], note: S['p7.note'],
  });

  return { strings: S, pages: [cover, p1, p2, p3, p4, p5, p6, p7] };
}

export { LANGS, render, LOGO_DARK };
