import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Per-market <head> metadata, injected at build time (one deployment = one
// country). Titles are the canonical brand naming — "HeatPump DB <Market>",
// no underscores — so search engines stop generating their own variants
// (Google was rewriting titles from hostnames: "HeatPump DB_UK" etc.).
const MARKET_HTML: Record<string, { lang: string; title: string; desc: string; canonical: string }> = {
  DE: {
    lang: 'de',
    title: 'HeatPump DB Germany — Heat Pump Database',
    desc: 'Wärmepumpen-Datenbank für den deutschen Markt: BAFA-Liste, SCOP, Schallleistung, Kältemittel und EU-Energielabel — Vergleich und Datenblätter für Fachhandwerk und Eigentümer.',
    canonical: 'https://www.heatpumpdb.de/',
  },
  GB: {
    lang: 'en',
    title: 'HeatPump DB UK — Heat Pump Database',
    desc: 'Heat pump database for the UK market: Ofgem PEL listing, MCS references, SCOP, sound power and refrigerant data — comparison and data sheets for installers and homeowners.',
    canonical: 'https://www.heatpumpdb.uk/',
  },
  FR: {
    lang: 'fr',
    title: 'HeatPump DB France — Base de données de pompes à chaleur',
    desc: "Base de données de pompes à chaleur pour le marché français : références techniques, SCOP, puissance acoustique, fluides frigorigènes et étiquette énergie UE — comparaison et fiches techniques.",
    canonical: 'https://www.heatpumpdb.fr/',
  },
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  // Cast process to any to avoid TypeScript error: Property 'cwd' does not exist on type 'Process'
  const env = loadEnv(mode, (process as any).cwd(), '');
  const country = (process as any).env.VITE_COUNTRY_CODE || env.VITE_COUNTRY_CODE || 'DE';
  const m = MARKET_HTML[country] ?? MARKET_HTML.DE;

  return {
    plugins: [
      react(),
      {
        name: 'market-html',
        transformIndexHtml(html: string) {
          return html
            .replace(/<html lang="[^"]*">/, `<html lang="${m.lang}">`)
            .replace(
              /<title>.*?<\/title>/,
              `<title>${m.title}</title>\n`
              + `    <meta name="description" content="${m.desc}" />\n`
              + `    <link rel="canonical" href="${m.canonical}" />\n`
              + `    <meta property="og:site_name" content="HeatPump DB" />\n`
              + `    <meta property="og:title" content="${m.title}" />\n`
              + `    <meta property="og:description" content="${m.desc}" />\n`
              + `    <meta property="og:url" content="${m.canonical}" />\n`
              + `    <meta property="og:type" content="website" />`,
            );
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
