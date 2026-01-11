import axios from 'axios';
import type { Golfer, Transaction, TransactionType, AuditLog, PaginatedResponse } from '../types';
import type { IApiClient, IGolferRepository, ITransactionRepository, IAuditLogRepository, GetAuditLogsParams } from './interfaces';

const API_BASE = import.meta.env.VITE_SOGO_API_URL || 'https://sogo-api.azure-api.net/sogo-general';
const API_KEY = import.meta.env.VITE_AZURE_API_KEY;

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'Ocp-Apim-Subscription-Key': API_KEY,
  },
});

async function query<T>(sql: string): Promise<T[]> {
  const response = await api.post('/postQuery', { query: sql });
  return response.data;
}

async function addDocument<T>(document: T): Promise<T> {
  const response = await api.post('/postAdd', document);
  return response.data;
}

const golferRepository: IGolferRepository = {
  async getByGolflinkNo(golflinkNo: string): Promise<Golfer | null> {
    const results = await query<Golfer>(
      `SELECT * FROM c WHERE c.type = "golfer" AND c.golflinkNo = "${golflinkNo}"`
    );
    return results.length > 0 ? results[0] : null;
  },

  async getById(id: string): Promise<Golfer | null> {
    const results = await query<Golfer>(
      `SELECT * FROM c WHERE c.type = "golfer" AND c.id = "${id}"`
    );
    return results.length > 0 ? results[0] : null;
  },

  async searchByName(name: string): Promise<Golfer[]> {
    const searchTerm = name.toLowerCase();
    return query<Golfer>(
      `SELECT * FROM c WHERE c.type = "golfer" AND (LOWER(c.firstName) LIKE "%${searchTerm}%" OR LOWER(c.lastName) LIKE "%${searchTerm}%")`
    );
  },
};

const transactionRepository: ITransactionRepository = {
  async getForGolfer(golferId: string): Promise<Transaction[]> {
    return query<Transaction>(
      `SELECT * FROM c WHERE c.type = "transaction" AND c.golferId = "${golferId}" ORDER BY c.transactionDate DESC`
    );
  },

  async getTypes(): Promise<TransactionType[]> {
    return query<TransactionType>(
      `SELECT * FROM c WHERE c.type = "transactionType" ORDER BY c.name`
    );
  },

  async add(transaction: Transaction): Promise<Transaction> {
    return addDocument(transaction);
  },
};

const auditLogRepository: IAuditLogRepository = {
  async add(log: AuditLog): Promise<AuditLog> {
    return addDocument(log);
  },

  async getAll(params: GetAuditLogsParams = {}): Promise<PaginatedResponse<AuditLog>> {
    const { page = 1, pageSize = 20, action, performedByEmail, fromDate, toDate } = params;

    // Build WHERE clauses
    const conditions: string[] = ['c.type = "auditLog"'];
    if (action) {
      conditions.push(`c.action = "${action}"`);
    }
    if (performedByEmail) {
      conditions.push(`c.performedBy.email = "${performedByEmail}"`);
    }
    if (fromDate) {
      conditions.push(`c.timestamp >= "${fromDate}"`);
    }
    if (toDate) {
      conditions.push(`c.timestamp <= "${toDate}"`);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count (SELECT VALUE returns array of numbers)
    const countResult = await query<number>(
      `SELECT VALUE COUNT(1) FROM c WHERE ${whereClause}`
    );
    const totalCount = countResult[0] ?? 0;

    // Get paginated results
    const offset = (page - 1) * pageSize;
    const logs = await query<AuditLog>(
      `SELECT * FROM c WHERE ${whereClause} ORDER BY c.timestamp DESC OFFSET ${offset} LIMIT ${pageSize}`
    );

    return {
      data: logs,
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  },
};

export const cosmosDbClient: IApiClient = {
  golfers: golferRepository,
  transactions: transactionRepository,
  auditLogs: auditLogRepository,
};
