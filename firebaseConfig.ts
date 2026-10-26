
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, CACHE_SIZE_UNLIMITED } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

/**
 * FIREBASE CONFIGURATION - LEADERSHIP SKILL BUILDER
 * 
 * Configured for project: leadership-skill-builder-7aba5
 */
export const stagingEnabled = import.meta.env.VITE_APP_ENV === 'staging';
export const freemiumEnabled = stagingEnabled && import.meta.env.VITE_FREEMIUM_ENABLED === 'true';
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

if (stagingEnabled && firebaseConfig.projectId !== 'leadership-skill-builder-stg') throw new Error('Staging must use its separate Firebase project.');
if (import.meta.env.VITE_FREEMIUM_ENABLED === 'true' && !stagingEnabled) throw new Error('Freemium is restricted to staging until production launch is authorised.');
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

/**
 * Initialize Firestore with persistent local cache.
 */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  }),
});

/**
 * Firebase Cloud Functions (europe-west1) — used to proxy all Gemini API
 * calls securely server-side. The real API key never reaches the browser.
 */
export const functions = getFunctions(app, "europe-west1");

if (import.meta.env.DEV && import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true') {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}
