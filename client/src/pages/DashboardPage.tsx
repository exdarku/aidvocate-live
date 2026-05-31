import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { PageLayout, Container, Card, Button, Loading, EmptyState } from '@/components/ui';
import { useAuth, useDonations } from '@/hooks';
import { useResource } from '@/hooks/useResource';
import { leaderboardApi } from '@/services/api';
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
  const { data: leaderboard } = useResource(() => leaderboardApi.list(), []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) navigate({ to: '/login' });
    // NGOs get the batch-management console instead of the donor view.
    else if (user?.role === 'ngo') navigate({ to: '/ngo' });
  }, [authLoading, isAuthenticated, user?.role, navigate]);

  if (authLoading || donationsLoading) {
    return (
      <PageLayout>
        <Loading fullPage />
      </PageLayout>
    );
  }

  const donationList = donations ?? [];
  const totalDonated = donationList.reduce((sum, d) => sum + d.amount, 0);

  // A donation's name is its organization, falling back to the parent NGO.
  const causeName = (d: (typeof donationList)[number]) => d.organizationName || d.ngoName || 'Unknown cause';

  // Unique causes the donor has supported.
  const causesSupported = new Set(donationList.map(causeName)).size;

  // Donations already bundled into a Merkle batch are anchored for verification.
  const batchedCount = donationList.filter((d) => d.batchId != null).length;

  // Top causes by total amount (donor "impact" breakdown).
  const byCause = new Map<string, number>();
  for (const d of donationList) byCause.set(causeName(d), (byCause.get(causeName(d)) ?? 0) + d.amount);
  const topCauses = [...byCause.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  // The donor's own leaderboard standing, if they've donated enough to appear.
  const rank = leaderboard?.find((e) => e.userId === user?.id)?.rank ?? null;

  const greeting = user?.firstName ? `Hello, ${user.firstName}` : `Hello, ${user?.email ?? 'there'}`;
  const hasDonations = donationList.length > 0;

  return (
    <PageLayout>
      <section className="dashboard">
        <Container>
          <div className="dashboard__header">
            <div>
              <div className="dashboard__greet-row">
                <h1>{greeting}</h1>
                {rank != null && <span className="rank-badge" title="Your leaderboard rank">★ Rank #{rank}</span>}
              </div>
              <p>Thanks for being part of the change. Here's your giving at a glance.</p>
            </div>
            <div className="dashboard__actions">
              <Button variant="secondary" onClick={() => navigate({ to: '/charities' })}>
                Donate to a cause
              </Button>
              {hasDonations && (
                <Button variant="ghost" onClick={() => navigate({ to: '/donations' })}>
                  My donations
                </Button>
              )}
            </div>
          </div>

          <div className="stat-grid">
            <Card>
              <p className="stat-label">Total Donated</p>
              <p className="stat-value">{formatPHP(totalDonated)}</p>
            </Card>
            <Card>
              <p className="stat-label">Donations Made</p>
              <p className="stat-value">{donationList.length}</p>
            </Card>
            <Card>
              <p className="stat-label">Causes Supported</p>
              <p className="stat-value">{causesSupported}</p>
            </Card>
            <Card>
              <p className="stat-label">Anchored for Verification</p>
              <p className="stat-value">
                {batchedCount}
                <span className="stat-suffix">/ {donationList.length}</span>
              </p>
            </Card>
          </div>

          {hasDonations && topCauses.length > 0 && (
            <>
              <h2 className="dashboard__section-title">Your Top Causes</h2>
              <div className="top-causes">
                {topCauses.map((c) => (
                  <div className="top-cause" key={c.name}>
                    <div className="top-cause__head">
                      <span className="top-cause__name">{c.name}</span>
                      <span className="top-cause__amount">{formatPHP(c.amount)}</span>
                    </div>
                    <div className="top-cause__bar">
                      <div
                        className="top-cause__fill"
                        style={{ width: `${totalDonated ? (c.amount / totalDonated) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <h2 className="dashboard__section-title">Recent Donations</h2>
          {!hasDonations ? (
            <EmptyState
              title="No donations yet"
              description="Pick a charity and make your first donation — it'll show up here, ready to verify."
              action={<Button variant="primary" onClick={() => navigate({ to: '/charities' })}>Browse charities</Button>}
            />
          ) : (
            <div className="donation-list">
              {donationList.slice(0, 5).map((d) => (
                <Card key={d.id} className="donation-row">
                  <div>
                    <strong>{causeName(d)}</strong>
                    {d.eventName && <div className="donation-row__sub">{d.eventName}</div>}
                    <div className="donation-row__sub">{new Date(d.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="donation-row__right">
                    <div className="donation-row__amount">
                      <div className="donation-row__money">{formatPHP(d.amount)}</div>
                      <span className={`verify-pill ${d.batchId != null ? 'verify-pill--ready' : 'verify-pill--pending'}`}>
                        {d.batchId != null ? 'Verifiable' : 'Pending batch'}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate({ to: '/verify-donation', search: { id: d.id } })}
                    >
                      Verify
                    </Button>
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
