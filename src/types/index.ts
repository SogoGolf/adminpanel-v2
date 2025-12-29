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
