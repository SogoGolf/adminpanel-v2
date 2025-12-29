export interface Golfer {
  id: string;
  type: 'golfer';
  firstName: string;
  lastName: string;
  email: string;
  golflinkNo: string;
  tokenBalance: number;
  memberSince?: string;
  gender?: string;
  dateOfBirth?: string;
  postcode?: string;
  state?: {
    shortName: string;
    name: string;
  };
  country?: string;
  appVersion?: string;
  deviceOS?: string;
  deviceOSVersion?: string;
}

export interface TransactionType {
  id: string;
  type: 'transactionType';
  name: string;
  shortDescription: string;
  debitOrCredit: 'credit' | 'debit';
}

export interface Transaction {
  id: string;
  type: 'transaction';
  golferId: string;
  golferEmail: string;
  golferFirstName: string;
  golferLastName: string;
  transactionDate: string;
  transactionValue: number;
  availableTokens: number;
  transactionType: TransactionType;
  transactionNotes?: string;
  createdDate: string;
  updateDate?: string;
  updateUserId?: string;
}

export interface NewTransaction {
  transactionTypeId: string;
  amount: number;
}

export interface TenantFeatures {
  canAddTokens: boolean;
  canViewRounds: boolean;
}

export interface TenantConfig {
  clubId: string;
  subdomain: string;
  name: string;
  logo: string;
  primaryColor: string;
  features: TenantFeatures;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface Club {
  id: string;
  type: 'club';
  name: string;
  glClubId: number;
  state?: {
    shortName: string;
    name: string;
  };
}

export interface RoundSummary {
  id: string;
  roundDate: string | null;
  startTime: string | null;
  golferFirstName: string | null;
  golferLastName: string | null;
  golflinkNo: string | null;
  clubName: string | null;
  clubState: string | null;
  compType: string | null;
  roundType: string | null;
  dailyHandicap: number | null;
  golfLinkHandicap: number | null;
  compScoreTotal: number | null;
  holeCount: number;
  completedHoleCount: number;
  isSubmitted: boolean | null;
}

export interface RoundsPaginatedResponse extends PaginatedResponse<RoundSummary> {
  todayInProgressCount: number;
  todaySubmittedCount: number;
}

export interface HoleScore {
  holeNumber: number;
  strokes: number;
  score: number;
  par: number;
  index1?: number;
  index2?: number;
  index3?: number;
  meters?: number;
}

export interface RoundDetail {
  id: string;
  roundDate?: string;
  golferFirstName?: string;
  golferLastName?: string;
  golflinkNo?: string;
  clubName?: string;
  clubState?: { shortName: string };
  compType?: string;
  roundType?: string;
  teeColor?: string;
  dailyHandicap?: number;
  golfLinkHandicap?: number;
  scratchRating?: number;
  slopeRating?: number;
  compScoreTotal?: number;
  isSubmitted?: boolean;
  holeScores?: HoleScore[];
  playingPartnerRound?: {
    golferFirstName?: string;
    golferLastName?: string;
    holeScores?: HoleScore[];
  };
}
