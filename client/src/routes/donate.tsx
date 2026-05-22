import { createFileRoute } from '@tanstack/react-router';
import DonatePage from '@/pages/DonatePage';

export const Route = createFileRoute('/donate')({
  component: DonatePage,
});
