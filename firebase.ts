import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { getAuth, signInAnonymously, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

export let analytics: Analytics | null = null;

if (typeof window !== 'undefined') {
  // Ensure we always have an authenticated session (anonymous) for storage/firestore rules
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      if (!auth.currentUser) {
        return signInAnonymously(auth).catch(() => {});
      }
    })
    .catch(() => {});

  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(firebaseApp);
      }
    })
    .catch(() => {
      // ignore analytics init errors in unsupported environments
    });
}


