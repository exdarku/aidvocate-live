import { apiClient } from './client';
import type { OnChainVerification, VerifyArtifacts } from './types';

export const verifyApi = {
  getArtifacts: async (): Promise<VerifyArtifacts> => {
    const { data } = await apiClient.get<VerifyArtifacts>('/verify/artifacts');
    return data;
  },
  verifyOnChain: async (
    proof: unknown,
    publicSignals: string[],
    batchId: number
  ): Promise<OnChainVerification> => {
    const { data } = await apiClient.post<OnChainVerification>('/verify/on-chain', {
      proof,
      publicSignals,
      batchId,
    });
    return data;
  },
};
