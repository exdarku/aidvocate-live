import { apiClient } from './client';
import type { BatchSubmitResult, BatchSummary } from './types';

export const batchApi = {
  create: async (): Promise<BatchSummary> => {
    const { data } = await apiClient.post<BatchSummary>('/batches/create');
    return data;
  },
  submit: async (batchId: number): Promise<BatchSubmitResult> => {
    const { data } = await apiClient.post<BatchSubmitResult>(`/batches/${batchId}/submit`);
    return data;
  },
};
