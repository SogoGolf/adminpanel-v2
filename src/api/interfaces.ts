import type { Golfer, Transaction, TransactionType } from '../types';

/**
 * Repository interface for golfer operations.
 * Implementations: CosmosDB, MongoDB
 */
export interface IGolferRepository {
  getByGolflinkNo(golflinkNo: string): Promise<Golfer | null>;
  getById(id: string): Promise<Golfer | null>;
  searchByName(name: string): Promise<Golfer[]>;
}

/**
 * Repository interface for transaction operations.
 * Implementations: CosmosDB, MongoDB
 */
export interface ITransactionRepository {
  getForGolfer(golferId: string): Promise<Transaction[]>;
  getTypes(): Promise<TransactionType[]>;
  add(transaction: Transaction): Promise<Transaction>;
}

/**
 * Combined API interface
 */
export interface IApiClient {
  golfers: IGolferRepository;
  transactions: ITransactionRepository;
}
