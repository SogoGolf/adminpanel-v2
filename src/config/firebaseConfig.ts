import type { FirebaseOptions } from 'firebase/app';

// The production sign-in project. Any build that names no other project uses it, so
// production builds sign in exactly as they always have.
export const PRODUCTION_FIREBASE_CONFIG: Readonly<FirebaseOptions> = Object.freeze({
  apiKey: 'AIzaSyDvfxHglAehaICk_IveIAH1DCD1wHYmFm4',
  authDomain: 'sogo-golf.firebaseapp.com',
  databaseURL: 'https://sogo-golf.firebaseio.com',
  projectId: 'sogo-golf',
  storageBucket: 'sogo-golf.appspot.com',
  messagingSenderId: '719518718236',
});

const REQUIRED_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_APP_ID',
] as const;

const ALL_KEYS = [
  'VITE_FIREBASE_PROJECT_ID',
  ...REQUIRED_KEYS,
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
] as const;

function read(env: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = env[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/**
 * Picks the Firebase project the admin site signs in with, from the build's VITE_FIREBASE_* values.
 *
 * - None set: the production project (sogo-golf).
 * - VITE_FIREBASE_PROJECT_ID set: that project. VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN and
 *   VITE_FIREBASE_APP_ID must be set too; the storage bucket and sender ID are optional.
 * - Any other VITE_FIREBASE_* value without VITE_FIREBASE_PROJECT_ID: an error, so a half-configured
 *   build fails instead of mixing two projects' settings.
 *
 * The DEV site sets these in scripts/deploy-dev.sh to use the sogogolf-dev project, so DEV has its
 * own sign-in accounts and passwords.
 */
export function resolveFirebaseConfig(env: Readonly<Record<string, unknown>>): FirebaseOptions {
  const projectId = read(env, 'VITE_FIREBASE_PROJECT_ID');

  if (!projectId) {
    const stray = ALL_KEYS.filter((key) => read(env, key) !== undefined);
    if (stray.length > 0) {
      throw new Error(
        `${stray.join(', ')} ${stray.length === 1 ? 'is' : 'are'} set without VITE_FIREBASE_PROJECT_ID. ` +
          'Set all the Firebase values or none of them.',
      );
    }
    return { ...PRODUCTION_FIREBASE_CONFIG };
  }

  const missing = REQUIRED_KEYS.filter((key) => read(env, key) === undefined);
  if (missing.length > 0) {
    throw new Error(
      `VITE_FIREBASE_PROJECT_ID is ${projectId}, but ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not set.`,
    );
  }

  const config: FirebaseOptions = {
    apiKey: read(env, 'VITE_FIREBASE_API_KEY'),
    authDomain: read(env, 'VITE_FIREBASE_AUTH_DOMAIN'),
    projectId,
    appId: read(env, 'VITE_FIREBASE_APP_ID'),
  };

  const storageBucket = read(env, 'VITE_FIREBASE_STORAGE_BUCKET');
  if (storageBucket) config.storageBucket = storageBucket;

  const messagingSenderId = read(env, 'VITE_FIREBASE_MESSAGING_SENDER_ID');
  if (messagingSenderId) config.messagingSenderId = messagingSenderId;

  return config;
}
