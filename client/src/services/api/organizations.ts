import { apiClient } from './client';
import type { EventItem, Organization } from './types';

export const organizationApi = {
  list: async (): Promise<Organization[]> => {
    const { data } = await apiClient.get<Organization[]>('/organizations');
    return data;
  },
  getById: async (id: number | string): Promise<Organization> => {
    const { data } = await apiClient.get<Organization>(`/organizations/${id}`);
    return data;
  },
  getEvents: async (id: number | string): Promise<EventItem[]> => {
    const { data } = await apiClient.get<EventItem[]>(`/organizations/${id}/events`);
    return data;
  },
  like: async (id: number | string): Promise<void> => {
    await apiClient.post(`/organizations/${id}/like`);
  },
  unlike: async (id: number | string): Promise<void> => {
    await apiClient.delete(`/organizations/${id}/like`);
  },
  isLiked: async (id: number | string): Promise<boolean> => {
    try {
      const { data } = await apiClient.get<{ liked: boolean }>(`/organizations/${id}/liked`);
      return data.liked;
    } catch {
      return false;
    }
  },
  volunteer: async (id: number | string): Promise<void> => {
    await apiClient.post(`/organizations/${id}/volunteer`);
  },
  unvolunteer: async (id: number | string): Promise<void> => {
    await apiClient.delete(`/organizations/${id}/volunteer`);
  },
  isVolunteered: async (id: number | string): Promise<boolean> => {
    try {
      const { data } = await apiClient.get<{ volunteered: boolean }>(`/organizations/${id}/volunteered`);
      return data.volunteered;
    } catch {
      return false;
    }
  },
};
