import { useResource } from './useResource';
import { eventApi, type EventItem } from '@/services/api';

export function useEvents(opts: { upcomingOnly?: boolean } = {}) {
  const fetcher = () => (opts.upcomingOnly ? eventApi.upcoming() : eventApi.list());
  return useResource<EventItem[]>(fetcher, [opts.upcomingOnly]);
}

export function useEvent(id: string | number | undefined) {
  return useResource<EventItem | null>(
    () => (id ? eventApi.getById(id) : Promise.resolve(null)),
    [id]
  );
}
