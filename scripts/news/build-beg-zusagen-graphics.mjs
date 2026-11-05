#!/usr/bin/env node
/**
 * build-beg-zusagen-graphics.mjs — the three infographics of the DE article on
 * the monthly BEG heating-subsidy approvals (owner request 2026-11-05).
 *
 * Every figure below is copied from a primary source and asserted against that
 * source's own printed totals, so a mistyped month fails the build instead of
 * reaching a chart:
 *   - BEG Heizungsförderung statistics, 01.01.2026–30.09.2026 (BMWE/energiewechsel.de)
 *   - BDH press release 2026-08-11 (heating-market sales, January–June 2026)
 *
 * Static images have no hover layer, so bars carry their value labels. The
 * monthly and cumulative series are two charts, never one chart with two axes.
 * Layout: the monthly Special Report page, rendered from that report's own
 * pages.css and logo (owner 2026-11-06: news graphics must match the report, not
 * look like presentation slides). Nothing here redraws the brand.
 *
 * Run: node scripts/news/build-beg-zusagen-graphics.mjs
 * Out: public/news-images/de-beg-zusagen-2026-09-{monate,laender,einordnung}[-en].webp
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const W = 1672, H = 941;
const PAGE_W = 1280, PAGE_H = 720; // the report's own page size

/* ── Source data ───────────────────────────────────────────────────────── */
const ZUSAGEN = [23478, 28826, 36596, 34939, 36626, 42499, 47340, 45936, 38314];
const WP = [21238, 25929, 33141, 31899, 33482, 39083, 43984, 43013, 36074];
const LAENDER = [
  ['Nordrhein-Westfalen', 'North Rhine-Westphalia', 87940],
  ['Baden-Württemberg', 'Baden-Württemberg', 63709],
  ['Bayern', 'Bavaria', 63496],
  ['Niedersachsen', 'Lower Saxony', 47382],
  ['Hessen', 'Hesse', 34004],
  ['Rheinland-Pfalz', 'Rhineland-Palatinate', 27002],
  ['Schleswig-Holstein', 'Schleswig-Holstein', 17720],
  ['Sachsen', 'Saxony', 11509],
  ['Brandenburg', 'Brandenburg', 10441],
  ['Saarland', 'Saarland', 7530],
  ['Sachsen-Anhalt', 'Saxony-Anhalt', 7320],
  ['Thüringen', 'Thuringia', 7270],
  ['Berlin', 'Berlin', 5216],
  ['Mecklenburg-Vorpommern', 'Mecklenburg-Vorpommern', 5023],
  ['Hamburg', 'Hamburg', 4367],
  ['Bremen', 'Bremen', 2217],
];
const sum = (a) => a.reduce((s, v) => s + v, 0);
const assertEq = (name, got, want) => {
  if (got !== want) throw new Error(`${name}: ${got} ≠ source total ${want}`);
};
assertEq('Zusagen', sum(ZUSAGEN), 334554);
assertEq('Wärmepumpen', sum(WP), 307843);
assertEq('Länder', sum(LAENDER.map((l) => l[2])), 402146);
const BDH = { total: 352000, wp: 194500, gas: 134000, biomasse: 14000, oel: 9500 };
assertEq('BDH', BDH.wp + BDH.gas + BDH.biomasse + BDH.oel, BDH.total);

const CUM = ZUSAGEN.reduce((a, v) => [...a, (a.at(-1) ?? 0) + v], []);
const qAvg = (i) => Math.round(sum(ZUSAGEN.slice(i, i + 3)) / 3);
const TOP3 = sum(LAENDER.slice(0, 3).map((l) => l[2]));

/* ── Copy ──────────────────────────────────────────────────────────────── */
const T = {
  de: {
    months: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep'],
    a: {
      title: 'Heizungsförderung 2026: Zusagen im Jahresverlauf',
      sub: 'BEG-Heizungsförderung der KfW · Wohn- und Nichtwohngebäude · Stand 30. September 2026',
      banner: '<b>334.554 Zusagen</b> bis Ende September: Trotz Rückgang im September liegt der Quartalsschnitt <b>weiter im Aufwärtstrend</b>.',
      monthly: 'Zusagen pro Monat', cum: 'Zusagen kumuliert seit Januar',
      q: (n, v) => `${n}. Quartal: Ø ${v}`, peak: 'Jahreshoch',
      alert: ['Zusage ≠ Einbau', 'Gezählt werden bewilligte Förderanträge, nicht installierte Anlagen.'],
      tiles: [
        ['92 %', 'der Zusagen entfallen auf Wärmepumpen (307.843)'],
        ['≈ +35 %', '1. Halbjahr: 202.964 Zusagen ggü. rund 150.000 im 1. Halbjahr 2025'],
      ],
    },
    b: {
      title: 'Zusagen nach Bundesland',
      sub: 'BEG-Heizungsförderung · Wohngebäude, inkl. Zusatzanträge · 01.01.–30.09.2026',
      banner: '<b>Drei Länder stehen für mehr als die Hälfte</b> aller Zusagen für Wohngebäude.',
      name: 0, top: 'Top 3 zusammen', ofAll: 'der 402.146 Zusagen',
      rest: 'übrige 13 Länder',
      closeT: 'Enges Rennen um Platz 2', close: 'Baden-Württemberg liegt nur 213 Zusagen vor Bayern.',
      nwgT: 'Nicht enthalten', nwg: '6.806 Zusagen für Nichtwohngebäude werden in der Quelle gesondert ausgewiesen.',
      noteT: 'So lesen Sie die Grafik',
      note: 'Absolute Zahlen: Die drei Spitzenreiter sind zugleich die bevölkerungsreichsten Länder. Die Rangfolge ist keine Aussage über die Wärmepumpen-Dichte pro Kopf. Es handelt sich um Zusagen, nicht um installierte Anlagen.',
    },
    c: {
      title: 'Was die Zahlen aussagen – und was nicht',
      sub: 'Einordnung · BEG-Heizungsförderung',
      banner: '<b>Zusage ist nicht gleich Einbau</b> · 92 % im Förderprogramm, 55 % im Gesamtmarkt',
      steps: [
        ['Antrag', 'vor Beginn des Vorhabens, im Portal „Meine KfW“'],
        ['Zusage', 'KfW bewilligt den Zuschuss'],
        ['Einbau', 'Abschluss innerhalb von 36 Monaten ab Zusage'],
        ['Nachweis', 'danach zahlt die KfW den Zuschuss aus'],
      ],
      here: 'Hier zählt diese Statistik',
      shareT: 'Anteil der Wärmepumpe: zwei verschiedene Messgrößen',
      bar1: 'Förderzusagen', bar1s: 'Januar–September 2026 · 334.554 Zusagen',
      bar2: 'Heizungsabsatz gesamt', bar2s: 'Januar–Juni 2026 · 352.000 Geräte (BDH)',
      wp: 'Wärmepumpe', other: 'Sonstige', gas: 'Gas', bio: 'Biomasse', oil: 'Öl',
      why: 'Gas- und Ölheizungen werden im Programm nicht gefördert (Ausnahme: wasserstofffähige Heizungen). Im geförderten Heizungstausch ist die Richtung weitgehend entschieden; im Gesamtmarkt bleibt Gas mit 38 % relevant.',
      trendT: 'Wärmepumpen-Anteil an den Zusagen je Monat', r4: 'Emissionsminderungszuschlag', r4v: '921 → 0', r4s: 'Juli → September (entfallen)',
      reformT: 'Nach der Reform vom 21. Juli',
      r1: 'Einkommensbonus', r1v: '5.858 → 15.944', r1s: 'Januar → September',
      r2: 'Effizienzbonus', r2v: '18.767 → 0', r2s: 'Juli → September (entfallen)',
      r3: 'Klima-Geschwindigkeitsbonus', r3v: '27.945', r3s: 'im September',
    },
    sourcesLabel: 'QUELLEN', brandline: 'Marktdaten',
    source: {
      a: { chips: ['BEG Heizungsförderung 01.01.–30.09.2026 (BMWE)', 'Solarserver/BMWE: 1. Hj. 2025'], note: 'Monatswerte sind Stichtagszahlen und können sich ändern.' },
      b: { chips: ['BEG Heizungsförderung 01.01.–30.09.2026 (BMWE)'], note: 'Anträge mit uneindeutigen Daten werden in der Quelle nicht ausgewiesen.' },
      c: { chips: ['BEG Heizungsförderung (BMWE)', 'KfW 458', 'BDH 11.08.2026'], note: 'Anteile gerundet; Absatz und Zusagen nicht direkt vergleichbar. Boni inkl. Zusatzanträge.' },
    },
  },
  en: {
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
    a: {
      title: 'German Heating Subsidy 2026: Approvals Through the Year',
      sub: 'KfW BEG heating subsidy · residential and non-residential · as of 30 September 2026',
      banner: '<b>334,554 approvals</b> to the end of September: despite a dip in September, the quarterly average <b>remains on an upward trend</b>.',
      monthly: 'Approvals per month', cum: 'Cumulative approvals since January',
      q: (n, v) => `Q${n}: avg. ${v}`, peak: 'Year high',
      alert: ['Approval ≠ installation', 'This counts approved grant applications, not installed systems.'],
      tiles: [
        ['92%', 'of approvals are for heat pumps (307,843)'],
        ['≈ +35%', 'H1: 202,964 approvals vs. around 150,000 in H1 2025'],
      ],
    },
    b: {
      title: 'Approvals by Federal State',
      sub: 'BEG heating subsidy · residential, incl. additional applications · 1 Jan–30 Sep 2026',
      banner: '<b>Three states account for more than half</b> of all residential approvals.',
      name: 1, top: 'Top 3 combined', ofAll: 'of 402,146 approvals',
      rest: 'other 13 states',
      closeT: 'A close race for second', close: 'Baden-Württemberg is just 213 approvals ahead of Bavaria.',
      nwgT: 'Not included', nwg: 'The source reports 6,806 approvals for non-residential buildings separately.',
      noteT: 'How to read this chart',
      note: 'Absolute figures: the top three are also Germany’s most populous states. The ranking says nothing about heat-pump density per capita. These are approvals, not installed systems.',
    },
    c: {
      title: 'What the Numbers Say — and What They Don’t',
      sub: 'In context · BEG heating subsidy',
      banner: '<b>Approval is not installation</b> · 92% in the subsidy programme, 55% in the total market',
      steps: [
        ['Application', 'before the project starts, in the “Meine KfW” portal'],
        ['Approval', 'KfW approves the grant'],
        ['Installation', 'to be completed within 36 months of approval'],
        ['Proof', 'KfW then pays out the grant'],
      ],
      here: 'This is what the statistics count',
      shareT: 'Heat-pump share: two different measures',
      bar1: 'Subsidy approvals', bar1s: 'January–September 2026 · 334,554 approvals',
      bar2: 'Total heating sales', bar2s: 'January–June 2026 · 352,000 units (BDH)',
      wp: 'Heat pump', other: 'Other', gas: 'Gas', bio: 'Biomass', oil: 'Oil',
      why: 'Gas and oil heating are not funded by the programme (exception: hydrogen-ready systems). In subsidised replacement the direction is largely decided; in the total market gas remains relevant at 38%.',
      trendT: 'Heat-pump share of approvals per month', r4: 'Emission-reduction surcharge', r4v: '921 → 0', r4s: 'July → September (abolished)',
      reformT: 'After the 21 July reform',
      r1: 'Income bonus', r1v: '5,858 → 15,944', r1s: 'January → September',
      r2: 'Efficiency bonus', r2v: '18,767 → 0', r2s: 'July → September (abolished)',
      r3: 'Climate speed bonus', r3v: '27,945', r3s: 'in September',
    },
    sourcesLabel: 'SOURCES', brandline: 'Market Data',
    source: {
      a: { chips: ['BEG Heizungsförderung 1 Jan–30 Sep 2026 (BMWE)', 'Solarserver/BMWE: H1 2025'], note: 'Monthly values are snapshots and may be revised.' },
      b: { chips: ['BEG Heizungsförderung 1 Jan–30 Sep 2026 (BMWE)'], note: 'Applications with ambiguous data are not shown in the source.' },
      c: { chips: ['BEG Heizungsförderung (BMWE)', 'KfW 458', 'BDH 11 Aug 2026'], note: 'Shares rounded; sales and approvals not directly comparable. Bonuses incl. additional applications.' },
    },
  },
};

/* ── Rendering: the Special Report page, from its own stylesheet ───────────
   pages.css is the report's source of truth, so the shell (rail, kicker, title,
   dek, footer, tokens) cannot drift from the monthly report. Only charts are
   drawn here, and they use the report's tokens. */
const REPORT = join(ROOT, 'data_sources', 'special_report', '2026-10', 'source');
const REPORT_CSS = readFileSync(join(REPORT, 'pages.css'), 'utf8');
const LOGO = `data:image/svg+xml;base64,${readFileSync(join(REPORT, 'assets', 'logo-dark.svg')).toString('base64')}`;
// The official Germany edition icon, never redrawn. Same size as the country icon in the report's page header.
const DE_ICON = `data:image/png;base64,${readFileSync(join(ROOT, 'public', 'icons', 'de-512.png')).toString('base64')}`;
const INK = '#1d1d1f', INK2 = '#44556e', MUTED = '#7d8ca2', HAIR = '#e3e7ee', HAIR2 = '#eef1f5';
const BLUE = '#0066cc', BLUE_MID = '#9cc3ec', BLUE_TINT = '#e8f1fb', RED = '#e0452c', RED_TINT = '#fdece8', RED_INK = '#b3321c', OTHER = '#8a94a3';
const fmt = (lang) => (v) => new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-GB').format(v);
const pct = (lang, v, d = 1) => new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
const unit = (lang) => (lang === 'de' ? ' %' : '%');

const frame = (lang, key, n, inner) => {
  const t = T[lang][key], src = T[lang].source[key];
  return `<!doctype html><html lang="${lang}"><meta charset="utf-8">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
  <style>${REPORT_CSS}
  html,body{margin:0;padding:0;background:#fff;width:${PAGE_W}px;height:${PAGE_H}px;overflow:hidden}
  .page{border-radius:0;color:${INK}}
  .pb{min-height:0}
  .sec{font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${INK};padding-bottom:5px;border-bottom:2px solid ${INK}}
  .pf .chip{font-size:10px}
  .market-icon{position:absolute;right:44px;top:48px;width:52px;height:52px;border-radius:14px;display:block;box-shadow:0 8px 18px rgba(8,25,51,.12)}
  svg text{font-family:var(--font);font-variant-numeric:tabular-nums}
  </style><body>
  <article class="page">
    <header class="ph"><span class="kicker">${t.sub}</span><span class="pageno">${n} / 3</span>
      <h3 class="title">${t.title}</h3><p class="dek">${t.banner}</p></header>
    <img class="market-icon" src="${DE_ICON}" alt="HeatPump DB ${lang === 'de' ? 'Deutschland' : 'Germany'}">
    <div class="pb">${inner}</div>
    <footer class="pf"><span class="sl">${T[lang].sourcesLabel}</span>${src.chips.map((c) => `<span class="chip">${c}</span>`).join('')}
      <span class="note">${src.note}</span>
      <span class="brand"><span class="badge"><img src="${LOGO}" alt=""></span><span>HeatPump DataBase Europe · <b>${T[lang].brandline}</b> · 11/2026</span></span></footer>
  </article></body></html>`;
};

const barTop = (x, y, w, base, r = 3) => {
  const rr = Math.min(r, base - y);
  return `M${x},${base}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${base}Z`;
};

/* ── A: monthly flow + cumulative (two charts, one axis each) ───────────── */
function graphicA(lang) {
  const t = T[lang].a, f = fmt(lang), m = T[lang].months;
  const CW = 690, CH = 408, top = 64, base = CH - 22, left = 2, right = CW - 2;
  const y = (v) => base - (v / 50000) * (base - top);
  const step = (right - left) / 9, bw = step - 8;
  const grid = [25000, 50000].map((g) => `<line x1="${left}" x2="${right}" y1="${y(g)}" y2="${y(g)}" stroke="${HAIR2}"/>`).join('');
  const bars = ZUSAGEN.map((v, i) => {
    const x = left + i * step + 4, peak = v === Math.max(...ZUSAGEN);
    return `<path d="${barTop(x, y(v), bw, base)}" fill="${peak ? INK : BLUE}"/>
      <text x="${x + bw / 2}" y="${y(v) - 6}" text-anchor="middle" font-size="12.5" font-weight="700" fill="${INK}">${f(v)}</text>
      ${peak ? `<text x="${x + bw / 2}" y="${y(v) - 21}" text-anchor="middle" font-size="10" font-weight="700" letter-spacing=".04em" fill="${RED_INK}">${t.peak}</text>` : ''}
      <text x="${x + bw / 2}" y="${base + 16}" text-anchor="middle" font-size="11.5" fill="${INK2}">${m[i]}</text>`;
  }).join('');
  const quarters = [0, 3, 6].map((s, q) => {
    const x1 = left + s * step + 4, x2 = left + (s + 3) * step - 4;
    return `<text x="${(x1 + x2) / 2}" y="13" text-anchor="middle" font-size="12" font-weight="700" fill="${INK}">${t.q(q + 1, f(qAvg(s)))}</text>
      <line x1="${x1}" x2="${x2}" y1="20" y2="20" stroke="${INK}" stroke-width="1"/>`;
  }).join('');
  const LW = 470, lTop = 22, lBase = CH - 22, lLeft = 16, lRight = LW - 16;
  const lx = (i) => lLeft + (i / 8) * (lRight - lLeft), ly = (v) => lBase - (v / 350000) * (lBase - lTop);
  const pts = CUM.map((v, i) => `${lx(i)},${ly(v)}`).join(' ');
  const area = `M${lx(0)},${lBase}L${pts.split(' ').join('L')}L${lx(8)},${lBase}Z`;
  const marks = [2, 5, 8].map((i) => `<circle cx="${lx(i)}" cy="${ly(CUM[i])}" r="4.5" fill="${BLUE}" stroke="#fff" stroke-width="1.5"/>
    <text x="${lx(i) - 8}" y="${ly(CUM[i]) - 8}" text-anchor="end" font-size="${i === 8 ? 19 : 13.5}" font-weight="800" fill="${INK}">${f(CUM[i])}</text>`).join('');
  const lGrid = [175000, 350000].map((g) => `<line x1="${lLeft}" x2="${lRight}" y1="${ly(g)}" y2="${ly(g)}" stroke="${HAIR2}"/>`).join('');
  const lLabels = CUM.map((_, i) => `<text x="${lx(i)}" y="${lBase + 16}" text-anchor="middle" font-size="11.5" fill="${INK2}">${m[i]}</text>`).join('');
  const base2 = (x1, x2, yy) => `<line x1="${x1}" x2="${x2}" y1="${yy}" y2="${yy}" stroke="${INK}"/>`;
  const stat = ([big, txt]) => `<div style="flex:1;display:flex;align-items:center;gap:12px;padding:0 18px;border-left:1px solid ${HAIR};min-width:0">
    <div style="font-size:32px;font-weight:800;letter-spacing:-.04em;color:${RED};white-space:nowrap;line-height:1">${big}</div>
    <div style="font-size:12px;line-height:1.35;color:#333">${txt}</div></div>`;
  const alert = t.alert;
  return frame(lang, 'a', 1, `<div style="flex:1;display:grid;grid-template-columns:${CW}fr ${LW}fr;gap:0 26px;min-height:0">
      <div style="display:flex;flex-direction:column;min-height:0"><div class="sec">${t.monthly}</div>
        <svg viewBox="0 0 ${CW} ${CH}" style="width:100%;flex:1;min-height:0;margin-top:8px">${quarters}${grid}${bars}${base2(left, right, base)}</svg></div>
      <div style="display:flex;flex-direction:column;min-height:0"><div class="sec">${t.cum}</div>
        <svg viewBox="0 0 ${LW} ${CH}" style="width:100%;flex:1;min-height:0;margin-top:8px">${lGrid}<path d="${area}" fill="${BLUE_TINT}"/>
          <polyline points="${pts}" fill="none" stroke="${BLUE}" stroke-width="2"/>${marks}${lLabels}${base2(lLeft, lRight, lBase)}</svg></div>
    </div>
    <div style="flex:none;display:flex;align-items:stretch;height:64px;border-top:1px solid ${HAIR};padding-top:10px;margin-top:2px">
      <div style="flex:1.45;display:flex;align-items:center;gap:12px;padding-right:18px;min-width:0">
        <span style="flex:none;background:${RED};color:#fff;border-radius:6px;padding:7px 10px;font-size:13px;font-weight:800;white-space:nowrap">${alert[0]}</span>
        <span style="font-size:12.5px;line-height:1.4;color:#333">${alert[1]}</span></div>
      ${t.tiles.map(stat).join('')}
    </div>`);
}

/* ── B: states, top three highlighted ───────────────────────────────────── */
function graphicB(lang) {
  const t = T[lang].b, f = fmt(lang);
  const rowH = 30.6, nameW = 196, CW = 800, barMax = CW - nameW - 62, max = LAENDER[0][2];
  const rows = LAENDER.map((l, i) => {
    const yy = i * rowH, w = Math.max(3, (l[2] / max) * barMax), top = i < 3;
    return `<line x1="0" x2="${CW}" y1="${yy + rowH}" y2="${yy + rowH}" stroke="${HAIR2}"/>
      <text x="2" y="${yy + 20}" font-size="12.5" font-weight="800" fill="${top ? RED : MUTED}">${top ? i + 1 : ''}</text>
      <text x="20" y="${yy + 20}" font-size="${top ? 13.5 : 12.5}" font-weight="${top ? 800 : 500}" fill="${top ? INK : INK2}">${l[t.name]}</text>
      <path d="M${nameW},${yy + 6}H${nameW + w - 3}Q${nameW + w},${yy + 6} ${nameW + w},${yy + 9}V${yy + rowH - 9}Q${nameW + w},${yy + rowH - 6} ${nameW + w - 3},${yy + rowH - 6}H${nameW}Z" fill="${top ? BLUE : BLUE_MID}"/>
      <text x="${nameW + w + 7}" y="${yy + 20}" font-size="${top ? 13.5 : 12.5}" font-weight="${top ? 800 : 600}" fill="${top ? INK : INK2}">${f(l[2])}</text>`;
  }).join('');
  const share = (TOP3 / 402146) * 100;
  const block = (h, b) => `<div style="padding:11px 0;border-top:1px solid ${HAIR}"><div style="font-size:12.5px;font-weight:700;color:${INK}">${h}</div>
    <div style="font-size:12.5px;line-height:1.45;color:#333;margin-top:3px">${b}</div></div>`;
  return frame(lang, 'b', 2, `<div style="flex:1;display:grid;grid-template-columns:1fr 310px;gap:0 26px;min-height:0">
    <div style="min-height:0"><svg viewBox="0 0 ${CW} ${LAENDER.length * rowH}" style="width:100%;height:100%" preserveAspectRatio="xMinYMin meet">${rows}</svg></div>
    <div style="border-left:1px solid ${HAIR};padding-left:20px;display:flex;flex-direction:column;min-height:0">
      <div style="font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${INK2}">${t.top}</div>
      <div style="font-size:58px;font-weight:800;letter-spacing:-.05em;color:${RED};line-height:1;margin-top:6px">${pct(lang, share)}${unit(lang)}</div>
      <div style="font-size:13px;margin-top:6px;color:#333"><b style="color:${INK}">${f(TOP3)}</b> ${t.ofAll}</div>
      <div style="display:flex;gap:2px;height:10px;margin-top:11px">
        <div style="flex:${TOP3};background:${BLUE};border-radius:3px 0 0 3px"></div>
        <div style="flex:${402146 - TOP3};background:${BLUE_MID};border-radius:0 3px 3px 0"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:10.5px;color:${INK2};margin:5px 0 12px"><span>Top 3</span><span>${t.rest}</span></div>
      ${block(t.closeT, t.close)}${block(t.nwgT, t.nwg)}${block(t.noteT, t.note)}
    </div></div>`);
}

/* ── C: approval ≠ installation; 92 % vs 55 % ───────────────────────────── */
function graphicC(lang) {
  const t = T[lang].c, P = (v) => `${pct(lang, v, 0)}${unit(lang)}`;
  const steps = t.steps.map(([h, s], i) => {
    const on = i === 1;
    return `${i ? `<div style="flex:none;width:18px;display:flex;align-items:center;justify-content:center;color:${MUTED};font-size:14px;font-weight:700">›</div>` : ''}
    <div style="flex:1;border-radius:6px;background:${on ? BLUE : '#f5f5f7'};padding:8px 12px;min-width:0">
      <div style="font-size:13.5px;font-weight:800;letter-spacing:-.01em;color:${on ? '#fff' : INK}">${i + 1} · ${h}</div>
      <div style="font-size:11px;line-height:1.3;margin-top:2px;color:${on ? '#e6f1ff' : '#333'}">${s}</div></div>`;
  }).join('');
  const seg = (flex, color, label) => `<div style="flex:${flex};background:${color};color:#fff;display:flex;align-items:center;justify-content:center;min-width:0;white-space:nowrap;overflow:hidden;font-weight:700;font-size:${flex > 20 ? 13 : 11}px">${label}</div>`;
  const row = (title, subtitle, segs) => `<div style="margin-top:8px"><div style="font-size:12.5px;font-weight:700">${title} <span style="font-weight:400;color:${INK2}">· ${subtitle}</span></div>
    <div style="display:flex;gap:2px;height:26px;margin-top:4px;border-radius:4px;overflow:hidden">${segs}</div></div>`;
  const wpShare = (sum(WP) / sum(ZUSAGEN)) * 100, s = (k) => (BDH[k] / BDH.total) * 100;
  const legend = [[BLUE, t.wp], [RED, t.gas], [OTHER, `${t.bio}, ${t.oil}, ${t.other}`]]
    .map(([c, l]) => `<span class="lg"><i class="sw" style="background:${c}"></i>${l}</span>`).join('');
  const shares = WP.map((v, i) => (v / ZUSAGEN[i]) * 100);
  const SW = 800, SH = 104, sL = 26, sR = SW - 32, sT = 24, sB = SH - 20;
  const sx = (i) => sL + (i / 8) * (sR - sL), sy = (v) => sB - ((v - 88) / 8) * (sB - sT);
  const sLabels = shares.map((_, i) => `<text x="${sx(i)}" y="${SH - 4}" text-anchor="middle" font-size="11" fill="${INK2}">${T[lang].months[i]}</text>`).join('');
  const sMarks = [0, 5, 8].map((i) => `<circle cx="${sx(i)}" cy="${sy(shares[i])}" r="4.5" fill="${BLUE}" stroke="#fff" stroke-width="1.5"/>
    <text x="${sx(i)}" y="${sy(shares[i]) - 9}" text-anchor="middle" font-size="12.5" font-weight="800" fill="${INK}">${pct(lang, shares[i])}${unit(lang)}</text>`).join('');
  const rRow = (n, v, sb, i) => `<div style="flex:1;display:flex;flex-direction:column;justify-content:center;${i ? `border-top:1px solid ${HAIR2}` : ''}">
    <div style="font-size:11.5px;font-weight:600;color:${INK2}">${n}</div>
    <div style="font-size:24px;font-weight:800;letter-spacing:-.04em;color:${INK};line-height:1.12">${v}</div>
    <div style="font-size:10.5px;color:${MUTED}">${sb}</div></div>`;
  return frame(lang, 'c', 3, `<div style="flex:none;display:flex">${steps}</div>
    <div style="flex:none;display:flex;font-size:11.5px;font-weight:800;color:${BLUE};margin-top:-5px">
      <span style="margin-left:calc(25% + 4px);width:calc(25% - 9px);text-align:center">▲ ${t.here}</span></div>
    <div style="flex:1;display:grid;grid-template-columns:1fr 250px;gap:0 22px;min-height:0">
      <div style="display:flex;flex-direction:column;min-height:0;min-width:0"><div class="sec">${t.shareT}</div>
        ${row(t.bar1, t.bar1s, seg(wpShare, BLUE, `${t.wp} ${P(wpShare)}`) + seg(100 - wpShare, OTHER, P(100 - wpShare)))}
        ${row(t.bar2, t.bar2s, seg(s('wp'), BLUE, `${t.wp} ${P(s('wp'))}`) + seg(s('gas'), RED, `${t.gas} ${P(s('gas'))}`) + seg(s('biomasse') + s('oel'), OTHER, P(s('biomasse') + s('oel'))))}
        <div class="legend" style="margin-top:6px">${legend}</div>
        <div style="margin-top:7px;background:${BLUE_TINT};border-left:3px solid ${BLUE};border-radius:0 6px 6px 0;padding:6px 11px;font-size:12px;line-height:1.38;color:#333">${t.why}</div>
        <div style="margin-top:8px;font-size:12.5px;font-weight:700">${t.trendT}</div>
        <svg viewBox="0 0 ${SW} ${SH}" style="width:100%;flex:1;min-height:0"><line x1="${sL}" x2="${sR}" y1="${sB}" y2="${sB}" stroke="${INK}"/>
          <polyline points="${shares.map((v, i) => `${sx(i)},${sy(v)}`).join(' ')}" fill="none" stroke="${BLUE}" stroke-width="2"/>${sMarks}${sLabels}</svg>
      </div>
      <div style="display:flex;flex-direction:column;min-height:0"><div class="sec">${t.reformT}</div>
        ${rRow(t.r1, t.r1v, t.r1s, 0)}${rRow(t.r2, t.r2v, t.r2s, 1)}${rRow(t.r3, t.r3v, t.r3s, 2)}${rRow(t.r4, t.r4v, t.r4s, 3)}</div>
    </div>`);
}

/* ── Output ────────────────────────────────────────────────────────────── */
const GFX = [['monate', graphicA], ['laender', graphicB], ['einordnung', graphicC]];
const tmp = mkdtempSync(join(tmpdir(), 'beg-gfx-'));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: PAGE_W, height: PAGE_H }, deviceScaleFactor: 2.6125 })).newPage();
for (const lang of ['de', 'en']) {
  for (const [slug, make] of GFX) {
    await page.setContent(make(lang), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const inter = await page.evaluate(() => document.fonts.check('800 20px Inter'));
    if (!inter) throw new Error('Inter did not load: the graphic would not match the report');
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.pb,.pf,.ph')].filter((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1).map((e) => e.className));
    if (clipped.length) console.warn(`CLIPPED ${slug}-${lang}: ${clipped}`);
    const png = join(tmp, `${slug}-${lang}.png`);
    await page.screenshot({ path: png });
    const out = join(ROOT, 'public', 'news-images', `de-beg-zusagen-2026-09-${slug}${lang === 'en' ? '-en' : ''}.webp`);
    execFileSync('cwebp', ['-quiet', '-q', '90', '-resize', String(W), String(H), png, '-o', out]);
    console.log(out.replace(`${ROOT}/`, ''));
  }
}
await browser.close();
