import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTION_FIREBASE_CONFIG, resolveFirebaseConfig } from '../src/config/firebaseConfig.ts';

const DEV_ENV = {
  VITE_FIREBASE_PROJECT_ID: 'sogogolf-dev',
  VITE_FIREBASE_API_KEY: 'dev-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'sogogolf-dev.firebaseapp.com',
  VITE_FIREBASE_APP_ID: '1:613362712202:web:ff16547ea6370f6639f773',
  VITE_FIREBASE_STORAGE_BUCKET: 'sogogolf-dev.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '613362712202',
};

describe('resolveFirebaseConfig', () => {
  it('uses the production project when no Firebase values are set', () => {
    const config = resolveFirebaseConfig({});
    assert.deepEqual(config, { ...PRODUCTION_FIREBASE_CONFIG });
    assert.equal(config.projectId, 'sogo-golf');
  });

  it('uses the production project for a typical Vite production env with no Firebase values', () => {
    const config = resolveFirebaseConfig({
      MODE: 'production',
      DEV: false,
      PROD: true,
      SSR: false,
      BASE_URL: '/',
      VITE_API_PROVIDER: 'mongodb',
      VITE_MONGODB_API_URL: 'https://mongo-api-613362712202.australia-southeast1.run.app',
    });
    assert.equal(config.projectId, 'sogo-golf');
    assert.equal(config.authDomain, 'sogo-golf.firebaseapp.com');
  });

  it('treats blank and whitespace-only values as not set', () => {
    const config = resolveFirebaseConfig({
      VITE_FIREBASE_PROJECT_ID: '   ',
      VITE_FIREBASE_API_KEY: '',
      VITE_FIREBASE_APP_ID: '\t',
    });
    assert.equal(config.projectId, 'sogo-golf');
  });

  it('returns a copy, so changing the result never changes the production settings', () => {
    const config = resolveFirebaseConfig({});
    config.projectId = 'changed';
    assert.equal(PRODUCTION_FIREBASE_CONFIG.projectId, 'sogo-golf');
    assert.equal(resolveFirebaseConfig({}).projectId, 'sogo-golf');
  });

  it('keeps the production settings frozen', () => {
    assert.ok(Object.isFrozen(PRODUCTION_FIREBASE_CONFIG));
  });

  it('uses the named project when all its values are set', () => {
    assert.deepEqual(resolveFirebaseConfig(DEV_ENV), {
      apiKey: 'dev-api-key',
      authDomain: 'sogogolf-dev.firebaseapp.com',
      projectId: 'sogogolf-dev',
      appId: '1:613362712202:web:ff16547ea6370f6639f773',
      storageBucket: 'sogogolf-dev.appspot.com',
      messagingSenderId: '613362712202',
    });
  });

  it('never mixes in production values for a named project', () => {
    const config = resolveFirebaseConfig(DEV_ENV);
    assert.equal(config.databaseURL, undefined);
    assert.ok(!Object.values(config).some((value) => String(value).includes('sogo-golf')));
  });

  it('leaves out the optional storage bucket and sender ID when they are not set', () => {
    const config = resolveFirebaseConfig({
      VITE_FIREBASE_PROJECT_ID: 'sogogolf-dev',
      VITE_FIREBASE_API_KEY: 'dev-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'sogogolf-dev.firebaseapp.com',
      VITE_FIREBASE_APP_ID: 'app-id',
    });
    assert.deepEqual(Object.keys(config).sort(), ['apiKey', 'appId', 'authDomain', 'projectId']);
  });

  it('trims surrounding spaces from values', () => {
    const config = resolveFirebaseConfig({
      ...DEV_ENV,
      VITE_FIREBASE_PROJECT_ID: '  sogogolf-dev  ',
      VITE_FIREBASE_API_KEY: ' dev-api-key\n',
    });
    assert.equal(config.projectId, 'sogogolf-dev');
    assert.equal(config.apiKey, 'dev-api-key');
  });

  it('fails when a named project is missing its API key', () => {
    const env: Record<string, string> = { ...DEV_ENV };
    delete env.VITE_FIREBASE_API_KEY;
    assert.throws(
      () => resolveFirebaseConfig(env),
      /VITE_FIREBASE_PROJECT_ID is sogogolf-dev, but VITE_FIREBASE_API_KEY is not set\./,
    );
  });

  it('lists every missing required value', () => {
    assert.throws(
      () => resolveFirebaseConfig({ VITE_FIREBASE_PROJECT_ID: 'sogogolf-dev' }),
      /VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_APP_ID are not set\./,
    );
  });

  it('fails when Firebase values are set without a project ID', () => {
    const env: Record<string, string> = { ...DEV_ENV };
    delete env.VITE_FIREBASE_PROJECT_ID;
    assert.throws(() => resolveFirebaseConfig(env), /set without VITE_FIREBASE_PROJECT_ID/);
  });

  it('fails when a single stray Firebase value is set without a project ID', () => {
    assert.throws(
      () => resolveFirebaseConfig({ VITE_FIREBASE_APP_ID: 'app-id' }),
      /VITE_FIREBASE_APP_ID is set without VITE_FIREBASE_PROJECT_ID/,
    );
  });

  it('ignores non-string values', () => {
    const config = resolveFirebaseConfig({ VITE_FIREBASE_PROJECT_ID: true, VITE_FIREBASE_API_KEY: 42 });
    assert.equal(config.projectId, 'sogo-golf');
  });
});
