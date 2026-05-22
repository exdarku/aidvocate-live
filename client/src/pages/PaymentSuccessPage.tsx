import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AxiosError } from 'axios';
import {
  PageLayout,
  Container,
  Card,
  Button,
  EmptyState,
  Loading,
  SearchIcon,
  LockIcon,
  CloudOffIcon,
  AlertIcon,
  InfoIcon,
} from '@/components/ui';
import { Receipt } from '@/components/app/Receipt';
import circleCheck from '@/assets/circle-check.png';
import { donationApi, type PublicReceipt } from '@/services/api';
import { useAuth } from '@/hooks';
import './paymentSuccessPage.css';

interface Props {
  reference?: string;
}

type LookupError = {
  kind: 'missing-ref' | 'not-found' | 'forbidden' | 'network' | 'other';
  message: string;
};

function classifyError(err: unknown): LookupError {
  if (err instanceof AxiosError) {
    if (err.response?.status === 404) {
      return {
        kind: 'not-found',
        message:
          "We couldn't find a donation with that reference. Double-check the link, or use the Receipt Lookup page to search manually.",
      };
    }
    if (err.response?.status === 403) {
      return {
        kind: 'forbidden',
        message:
          'This receipt belongs to a different account. Log in with the account that made the donation.',
      };
    }
    if (!err.response) {
      return { kind: 'network', message: "Can't reach the server. Check your connection and try again." };
    }
  }
  return {
    kind: 'other',
    message: err instanceof Error ? err.message : 'Something went wrong loading this receipt.',
  };
}

export default function PaymentSuccessPage({ reference }: Props) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [receipt, setReceipt] = useState<PublicReceipt | null>(null);
  const [error, setError] = useState<LookupError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!reference) {
      setError({ kind: 'missing-ref', message: 'No receipt reference in the URL.' });
      setLoading(false);
      return;
    }
    donationApi
      .getReceipt(reference)
      .then(setReceipt)
      .catch((e) => setError(classifyError(e)))
      .finally(() => setLoading(false));
  }, [reference]);

  if (loading) {
    return (
      <PageLayout>
        <Loading fullPage />
      </PageLayout>
    );
  }

  if (error || !receipt) {
    return (
      <PageLayout>
        <section className="payment-success">
          <Container size="narrow">
            <Card padding="lg">
              <EmptyState
                icon={
                  error?.kind === 'not-found' ? <SearchIcon /> :
                  error?.kind === 'forbidden' ? <LockIcon /> :
                  error?.kind === 'network' ? <CloudOffIcon /> :
                  error?.kind === 'missing-ref' ? <InfoIcon /> :
                  <AlertIcon />
                }
                title={
                  error?.kind === 'not-found'
                    ? 'Receipt not found'
                    : error?.kind === 'forbidden'
                      ? 'Receipt belongs to another account'
                      : error?.kind === 'missing-ref'
                        ? 'No reference provided'
                        : error?.kind === 'network'
                          ? "Can't reach the server"
                          : 'Could not load receipt'
                }
                description={error?.message ?? 'Unknown error.'}
                action={
                  <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Button variant="primary" onClick={() => navigate({ to: '/receipt' })}>
                      Open receipt lookup
                    </Button>
                    {error?.kind === 'forbidden' && (
                      <Button variant="secondary" onClick={() => navigate({ to: '/login' })}>
                        Go to login
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => navigate({ to: '/charities' })}>
                      Browse charities
                    </Button>
                  </div>
                }
              />
            </Card>
          </Container>
        </section>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <section className="payment-success">
        <Container size="narrow">
          <div className="payment-success__banner">
            <img src={circleCheck} alt="" className="payment-success__check" aria-hidden="true" />
            <div>
              <h1 className="payment-success__title">Donation successful</h1>
              <p className="payment-success__subtitle">
                {isAuthenticated
                  ? 'Your donation has been recorded.'
                  : 'Save this receipt — it is your only record as a guest.'}
              </p>
            </div>
          </div>

          <Receipt receipt={receipt} />

          <div className="payment-success__nav">
            {isAuthenticated ? (
              <Button variant="secondary" onClick={() => navigate({ to: '/donations' })}>
                View My Donations
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => navigate({ to: '/receipt', search: { ref: reference } })}
              >
                Look up this receipt later
              </Button>
            )}
            <Button variant="ghost" onClick={() => navigate({ to: '/charities' })}>
              Donate again
            </Button>
          </div>
        </Container>
      </section>
    </PageLayout>
  );
}
