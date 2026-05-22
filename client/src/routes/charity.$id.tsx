import { createFileRoute } from '@tanstack/react-router';
import CharityDetailPage from '@/pages/CharityDetailPage';

export const Route = createFileRoute('/charity/$id')({
  component: CharityRoute,
});

function CharityRoute() {
  const { id } = Route.useParams();
  return <CharityDetailPage id={id} />;
}
