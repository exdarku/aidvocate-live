import { useResource } from './useResource';
import { donationApi, type Donation } from '@/services/api';

export function useDonations() {
  return useResource<Donation[]>(() => donationApi.list(), []);
}
