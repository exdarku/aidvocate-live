import { apiClient } from './client';
import type { BatchSubmitResult, BatchSummary, BatchListItem, UnbatchedDonation } from './types';

export const batchApi = {
  list: async (): Promise<BatchListItem[]> => {
    const { data } = await apiClient.get<BatchListItem[]>('/batches');
    return data;
  },
  listUnbatched: async (): Promise<UnbatchedDonation[]> => {
    const { data } = await apiClient.get<UnbatchedDonation[]>('/batches/unbatched');
    return data;
  },
  create: async (): Promise<BatchSummary> => {
    const { data } = await apiClient.post<BatchSummary>('/batches/create');
    return data;
  },
  submit: async (batchId: number): Promise<BatchSubmitResult> => {
    const { data } = await apiClient.post<BatchSubmitResult>(`/batches/${batchId}/submit`);
    return data;
  },
};
