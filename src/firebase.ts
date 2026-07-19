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
  // reCAPTCHA can't attest localhost, so dev exchanges a debug token instead.
  // Setting the flag to `true` works, but the token it mints is per browser
  // profile (the SDK keeps it in IndexedDB) and must be REGISTERED in the
  // console — an unregistered one is rejected with HTTP 403
  // (appCheck/fetch-status-error), which is what dev was hitting. Take the token
  // from VITE_APPCHECK_DEBUG_TOKEN so the project's already-registered one can be
  // shared across browser profiles and machines; fall back to a per-browser token
  // kept in localStorage. Either way it is printed below, ready to register.
  const KEY = 'hpdb.appcheck-debug-token';
  const token =
    (import.meta.env.VITE_APPCHECK_DEBUG_TOKEN as string | undefined) ||
    localStorage.getItem(KEY) ||
    crypto.randomUUID();
  localStorage.setItem(KEY, token);
  window.FIREBASE_APPCHECK_DEBUG_TOKEN = token;
  console.info(
    `[App Check] dev debug token: ${token}\n` +
    'Register it once: Firebase Console → App Check → Apps tab → the web app → ⋮ → Manage debug tokens → Add debug token.',
  );
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

// Default bucket — used only for manual-news hero images (news/manual/…),
// gated by storage.default.rules (admin write / approved read).
export const defaultStorage = getStorage(app);
