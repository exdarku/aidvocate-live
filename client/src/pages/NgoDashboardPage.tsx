import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import { PageLayout, Container, Card, Button, Loading, EmptyState } from '@/components/ui';
import { useAuth } from '@/hooks';
import { useResource } from '@/hooks/useResource';
import { batchApi } from '@/services/api';
import './dashboardPage.css';

function formatPHP(n: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

const short = (s: string | null | undefined, head = 10, tail = 6) =>
  !s ? '—' : s.length <= head + tail ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;

export default function NgoDashboardPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Role gate: only NGOs belong here; everyone else goes to the donor dashboard.
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) navigate({ to: '/login' });
    else if (user?.role !== 'ngo') navigate({ to: '/dashboard' });
  }, [authLoading, isAuthenticated, user?.role, navigate]);

  const { data: batches, loading: batchesLoading, refetch: refetchBatches } = useResource(
    () => batchApi.list(),
    []
  );
  const { data: unbatched, loading: unbatchedLoading, refetch: refetchUnbatched } = useResource(
    () => batchApi.listUnbatched(),
    []
  );

  const [creating, setCreating] = useState(false);
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  if (authLoading || user?.role !== 'ngo') {
    return (
      <PageLayout>
        <Loading fullPage />
      </PageLayout>
    );
  }

  const batchList = batches ?? [];
  const unbatchedList = unbatched ?? [];

  const unbatchedAmount = unbatchedList.reduce((s, d) => s + d.amount, 0);
  const batchedAmount = batchList.reduce((s, b) => s + Number(b.totalAmount || 0), 0);
  const batchedCount = batchList.reduce((s, b) => s + Number(b.donationCount || 0), 0);
  const totalRaised = unbatchedAmount + batchedAmount;
  const totalDonations = unbatchedList.length + batchedCount;
  const confirmedBatches = batchList.filter((b) => b.status === 'confirmed').length;

  const refetchAll = async () => {
    await Promise.all([refetchBatches(), refetchUnbatched()]);
  };

  const handleCreateBatch = async () => {
    if (unbatchedList.length === 0) return;
    setCreating(true);
    try {
      const res = await batchApi.create();
      toast.success(`Batch #${res.batchId} created with ${res.donationCount} donation(s).`);
      await refetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create batch');
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = async (batchId: number) => {
    setSubmittingId(batchId);
    try {
      const res = await batchApi.submit(batchId);
      toast.success(`Batch #${batchId} anchored on-chain (${short(res.txHash)}).`);
      await refetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'On-chain submission failed');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <PageLayout>
      <section className="dashboard">
        <Container>
          <div className="dashboard__header">
            <div>
              <div className="dashboard__greet-row">
                <h1>NGO Console</h1>
                <span className="rank-badge" title="Your role">NGO</span>
              </div>
              <p>{user?.email} — manage donation batches and anchor them on-chain.</p>
            </div>
            <div className="dashboard__actions">
              <Button
                variant="secondary"
                onClick={handleCreateBatch}
                isLoading={creating}
                disabled={unbatchedList.length === 0}
              >
                Create batch ({unbatchedList.length})
              </Button>
            </div>
          </div>

          <div className="stat-grid">
            <Card>
              <p className="stat-label">Total Raised</p>
              <p className="stat-value">{formatPHP(totalRaised)}</p>
            </Card>
            <Card>
              <p className="stat-label">Total Donations</p>
              <p className="stat-value">{totalDonations}</p>
            </Card>
            <Card>
              <p className="stat-label">Unbatched</p>
              <p className="stat-value">{unbatchedList.length}</p>
            </Card>
            <Card>
              <p className="stat-label">Batches (Confirmed)</p>
              <p className="stat-value">
                {batchList.length}
                <span className="stat-suffix">/ {confirmedBatches} on-chain</span>
              </p>
            </Card>
          </div>

          {/* Unbatched donations — the next "Create batch" sweeps these up */}
          <h2 className="dashboard__section-title">Unbatched Donations</h2>
          {unbatchedLoading ? (
            <Loading />
          ) : unbatchedList.length === 0 ? (
            <EmptyState
              title="Nothing to batch"
              description="All donations have been assigned to a batch. New donations will appear here."
            />
          ) : (
            <div className="donation-list">
              {unbatchedList.map((d) => (
                <Card key={d.id} className="donation-row">
                  <div>
                    <strong>{d.organizationName || d.ngoName || 'Unknown cause'}</strong>
                    {d.eventName && <div className="donation-row__sub">{d.eventName}</div>}
                    <div className="donation-row__sub">{new Date(d.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="donation-row__money">{formatPHP(d.amount)}</div>
                </Card>
              ))}
            </div>
          )}

          {/* Batches + on-chain status */}
          <h2 className="dashboard__section-title" style={{ marginTop: 'var(--space-12)' }}>
            Batches
          </h2>
          {batchesLoading ? (
            <Loading />
          ) : batchList.length === 0 ? (
            <EmptyState
              title="No batches yet"
              description="Create your first batch from the unbatched donations above."
            />
          ) : (
            <div className="donation-list">
              {batchList.map((b) => (
                <Card key={b.id} className="donation-row">
                  <div>
                    <strong>Batch #{b.id}</strong>
                    <span
                      className={`verify-pill ${b.status === 'confirmed' ? 'verify-pill--ready' : 'verify-pill--pending'}`}
                      style={{ marginLeft: 8 }}
                    >
                      {b.status === 'confirmed' ? 'On-chain' : 'Pending'}
                    </span>
                    <div className="donation-row__sub">
                      {b.donationCount} donation(s) · {formatPHP(Number(b.totalAmount || 0))}
                    </div>
                    <div className="donation-row__sub">root: {short(b.merkleRoot)}</div>
                    {b.txHash && <div className="donation-row__sub">tx: {short(b.txHash)}</div>}
                  </div>
                  <div className="donation-row__right">
                    {b.status === 'confirmed' ? (
                      <span className="verify-pill verify-pill--ready">Anchored</span>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        isLoading={submittingId === b.id}
                        onClick={() => handleSubmit(b.id)}
                      >
                        Submit on-chain
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Container>
      </section>
    </PageLayout>
  );
}
