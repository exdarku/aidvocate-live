import { apiClient } from './client';
import type { Category } from './types';

export const categoryApi = {
  list: async (): Promise<Category[]> => {
    const { data } = await apiClient.get<Category[]>('/categories');
    return data;
  },
};
