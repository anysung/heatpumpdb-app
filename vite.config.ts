import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Per-market <head> metadata, injected at build time (one deployment = one
// country). Titles are the canonical brand naming — "HeatPump DB <Market>",
// no underscores — so search engines stop generating their own variants
// (Google was rewriting titles from hostnames: "HeatPump DB_UK" etc.).
// Descriptions carry the market keywords (BAFA-Liste / Ofgem BUS PEL / MCS /
// comparateur pompe à chaleur) that match how each market actually searches.
const MARKET_HTML: Record<string, { lang: string; hreflang: string; title: string; desc: string; canonical: string; iconCode: string; appName: string; themeColor: string }> = {
  DE: {
    lang: 'de',
    hreflang: 'de-DE',
    iconCode: 'de',
    appName: 'HeatPump DB Germany',
    themeColor: '#0a1712',
    title: 'HeatPump DB Germany — Heat Pump Database',
    desc: 'Wärmepumpen-Datenbank & Vergleich für den deutschen Markt: BAFA-Liste förderfähiger Wärmepumpen (BEG), SCOP, COP, Schallleistung, Kältemittel (R290) und EU-Energielabel — Datenblätter für Fachhandwerk und Eigentümer.',
    canonical: 'https://www.heatpumpdb.de/',
  },
  GB: {
    lang: 'en',
    hreflang: 'en-GB',
    iconCode: 'uk',
    appName: 'HeatPump DB UK',
    themeColor: '#081322',
    title: 'HeatPump DB UK — Heat Pump Database',
    desc: 'UK heat pump database & comparison: Ofgem Boiler Upgrade Scheme (BUS) product eligibility list, MCS-certified air source heat pumps, SCOP, sound power and refrigerant data — data sheets for installers and homeowners.',
    canonical: 'https://www.heatpumpdb.uk/',
  },
  FR: {
    lang: 'fr',
    hreflang: 'fr-FR',
    iconCode: 'fr',
    appName: 'HeatPump DB France',
    themeColor: '#0b1128',
    title: 'HeatPump DB France — Base de données de pompes à chaleur',
    desc: "Base de données et comparateur de pompes à chaleur air/eau pour le marché français : SCOP, COP, puissance acoustique, fluides frigorigènes (R290) et étiquette énergie UE — fiches techniques pour installateurs et particuliers.",
    canonical: 'https://www.heatpumpdb.fr/',
  },
};

/** hreflang cluster — the three market editions are alternates of each other. */
function hreflangLinks(): string {
  const links = Object.values(MARKET_HTML)
    .map(x => `    <link rel="alternate" hreflang="${x.hreflang}" href="${x.canonical}" />`)
    .join('\n');
  return `${links}\n    <link rel="alternate" hreflang="x-default" href="${MARKET_HTML.DE.canonical}" />`;
}

/** Structured data: tells Google what the entity "HeatPump DB" is. */
function jsonLd(m: (typeof MARKET_HTML)[string]): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'HeatPump DB',
    alternateName: m.title.split(' — ')[0],
    url: m.canonical,
    description: m.desc,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: m.lang,
    offers: { '@type': 'Offer', category: 'subscription' },
    publisher: { '@type': 'Organization', name: 'HeatPump DB', url: m.canonical },
  };
  return `    <script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  // Cast process to any to avoid TypeScript error: Property 'cwd' does not exist on type 'Process'
  const env = loadEnv(mode, (process as any).cwd(), '');
  const country = (process as any).env.VITE_COUNTRY_CODE || env.VITE_COUNTRY_CODE || 'DE';
  const m = MARKET_HTML[country] ?? MARKET_HTML.DE;
  let outDir = 'dist';

  return {
    plugins: [
      react(),
      {
        name: 'market-html',
        configResolved(config: any) { outDir = config.build.outDir; },
        transformIndexHtml(html: string) {
          return html
            .replace(/<html lang="[^"]*">/, `<html lang="${m.lang}">`)
            .replace(
              /<title>.*?<\/title>/,
              `<title>${m.title}</title>\n`
              + `    <meta name="description" content="${m.desc}" />\n`
              + `    <link rel="canonical" href="${m.canonical}" />\n`
              + hreflangLinks() + '\n'
              + `    <meta property="og:site_name" content="HeatPump DB" />\n`
              + `    <meta property="og:title" content="${m.title}" />\n`
              + `    <meta property="og:description" content="${m.desc}" />\n`
              + `    <meta property="og:url" content="${m.canonical}" />\n`
              + `    <meta property="og:type" content="website" />\n`
              // PWA: installable per market with its own icon set (public/icons/)
              + `    <link rel="manifest" href="/manifest.webmanifest" />\n`
              + `    <meta name="theme-color" content="${m.themeColor}" />\n`
              + `    <meta name="mobile-web-app-capable" content="yes" />\n`
              + `    <meta name="apple-mobile-web-app-title" content="HeatPump DB" />\n`
              + `    <link rel="icon" type="image/png" sizes="32x32" href="/icons/${m.iconCode}-32.png" />\n`
              + `    <link rel="apple-touch-icon" sizes="180x180" href="/icons/${m.iconCode}-180.png" />\n`
              + jsonLd(m),
            );
        },
        closeBundle() {
          // Per-market sitemap + robots (the shared public/ dir cannot carry
          // market-specific Sitemap URLs).
          const today = new Date().toISOString().slice(0, 10);
          writeFileSync(resolve(outDir, 'sitemap.xml'),
            `<?xml version="1.0" encoding="UTF-8"?>\n`
            + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
            + `  <url><loc>${m.canonical}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq></url>\n`
            + `</urlset>\n`);
          writeFileSync(resolve(outDir, 'robots.txt'),
            `User-agent: *\nAllow: /\n\nSitemap: ${m.canonical}sitemap.xml\n`);
          // PWA manifest — per-market identity so each installed edition
          // carries its own name, icon and theme color.
          writeFileSync(resolve(outDir, 'manifest.webmanifest'), JSON.stringify({
            name: m.appName,
            short_name: 'HeatPump DB',
            description: m.desc,
            lang: m.lang,
            start_url: '/',
            scope: '/',
            display: 'standalone',
            background_color: m.themeColor,
            theme_color: m.themeColor,
            icons: [
              { src: `/icons/${m.iconCode}-192.png`, sizes: '192x192', type: 'image/png' },
              { src: `/icons/${m.iconCode}-512.png`, sizes: '512x512', type: 'image/png' },
            ],
          }, null, 2));
        },
      },
    ],
    base: '/',
    server: {
      host: true
    },
    define: {
      // Polyfill process.env.API_KEY so it works in the browser
      // CRITICAL FIX: Added || "" to prevent build failure if API_KEY is undefined in Cloud Build env
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY || "")
    }
  }
})
