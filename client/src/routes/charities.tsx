import { createFileRoute } from '@tanstack/react-router';
import AllCharitiesPage from '@/pages/AllCharitiesPage';

export const Route = createFileRoute('/charities')({
  component: AllCharitiesPage,
});
