import type { Golfer, Transaction, TransactionType, AuditLog, AuditAction, PaginatedResponse } from '../types';

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
 * Query parameters for fetching audit logs.
 */
export interface GetAuditLogsParams {
  page?: number;
  pageSize?: number;
  action?: AuditAction;
  performedByEmail?: string;
  fromDate?: string;
  toDate?: string;
}

/**
 * Repository interface for audit log operations.
 * Implementations: CosmosDB
 */
export interface IAuditLogRepository {
  add(log: AuditLog): Promise<AuditLog>;
  getAll(params?: GetAuditLogsParams): Promise<PaginatedResponse<AuditLog>>;
}

/**
 * Combined API interface
 */
export interface IApiClient {
  golfers: IGolferRepository;
  transactions: ITransactionRepository;
  auditLogs: IAuditLogRepository;
}
