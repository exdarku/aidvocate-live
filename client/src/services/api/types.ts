/* Shared type definitions for the AidVocate API. */

export interface User {
  id: number;
  email: string;
  role: 'donor' | 'ngo';
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  contactNumber?: string | null;
  dob?: string | null;
  location?: string | null;
  interestedIn?: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Ngo {
  id: number;
  name: string;
  description: string | null;
}

export interface Organization {
  id: number;
  name: string;
  description: string | null;
  coverImage?: string | null;
  logo?: string | null;
  location?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  walletAddress?: string | null;
  ngoId?: number | null;
  categories?: string[];
  likeCount?: number;
  volunteerCount?: number;
  totalRaised?: number;
}

export interface EventItem {
  id: number;
  organizationId: number;
  name: string;
  description: string | null;
  image?: string | null;
  location?: string | null;
  dateStart: string;
  dateEnd?: string | null;
  categories?: string[];
  likeCount?: number;
  volunteerCount?: number;
  organization?: { id: number; name: string };
}

export interface Category {
  id: number;
  name: string;
}

export interface Donation {
  id: number;
  donorId: number;
  ngoId: number;
  ngoName?: string;
  organizationId?: number | null;
  organizationName?: string | null;
  eventId?: number | null;
  eventName?: string | null;
  amount: number;
  timestamp: number;
  salt: string;
  commitment: string;
  batchId: number | null;
  paymentStatus?: string;
  paymentReference?: string;
  description?: string | null;
  createdAt: string;
}

export interface CreateDonationInput {
  organizationId?: number;
  eventId?: number;
  ngoId?: number;
  amount: number;
  description?: string;
  /* Guest-only fields — ignored if authenticated. */
  guestName?: string;
  guestEmail?: string;
  guestContact?: string;
  isAnonymous?: boolean;
}

export interface CreateDonationResponse {
  id: number;
  commitment: string;
  salt: string;
  timestamp: number;
  paymentReference: string;
  payment_url: string;
  asGuest?: boolean;
  message: string;
}

export interface MerkleProof {
  pathElements: string[];
  pathIndices: number[];
  root: string;
}

export interface DonationWithProof extends Donation {
  merkleProof: MerkleProof | null;
}

export interface PublicReceipt {
  id: number;
  amount: number;
  timestamp: number;
  commitment: string;
  salt: string;
  batchId: number | null;
  paymentStatus: string;
  paymentReference: string;
  description: string | null;
  isAnonymous: number;
  createdAt: string;
  ngoName: string;
  organizationName: string | null;
  eventName: string | null;
}

export interface LeaderboardEntry {
  userId: number;
  name: string;
  username: string;
  totalDonated: number;
  donationCount: number;
  rank: number;
}

export interface BatchSummary {
  batchId: number;
  merkleRoot: string;
  donationCount: number;
  status: string;
}

export interface BatchSubmitResult {
  batchId: number;
  txHash: string;
  status: string;
}

export interface BatchListItem {
  id: number;
  merkleRoot: string;
  txHash: string | null;
  status: string;
  createdAt: string;
  donationCount: number;
  totalAmount: number;
}

export interface UnbatchedDonation {
  id: number;
  amount: number;
  createdAt: string;
  paymentReference?: string;
  ngoName?: string;
  organizationName?: string | null;
  eventName?: string | null;
}

export interface VerifyArtifacts {
  wasmUrl: string;
  zkeyUrl: string;
  vkeyUrl: string;
}

export interface OnChainVerification {
  valid: boolean;
  batchId: number;
}
