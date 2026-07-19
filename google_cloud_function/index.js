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
  {
    code: 'IT',
    marketName: 'Italy',
    includeGermanTranslation: false,
    italianTranslation: true,
    researchScope: `- Conto Termico 3.0 (GSE) rules, incentive amounts and the pre-qualified appliance catalogues (catalogo apparecchi prequalificati)
- Detrazioni fiscali / Ecobonus changes affecting heat pumps (Agenzia delle Entrate, ENEA)
- Italian heat pump market trends and sales statistics (Assoclima, EHPA, manufacturer reports)
- Technology developments (R290/natural refrigerants, sound power, hybrid systems)
- EU policy developments affecting Italy (EPBD/case green, efficiency standards, refrigerants)`,
    reputableSources: 'gse.it, mase.gov.it, agenziaentrate.gov.it, enea.it, efficienzaenergetica.enea.it, assoclima.it, ec.europa.eu, manufacturer newsrooms, established trade press',
    policyScope: 'Conto Termico 3.0 incentive amounts and conditions, detrazioni fiscali / Ecobonus, EU EPBD (direttiva case green) requirements',
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
// Small pure helpers shared by the manual news-admin function below.
// -------------------------------------------------------------------
/** SEO slug: lowercase, ASCII-folded (accents stripped), hyphen-separated. */
function slugify(text) {
  const slug = String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return slug || 'article';
}

/** YouTube video ids are exactly 11 chars of [A-Za-z0-9_-]. */
function validateYouTubeId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id);
}

/** Count blank-line-separated paragraphs in a plain-text body. */
function countParagraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .length;
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
// News-article images (2026-07-19): curated LOCAL webp pool shipped with every
// market build at /news-images/ (public/news-images/manifest.json is the
// source of truth for these slugs — keep in sync). Rules (owner spec):
//   - assignment is deterministic (category field + keyword match) — never AI URLs;
//   - POLICY articles use the market's OWN policy set (each image carries that
//     country's flag — never cross markets); EU-level policy topics rotate the
//     three eu-policy images instead;
//   - non-policy articles use the COMMON pools by subject category;
//   - within one (market, month) no file is used twice (pools ≥ articles/run);
//     rotation is least-recently-used via a total-count offset so consecutive
//     months walk the pool instead of always starting at the first file;
//   - every article ALWAYS gets an image (pool exhausted → least-used file).
const NEWS_IMAGE_POOLS = {
  policy: {
    DE: ['de-policy-01.webp', 'de-policy-02.webp', 'de-policy-03.webp'],
    GB: ['uk-policy-01.webp', 'uk-policy-02.webp', 'uk-policy-03.webp'],
    FR: ['fr-policy-01.webp', 'fr-policy-02.webp', 'fr-policy-03.webp'],
    PL: ['pl-policy-01.webp', 'pl-policy-02.webp', 'pl-policy-03.webp'],
    IT: ['it-policy-01.webp', 'it-policy-02.webp', 'it-policy-03.webp'],
    EU: ['eu-policy-01.webp', 'eu-policy-02.webp', 'eu-policy-03.webp'],
  },
  install: ['common-install-01.webp', 'common-install-02.webp', 'common-install-03.webp', 'common-install-04.webp', 'common-install-05.webp'],
  market: ['common-market-01.webp', 'common-market-02-factory-layoff.webp', 'common-market-03.webp', 'common-market-04.webp', 'common-market-05.webp', 'common-market-06.webp'],
  tech: ['common-tech-01.webp', 'common-tech-02.webp', 'common-tech-03.webp', 'common-tech-04.webp', 'common-tech-05.webp', 'common-tech-06.webp'],
  energy: ['common-energy-01.webp', 'common-energy-02.webp', 'common-energy-03.webp', 'common-energy-04.webp', 'common-energy-05.webp'],
};

const NATIONAL_POLICY_KEYWORDS = ['bafa', 'beg', 'kfw', 'geg', 'bundes',
  'boiler upgrade', 'bus grant', 'mcs', 'clean heat market', 'future homes', 'ofgem',
  'maprimerénov', 'maprimerenov', 'coup de pouce', 'cee', 'anah', 'france rénov',
  'czyste powietrze', 'moje ciepło', 'cieple mieszkanie', 'ciepłe mieszkanie', 'lista zum', 'nfośigw', 'nfosigw',
  'conto termico', 'gse', 'ecobonus', 'detrazion', 'agenzia delle entrate', 'enea'];
const EU_POLICY_KEYWORDS = ['epbd', 'european commission', 'eu directive', 'eu-richtlinie',
  'direttiva', 'dyrektywa', 'brussels', 'bruxelles', 'case green', 'european union',
  'f-gas', 'ecodesign', 'red iii', 'fit for 55'];
const ENERGY_KEYWORDS = ['district heating', 'fernwärme', 'waste heat', 'data center',
  'data centre', 'industrial heat', 'solar', 'photovoltaic', 'battery', 'grid',
  'decarbon', 'carbon', 'geothermal'];

/** Deterministic subject classification: article category field + keyword nudges. */
function newsImageCategory(category = 'MARKET', title = '', summary = '') {
  const text = `${title} ${summary}`.toLowerCase();
  if (category === 'FUNDING') {
    // A NATIONAL programme mention always outranks an incidental EU reference:
    // a BUS/Conto-Termico article that cites the EPBD is still national policy.
    if (NATIONAL_POLICY_KEYWORDS.some(k => text.includes(k))) return 'policy';
    return EU_POLICY_KEYWORDS.some(k => text.includes(k)) ? 'eu-policy' : 'policy';
  }
  if (category === 'INSTALLER INSIGHT') return 'install';
  if (category === 'TECHNOLOGY') {
    return ENERGY_KEYWORDS.some(k => text.includes(k)) ? 'energy' : 'tech';
  }
  return ENERGY_KEYWORDS.some(k => text.includes(k)) ? 'energy' : 'market';
}

function newsImagePool(marketCode, imgCat) {
  if (imgCat === 'eu-policy') return NEWS_IMAGE_POOLS.policy.EU;
  if (imgCat === 'policy') return NEWS_IMAGE_POOLS.policy[marketCode] ?? NEWS_IMAGE_POOLS.market;
  return NEWS_IMAGE_POOLS[imgCat] ?? NEWS_IMAGE_POOLS.market;
}

/** Pick the next pool file: skip files already used this month; walk from a
 *  rotation offset so usage spreads across months; if the whole pool was used
 *  this month already (more articles than images), fall back to the
 *  least-used file — an article must never be imageless. */
/** Images whose subject is only appropriate for specific story angles: the
 *  file is SKIPPED in rotation unless the article text matches its keywords
 *  (2026-07-19: the factory-layoff photo appeared on a routine DE market
 *  article — a layoff image belongs only on job-loss/decline stories). */
const CONDITIONAL_IMAGES = {
  'common-market-02-factory-layoff.webp': ['layoff', 'lay-off', 'job cut', 'job loss', 'jobs lost',
    'redundan', 'stellenabbau', 'arbeitsplatzabbau', 'entlassung', 'kurzarbeit',
    'licenzia', 'esuber', 'zwolnien', 'licenciement', 'suppression d', 'downturn', 'slump', 'insolven'],
};
function chooseNewsImage(pool, usedFilesThisMonth, rotationOffset = 0, articleText = '') {
  const eligible = pool.filter(f => !CONDITIONAL_IMAGES[f]
    || CONDITIONAL_IMAGES[f].some(k => articleText.includes(k)));
  pool = eligible.length ? eligible : pool;
  for (let i = 0; i < pool.length; i++) {
    const f = pool[(rotationOffset + i) % pool.length];
    if (!usedFilesThisMonth.includes(f)) return f;
  }
  const counts = pool.map(f => [f, usedFilesThisMonth.filter(u => u === f).length]);
  counts.sort((a, b) => a[1] - b[1]);
  return counts[0][0];
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
        : market.italianTranslation
          ? `- For EACH article ALSO provide a professional Italian version of the same
  content in "title_it", "summary_it", and "body_it": natural, journalistic
  Italian for professional installers (correct terminology: pompa di calore,
  incentivi, potenza sonora, refrigerante…), not a literal word-by-word
  translation. Same paragraph structure as "body".`
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
        : market.italianTranslation
          ? `
      "title_it": "Titolo editoriale conciso (italiano)",
      "summary_it": "Sommario di 2-3 frasi (italiano)",
      "body_it": "Primo paragrafo...\\n\\nSecondo paragrafo...\\n\\nTerzo paragrafo...",`
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
            // imageUrl is assigned at PUBLISH time (publishNewsAndPolicies):
            // it needs the month's existing usage for the no-repeat rule.
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

    // Image assignment (deterministic, month-scoped no-repeat): collect the
    // files already used by THIS month's existing articles, then assign each
    // new article the next rotation slot of its subject pool.
    const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '');
    const monthSnap = await newsRef
      .orderBy(admin.firestore.FieldPath.documentId())
      .startAt(`news-${yyyymm}`)
      .endAt(`news-${yyyymm}\uf8ff`)
      .get();
    const usedThisMonth = monthSnap.docs
      .map(d => String(d.data().imageUrl ?? ''))
      .filter(u => u.startsWith('/news-images/'))
      .map(u => u.slice('/news-images/'.length));
    const totalNewsCount = (await newsRef.count().get()).data().count;

    const newsBatch = firestoreDb.batch();
    news.forEach((item, i) => {
      const id = item.id || `news-${Date.now()}-${i}`;
      if (!item.imageUrl) {
        const imgCat = newsImageCategory(item.category, item.title, item.summary);
        const pool = newsImagePool(marketCode, imgCat);
        const file = chooseNewsImage(pool, usedThisMonth, (totalNewsCount + i) % pool.length,
          `${item.title ?? ''} ${item.summary ?? ''}`.toLowerCase());
        item.imageUrl = `/news-images/${file}`;
        usedThisMonth.push(file);
      }
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

// ===================================================================
// Cloud Function: newsAdmin  (admin-authenticated, HTTP)
//
// Translates and publishes MANUAL news articles authored in the admin
// console. The English canonical draft lives in newsArticles/{articleId};
// on publish this fans out ONE localized doc per selected country into
// countries/<CC>/news/{articleId} (same id everywhere → idempotent).
//
// This function is entirely independent of autoUpdateDatabase and never
// touches its automated news-generation logic.
// ===================================================================

// Country → locale / flat-field language / prompt language name.
// Mirrored here on purpose (do NOT import from src/) — single source in the fn.
const COUNTRY_NEWS_META = {
  DE: { locale: 'de-DE', lang: 'de', languageName: 'German' },
  GB: { locale: 'en-GB', lang: 'en', languageName: 'English' },
  FR: { locale: 'fr-FR', lang: 'fr', languageName: 'French' },
  PL: { locale: 'pl-PL', lang: 'pl', languageName: 'Polish' },
  IT: { locale: 'it-IT', lang: 'it', languageName: 'Italian' },
};
const VALID_COUNTRIES = Object.keys(COUNTRY_NEWS_META);
const NEWS_ADMIN_ROLES = ['owner', 'admin', 'support', 'ops'];
const TRANSLATION_MODEL = 'gemini-2.5-flash';
const TRANSLATION_VERSION = '2026-07-manual-v1';
const DEFAULT_NEWS_AUTHOR = 'HeatPump DataBase (Europe)';

// Article size ceilings. Two independent guards:
//  1) SOURCE caps (chars) — reject oversized English input BEFORE any AI call,
//     so we never burn Gemini tokens (or grow the doc) on a runaway paste.
//  2) A serialized-doc byte ceiling checked on every fan-out doc before it is
//     written — Firestore hard-limits a document to 1 MiB, and a doc that trips
//     it would otherwise fail the whole batch.commit() with an opaque 500.
const NEWS_FIELD_LIMITS = { title: 300, summary: 2000, body: 50000, imageAlt: 400 };
const NEWS_URL_LIMIT = 2000;
const NEWS_DOC_MAX_BYTES = 900 * 1024; // safety margin under Firestore's 1 MiB
function newsDocSizeError(doc) {
  const bytes = Buffer.byteLength(JSON.stringify(doc), 'utf8');
  return bytes > NEWS_DOC_MAX_BYTES
    ? `article too large: ${bytes} bytes serialized (max ${NEWS_DOC_MAX_BYTES})`
    : null;
}

// -------------------------------------------------------------------
// STRICT server-side translation prompt (key + prompt never leave the fn).
// -------------------------------------------------------------------
function buildTranslationPrompt(source, locale, languageName) {
  return `You are a professional translator for "HeatPump DB", a heat-pump-industry news service. Translate the English heat-pump-industry news article below into ${languageName} (locale ${locale}).

Return ONLY a strict JSON object with EXACTLY these keys and nothing else:
{"locale":"${locale}","title":"…","summary":"…","body":"…","imageAlt":"…","slug":"…"}
No markdown fences, no explanation, no prose before or after the JSON object.

TRANSLATION RULES — obey every one:
- Do not add facts, claims, opinions, explanations, or numbers that are not in the source.
- Do not remove sentences, paragraphs, list items, or qualifiers.
- Preserve all numbers, percentages, dates, performance values, capacities and units exactly as written.
- Do not alter manufacturer, product, model, trademark or brand names.
- Do not modify any URLs.
- Preserve headings, paragraphs, lists, links and body structure; keep the SAME blank-line-separated paragraph breaks as the source.
- Do NOT translate the brand name "HeatPump DataBase" — keep it verbatim.
- Use the official local names of policy programmes, subsidies and institutions ONLY when you are reliably certain of them; when uncertain, keep the original proper noun unchanged.
- Do NOT introduce "BAFA" (or any German-specific programme name) for a non-German country unless it is explicitly written in the English source.
- Do not identify another European country as the source of product information; where such wording is needed, use neutral phrasing such as "European-market information".
- Do not convert units or values unless the source itself does.
- No marketing language, no added disclaimers, no commentary.
- Return only the required JSON object.

For "slug": produce an SEO-friendly slug of the TRANSLATED title in ${languageName} — lowercase, words separated by hyphens, ASCII-folded (no accents or diacritics).

SOURCE ARTICLE (English canonical):
Title: ${source.title}
Summary: ${source.summary}
Image alt text: ${source.imageAlt}
Body:
${source.body}

Return the JSON object now:`;
}

// -------------------------------------------------------------------
// Validate a Gemini translation payload against the English source.
// Returns null when valid, otherwise a short failure-reason string.
// -------------------------------------------------------------------
function validateTranslation(parsed, source) {
  if (!parsed || typeof parsed !== 'object') return 'ai-json-parse';
  for (const k of ['title', 'summary', 'body', 'imageAlt']) {
    if (typeof parsed[k] !== 'string' || !parsed[k].trim()) return `missing-field:${k}`;
  }
  // body paragraph count within ±1 of the source's blank-line paragraph count
  const srcParas = countParagraphs(source.body);
  const outParas = countParagraphs(parsed.body);
  if (Math.abs(srcParas - outParas) > 1) return 'paragraph-count-mismatch';
  // no dangerous markup / injection substrings
  const blob = `${parsed.title}\n${parsed.summary}\n${parsed.body}\n${parsed.imageAlt}`.toLowerCase();
  for (const bad of ['<script', '<iframe', 'javascript:', 'onerror=']) {
    if (blob.includes(bad)) return `unsafe-content:${bad}`;
  }
  // brand name must survive translation if it was present in the source
  const brand = 'HeatPump DataBase';
  const srcHasBrand = ['title', 'summary', 'body', 'imageAlt']
    .some(k => String(source[k] || '').includes(brand));
  const outHasBrand = ['title', 'summary', 'body', 'imageAlt']
    .some(k => String(parsed[k] || '').includes(brand));
  if (srcHasBrand && !outHasBrand) return 'brand-name-dropped';
  return null;
}

// -------------------------------------------------------------------
// Produce the localized payload for ONE country.
// GB (en-GB) → original English pass-through (translationSource:'original').
// DE/FR/PL/IT → one Gemini call (translationSource:'ai'), validated.
// Returns { ok:true, payload } or { ok:false, step, message }.
// -------------------------------------------------------------------
async function translateArticleForCountry(ai, cc, source) {
  const meta = COUNTRY_NEWS_META[cc];
  const nowIso = new Date().toISOString();

  if (cc === 'GB') {
    return {
      ok: true,
      payload: {
        title: source.title,
        summary: source.summary,
        body: source.body,
        imageAlt: source.imageAlt,
        slug: slugify(source.title),
        translationSource: 'original',
        translatedAt: nowIso,
        translationModel: TRANSLATION_MODEL,
        translationVersion: TRANSLATION_VERSION,
      },
    };
  }

  let parsed;
  try {
    const response = await ai.models.generateContent({
      model: TRANSLATION_MODEL,
      contents: buildTranslationPrompt(source, meta.locale, meta.languageName),
    });
    parsed = extractJsonObject(response.text);
  } catch (err) {
    return { ok: false, step: 'ai-call', message: err.message };
  }
  if (!parsed) return { ok: false, step: 'ai-parse', message: 'could not parse AI JSON' };

  const reason = validateTranslation(parsed, source);
  if (reason) return { ok: false, step: 'validation', message: reason };

  return {
    ok: true,
    payload: {
      title: parsed.title.trim(),
      summary: parsed.summary.trim(),
      body: parsed.body.trim(),
      imageAlt: parsed.imageAlt.trim(),
      slug: slugify(parsed.slug || parsed.title),
      translationSource: 'ai',
      translatedAt: nowIso,
      translationModel: TRANSLATION_MODEL,
      translationVersion: TRANSLATION_VERSION,
    },
  };
}

// -------------------------------------------------------------------
// Build the public fan-out doc for countries/<CC>/news/<articleId>.
// -------------------------------------------------------------------
function buildCountryNewsDoc(cc, articleId, source, localePayload) {
  const { lang } = COUNTRY_NEWS_META[cc];
  const sources = [];
  if (source.sourceUrl) {
    sources.push({ title: source.sourceName || source.sourceUrl, url: source.sourceUrl });
  }
  const doc = {
    // The public renderer reads item.id from the DOCUMENT DATA (getNews does
    // doc.data(), NOT doc.id) — deep links (/?article=<id>), share/email and
    // React keys all depend on it, exactly like the auto flow stores it.
    id: articleId,
    // base English canonical (the en/GB site reads these directly)
    title: source.title,
    summary: source.summary,
    body: source.body,
    category: source.category,
    date: source.publicationDate || new Date().toISOString(),
    imageUrl: source.imageUrl,
    imageAlt: localePayload.imageAlt,
    sources,
    // Parity with the auto flow: the "open source" action reads sourceUrl.
    sourceUrl: sources[0] ? sources[0].url : '',
    author: source.author || DEFAULT_NEWS_AUTHOR,
    original: true,
    sourceType: 'manual',
    manualArticleId: articleId,
    slug: localePayload.slug,
  };
  if (source.youtubeVideoId) doc.youtubeVideoId = source.youtubeVideoId;
  // Non-English editions localize via flat title_<lang>/summary_<lang>/body_<lang>.
  // GB (en) uses the base fields only.
  if (lang !== 'en') {
    doc[`title_${lang}`] = localePayload.title;
    doc[`summary_${lang}`] = localePayload.summary;
    doc[`body_${lang}`] = localePayload.body;
  }
  return doc;
}

// -------------------------------------------------------------------
// Validate that a draft has everything required to be published.
// Returns null when valid, otherwise a human-readable detail string.
// -------------------------------------------------------------------
function validatePublishFields(source) {
  for (const k of ['title', 'summary', 'body', 'imageAlt', 'category', 'imageUrl']) {
    if (typeof source[k] !== 'string' || !source[k].trim()) {
      return `missing or empty required field: ${k}`;
    }
  }
  for (const [k, max] of Object.entries(NEWS_FIELD_LIMITS)) {
    if (source[k].length > max) return `field too long: ${k} (${source[k].length} > ${max} chars)`;
  }
  if (source.imageUrl.length > NEWS_URL_LIMIT) return `field too long: imageUrl (max ${NEWS_URL_LIMIT} chars)`;
  if (typeof source.sourceUrl === 'string' && source.sourceUrl.length > NEWS_URL_LIMIT) {
    return `field too long: sourceUrl (max ${NEWS_URL_LIMIT} chars)`;
  }
  if (!Array.isArray(source.targetCountries) || source.targetCountries.length === 0) {
    return 'targetCountries must be a non-empty array';
  }
  for (const cc of source.targetCountries) {
    if (!VALID_COUNTRIES.includes(cc)) return `invalid target country: ${cc}`;
  }
  if (source.youtubeVideoId != null && source.youtubeVideoId !== ''
      && !validateYouTubeId(source.youtubeVideoId)) {
    return 'invalid youtubeVideoId (must be 11 chars of [A-Za-z0-9_-])';
  }
  return null;
}

// -------------------------------------------------------------------
// action: publish / updatePublished (same core, all-or-nothing).
// The live country docs are only ever overwritten in the FINAL batch —
// if any translation fails, nothing is written and the previous public
// version (if any) stays untouched.
// -------------------------------------------------------------------
async function handleNewsPublish(articleId, draftRef, source, uid, res) {
  const detail = validatePublishFields(source);
  if (detail) return res.status(400).json({ error: 'validation', detail });

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'server-error', message: 'GEMINI_API_KEY not set' });
  }

  const targets = source.targetCountries;
  await draftRef.update({
    status: 'translating',
    updatedAt: new Date().toISOString(),
    updatedBy: uid,
  });

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const payloadByCountry = {};
  const localesByLocale = {};

  for (const cc of targets) {
    const result = await translateArticleForCountry(ai, cc, source);
    if (!result.ok) {
      const locale = COUNTRY_NEWS_META[cc].locale;
      await draftRef.update({
        status: 'translation_failed',
        lastTranslationError: `${locale}: ${result.step}: ${result.message}`,
        updatedAt: new Date().toISOString(),
        updatedBy: uid,
      });
      // All-or-nothing: no country doc has been written.
      return res.status(200).json({
        ok: false,
        error: 'translation-failed',
        failedLocale: locale,
        failedStep: result.step,
      });
    }
    payloadByCountry[cc] = result.payload;
    localesByLocale[COUNTRY_NEWS_META[cc].locale] = result.payload;
  }

  // All locales succeeded — fan out atomically (fixed ids → idempotent).
  const batch = firestoreDb.batch();
  for (const cc of targets) {
    const ref = firestoreDb.collection(`countries/${cc}/news`).doc(articleId);
    const doc = buildCountryNewsDoc(cc, articleId, source, payloadByCountry[cc]);
    const sizeErr = newsDocSizeError(doc);
    if (sizeErr) {
      await draftRef.update({
        status: 'translation_failed',
        lastTranslationError: `${COUNTRY_NEWS_META[cc].locale}: doc-size: ${sizeErr}`,
        updatedAt: new Date().toISOString(),
        updatedBy: uid,
      });
      // Nothing committed yet — the batch is abandoned, previous public docs stay.
      return res.status(400).json({ error: 'validation', detail: sizeErr, failedLocale: COUNTRY_NEWS_META[cc].locale });
    }
    batch.set(ref, doc);
  }
  await batch.commit();

  const nowIso = new Date().toISOString();
  await draftRef.update({
    status: 'published',
    publishedAt: nowIso,
    publishedBy: uid,
    publishedCountries: targets,
    locales: localesByLocale,
    translationOutdated: false,
    lastTranslationError: null,
    updatedAt: nowIso,
    updatedBy: uid,
  });

  return res.status(200).json({ ok: true, status: 'published', publishedCountries: targets });
}

// -------------------------------------------------------------------
// action: unpublish { articleId, countries? }
// -------------------------------------------------------------------
async function handleNewsUnpublish(articleId, draftRef, source, uid, res, body) {
  const published = Array.isArray(source.publishedCountries) ? source.publishedCountries : [];
  const toRemove = Array.isArray(body.countries) && body.countries.length
    ? body.countries.map(c => String(c).toUpperCase())
    : [...published];

  const batch = firestoreDb.batch();
  for (const cc of toRemove) {
    batch.delete(firestoreDb.collection(`countries/${cc}/news`).doc(articleId));
  }
  await batch.commit();

  const remaining = published.filter(cc => !toRemove.includes(cc));
  const update = {
    publishedCountries: remaining,
    updatedAt: new Date().toISOString(),
    updatedBy: uid,
  };
  if (remaining.length === 0) {
    update.status = 'draft';
    update.publishedAt = null;
  }
  await draftRef.update(update);

  return res.status(200).json({ ok: true, publishedCountries: remaining });
}

// -------------------------------------------------------------------
// action: retarget { articleId, add:[CC…], remove:[CC…] }
// Per-country writes only — one country never affects another.
// -------------------------------------------------------------------
async function handleNewsRetarget(articleId, draftRef, source, uid, res, body) {
  const add = Array.isArray(body.add) ? body.add.map(c => String(c).toUpperCase()) : [];
  const remove = Array.isArray(body.remove) ? body.remove.map(c => String(c).toUpperCase()) : [];

  for (const cc of [...add, ...remove]) {
    if (!VALID_COUNTRIES.includes(cc)) {
      return res.status(400).json({ error: 'validation', detail: `invalid target country: ${cc}` });
    }
  }

  let publishedCountries = Array.isArray(source.publishedCountries) ? [...source.publishedCountries] : [];
  let targetCountries = Array.isArray(source.targetCountries) ? [...source.targetCountries] : [];
  const locales = (source.locales && typeof source.locales === 'object') ? { ...source.locales } : {};

  // 1) Removals — delete each country doc, drop from the tracked lists.
  if (remove.length) {
    const batch = firestoreDb.batch();
    for (const cc of remove) {
      batch.delete(firestoreDb.collection(`countries/${cc}/news`).doc(articleId));
    }
    await batch.commit();
    publishedCountries = publishedCountries.filter(cc => !remove.includes(cc));
    targetCountries = targetCountries.filter(cc => !remove.includes(cc));
    for (const cc of remove) delete locales[COUNTRY_NEWS_META[cc].locale];
  }

  // 2) Additions — each must be publishable; translate + write that ONE locale.
  if (add.length) {
    const detail = validatePublishFields({ ...source, targetCountries: add });
    if (detail) return res.status(400).json({ error: 'validation', detail });
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'server-error', message: 'GEMINI_API_KEY not set' });
    }
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    for (const cc of add) {
      const result = await translateArticleForCountry(ai, cc, source);
      if (!result.ok) {
        // Persist the progress already made; other countries are untouched.
        await draftRef.update({
          publishedCountries,
          targetCountries,
          locales,
          lastTranslationError: `${COUNTRY_NEWS_META[cc].locale}: ${result.step}: ${result.message}`,
          updatedAt: new Date().toISOString(),
          updatedBy: uid,
        });
        return res.status(200).json({
          ok: false,
          error: 'translation-failed',
          failedLocale: COUNTRY_NEWS_META[cc].locale,
          failedStep: result.step,
        });
      }
      const doc = buildCountryNewsDoc(cc, articleId, source, result.payload);
      const sizeErr = newsDocSizeError(doc);
      if (sizeErr) {
        await draftRef.update({
          publishedCountries, targetCountries, locales,
          lastTranslationError: `${COUNTRY_NEWS_META[cc].locale}: doc-size: ${sizeErr}`,
          updatedAt: new Date().toISOString(), updatedBy: uid,
        });
        return res.status(400).json({ error: 'validation', detail: sizeErr, failedLocale: COUNTRY_NEWS_META[cc].locale });
      }
      await firestoreDb.collection(`countries/${cc}/news`).doc(articleId).set(doc);
      if (!publishedCountries.includes(cc)) publishedCountries.push(cc);
      if (!targetCountries.includes(cc)) targetCountries.push(cc);
      locales[COUNTRY_NEWS_META[cc].locale] = result.payload;
    }
  }

  const update = {
    publishedCountries,
    targetCountries,
    locales,
    updatedAt: new Date().toISOString(),
    updatedBy: uid,
  };
  if (publishedCountries.length === 0) {
    update.status = 'draft';
    update.publishedAt = null;
  } else if (source.status !== 'published') {
    update.status = 'published';
  }
  await draftRef.update(update);

  return res.status(200).json({ ok: true, publishedCountries, targetCountries });
}

functions.http('newsAdmin', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    return res.status(204).send('');
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method-not-allowed' });
  }

  // --- AUTH: verified Firebase ID token + admin-tier role ---
  const authHeader = String(req.headers.authorization || req.headers.Authorization || '');
  const tokenMatch = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!tokenMatch) return res.status(401).json({ error: 'unauthorized' });

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(tokenMatch[1].trim());
  } catch (err) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const uid = decoded.uid;

  let role = null;
  try {
    const userSnap = await firestoreDb.collection('users').doc(uid).get();
    role = userSnap.exists ? userSnap.data().role : null;
  } catch (err) {
    return res.status(500).json({ error: 'server-error', message: err.message });
  }
  if (!NEWS_ADMIN_ROLES.includes(role)) return res.status(403).json({ error: 'forbidden' });

  // --- Request body ---
  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const action = body.action;
  const articleId = body.articleId;

  if (typeof articleId !== 'string' || !articleId.trim()) {
    return res.status(400).json({ error: 'validation', detail: 'articleId is required' });
  }
  if (!['publish', 'unpublish', 'retarget', 'updatePublished'].includes(action)) {
    return res.status(400).json({ error: 'validation', detail: 'invalid action' });
  }

  const draftRef = firestoreDb.collection('newsArticles').doc(articleId);
  const draftSnap = await draftRef.get();
  if (!draftSnap.exists) return res.status(404).json({ error: 'not-found' });
  const source = draftSnap.data();

  try {
    if (action === 'publish' || action === 'updatePublished') {
      return await handleNewsPublish(articleId, draftRef, source, uid, res);
    }
    if (action === 'unpublish') {
      return await handleNewsUnpublish(articleId, draftRef, source, uid, res, body);
    }
    if (action === 'retarget') {
      return await handleNewsRetarget(articleId, draftRef, source, uid, res, body);
    }
  } catch (err) {
    console.error('newsAdmin error:', err);
    return res.status(500).json({ error: 'server-error', message: err.message });
  }
});
