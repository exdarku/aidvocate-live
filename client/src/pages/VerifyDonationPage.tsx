import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  PageLayout,
  Container,
  Card,
  Button,
  FormField,
  SectionTitle,
  RequireAuth,
} from '@/components/ui';
import { donationApi, verifyApi } from '@/services/api';
import { generateDonationProof } from '@/services/zkp';

type Step = 'idle' | 'fetching' | 'proving' | 'verifying' | 'done' | 'error';

const STEP_LABELS: Record<Step, string> = {
  idle: '',
  fetching: 'Fetching donation + Merkle proof…',
  proving: 'Generating zero-knowledge proof in your browser…',
  verifying: 'Verifying on-chain…',
  done: '',
  error: '',
};

function VerifyContent({ donationId }: { donationId?: number }) {
  const [inputId, setInputId] = useState(donationId ? String(donationId) : '');
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ valid: boolean; batchId: number } | null>(null);
  const isBusy = step === 'fetching' || step === 'proving' || step === 'verifying';

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputId) return;
    setStep('fetching');
    setError(null);
    setResult(null);
    try {
      const donation = await donationApi.getById(Number(inputId));
      if (!donation.batchId || !donation.merkleProof) {
        throw new Error('Donation has not been batched yet — wait for the NGO to create a batch.');
      }
      setStep('proving');
      const { proof, publicSignals } = await generateDonationProof(donation, donation.merkleProof);
      setStep('verifying');
      const onChain = await verifyApi.verifyOnChain(proof, publicSignals, donation.batchId);
      setResult(onChain);
      setStep('done');
      toast.success(onChain.valid ? 'Proof verified on-chain' : 'Proof rejected');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      setError(message);
      setStep('error');
      toast.error(message);
    }
  };

  return (
    <section style={{ padding: 'var(--space-12) 0' }}>
      <Container size="narrow">
        <SectionTitle eyebrow="Zero-knowledge" title="Verify Donation" align="left" />
        <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-8)' }}>
          Generate a zero-knowledge proof that your donation exists in a Merkle root on the blockchain — without
          revealing the amount, recipient, or your identity.
        </p>

        <Card padding="lg">
          <form onSubmit={handleVerify}>
            <FormField
              label="Donation ID"
              type="number"
              min={1}
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              required
            />
            <div style={{ marginTop: 'var(--space-6)' }}>
              <Button type="submit" variant="primary" size="lg" fullWidth isLoading={isBusy}>
                {isBusy ? 'Working…' : 'Generate & verify proof'}
              </Button>
            </div>
          </form>

          {STEP_LABELS[step] && (
            <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
              {STEP_LABELS[step]}
            </p>
          )}

          {error && (
            <div
              style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-4)',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                color: '#991b1b',
              }}
            >
              {error}
            </div>
          )}

          {result && (
            <div
              style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-4)',
                background: result.valid ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${result.valid ? '#bbf7d0' : '#fecaca'}`,
                borderRadius: 'var(--radius-md)',
              }}
            >
              <p style={{ fontWeight: 700 }}>{result.valid ? 'Verified' : 'Invalid proof'}</p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                Batch ID: {result.batchId}
              </p>
            </div>
          )}
        </Card>
      </Container>
    </section>
  );
}

export default function VerifyDonationPage({ donationId }: { donationId?: number }) {
  return (
    <RequireAuth message="Log in to verify your donation.">
      <PageLayout>
        <VerifyContent donationId={donationId} />
      </PageLayout>
    </RequireAuth>
  );
}
