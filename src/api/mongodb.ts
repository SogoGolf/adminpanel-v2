import axios from 'axios';
import type { Golfer, Transaction, TransactionType, PaginatedResponse, Club, RoundDetail, RoundsPaginatedResponse, ClosedComp, ClosedCompParticipant, ClosedCompRound, ClosedCompLeaderboard } from '../types';
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
  clubIds?: string[]; // For multi-tenant filtering
}

export async function getAllGolfers(params: GetAllGolfersParams = {}): Promise<PaginatedResponse<Golfer>> {
  const { page = 1, pageSize = 20, search, firstName, lastName, email, golflinkNo, state, clubName, clubIds } = params;
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
      clubIds: clubIds && clubIds.length > 0 ? clubIds.join(',') : undefined,
    },
  });
  return response.data;
}

export async function getClubs(): Promise<Club[]> {
  const response = await api.get<Club[]>('/clubs');
  return response.data;
}

export interface GetAllRoundsParams {
  page?: number;
  pageSize?: number;
  golferName?: string;
  golflinkNo?: string;
  clubName?: string;
  state?: string;
  compType?: string;
  roundType?: string;
  isSubmitted?: boolean;
  roundDate?: string;
  clubIds?: string[]; // For multi-tenant filtering
}

export async function getAllRounds(params: GetAllRoundsParams = {}): Promise<RoundsPaginatedResponse> {
  const { page = 1, pageSize = 20, golferName, golflinkNo, clubName, state, compType, roundType, isSubmitted, roundDate, clubIds } = params;
  const response = await api.get<RoundsPaginatedResponse>('/rounds/search', {
    params: {
      page,
      pageSize,
      golferName: golferName || undefined,
      golflinkNo: golflinkNo || undefined,
      clubName: clubName || undefined,
      state: state || undefined,
      compType: compType || undefined,
      roundType: roundType || undefined,
      isSubmitted: isSubmitted !== undefined ? isSubmitted : undefined,
      roundDate: roundDate || undefined,
      clubIds: clubIds && clubIds.length > 0 ? clubIds.join(',') : undefined,
    },
  });
  return response.data;
}

export async function getRoundById(id: string): Promise<RoundDetail> {
  const response = await api.get<RoundDetail>(`/rounds/${id}`);
  return response.data;
}

// Notification API functions
export interface AudienceCountParams {
  audienceType: 'rounds-in-progress' | 'gender' | 'club' | 'state' | 'single';
  gender?: string;
  clubId?: string;
  state?: string;
  golflinkNo?: string;
  clubIds?: string[];
  requestingUserEmail: string;
}

export interface AudienceCountResponse {
  count: number;
  emails: string[];
}

export async function getNotificationAudienceCount(params: AudienceCountParams): Promise<AudienceCountResponse> {
  const { audienceType, gender, clubId, state, golflinkNo, clubIds, requestingUserEmail } = params;
  const response = await api.get<AudienceCountResponse>('/notifications/audience-count', {
    params: {
      audienceType,
      gender: gender || undefined,
      clubId: clubId || undefined,
      state: state || undefined,
      golflinkNo: golflinkNo || undefined,
      clubIds: clubIds && clubIds.length > 0 ? clubIds.join(',') : undefined,
      requestingUserEmail,
    },
  });
  return response.data;
}

export interface SendNotificationParams {
  title: string;
  message: string;
  audienceType: 'rounds-in-progress' | 'gender' | 'club' | 'state' | 'single';
  gender?: string;
  clubId?: string;
  state?: string;
  golflinkNo?: string;
  clubIds?: string[];
  requestingUserEmail: string;
}

export interface SendNotificationResponse {
  success: boolean;
  message: string;
  recipientCount: number;
  oneSignalResponse?: string;
}

export async function sendNotification(params: SendNotificationParams): Promise<SendNotificationResponse> {
  const { title, message, audienceType, gender, clubId, state, golflinkNo, clubIds, requestingUserEmail } = params;
  const response = await api.post<SendNotificationResponse>('/notifications/send',
    {
      title,
      message,
      audienceType,
      gender: gender || undefined,
      clubId: clubId || undefined,
      state: state || undefined,
      golflinkNo: golflinkNo || undefined,
    },
    {
      params: {
        requestingUserEmail,
        clubIds: clubIds && clubIds.length > 0 ? clubIds.join(',') : undefined,
      },
    }
  );
  return response.data;
}

// Closed Comps API functions
export interface GetClosedCompsParams {
  page?: number;
  pageSize?: number;
  status?: 'active' | 'closed';
  search?: string;
  ownerId?: string;
}

export async function getClosedComps(params: GetClosedCompsParams = {}): Promise<PaginatedResponse<ClosedComp>> {
  const { page = 1, pageSize = 20, status, search, ownerId } = params;
  const response = await api.get<PaginatedResponse<ClosedComp>>('/closedcomps', {
    params: {
      page,
      pageSize,
      status: status || undefined,
      search: search || undefined,
      ownerId: ownerId || undefined,
    },
  });
  return response.data;
}

export async function getClosedCompById(id: string): Promise<ClosedComp> {
  const response = await api.get<ClosedComp>(`/closedcomps/${id}`);
  return response.data;
}

export async function getClosedCompParticipants(compId: string, status?: string): Promise<ClosedCompParticipant[]> {
  const response = await api.get<ClosedCompParticipant[]>(`/closedcomps/${compId}/participants`, {
    params: { status: status || undefined },
  });
  return response.data;
}

export async function getClosedCompRounds(compId: string): Promise<ClosedCompRound[]> {
  const response = await api.get<ClosedCompRound[]>(`/closedcomps/${compId}/rounds`);
  return response.data;
}

export async function getClosedCompLeaderboard(compId: string): Promise<ClosedCompLeaderboard> {
  const response = await api.get<ClosedCompLeaderboard>(`/closedcomps/${compId}/leaderboard`);
  return response.data;
}

export async function updateClosedCompStatus(id: string, status: 'active' | 'closed'): Promise<void> {
  await api.patch(`/closedcomps/${id}/status`, { status });
}

export async function deleteClosedComp(id: string): Promise<void> {
  await api.delete(`/closedcomps/${id}`);
}

export async function updateParticipantStatus(
  compId: string,
  participantId: string,
  status: 'accepted' | 'blocked'
): Promise<void> {
  await api.patch(`/closedcomps/${compId}/participants/${participantId}/status`, { status });
}

export interface CreateClosedCompParams {
  name: string;
  ownerEmail: string;
  ownerName: string;
  ownerId?: string;
  compTypes: string[];
  maxRounds: number;
  holesPerRound: number;
  roundSelectionMode?: 'best' | 'first';
  prize?: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  timezone?: string;
  entityId?: string;
}

export async function createClosedComp(params: CreateClosedCompParams): Promise<ClosedComp> {
  const response = await api.post<ClosedComp>('/closedcomps', params);
  return response.data;
}

export interface UpdateClosedCompParams {
  name?: string;
  prize?: string;
  maxRounds?: number;
  holesPerRound?: number;
  roundSelectionMode?: 'best' | 'first';
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
  timezone?: string;
}

export async function updateClosedComp(id: string, params: UpdateClosedCompParams): Promise<ClosedComp> {
  const response = await api.patch<ClosedComp>(`/closedcomps/${id}`, params);
  return response.data;
}

// Search golfers for owner selection or invite
export async function searchGolfers(params: {
  search?: string;
  state?: string;
  clubName?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<Golfer>> {
  const response = await api.get<PaginatedResponse<Golfer>>('/golfers/all', {
    params: {
      page: params.page || 1,
      pageSize: params.pageSize || 10,
      search: params.search || undefined,
      state: params.state || undefined,
      clubName: params.clubName || undefined,
    },
  });
  return response.data;
}

// Invite a golfer to a closed comp
export async function inviteParticipant(compId: string, golferId: string): Promise<ClosedCompParticipant> {
  const response = await api.post<ClosedCompParticipant>(`/closedcomps/${compId}/participants`, { golferId });
  return response.data;
}
