import { createFileRoute } from '@tanstack/react-router';
import NgoDashboardPage from '@/pages/NgoDashboardPage';

export const Route = createFileRoute('/ngo')({
  component: NgoDashboardPage,
});
