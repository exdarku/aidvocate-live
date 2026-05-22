import { useResource } from './useResource';
import { organizationApi, type Organization } from '@/services/api';

export function useOrganizations() {
  return useResource<Organization[]>(() => organizationApi.list(), []);
}

export function useOrganization(id: string | number | undefined) {
  return useResource<Organization | null>(
    () => (id ? organizationApi.getById(id) : Promise.resolve(null)),
    [id]
  );
}
