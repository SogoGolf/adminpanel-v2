import axios from 'axios';
import type { Golfer, Transaction, TransactionType } from '../types';

const API_BASE = import.meta.env.VITE_SOGO_API_URL || 'https://sogo-api.azure-api.net/sogo-general';
const API_KEY = import.meta.env.VITE_AZURE_API_KEY;

// Configure axios defaults
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'Ocp-Apim-Subscription-Key': API_KEY,
  },
});

// Query helper
async function query<T>(sql: string): Promise<T[]> {
  const response = await api.post('/postQuery', { query: sql });
  return response.data;
}

// Add document helper
async function addDocument<T>(document: T): Promise<T> {
  const response = await api.post('/postAdd', document);
  return response.data;
}

// Golfer queries
export async function getGolferByGolflinkNo(golflinkNo: string): Promise<Golfer | null> {
  const results = await query<Golfer>(
    `SELECT * FROM c WHERE c.type = "golfer" AND c.golflinkNo = "${golflinkNo}"`
  );
  return results.length > 0 ? results[0] : null;
}

export async function getGolferById(id: string): Promise<Golfer | null> {
  const results = await query<Golfer>(
    `SELECT * FROM c WHERE c.type = "golfer" AND c.id = "${id}"`
  );
  return results.length > 0 ? results[0] : null;
}

export async function searchGolfersByName(name: string): Promise<Golfer[]> {
  const searchTerm = name.toLowerCase();
  return query<Golfer>(
    `SELECT * FROM c WHERE c.type = "golfer" AND (LOWER(c.firstName) LIKE "%${searchTerm}%" OR LOWER(c.lastName) LIKE "%${searchTerm}%")`
  );
}

// Transaction queries
export async function getTransactionsForGolfer(golferId: string): Promise<Transaction[]> {
  return query<Transaction>(
    `SELECT * FROM c WHERE c.type = "transaction" AND c.golferId = "${golferId}" ORDER BY c.transactionDate DESC`
  );
}

export async function getTransactionTypes(): Promise<TransactionType[]> {
  return query<TransactionType>(
    `SELECT * FROM c WHERE c.type = "transactionType" ORDER BY c.name`
  );
}

export async function addTransaction(transaction: Transaction): Promise<Transaction> {
  return addDocument(transaction);
}
