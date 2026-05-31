/* Barrel export for the AidVocate API surface.
 * Import APIs as named groups: `import { donationApi } from '@/services/api'`.
 * Import types from the same module too: `import type { Donation } from '@/services/api'`. */

export { apiClient, getToken, setToken, removeToken, getStoredUser, setStoredUser, removeStoredUser } from './client';
export { authApi } from './auth';
export { ngoApi } from './ngos';
export { organizationApi } from './organizations';
export { eventApi } from './events';
export { categoryApi } from './categories';
export { leaderboardApi } from './leaderboard';
export { donationApi } from './donations';
export { batchApi } from './batches';
export { verifyApi } from './verify';

export type {
  User,
  AuthResponse,
  Ngo,
  Organization,
  EventItem,
  Category,
  Donation,
  DonationWithProof,
  CreateDonationInput,
  CreateDonationResponse,
  MerkleProof,
  PublicReceipt,
  LeaderboardEntry,
  BatchSummary,
  BatchSubmitResult,
  BatchListItem,
  UnbatchedDonation,
  VerifyArtifacts,
  OnChainVerification,
} from './types';
