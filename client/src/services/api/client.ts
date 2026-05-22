import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { User } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/* Storage keys are kept stable so existing sessions survive renames. */
const TOKEN_KEY = 'aidvocate_thesis_token';
const USER_KEY = 'aidvocate_thesis_user';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const removeToken = (): void => localStorage.removeItem(TOKEN_KEY);

export const getStoredUser = (): User | null => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
};
export const setStoredUser = (user: User): void =>
  localStorage.setItem(USER_KEY, JSON.stringify(user));
export const removeStoredUser = (): void => localStorage.removeItem(USER_KEY);

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * On 401 from a request that carried a token, the token is stale. Clear it so
 * the UI flips back to logged-out state instead of looping with a broken token.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && getToken()) {
      removeToken();
      removeStoredUser();
    }
    return Promise.reject(error);
  }
);
