import { apiClient } from './client';
import type { LeaderboardEntry } from './types';

export const leaderboardApi = {
  list: async (): Promise<LeaderboardEntry[]> => {
    const { data } = await apiClient.get<LeaderboardEntry[]>('/leaderboard');
    return data;
  },
};
