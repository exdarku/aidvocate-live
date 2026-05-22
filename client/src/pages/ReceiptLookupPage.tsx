import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AxiosError } from 'axios';
import {
  PageLayout,
  Container,
  Card,
  Button,
  FormField,
  SectionTitle,
  EmptyState,
  SearchIcon,
  LockIcon,
  CloudOffIcon,
  AlertIcon,
  InfoIcon,
} from '@/components/ui';
import QRScanner from '@/components/app/QRScanner';
import { Receipt } from '@/components/app/Receipt';
import { donationApi, type PublicReceipt } from '@/services/api';
import { parseReferenceFromScan } from '@/utils/receiptUrl';

type ErrorKind = 'not-found' | 'forbidden' | 'network' | 'invalid' | 'other';

interface ErrorState {
  kind: ErrorKind;
  title: string;
  description: string;
  searched?: string;
}

interface Props { initialRef?: string; }

function classifyError(err: unknown, reference: string): ErrorState {
  if (err instanceof AxiosError) {
    if (err.response?.status === 404) {
      return {
        kind: 'not-found',
        title: 'No receipt found',
        description:
          "We couldn't find a donation with that reference. Double-check it for typos — references are 32 characters long and contain only letters a–f and digits 0–9.",
        searched: reference,
      };
    }
    if (err.response?.status === 403) {
      return {
        kind: 'forbidden',
        title: 'Receipt belongs to another account',
        description:
          "This receipt is tied to a different user. Log out and try again, or log in to the account that made the donation.",
        searched: reference,
      };
    }
    if (!err.response) {
      return {
        kind: 'network',
        title: "Can't reach the server",
        description: 'Check your internet connection and try again in a moment.',
      };
    }
  }
  const msg = err instanceof Error ? err.message : 'Something went wrong while looking up the receipt.';
  return {
    kind: 'other',
    title: 'Lookup failed',
    description: msg,
  };
}

export default function ReceiptLookupPage({ initialRef }: Props) {
  const navigate = useNavigate();
  const [inputRef, setInputRef] = useState(initialRef ?? '');
  const [receipt, setReceipt] = useState<PublicReceipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleScanDecode = (decoded: string) => {
    const ref = parseReferenceFromScan(decoded);
    if (!ref) {
      setError({
        kind: 'invalid',
        title: 'QR did not contain a receipt',
        description: `Decoded: "${decoded.slice(0, 80)}${decoded.length > 80 ? '…' : ''}"`,
      });
      return;
    }
    setInputRef(ref);
    doLookup(ref);
  };

  const validateRef = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return 'Please enter a reference.';
    if (trimmed.length < 6) return 'References are at least 6 characters.';
    return null;
  };

  const doLookup = async (reference: string) => {
    const trimmed = reference.trim();
    const invalid = validateRef(trimmed);
    if (invalid) {
      setError({ kind: 'invalid', title: 'Check the reference', description: invalid });
      return;
    }
    setLoading(true);
    setError(null);
    setReceipt(null);
    try {
      const r = await donationApi.getReceipt(trimmed);
      setReceipt(r);
    } catch (err) {
      setError(classifyError(err, trimmed));
    } finally {
      setLoading(false);
    }
  };

  // Auto-lookup if the URL already carried a ref
  useEffect(() => {
    if (initialRef) doLookup(initialRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageLayout>
      <section style={{ padding: 'var(--space-12) 0' }}>
        <Container size="narrow">
          <SectionTitle
            eyebrow="Receipt lookup"
            title="Find a donation"
            align="left"
          />
          <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-8)' }}>
            Paste your payment reference below to view the public details of a donation. Anyone with the
            reference can look it up — your donor identity (if any) stays private.
          </p>

          <Card padding="lg">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (inputRef.trim()) doLookup(inputRef.trim());
              }}
            >
              <FormField
                label="Payment reference"
                value={inputRef}
                onChange={(e) => setInputRef(e.target.value)}
                placeholder="AID-1778784100341-VESDK9"
                required
              />
              <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <Button type="submit" variant="primary" size="lg" isLoading={loading} style={{ flex: 1, minWidth: 0 }}>
                  Look up
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  onClick={() => setScannerOpen(true)}
                >
                  Scan QR
                </Button>
              </div>
            </form>

            {error && (
              <div style={{ marginTop: 'var(--space-5)' }}>
                <EmptyState
                  icon={
                    error.kind === 'network' ? <CloudOffIcon /> :
                    error.kind === 'forbidden' ? <LockIcon /> :
                    error.kind === 'invalid' ? <AlertIcon /> :
                    error.kind === 'not-found' ? <SearchIcon /> :
                    <InfoIcon />
                  }
                  title={error.title}
                  description={error.description}
                  action={
                    <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
                      {error.kind === 'not-found' && (
                        <>
                          <Button
                            variant="primary"
                            onClick={() => {
                              setError(null);
                              setInputRef('');
                            }}
                          >
                            Try a different reference
                          </Button>
                          <Button variant="ghost" onClick={() => navigate({ to: '/charities' })}>
                            Make a donation
                          </Button>
                        </>
                      )}
                      {error.kind === 'forbidden' && (
                        <Button variant="primary" onClick={() => navigate({ to: '/login' })}>
                          Go to login
                        </Button>
                      )}
                      {(error.kind === 'network' || error.kind === 'other') && (
                        <Button variant="primary" onClick={() => doLookup(inputRef)}>
                          Try again
                        </Button>
                      )}
                      {error.kind === 'invalid' && (
                        <Button variant="ghost" onClick={() => setError(null)}>
                          Got it
                        </Button>
                      )}
                    </div>
                  }
                />
                {error.searched && (
                  <p
                    style={{
                      textAlign: 'center',
                      marginTop: 'var(--space-3)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    Searched for: <code>{error.searched}</code>
                  </p>
                )}
              </div>
            )}

          </Card>

          {receipt && (
            <div style={{ marginTop: 'var(--space-6)' }}>
              <Receipt receipt={receipt} />
            </div>
          )}

          <QRScanner
            isOpen={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onDecode={handleScanDecode}
          />

          <div style={{ marginTop: 'var(--space-8)', textAlign: 'center' }}>
            <Button variant="ghost" onClick={() => navigate({ to: '/charities' })}>
              Browse charities
            </Button>
          </div>
        </Container>
      </section>
    </PageLayout>
  );
}

