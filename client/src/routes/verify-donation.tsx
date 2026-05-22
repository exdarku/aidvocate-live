import { createFileRoute } from '@tanstack/react-router';
import VerifyDonationPage from '@/pages/VerifyDonationPage';

type VerifySearch = { id?: number };

export const Route = createFileRoute('/verify-donation')({
  validateSearch: (search: Record<string, unknown>): VerifySearch => ({
    id: search.id ? Number(search.id) : undefined,
  }),
  component: VerifyDonationRoute,
});

function VerifyDonationRoute() {
  const { id } = Route.useSearch();
  return <VerifyDonationPage donationId={id} />;
}
