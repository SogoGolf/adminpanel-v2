import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { resolveFirebaseConfig } from './config/firebaseConfig';

// Production builds set no VITE_FIREBASE_* values and use sogo-golf; the DEV site sets them (see scripts/deploy-dev.sh).
const app = initializeApp(resolveFirebaseConfig(import.meta.env));
export const auth = getAuth(app);
