import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase (Modular)
const app = initializeApp(firebaseConfig);

// App Check (anti-bot): every SDK request carries a reCAPTCHA-Enterprise-backed
// attestation; services set to ENFORCED reject calls without one (raw REST
// scripts, scrapers). Invisible to real users. Dev/e2e use a debug token via
// window.FIREBASE_APPCHECK_DEBUG_TOKEN (set before this module loads).
declare global { interface Window { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean } }
if (import.meta.env.DEV && window.FIREBASE_APPCHECK_DEBUG_TOKEN === undefined) {
  window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;  // auto debug token, printed to console
}
if (import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_SITE_KEY as string),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache()
});
// Product datasets live in a dedicated auth-protected bucket (anti-scraping,
// 2026-07-12): storage.rules only admits approved accounts; the hosting
// sites no longer serve /data/*.json publicly.
export const datasetStorage = getStorage(app, 'gs://heatpumpdb-datasets');
