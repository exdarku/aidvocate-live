import { useNavigate } from '@tanstack/react-router';
import { PageLayout, Container, EmptyState, Button } from '@/components/ui';

/** Catch-all page shown for any unmatched route. */
export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <PageLayout>
      <Container size="narrow">
        <EmptyState
          title="Page not found"
          description="The page you're looking for doesn't exist or has moved."
          action={
            <Button variant="primary" onClick={() => navigate({ to: '/' })}>
              Back to home
            </Button>
          }
        />
      </Container>
    </PageLayout>
  );
}

export default NotFoundPage;
