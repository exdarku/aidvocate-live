import { createFileRoute } from '@tanstack/react-router';
import EventDetailPage from '@/pages/EventDetailPage';

export const Route = createFileRoute('/event/$id')({
  component: EventRoute,
});

function EventRoute() {
  const { id } = Route.useParams();
  return <EventDetailPage id={id} />;
}
