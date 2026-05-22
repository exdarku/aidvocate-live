import type { ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/hooks';
import { PageLayout } from './PageLayout';
import { Container } from './Container';
import { EmptyState } from './EmptyState';
import { Loading } from './Loading';
import { Button } from './Button';

interface RequireAuthProps {
  children: ReactNode;
  message?: string;
}

/**
 * Wrap any page that needs an authenticated user.
 * Shows a friendly "Login required" screen instead of letting API calls 401.
 */
export function RequireAuth({ children, message = 'Please log in to continue.' }: RequireAuthProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <PageLayout>
        <Loading fullPage />
      </PageLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageLayout>
        <Container size="narrow">
          <EmptyState
            title="Login required"
            description={message}
            action={
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
                <Button variant="primary" onClick={() => navigate({ to: '/login' })}>
                  Go to login
                </Button>
                <Button variant="ghost" onClick={() => navigate({ to: '/register' })}>
                  Create an account
                </Button>
              </div>
            }
          />
        </Container>
      </PageLayout>
    );
  }

  return <>{children}</>;
}
