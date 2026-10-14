const defaultMongoApiUrl = 'https://mongo-api-613362712202.australia-southeast1.run.app';

export const appEnv = (import.meta.env.VITE_APP_ENV || 'production').toLowerCase();
export const isNonProdEnvironment = appEnv !== 'production';
export const environmentBannerText =
  import.meta.env.VITE_ENV_BANNER_TEXT ||
  (isNonProdEnvironment ? `${appEnv.toUpperCase()} SITE` : '');

const mongoApiUrl = import.meta.env.VITE_MONGODB_API_URL || defaultMongoApiUrl;

const sanitizeKeyPart = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const cacheNamespaceParts = [
  appEnv,
  sanitizeKeyPart(mongoApiUrl),
].filter(Boolean);

export const cacheNamespace = cacheNamespaceParts.join('__');
export const queryCacheStorageKey = `sogo-admin-cache__${cacheNamespace}`;
export const roundsViewStorageKey = `rounds-view-state-v2__${cacheNamespace}`;
