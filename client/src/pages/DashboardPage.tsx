import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { PageLayout, Container, Card, Button, Loading, EmptyState } from '@/components/ui';
import { useAuth, useDonations } from '@/hooks';
import './dashboardPage.css';

function formatPHP(n: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: donations, loading: donationsLoading } = useDonations();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate({ to: '/login' });
  }, [authLoading, isAuthenticated, navigate]);

  if (authLoading || donationsLoading) {
    return (
      <PageLayout>
        <Loading fullPage />
      </PageLayout>
    );
  }

  const donationList = donations ?? [];
  const totalDonated = donationList.reduce((sum, d) => sum + d.amount, 0);
  const greeting = user?.firstName ? `Hello, ${user.firstName}` : `Hello, ${user?.email ?? 'there'}`;

  return (
    <PageLayout>
      <section className="dashboard">
        <Container>
          <div className="dashboard__header">
            <div>
              <h1>{greeting}</h1>
              <p>Welcome back to your dashboard.</p>
            </div>
            <Button variant="secondary" onClick={() => navigate({ to: '/charities' })}>
              Donate to a cause
            </Button>
          </div>

          <div className="stat-grid">
            <Card>
              <p className="stat-label">Total Donated</p>
              <p className="stat-value">{formatPHP(totalDonated)}</p>
            </Card>
            <Card>
              <p className="stat-label">Donations</p>
              <p className="stat-value">{donationList.length}</p>
            </Card>
            <Card>
              <p className="stat-label">Role</p>
              <p className="stat-value" style={{ textTransform: 'capitalize' }}>{user?.role ?? '—'}</p>
            </Card>
          </div>

          <h2 className="dashboard__section-title">Recent Donations</h2>
          {donationList.length === 0 ? (
            <EmptyState
              title="No donations yet"
              description="Pick a charity and make your first donation."
              action={<Button variant="primary" onClick={() => navigate({ to: '/charities' })}>Browse charities</Button>}
            />
          ) : (
            <div className="donation-list">
              {donationList.slice(0, 5).map((d) => (
                <Card key={d.id} className="donation-row">
                  <div>
                    <strong>{d.organizationName || d.ngoName}</strong>
                    {d.eventName && <div className="donation-row__sub">{d.eventName}</div>}
                    <div className="donation-row__sub">{new Date(d.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="donation-row__amount">
                    <div className="donation-row__money">{formatPHP(d.amount)}</div>
                    <div className="donation-row__sub">{d.paymentStatus || 'paid'}</div>
                  </div>
                </Card>
              ))}
              {donationList.length > 5 && (
                <Button variant="ghost" onClick={() => navigate({ to: '/donations' })}>
                  View all donations
                </Button>
              )}
            </div>
          )}
        </Container>
      </section>
    </PageLayout>
  );
}
