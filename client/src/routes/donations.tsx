import { createFileRoute } from '@tanstack/react-router';
import DonationHistoryPage from '@/pages/DonationHistoryPage';

export const Route = createFileRoute('/donations')({
  component: DonationHistoryPage,
});
