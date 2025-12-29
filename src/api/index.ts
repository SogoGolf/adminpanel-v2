import type { IApiClient } from './interfaces';
import { cosmosDbClient } from './cosmosdb';
import { mongoDbClient } from './mongodb';

export type { IApiClient, IGolferRepository, ITransactionRepository } from './interfaces';

type ApiProvider = 'cosmosdb' | 'mongodb';

const API_PROVIDER: ApiProvider = (import.meta.env.VITE_API_PROVIDER as ApiProvider) || 'cosmosdb';

const clients: Record<ApiProvider, IApiClient> = {
  cosmosdb: cosmosDbClient,
  mongodb: mongoDbClient,
};

/**
 * The active API client based on VITE_API_PROVIDER env var.
 * Defaults to 'cosmosdb'.
 *
 * Usage:
 *   import { api } from '@/api';
 *   const golfer = await api.golfers.getByGolflinkNo('123');
 */
export const api: IApiClient = clients[API_PROVIDER];

// Also export individual clients for direct access if needed
export { cosmosDbClient, mongoDbClient };
