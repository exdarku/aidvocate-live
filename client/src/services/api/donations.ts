import { apiClient } from './client';
import type {
  CreateDonationInput,
  CreateDonationResponse,
  Donation,
  DonationWithProof,
  PublicReceipt,
} from './types';

export const donationApi = {
  create: async (data: CreateDonationInput): Promise<CreateDonationResponse> => {
    const { data: res } = await apiClient.post<CreateDonationResponse>('/donations', data);
    return res;
  },
  list: async (): Promise<Donation[]> => {
    const { data } = await apiClient.get<Donation[]>('/donations');
    return data;
  },
  getById: async (id: number): Promise<DonationWithProof> => {
    const { data } = await apiClient.get<DonationWithProof>(`/donations/${id}`);
    return data;
  },
  getByReference: async (ref: string): Promise<Donation> => {
    const { data } = await apiClient.get<Donation>(`/donations/by-reference/${ref}`);
    return data;
  },
  /**
   * Public receipt lookup — works for both authenticated and guest donations.
   * The 32-char unguessable reference acts as the bearer credential for guests.
   * Returns donation details without donor identity.
   */
  getReceipt: async (ref: string): Promise<PublicReceipt> => {
    const { data } = await apiClient.get<PublicReceipt>(`/donations/receipt/${ref}`);
    return data;
  },
};
