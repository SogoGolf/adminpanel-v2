import axios from 'axios';
import type { Golfer, Transaction, TransactionType, PaginatedResponse, Club } from '../types';
import type { IApiClient, IGolferRepository, ITransactionRepository } from './interfaces';

const API_BASE = import.meta.env.VITE_MONGODB_API_URL || 'https://mongo-api-613362712202.australia-southeast1.run.app';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

const golferRepository: IGolferRepository = {
  async getByGolflinkNo(golflinkNo: string): Promise<Golfer | null> {
    try {
      const response = await api.get('/golfers', {
        params: { golflinkNo },
      });
      return response.data || null;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async getById(_id: string): Promise<Golfer | null> {
    // MongoDB API doesn't have getById - would need to be added or use different approach
    // For now, return null as this isn't used in current UI
    console.warn('getById not implemented for MongoDB API');
    return null;
  },

  async searchByName(_name: string): Promise<Golfer[]> {
    // MongoDB API doesn't have search by name endpoint yet
    console.warn('searchByName not implemented for MongoDB API');
    return [];
  },
};

const transactionRepository: ITransactionRepository = {
  async getForGolfer(_golferId: string, golferEmail?: string): Promise<Transaction[]> {
    // MongoDB API uses email to fetch transactions, not golferId
    // We need to pass email - this may require interface adjustment
    if (!golferEmail) {
      console.warn('MongoDB API requires golferEmail to fetch transactions');
      return [];
    }
    const response = await api.get('/transactions', {
      params: { email: golferEmail },
    });
    return response.data || [];
  },

  async getTypes(): Promise<TransactionType[]> {
    // MongoDB API doesn't have transaction types endpoint
    // Return hardcoded admin types for now
    return [
      {
        id: 'admin-credit',
        type: 'transactionType',
        name: 'Admin Credit',
        shortDescription: 'Manual credit by admin',
        debitOrCredit: 'credit',
      },
      {
        id: 'admin-debit',
        type: 'transactionType',
        name: 'Admin Debit',
        shortDescription: 'Manual debit by admin',
        debitOrCredit: 'debit',
      },
    ];
  },

  async add(transaction: Transaction): Promise<Transaction> {
    const response = await api.post('/transactions', transaction);
    return response.data;
  },
};

export const mongoDbClient: IApiClient = {
  golfers: golferRepository,
  transactions: transactionRepository,
};

// Direct API functions for MongoDB-specific endpoints
export interface GetAllGolfersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  golflinkNo?: string;
  state?: string;
  clubName?: string;
}

export async function getAllGolfers(params: GetAllGolfersParams = {}): Promise<PaginatedResponse<Golfer>> {
  const { page = 1, pageSize = 20, search, firstName, lastName, email, golflinkNo, state, clubName } = params;
  const response = await api.get<PaginatedResponse<Golfer>>('/golfers/all', {
    params: {
      page,
      pageSize,
      search: search || undefined,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      email: email || undefined,
      golflinkNo: golflinkNo || undefined,
      state: state || undefined,
      clubName: clubName || undefined,
    },
  });
  return response.data;
}

export async function getClubs(): Promise<Club[]> {
  const response = await api.get<Club[]>('/clubs');
  return response.data;
}
