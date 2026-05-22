import { createFileRoute } from '@tanstack/react-router';
import AllEventsPage from '@/pages/AllEventsPage';

export const Route = createFileRoute('/events')({
  component: AllEventsPage,
});
