const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');
const { GoogleGenAI } = require('@google/genai');

admin.initializeApp();
const firestoreDb = admin.firestore();

// Legacy manufacturer-research loop still writes to the DE product collection.
const COUNTRY_CODE = 'DE';

// -------------------------------------------------------------------
// Markets served by the news/policy pipeline. Each entry fully describes
// the market's editorial research scope; articles are written into
// countries/<code>/news and countries/<code>/policies.
// includeGermanTranslation: the DE app has a DE|EN toggle and stores
// title_de/summary_de/body_de; the GB edition is English-only.
// -------------------------------------------------------------------
const MARKETS = [
  {
    code: 'DE',
    marketName: 'German',
    includeGermanTranslation: true,
    researchScope: `- BAFA/BEG funding changes and the BAFA list of eligible heat pumps
- KfW grant 458 processing and conditions
- German heat pump market trends, sales statistics (BWP, Statista, manufacturer reports)
- Technology developments (R290/natural refrigerants, noise limits, efficiency)
- GEG (Gebäudeenergiegesetz) regulatory developments`,
    reputableSources: 'bafa.de, kfw.de, bmwk.de, waermepumpe.de, manufacturer newsrooms, established trade press',
    policyScope: 'BAFA/KfW programs with amounts, GEG requirements, efficiency standards',
  },
  {
    code: 'FR',
    marketName: 'French',
    includeGermanTranslation: false,
    frenchTranslation: true,
    researchScope: `- MaPrimeRénov' (ANAH) conditions, income bands and processing for heat pumps
- CEE (certificats d'économies d'énergie) / Coup de pouce chauffage offers
- French heat pump market trends and installation statistics (AFPAC, Uniclima, ADEME)
- Technology developments (R290/natural refrigerants, sound power, RE2020 context)
- French policy developments (France Rénov', RGE requirements, RE2020)`,
    reputableSources: 'france-renov.gouv.fr, anah.gouv.fr, ademe.fr, ecologie.gouv.fr, afpac.org, manufacturer newsrooms, established trade press',
    policyScope: "MaPrimeRénov' conditions, CEE / Coup de pouce chauffage, RGE requirement, RE2020",
  },
  {
    code: 'GB',
    marketName: 'UK',
    includeGermanTranslation: false,
    researchScope: `- Boiler Upgrade Scheme (BUS) changes, voucher statistics and Ofgem administration
- The Ofgem Product Eligibility List (PEL) and MCS product/installer certification
- UK heat pump market trends and installation statistics (MCS data dashboard, Heat Pump Association, Nesta)
- Technology developments (R290/natural refrigerants, sound power, permitted development rules)
- UK policy developments (Future Homes Standard, Clean Heat Market Mechanism, Warm Homes Plan)`,
    reputableSources: 'ofgem.gov.uk, gov.uk, mcscertified.com, heatpumps.org.uk, nesta.org.uk, manufacturer newsrooms, established trade press',
    policyScope: 'Boiler Upgrade Scheme grant amounts and conditions, MCS standards, Future Homes Standard, Clean Heat Market Mechanism',
  },
  {
    code: 'PL',
    marketName: 'Poland',
    includeGermanTranslation: false,
    polishTranslation: true,
    researchScope: `- Czyste Powietrze program changes, grant conditions and processing for heat pumps
- Lista ZUM (lista zielonych urządzeń i materiałów) updates and device eligibility
- NFOŚiGW announcements and funding calls (Moje Ciepło, Ciepłe Mieszkanie)
- Polish heat pump market trends and sales statistics (PORT PC, manufacturer reports)
- EU policy developments affecting Poland (EPBD, efficiency standards, refrigerants)`,
    reputableSources: 'gov.pl, nfosigw.gov.pl, czystepowietrze.gov.pl, mojecieplo.gov.pl, lista-zum.ios.edu.pl, portpc.pl, ec.europa.eu, manufacturer newsrooms, established trade press',
    policyScope: 'Czyste Powietrze grant amounts and conditions, Moje Ciepło, Ciepłe Mieszkanie, ulga termomodernizacyjna, EU EPBD requirements',
  },
];

// -------------------------------------------------------------------
// Budget Tracker
// Gemini 2.5 Flash pricing: $0.075/1M input, $0.30/1M output
// Google Search grounding: $35/1000 requests
// Default limit: $14 (~20,000 KRW)
// -------------------------------------------------------------------
class BudgetTracker {
  constructor(limitUsd = 14) {
    this.limitUsd = limitUsd;
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.groundingRequests = 0;
    this.INPUT_COST_PER_TOKEN = 0.075 / 1e6;
    this.OUTPUT_COST_PER_TOKEN = 0.30 / 1e6;
    this.GROUNDING_COST_PER_REQ = 35 / 1000;
  }

  track(usageMetadata, isGrounded = false) {
    if (usageMetadata) {
      this.inputTokens += usageMetadata.promptTokenCount || 0;
      this.outputTokens += usageMetadata.candidatesTokenCount || 0;
    }
    if (isGrounded) this.groundingRequests++;
  }

  get cost() {
    return (this.inputTokens * this.INPUT_COST_PER_TOKEN)
      + (this.outputTokens * this.OUTPUT_COST_PER_TOKEN)
      + (this.groundingRequests * this.GROUNDING_COST_PER_REQ);
  }

  get isOverBudget() { return this.cost >= this.limitUsd; }

  get summary() {
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      groundingRequests: this.groundingRequests,
      costUsd: parseFloat(this.cost.toFixed(4)),
      limitUsd: this.limitUsd,
      remainingUsd: parseFloat((this.limitUsd - this.cost).toFixed(4)),
    };
  }
}

// -------------------------------------------------------------------
// Manufacturers to research (sorted by priority)
// minProducts: target minimum number of products in DB
// priority: 1 = highest (researched first)
// -------------------------------------------------------------------
const MANUFACTURERS = [
  { name: 'Viessmann',          minProducts: 5, priority: 1 },
  { name: 'Vaillant',           minProducts: 5, priority: 1 },
  { name: 'Stiebel Eltron',     minProducts: 5, priority: 1 },
  { name: 'Buderus',            minProducts: 4, priority: 1 },
  { name: 'Daikin',             minProducts: 4, priority: 1 },
  { name: 'Nibe',               minProducts: 4, priority: 2 },
  { name: 'Wolf',               minProducts: 3, priority: 2 },
  { name: 'Bosch',              minProducts: 3, priority: 2 },
  { name: 'Weishaupt',          minProducts: 3, priority: 2 },
  { name: 'Alpha Innotec',      minProducts: 3, priority: 3 },
  { name: 'Ochsner',            minProducts: 2, priority: 3 },
  { name: 'Mitsubishi Electric', minProducts: 2, priority: 3 },
  { name: 'Panasonic',          minProducts: 2, priority: 3 },
  { name: 'LG',                 minProducts: 2, priority: 3 },
];

// -------------------------------------------------------------------
// Helper: Extract JSON array from Gemini text response
// -------------------------------------------------------------------
function extractJsonArray(text) {
  if (!text) return null;
  // Try to extract a JSON array from the response
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractJsonObject(text) {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// -------------------------------------------------------------------
// Research products for a single manufacturer using Gemini + Search
// Priority: 1) BAFA list, 2) Manufacturer site, 3) Retailer sites
// -------------------------------------------------------------------
async function researchManufacturerProducts(ai, manufacturer, existingModels, budget) {
  if (budget.isOverBudget) return [];

  const today = new Date().toISOString().split('T')[0];
  const existingNote = existingModels.length > 0
    ? `Already in our database: ${existingModels.join(', ')}. Keep updating these AND add NEW models not yet in our list.`
    : `No products for this manufacturer yet. Find as many as possible.`;

  const prompt = `You are a German heat pump database specialist. Search for ${manufacturer} heat pump (Wärmepumpe) products sold in Germany as of ${today}.

Research priority order:
1. BAFA eligible product list at bafa.de (Bundesamt für Wirtschaft und Ausfuhrkontrolle) - most authoritative
2. ${manufacturer} official German website or product catalog (datasheet/Produktdatenblatt)
3. German retailer/distributor sites (heizung.de, haustechnikdialog.de, selfio.de, hagebau.de, etc.)

${existingNote}

For each heat pump product found, provide a JSON object with these fields:
- manufacturer: brand name
- unitType: "ODU" (outdoor unit) or "IDU" (indoor unit)
- model: exact model name/number as shown by manufacturer
- capacityRange: nominal heating capacity, e.g. "5 kW" or "5-17 kW"
- dimensions: H x W x D in mm, e.g. "815 x 1100 x 500 mm"
- refrigerant: e.g. "R290", "R32", "R410A"
- cop: e.g. "5.1 (A7/W35)" - Coefficient of Performance
- scop: e.g. "4.90 (W35)" - Seasonal COP
- noiseLevel: Sound power level, e.g. "49 dB(A)"
- description: 1 sentence summarizing key features in English
- others: weight, max flow temperature, voltage, phases (e.g. "Weight: 130 kg; Max flow temp: 75°C; 230V 1-phase")
- marketPrice: approximate installer-to-consumer price range in EUR (e.g. "€9,000 - €11,000"). This is NOT the product purchase price but the total installed system cost estimate from market data.
- dataSource: one of "bafa", "manufacturer", "retailer", "estimated"

Rules:
- Use "N/A" for fields that cannot be found after searching
- Do NOT invent model names that don't exist
- If a value is uncertain, use "estimated" for dataSource
- Return ONLY a valid JSON array, no other text

JSON array:`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    budget.track(response.usageMetadata, true);

    const products = extractJsonArray(response.text);
    if (!products) {
      console.warn(`  Could not parse JSON for ${manufacturer}. Response snippet: ${(response.text || '').slice(0, 200)}`);
      return [];
    }

    // Filter out obviously invalid entries and blocklisted patterns
    return products.filter(p => {
      if (!p || !p.model || !p.manufacturer) return false;
      // Reject bundled multi-model entries (contains "e.g." or model name > 80 chars)
      if (p.model.toLowerCase().includes('e.g.') || p.model.toLowerCase().includes('e.g,')) return false;
      if (p.model.length > 80) return false;
      return true;
    });
  } catch (err) {
    console.error(`  Error researching ${manufacturer}: ${err.message}`);
    return [];
  }
}

// -------------------------------------------------------------------
// Curated open-source image library for news articles
// All images: Unsplash (free to use, no attribution required for web)
// Rule: assign based on keyword match in title/summary; never let AI hallucinate URLs
// -------------------------------------------------------------------
const NEWS_IMAGES = {
  heatpump:     'https://images.unsplash.com/photo-1621905251189-08b1059efa82?auto=format&fit=crop&q=80&w=600',
  subsidy:      'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=600',
  house:        'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&q=80&w=600',
  government:   'https://images.unsplash.com/photo-1555900234-35b55afe19df?auto=format&fit=crop&q=80&w=600',
  solar:        'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&q=80&w=600',
  technology:   'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=600',
  installation: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=600',
  market:       'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=600',
  energy:       'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&q=80&w=600',
};

const NEWS_IMAGE_RULES = [
  { key: 'subsidy',      keywords: ['bafa', 'beg', 'subsidy', 'funding', 'grant', 'zuschuss', 'kfw', 'förder', 'förderung', 'ofgem', 'boiler upgrade', 'voucher', 'maprimerénov', 'maprimerenov', 'coup de pouce', 'anah', 'aides'] },
  { key: 'government',   keywords: ['parliament', 'bundestag', 'bundesrat', 'minister', 'government', 'geg', 'regulation', 'gesetz', 'policy', 'law', 'legislation', 'desnz', 'future homes', 'clean heat', 're2020', 'france rénov'] },
  { key: 'solar',        keywords: ['solar', 'photovoltaic', 'pv', 'renewable', 'wind', 'erneuerbar', 'green energy'] },
  { key: 'technology',   keywords: ['r290', 'r32', 'refrigerant', 'cop', 'scop', 'efficiency', 'innovation', 'technology', 'inverter', 'compressor'] },
  { key: 'installation', keywords: ['install', 'installer', 'montage', 'handwerk', 'technician', 'fachmann', 'workforce'] },
  { key: 'market',       keywords: ['market', 'sales', 'statistics', 'stat', 'trend', 'bwp', 'report', 'record', 'growth', 'demand', 'forecast', 'mcs', 'installation figures'] },
  { key: 'energy',       keywords: ['energy', 'electricity', 'power', 'grid', 'strom', 'energie', 'tariff', 'price hike'] },
  { key: 'house',        keywords: ['house', 'home', 'building', 'residential', 'gebäude', 'renovation', 'refurb', 'retrofit'] },
  { key: 'heatpump',     keywords: ['heat pump', 'heatpump', 'wärmepumpe', 'outdoor unit', 'odu', 'idu', 'hvac', 'heating', 'viessmann', 'vaillant', 'stiebel', 'bosch', 'daikin', 'nibe', 'wolf', 'panasonic'] },
];

/**
 * Select an appropriate image URL based on news title and summary keywords.
 * Rule: always assign from curated map — never use AI-generated URLs.
 */
function selectNewsImage(title = '', summary = '') {
  const text = `${title} ${summary}`.toLowerCase();
  for (const rule of NEWS_IMAGE_RULES) {
    if (rule.keywords.some(kw => text.includes(kw))) {
      return NEWS_IMAGES[rule.key];
    }
  }
  return NEWS_IMAGES.heatpump; // default fallback
}

// -------------------------------------------------------------------
// -------------------------------------------------------------------
// Article graphic generator — deterministic branded SVG (data URI).
// Never uses AI-generated image URLs; generated by code, works offline.
// -------------------------------------------------------------------
const ARTICLE_GRAPHIC_THEMES = {
  FUNDING:             { bg0: '#0b3d2e', bg1: '#127a55', accent: '#7be3b3' },
  MARKET:              { bg0: '#0f2a4a', bg1: '#1c5a9e', accent: '#7fb8ff' },
  TECHNOLOGY:          { bg0: '#3a1d0b', bg1: '#8a4d16', accent: '#ffc38a' },
  'INSTALLER INSIGHT': { bg0: '#2a2140', bg1: '#54448a', accent: '#c1b3ff' },
};

function generateArticleGraphic(category = 'MARKET') {
  const t = ARTICLE_GRAPHIC_THEMES[category] || ARTICLE_GRAPHIC_THEMES.MARKET;
  // Fan-blade motif (heat pump outdoor unit) + concentric airflow arcs.
  const blades = [0, 60, 120, 180, 240, 300]
    .map(a => `<ellipse cx="0" cy="-118" rx="34" ry="86" fill="${t.accent}" opacity=".28" transform="rotate(${a})"/>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`
    + `<stop offset="0" stop-color="${t.bg0}"/><stop offset="1" stop-color="${t.bg1}"/>`
    + `</linearGradient></defs>`
    + `<rect width="1200" height="630" fill="url(#g)"/>`
    + `<g transform="translate(920,315)">`
    + `<circle r="240" fill="none" stroke="${t.accent}" stroke-opacity=".18" stroke-width="2"/>`
    + `<circle r="180" fill="none" stroke="${t.accent}" stroke-opacity=".26" stroke-width="2"/>`
    + blades
    + `<circle r="44" fill="${t.accent}" opacity=".85"/>`
    + `</g>`
    + `<text x="64" y="120" font-family="Helvetica,Arial,sans-serif" font-size="30" font-weight="600" letter-spacing="6" fill="${t.accent}">${category}</text>`
    + `<text x="64" y="540" font-family="Helvetica,Arial,sans-serif" font-size="42" font-weight="700" fill="#ffffff">HeatPump DB</text>`
    + `<text x="64" y="580" font-family="Helvetica,Arial,sans-serif" font-size="22" fill="#ffffff" opacity=".65">Market intelligence briefing</text>`
    + `</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

const ARTICLE_CATEGORIES = ['FUNDING', 'MARKET', 'TECHNOLOGY', 'INSTALLER INSIGHT'];

/**
 * Google Search grounding returns opaque vertexaisearch redirect URLs.
 * Resolve them to the real publisher URL (302 Location) so article
 * citations point at the actual source; keep the original on failure.
 */
async function resolveSourceUrl(url) {
  if (!/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect/.test(url)) return url;
  try {
    const resp = await fetch(url, { method: 'GET', redirect: 'manual' });
    const loc = resp.headers.get('location');
    return loc && /^https?:\/\//.test(loc) ? loc : url;
  } catch {
    return url;
  }
}

// -------------------------------------------------------------------
// Research market info and WRITE original HeatPump DB editorial articles
// (2-3 per run) + current policy items, using Gemini + Google Search.
// Market-parameterized: the `market` entry (from MARKETS) sets the research
// scope, reputable sources and whether German translations are produced.
// -------------------------------------------------------------------
async function researchNewsAndPolicies(ai, budget, market) {
  if (budget.isOverBudget) return { news: [], policies: [] };

  const today = new Date().toISOString().split('T')[0];
  const idPrefix = `news-${today.replace(/-/g, '')}-${market.code.toLowerCase()}`;

  const germanBlock = market.includeGermanTranslation
    ? `- For EACH article ALSO provide a professional German version of the same
  content in "title_de", "summary_de", and "body_de": natural, journalistic
  German for professional installers (correct Fachbegriffe: Wärmepumpe,
  Förderung, Schallleistung, Kältemittel…), not a literal word-by-word
  translation. Same paragraph structure as "body".`
    : market.frenchTranslation
      ? `- For EACH article ALSO provide a professional French version of the same
  content in "title_fr", "summary_fr", and "body_fr": natural, journalistic
  French for professional installers (correct terminology: pompe à chaleur,
  aides, puissance acoustique, fluide frigorigène…), not a literal
  word-by-word translation. Same paragraph structure as "body".`
      : market.polishTranslation
        ? `- For EACH article ALSO provide a professional Polish version of the same
  content in "title_pl", "summary_pl", and "body_pl": natural, journalistic
  Polish for professional installers (correct terminology: pompa ciepła,
  dofinansowanie, moc akustyczna, czynnik chłodniczy…), not a literal
  word-by-word translation. Same paragraph structure as "body".`
        : `- Do NOT include any translated fields — this market edition is English-only.`;

  const germanJsonFields = market.includeGermanTranslation
    ? `
      "title_de": "Prägnante redaktionelle Überschrift (Deutsch)",
      "summary_de": "2-3 Sätze Vorspann (Deutsch)",
      "body_de": "Erster Absatz...\\n\\nZweiter Absatz...\\n\\nDritter Absatz...",`
    : market.frenchTranslation
      ? `
      "title_fr": "Titre éditorial concis (français)",
      "summary_fr": "Chapeau de 2-3 phrases (français)",
      "body_fr": "Premier paragraphe...\\n\\nDeuxième paragraphe...\\n\\nTroisième paragraphe...",`
      : market.polishTranslation
        ? `
      "title_pl": "Zwięzły nagłówek redakcyjny (polski)",
      "summary_pl": "Lead 2-3 zdania (polski)",
      "body_pl": "Pierwszy akapit...\\n\\nDrugi akapit...\\n\\nTrzeci akapit...",`
        : '';

  const prompt = `You are the editorial engine of "HeatPump DB", a ${market.marketName} heat pump market intelligence app.

STEP 1 — RESEARCH. Search for current (as of ${today}) information about heat pumps in the ${market.marketName} market:
${market.researchScope}

STEP 2 — WRITE. Compose exactly 3 ORIGINAL NEWS ARTICLES in English, written
exactly as a professional news agency would publish them (publisher:
"HeatPump DataBase (Europe)"):
- NEWS REGISTER, not blog/editorial: inverted pyramid — the lede paragraph
  answers who/what/when/where/why in 1-2 sentences; each following paragraph
  adds detail in decreasing importance.
- ATTRIBUTE INLINE: name the information source inside the sentences wherever
  a fact is stated ("according to …", "data published by … shows", "… said in
  a statement"). Every substantive claim must be traceable to a named source.
- NEVER invent quotes, figures or statements. Only quote wording that actually
  appears in the researched pages; otherwise paraphrase with attribution.
- Each article must be an ORIGINAL synthesis in your own words — do NOT copy
  or closely paraphrase any single source.
- The three articles must cover three DIFFERENT topics, one each from:
  (a) funding/policy, (b) market/statistics, (c) technology or installer practice.
- "title": a factual news headline (no clickbait, no colon-hype).
- "summary": a 2-3 sentence standfirst in news style.
- "body": 5-7 short news paragraphs of plain text, separated by blank lines.
- "sources": 2-4 of the real web pages found in STEP 1 that informed the
  article (official or reputable pages only — ${market.reputableSources}).
  Never invent URLs. These are printed under the article as "References".
- "category": exactly one of FUNDING | MARKET | TECHNOLOGY | INSTALLER INSIGHT.
${germanBlock}

Also compile 3-5 current policy/regulation items (${market.policyScope}).

Return ONLY valid JSON with this exact structure:
{
  "news": [
    {
      "id": "${idPrefix}-001",
      "title": "Concise editorial headline (English)",
      "summary": "2-3 sentence standfirst/dek (English)",
      "body": "Paragraph one...\\n\\nParagraph two...\\n\\nParagraph three...",${germanJsonFields}
      "category": "MARKET",
      "sources": [ { "title": "Source page title", "url": "https://real-url.example" } ],
      "date": "${today}T00:00:00Z"
    }
  ],
  "policies": [
    {
      "id": "pol-001",
      "title": "Policy name",
      "category": "Subsidy",
      "summary": "Description of the policy",
      "sourceUrl": "https://official-source.example"
    }
  ]
}

Increment the news ID counter (${idPrefix}-001, -002, -003).
Do NOT include imageUrl — a related graphic is generated by the system.
Return ONLY the JSON object, no other text:`;

  try {
    // Gemini occasionally returns unparseable output — retry once before giving up.
    let result = null;
    for (let attempt = 1; attempt <= 2 && !result; attempt++) {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      budget.track(response.usageMetadata, true);
      result = extractJsonObject(response.text);
      if (!result) console.warn(`Could not parse news/policy JSON (attempt ${attempt}).`);
    }
    if (!result) {
      return { news: [], policies: [] };
    }

    // Original HeatPump DB articles: stamp byline/branding in code (not by AI),
    // attach a generated related graphic, resolve grounding-redirect source
    // URLs to real publisher URLs, and keep only sane source entries.
    const articles = await Promise.all(
      (Array.isArray(result.news) ? result.news : [])
        .slice(0, 3)
        .map(async item => {
          const category = ARTICLE_CATEGORIES.includes(item.category) ? item.category : 'MARKET';
          const rawSources = (Array.isArray(item.sources) ? item.sources : [])
            .filter(s => s && typeof s.url === 'string' && /^https?:\/\//.test(s.url) && s.title)
            .slice(0, 4);
          const sources = await Promise.all(
            rawSources.map(async s => ({ ...s, url: await resolveSourceUrl(s.url) }))
          );
          return {
            ...item,
            category,
            sources,
            author: 'HeatPump DataBase (Europe)',
            original: true,
            // Original articles open in-app; keep first source as fallback link.
            sourceUrl: sources[0]?.url ?? '',
            imageUrl: generateArticleGraphic(category),
          };
        })
    );

    return {
      news: articles,
      policies: Array.isArray(result.policies) ? result.policies : [],
    };
  } catch (err) {
    console.error(`Error fetching news: ${err.message}`);
    return { news: [], policies: [] };
  }
}

// -------------------------------------------------------------------
// Utility: chunk array for Firestore batch writes (limit 500)
// -------------------------------------------------------------------
function chunkArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

async function deleteCollection(path, batchSize = 400) {
  const ref = firestoreDb.collection(path);
  const snapshot = await ref.orderBy('__name__').limit(batchSize).get();
  if (snapshot.empty) return;
  const batch = firestoreDb.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  if (snapshot.size >= batchSize) await deleteCollection(path, batchSize);
}

// -------------------------------------------------------------------
// Main update logic
// -------------------------------------------------------------------
async function publishNewsAndPolicies(marketCode, news, policies) {
  if (news.length > 0) {
    // APPEND — past articles are never deleted; the app shows an archive.
    const newsRef = firestoreDb.collection(`countries/${marketCode}/news`);
    const newsBatch = firestoreDb.batch();
    news.forEach((item, i) => {
      const id = item.id || `news-${Date.now()}-${i}`;
      newsBatch.set(newsRef.doc(id), item);
    });
    await newsBatch.commit();
    console.log(`[${marketCode}] News published.`);
  }

  if (policies.length > 0) {
    await deleteCollection(`countries/${marketCode}/policies`);
    const policyRef = firestoreDb.collection(`countries/${marketCode}/policies`);
    const polBatch = firestoreDb.batch();
    policies.forEach((item, i) => {
      const id = item.id || `pol-${Date.now()}-${i}`;
      polBatch.set(policyRef.doc(id), item);
    });
    await polBatch.commit();
    console.log(`[${marketCode}] Policies published.`);
  }

  const totalNews = (await firestoreDb.collection(`countries/${marketCode}/news`).count().get()).data().count;
  await firestoreDb.collection('countries').doc(marketCode).set({
    lastUpdated: new Date().toISOString(),
    newsCount: totalNews,
    policyCount: policies.length,
  }, { merge: true });
}

async function runAutoUpdate(budget, options = {}) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Which markets to serve this run — options.countries (e.g. ['GB']) narrows
  // the run; default is every configured market. Unknown codes are ignored.
  const requested = Array.isArray(options.countries) && options.countries.length > 0
    ? options.countries.map(c => String(c).toUpperCase())
    : MARKETS.map(m => m.code);
  const markets = MARKETS.filter(m => requested.includes(m.code));

  // Step 0 (FIRST — must never be starved by the research loop): generate
  // the monthly HeatPump DB editorial articles + policy items per market and
  // publish them immediately. The manufacturer research below can consume the
  // whole function timeout; news/policies are the user-facing deliverable.
  const perMarket = {};
  let deNews = [];
  let dePolicies = [];
  for (const market of markets) {
    console.log(`[${market.code}] Researching latest news and policies (priority step)...`);
    const { news, policies } = await researchNewsAndPolicies(ai, budget, market);
    console.log(`[${market.code}]   → Generated ${news.length} articles, ${policies.length} policy items.`);
    await publishNewsAndPolicies(market.code, news, policies);
    perMarket[market.code] = { newsUpdated: news.length, policiesUpdated: policies.length };
    if (market.code === 'DE') { deNews = news; dePolicies = policies; }
  }

  // newsOnly mode: publish news/policies and stop — used for manual refreshes
  // without spending time/budget on the manufacturer research loop.
  if (options.newsOnly) {
    return {
      mode: 'newsOnly',
      markets: perMarket,
      budget: budget.summary,
    };
  }

  const news = deNews;
  const policies = dePolicies;

  // Step 1: Load existing products from Firestore
  console.log('Loading existing products from Firestore...');
  const productsRef = firestoreDb.collection(`countries/${COUNTRY_CODE}/products`);
  const existingSnapshot = await productsRef.get();

  const existingProducts = new Map(); // docId -> product data
  existingSnapshot.forEach(doc => existingProducts.set(doc.id, doc.data()));
  console.log(`Loaded ${existingProducts.size} existing products.`);

  // Step 2: Count products per manufacturer
  const manufacturerCounts = {};
  existingProducts.forEach(p => {
    manufacturerCounts[p.manufacturer] = (manufacturerCounts[p.manufacturer] || 0) + 1;
  });

  // Step 3: Sort by deficit (underrepresented manufacturers first)
  const sortedManufacturers = [...MANUFACTURERS].sort((a, b) => {
    const aDeficit = Math.max(0, a.minProducts - (manufacturerCounts[a.name] || 0));
    const bDeficit = Math.max(0, b.minProducts - (manufacturerCounts[b.name] || 0));
    if (bDeficit !== aDeficit) return bDeficit - aDeficit;
    return a.priority - b.priority;
  });

  console.log('Manufacturer research order:',
    sortedManufacturers.map(m => `${m.name}(${manufacturerCounts[m.name] || 0}/${m.minProducts})`).join(', ')
  );

  // Step 4: Research each manufacturer
  let productsAdded = 0;
  let productsUpdated = 0;
  const allResearchedProducts = [];

  for (const mfr of sortedManufacturers) {
    if (budget.isOverBudget) {
      console.log(`Budget limit reached ($${budget.cost.toFixed(3)}). Stopping research.`);
      break;
    }

    const existingModels = [];
    existingProducts.forEach(p => {
      if (p.manufacturer === mfr.name) existingModels.push(p.model);
    });

    console.log(`Researching ${mfr.name} (current: ${existingModels.length}, target: ${mfr.minProducts})...`);

    const products = await researchManufacturerProducts(ai, mfr.name, existingModels, budget);
    console.log(`  → Found ${products.length} products. Cost so far: $${budget.cost.toFixed(3)}`);

    allResearchedProducts.push(...products);

    // Small delay to respect rate limits
    await new Promise(r => setTimeout(r, 400));
  }

  // Step 5: Merge researched products into Firestore (incremental)
  if (allResearchedProducts.length > 0) {
    const chunks = chunkArray(allResearchedProducts, 400);
    for (const chunk of chunks) {
      const batch = firestoreDb.batch();
      for (const product of chunk) {
        if (!product.model) continue;

        const docId = product.model.replace(/[^a-zA-Z0-9-_]/g, '_').toUpperCase();
        const docRef = productsRef.doc(docId);
        const existing = existingProducts.get(docId);

        if (existing) {
          // Update: only overwrite with better (non-N/A) data
          const merged = { ...existing };
          for (const key of Object.keys(product)) {
            const newVal = product[key];
            const oldVal = existing[key];
            if (newVal && newVal !== 'N/A' && newVal !== oldVal) {
              merged[key] = newVal;
            }
          }
          merged.lastVerified = new Date().toISOString();
          batch.set(docRef, merged);
          productsUpdated++;
        } else {
          // New product
          product.lastVerified = new Date().toISOString();
          batch.set(docRef, product);
          productsAdded++;
        }
      }
      await batch.commit();
    }
  }

  console.log(`Products: +${productsAdded} added, ~${productsUpdated} updated.`);

  // (News + policies already published in Step 0 above.)

  // Step 9: Update metadata
  const totalProducts = existingProducts.size + productsAdded;
  const metadata = {
    lastUpdated: new Date().toISOString(),
    productCount: totalProducts,
    newsCount: news.length,
    policyCount: policies.length,
    lastUpdateStats: {
      productsAdded,
      productsUpdated,
      budget: budget.summary,
    },
    source: 'auto-update (BAFA → manufacturer → retailer)',
  };

  await firestoreDb.collection('countries').doc(COUNTRY_CODE).set(metadata, { merge: true });

  return {
    productsAdded,
    productsUpdated,
    totalProducts,
    markets: perMarket,
    newsUpdated: news.length,
    policiesUpdated: policies.length,
    budget: budget.summary,
  };
}

// -------------------------------------------------------------------
// Cloud Function: autoUpdateDatabase
// Triggered by: Cloud Scheduler (monthly) or authenticated HTTP call
//
// AUTO_UPDATE_ENABLED env var (default: "false"):
//   "false" → scheduler-triggered calls are rejected; manual API-key calls still work
//   "true"  → both scheduler and manual calls are accepted
// -------------------------------------------------------------------
functions.http('autoUpdateDatabase', async (req, res) => {
  const SECRET_KEY = process.env.SECRET_KEY;
  const autoUpdateEnabled = (process.env.AUTO_UPDATE_ENABLED || 'false').toLowerCase() === 'true';

  // Allow Cloud Scheduler requests (identified by header) OR valid API key
  const isScheduler = req.headers['x-cloudscheduler'] === 'true';
  const providedKey = req.headers['x-api-key'];

  // Block scheduler-triggered calls when auto-update is disabled
  if (isScheduler && !autoUpdateEnabled) {
    console.log('Auto-update is disabled (AUTO_UPDATE_ENABLED=false). Scheduler call rejected.');
    return res.status(200).json({ status: 'skipped', reason: 'Auto-update is disabled. Set AUTO_UPDATE_ENABLED=true to re-enable.' });
  }

  if (!isScheduler && (!SECRET_KEY || providedKey !== SECRET_KEY)) {
    console.warn(`Unauthorized access attempt from ${req.ip}`);
    return res.status(403).json({ error: 'Unauthorized: Invalid or missing API key' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not set' });
  }

  const budgetLimitUsd = parseFloat(process.env.BUDGET_LIMIT_USD || '14');
  const budget = new BudgetTracker(budgetLimitUsd);

  console.log(`=== Auto Update Started === Budget limit: $${budgetLimitUsd} | ${new Date().toISOString()}`);

  try {
    const newsOnly = req.query?.newsOnly === 'true' || req.body?.newsOnly === true;
    // ?countries=GB or ?countries=DE,GB (body: {"countries":["GB"]}) narrows
    // the run to specific markets; default = all configured markets.
    const countriesRaw = req.query?.countries ?? req.body?.countries;
    const countries = Array.isArray(countriesRaw)
      ? countriesRaw
      : typeof countriesRaw === 'string' && countriesRaw.trim()
        ? countriesRaw.split(',').map(s => s.trim())
        : undefined;
    const result = await runAutoUpdate(budget, { newsOnly, countries });
    console.log('=== Auto Update Complete ===', JSON.stringify(result));
    return res.status(200).json({ status: 'success', ...result });
  } catch (err) {
    console.error('Auto Update Error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});
