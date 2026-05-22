import { apiClient } from './client';
import type { EventItem } from './types';

export const eventApi = {
  list: async (): Promise<EventItem[]> => {
    const { data } = await apiClient.get<EventItem[]>('/events');
    return data;
  },
  upcoming: async (): Promise<EventItem[]> => {
    const { data } = await apiClient.get<EventItem[]>('/events/upcoming');
    return data;
  },
  getById: async (id: number | string): Promise<EventItem> => {
    const { data } = await apiClient.get<EventItem>(`/events/${id}`);
    return data;
  },
  like: async (id: number | string): Promise<void> => {
    await apiClient.post(`/events/${id}/like`);
  },
  unlike: async (id: number | string): Promise<void> => {
    await apiClient.delete(`/events/${id}/like`);
  },
  isLiked: async (id: number | string): Promise<boolean> => {
    try {
      const { data } = await apiClient.get<{ liked: boolean }>(`/events/${id}/liked`);
      return data.liked;
    } catch {
      return false;
    }
  },
  volunteer: async (id: number | string): Promise<void> => {
    await apiClient.post(`/events/${id}/volunteer`);
  },
  unvolunteer: async (id: number | string): Promise<void> => {
    await apiClient.delete(`/events/${id}/volunteer`);
  },
  isVolunteered: async (id: number | string): Promise<boolean> => {
    try {
      const { data } = await apiClient.get<{ volunteered: boolean }>(`/events/${id}/volunteered`);
      return data.volunteered;
    } catch {
      return false;
    }
  },
};
