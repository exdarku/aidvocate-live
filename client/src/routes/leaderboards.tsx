import { createFileRoute } from '@tanstack/react-router';
import LeaderboardsPage from '@/pages/LeaderboardsPage';

export const Route = createFileRoute('/leaderboards')({
  component: LeaderboardsPage,
});
