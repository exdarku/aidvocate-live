import { apiClient, removeStoredUser, removeToken, setStoredUser, setToken } from './client';
import type { AuthResponse, User } from './types';

export const authApi = {
  register: async (data: Partial<User> & { email: string; password: string }): Promise<AuthResponse> => {
    const { data: res } = await apiClient.post<AuthResponse>('/auth/register', data);
    setToken(res.token);
    setStoredUser(res.user);
    return res;
  },
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password });
    setToken(data.token);
    setStoredUser(data.user);
    return data;
  },
  logout: (): void => {
    removeToken();
    removeStoredUser();
  },
  me: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/auth/me');
    return data;
  },
  isAuthenticated: async (): Promise<{ authenticated: boolean; user: User | null }> => {
    try {
      const { data } = await apiClient.get<{ authenticated: boolean; user: User }>('/auth/authenticated');
      return data;
    } catch {
      return { authenticated: false, user: null };
    }
  },
};
