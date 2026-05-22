import { useNavigate } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import {
  PageLayout,
  Container,
  Card,
  Button,
  SectionTitle,
  Loading,
  EmptyState,
  RequireAuth,
} from '@/components/ui';
import { useDonations } from '@/hooks';

function formatPHP(n: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function HistoryContent() {
  const navigate = useNavigate();
  const { data, loading, error } = useDonations();

  if (loading) return <Loading fullPage />;
  if (error) {
    toast.error(error.message);
    return (
      <Container size="narrow">
        <EmptyState
          title="Could not load donations"
          description={error.message}
          action={<Button onClick={() => window.location.reload()}>Retry</Button>}
        />
      </Container>
    );
  }

  const donations = data ?? [];

  return (
    <section style={{ padding: 'var(--space-12) 0' }}>
      <Container>
        <SectionTitle eyebrow="Your history" title="My Donations" align="left" />

        {donations.length === 0 ? (
          <EmptyState
            title="No donations yet"
            description="When you make a donation it will appear here."
            action={<Button onClick={() => navigate({ to: '/charities' })}>Browse charities</Button>}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {donations.map((d) => (
              <Card key={d.id}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 'var(--space-4)',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <strong>{d.organizationName || d.ngoName}</strong>
                    {d.eventName && (
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                        {d.eventName}
                      </div>
                    )}
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                      {new Date(d.createdAt).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>
                      Batch: {d.batchId ?? 'pending'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>{formatPHP(d.amount)}</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate({ to: '/verify-donation', search: { id: d.id } })}
                    >
                      Verify
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}

export default function DonationHistoryPage() {
  return (
    <RequireAuth message="Log in to see your donation history.">
      <PageLayout>
        <HistoryContent />
      </PageLayout>
    </RequireAuth>
  );
}
