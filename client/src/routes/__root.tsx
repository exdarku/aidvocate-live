import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { AuthProvider } from '@/hooks/useAuth';

export const Route = createRootRoute({
  component: () => (
    <AuthProvider>
      <Outlet />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </AuthProvider>
  ),
});
