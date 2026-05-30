import { createRootRoute, Outlet } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { AuthProvider } from '@/hooks/useAuth';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Lazy + dev-only so the devtools are never bundled into the production build.
const TanStackRouterDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-router-devtools').then((m) => ({
        default: m.TanStackRouterDevtools,
      }))
    )
  : () => null;

export const Route = createRootRoute({
  component: () => (
    <AuthProvider>
      <Outlet />
      <Suspense>
        <TanStackRouterDevtools />
      </Suspense>
    </AuthProvider>
  ),
  notFoundComponent: NotFoundPage,
});
