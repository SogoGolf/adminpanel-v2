import axios from 'axios';
import type {
  Golfer,
  Transaction,
  TransactionType,
  PaginatedResponse,
  Club,
  RoundDetail,
  RoundsPaginatedResponse,
  ClosedComp,
  ClosedCompParticipant,
  ClosedCompRound,
  ClosedCompLeaderboard,
  AuditLog,
  ScoreType,
  MobileAppVersionConfig,
  UpdateMobileAppVersionConfigRequest,
} from '../types';
import type { IApiClient, IGolferRepository, ITransactionRepository, IAuditLogRepository, GetAuditLogsParams } from './interfaces';

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

// Audit logs - uses CosmosDB directly, not MongoDB API
// This is a stub to satisfy the interface
const auditLogRepository: IAuditLogRepository = {
  async add(_log: AuditLog): Promise<AuditLog> {
    throw new Error('Audit logs are stored in CosmosDB, not MongoDB');
  },
  async getAll(_params?: GetAuditLogsParams): Promise<PaginatedResponse<AuditLog>> {
    throw new Error('Audit logs are stored in CosmosDB, not MongoDB');
  },
};

export const mongoDbClient: IApiClient = {
  golfers: golferRepository,
  transactions: transactionRepository,
  auditLogs: auditLogRepository,
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

export async function getScoreTypes(): Promise<ScoreType[]> {
  const response = await api.get<ScoreType[]>('/scoreTypes');
  return response.data;
}

export async function getMobileAppVersionConfig(requestingUserEmail: string): Promise<MobileAppVersionConfig> {
  const response = await api.get<MobileAppVersionConfig>('/mobileAppVersionConfig', {
    params: { requestingUserEmail },
  });
  return response.data;
}

export async function updateMobileAppVersionConfig(
  requestingUserEmail: string,
  config: UpdateMobileAppVersionConfigRequest,
): Promise<MobileAppVersionConfig> {
  const response = await api.put<MobileAppVersionConfig>('/mobileAppVersionConfig', config, {
    params: { requestingUserEmail },
  });
  return response.data;
}

export interface GetAllRoundsParams {
  page?: number;
  pageSize?: number;
  golferName?: string;
  golferFirstName?: string;
  golferLastName?: string;
  golflinkNo?: string;
  clubName?: string;
  state?: string;
  compType?: string;
  roundType?: string;
  operatingSystem?: string;
  isSubmitted?: boolean;
  roundDate?: string;
  roundDateFrom?: string;
  roundDateTo?: string;
  startTimeFrom?: string;
  startTimeTo?: string;
  handicapMin?: number;
  handicapMax?: number;
  holeCountMin?: number;
  holeCountMax?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  clubIds?: string[]; // For multi-tenant filtering
}

// Lightweight response for polling counts only
export interface RoundsCountResponse {
  todayInProgressCount: number;
  todayInProgressIosCount: number;
  todayInProgressAndroidCount: number;
  todaySubmittedCount: number;
  todaySubmittedIosCount: number;
  todaySubmittedAndroidCount: number;
}

export async function getAllRounds(params: GetAllRoundsParams = {}): Promise<RoundsPaginatedResponse> {
  const {
    page = 1,
    pageSize = 20,
    golferName,
    golferFirstName,
    golferLastName,
    golflinkNo,
    clubName,
    state,
    compType,
    roundType,
    operatingSystem,
    isSubmitted,
    roundDate,
    roundDateFrom,
    roundDateTo,
    startTimeFrom,
    startTimeTo,
    handicapMin,
    handicapMax,
    holeCountMin,
    holeCountMax,
    sortBy,
    sortDirection,
    clubIds,
  } = params;

  const response = await api.get<RoundsPaginatedResponse>('/rounds/search', {
    params: {
      page,
      pageSize,
      golferName: golferName || undefined,
      golferFirstName: golferFirstName || undefined,
      golferLastName: golferLastName || undefined,
      golflinkNo: golflinkNo || undefined,
      clubName: clubName || undefined,
      state: state || undefined,
      compType: compType || undefined,
      roundType: roundType || undefined,
      operatingSystem: operatingSystem || undefined,
      isSubmitted: isSubmitted !== undefined ? isSubmitted : undefined,
      roundDate: roundDate || undefined,
      roundDateFrom: roundDateFrom || undefined,
      roundDateTo: roundDateTo || undefined,
      startTimeFrom: startTimeFrom || undefined,
      startTimeTo: startTimeTo || undefined,
      handicapMin: handicapMin !== undefined ? handicapMin : undefined,
      handicapMax: handicapMax !== undefined ? handicapMax : undefined,
      holeCountMin: holeCountMin !== undefined ? holeCountMin : undefined,
      holeCountMax: holeCountMax !== undefined ? holeCountMax : undefined,
      sortBy: sortBy || undefined,
      sortDirection: sortDirection || undefined,
      clubIds: clubIds && clubIds.length > 0 ? clubIds.join(',') : undefined,
    },
  });
  return response.data;
}

/**
 * Lightweight polling for just the counts - uses pageSize=1 to minimize data transfer.
 * TODO: Replace with dedicated /rounds/counts endpoint when available.
 */
export async function getRoundsCounts(clubIds?: string[]): Promise<RoundsCountResponse> {
  const response = await api.get<RoundsPaginatedResponse>('/rounds/search', {
    params: {
      page: 1,
      pageSize: 1, // Minimize data transfer - we only need the counts
      clubIds: clubIds && clubIds.length > 0 ? clubIds.join(',') : undefined,
    },
  });
  return {
    todayInProgressCount: response.data.todayInProgressCount,
    todayInProgressIosCount: response.data.todayInProgressIosCount,
    todayInProgressAndroidCount: response.data.todayInProgressAndroidCount,
    todaySubmittedCount: response.data.todaySubmittedCount,
    todaySubmittedIosCount: response.data.todaySubmittedIosCount,
    todaySubmittedAndroidCount: response.data.todaySubmittedAndroidCount,
  };
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

// Audit Log API functions
export interface CreateAuditLogParams {
  action: string;
  performedBy: {
    id?: string;
    email: string;
    name?: string;
  };
  target?: {
    type?: string;
    id?: string;
    name?: string;
    email?: string;
  };
  details?: Record<string, unknown>;
}

export async function getAuditLogs(params: GetAuditLogsParams = {}): Promise<PaginatedResponse<AuditLog>> {
  const { page = 1, pageSize = 20, action, fromDate, toDate } = params;
  const response = await api.get<PaginatedResponse<AuditLog>>('/auditlogs', {
    params: {
      page,
      pageSize,
      action: action || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    },
  });
  return response.data;
}

export async function createAuditLog(params: CreateAuditLogParams): Promise<AuditLog> {
  const response = await api.post<AuditLog>('/auditlogs', params);
  return response.data;
}
