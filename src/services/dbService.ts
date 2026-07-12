import { collection, getDocs, getDoc, doc, query, limit } from 'firebase/firestore';
import { ref, getBlob } from 'firebase/storage';
import { db, datasetStorage } from '../firebase';
import { HeatPump, NewsItem, PolicyItem, BAFAItem } from '../types';
import { ACTIVE_COUNTRY } from '../config/countryProfiles';

// Firestore collection paths — derived from the active country profile so that
// all country-specific routing is driven by ACTIVE_COUNTRY, not hardcoded strings.
const NEWS_REF   = `${ACTIVE_COUNTRY.firestoreRoot}/news`;
const POLICY_REF = `${ACTIVE_COUNTRY.firestoreRoot}/policies`;
const BAFA_REF   = `${ACTIVE_COUNTRY.firestoreRoot}/bafa`;

/**
 * Load a product dataset.
 *
 * Production: downloaded through the Firebase Storage SDK from the
 * auth-protected datasets bucket (gs://heatpumpdb-datasets/datasets/<CC>/…) —
 * storage.rules only admit approved accounts, so the catalogue is no longer
 * one anonymous HTTP GET away (anti-scraping, 2026-07-12).
 *
 * Dev server: reads the local file from public/data (vite serves it), so the
 * pipeline/preview workflow keeps working without a Storage round-trip.
 */
const loadProductsFromJson = async (path: string): Promise<HeatPump[]> => {
  try {
    let data: any;
    if (import.meta.env.DEV) {
      const resp = await fetch(path);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      data = await resp.json();
    } else {
      const file = path.split('/').pop()!;
      const blob = await getBlob(ref(datasetStorage, `datasets/${ACTIVE_COUNTRY.code}/${file}`));
      data = JSON.parse(await blob.text());
    }
    return (data.items || []) as HeatPump[];
  } catch (error) {
    console.error(`Error fetching products from ${path}:`, error);
    return [];
  }
};

/** Load residential products (static JSON, path from active country profile). */
export const getProducts = (): Promise<HeatPump[]> =>
  loadProductsFromJson(ACTIVE_COUNTRY.datasetPaths.products);

/** Load commercial products (static JSON, path from active country profile). */
export const getCommercialProducts = (): Promise<HeatPump[]> =>
  loadProductsFromJson(ACTIVE_COUNTRY.datasetPaths.commercialProducts);

/** News for an arbitrary market — used by the unified admin console. */
export const getNewsFor = async (countryCode: string): Promise<NewsItem[]> => {
  try {
    const snapshot = await getDocs(query(collection(db, `countries/${countryCode}/news`), limit(20)));
    return snapshot.docs.map(d => d.data() as NewsItem)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return [];
  }
};

export const getNews = async (): Promise<NewsItem[]> => {
  try {
    const newsCollection = collection(db, NEWS_REF);
    const q = query(newsCollection, limit(200)); 
    const snapshot = await getDocs(q);
    
    const news = snapshot.docs.map(doc => doc.data() as NewsItem);
    return news.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error("Error fetching news:", error);
    return [];
  }
};

export const getPolicies = async (): Promise<PolicyItem[]> => {
  try {
    const snapshot = await getDocs(collection(db, POLICY_REF));
    return snapshot.docs.map(doc => doc.data() as PolicyItem);
  } catch (error) {
    console.error("Error fetching policies:", error);
    return [];
  }
};

export const getBAFA = async (): Promise<BAFAItem[]> => {
  try {
    const snapshot = await getDocs(collection(db, BAFA_REF));
    return snapshot.docs.map(d => d.data() as BAFAItem);
  } catch (error) {
    console.error("Error fetching BAFA:", error);
    return [];
  }
};

export interface DbMetadata {
  lastUpdated: string | null;
  productCount: number;
  newsCount: number;
  policyCount?: number;
  lastUpdateStats?: {
    productsAdded: number;
    productsUpdated: number;
    budget: {
      costUsd: number;
      limitUsd: number;
      inputTokens: number;
      outputTokens: number;
      groundingRequests: number;
    };
  };
  source?: string;
}

export const getMetadata = async (): Promise<DbMetadata> => {
  try {
    const snap = await getDoc(doc(db, 'countries', ACTIVE_COUNTRY.code));
    if (snap.exists()) return snap.data() as DbMetadata;
    return { lastUpdated: null, productCount: 0, newsCount: 0 };
  } catch (error) {
    console.error("Error fetching metadata:", error);
    return { lastUpdated: null, productCount: 0, newsCount: 0 };
  }
};