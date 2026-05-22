import { apiClient } from './client';
import type { Ngo } from './types';

export const ngoApi = {
  list: async (): Promise<Ngo[]> => {
    const { data } = await apiClient.get<Ngo[]>('/ngos');
    return data;
  },
};
