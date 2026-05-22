// =============================================
// AidVocate TypeScript Type Definitions
// =============================================

// User Types
export type UserRole = 'DONOR' | 'NGO' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  avatarUrl?: string;
  kycVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// Charity Types
export interface Charity {
  id: string;
  name: string;
  description: string;
  shortDescription?: string;
  imageUrl?: string;
  categories: string[];
  walletAddress?: string;
  verified: boolean;
  totalRaised: number;
  totalVolunteers: number;
  totalLikes: number;
  isLiked?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CharityFilters {
  category?: string;
  search?: string;
  verified?: boolean;
  sortBy?: 'recent' | 'popular' | 'raised';
}

// Donation Types
export type DonationStatus =
  | 'PENDING'
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_CONFIRMED'
  | 'BLOCKCHAIN_RECORDED'
  | 'NGO_CONFIRMED'
  | 'COMPLETED'
  | 'DISPUTED'
  | 'FAILED';

export interface Donation {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  purpose?: string;
  status: DonationStatus;
  paymentMethod?: string;
  paymentTxId?: string;
  blockchainTxHash?: string;
  confidenceScore?: number;
  riskScore?: number;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  donor: User;
  charity: Charity;
  blockchainRecord?: BlockchainRecord;
}

export interface CreateDonationRequest {
  charityId: string;
  amount: number;
  purpose?: string;
  paymentMethod: 'GCASH' | 'PAYMAYA' | 'BANK';
}

export interface DonationResponse {
  donation: Donation;
  paymentUrl: string;
  reference: string;
  expiresAt: string;
}

// Blockchain Types
export interface BlockchainRecord {
  id: string;
  txHash: string;
  blockNumber: number;
  contractAddress: string;
  network: string;
  donorHash: string;
  ngoAddress: string;
  amountCentavos: number;
  recordedAt: string;
}

export interface BlockchainVerification {
  verified: boolean;
  donation?: {
    reference: string;
    amount: number;
    charityName: string;
    donorHash: string;
    timestamp: string;
    txHash: string;
    blockNumber: number;
  };
  error?: string;
}

// Event Types
export interface Event {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  location: string;
  startDate: string;
  endDate: string;
  maxParticipants?: number;
  currentParticipants: number;
  totalLikes: number;
  isLiked?: boolean;
  isJoined?: boolean;
  charity: Pick<Charity, 'id' | 'name' | 'imageUrl'>;
  createdAt: string;
  updatedAt: string;
}

export interface EventFilters {
  charityId?: string;
  upcoming?: boolean;
  search?: string;
}

// Leaderboard Types
export interface LeaderboardEntry {
  rank: number;
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  totalDonations: number;
  donationCount: number;
}

// Dashboard Types
export interface DashboardStats {
  totalCharities: number;
  totalDonations: number;
  totalRaised: number;
  totalVolunteers: number;
  recentDonations: Donation[];
  topCharities: Charity[];
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Form Types
export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

// Fraud Detection Types
export interface DPADResult {
  riskScore: number;
  flags: string[];
  recommendedAction: 'APPROVE' | 'FLAG' | 'BLOCK' | 'REVIEW';
  details: {
    velocity: number;
    accountAge: number;
    mlScore: number;
  };
}

export interface MTCSResult {
  confidenceScore: number;
  breakdown: {
    payment: number;
    reputation: number;
    pattern: number;
    oracle: number;
    context: number;
  };
  action: string;
  verificationLevel: string;
  delaySeconds?: number;
  explanation: string;
}
