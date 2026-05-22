import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import {
  PageLayout,
  Container,
  Card,
  Button,
  FormField,
  SelectField,
  SectionTitle,
  RequireAuth,
} from '@/components/ui';
import { donationApi, ngoApi, type Ngo } from '@/services/api';

function DonateContent() {
  const navigate = useNavigate();
  const [ngos, setNgos] = useState<Ngo[]>([]);
  const [ngoId, setNgoId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    ngoApi
      .list()
      .then(setNgos)
      .catch((err) => toast.error(`Failed to load NGOs: ${err.message}`));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!ngoId || !amt || amt <= 0) {
      toast.error('Select an NGO and enter a positive amount.');
      return;
    }
    setLoading(true);
    try {
      const result = await donationApi.create({ ngoId: Number(ngoId), amount: amt });
      toast.success('Donation recorded');
      navigate({ to: '/payment-success', search: { ref: result.paymentReference } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Donation failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section style={{ padding: 'var(--space-12) 0' }}>
      <Container size="narrow">
        <SectionTitle
          eyebrow="Privacy-preserving"
          title="Make a Donation"
          align="left"
        />
        <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-8)' }}>
          Your donation is recorded as a cryptographic commitment. You'll get a salt receipt that lets you prove your
          donation later — without revealing the amount or recipient.
        </p>

        <Card padding="lg">
          <form onSubmit={handleSubmit}>
            <SelectField
              label="NGO"
              value={ngoId}
              onChange={(e) => setNgoId(e.target.value)}
              required
              options={ngos.map((n) => ({ value: n.id, label: n.name }))}
            />
            <FormField
              label="Amount (PHP)"
              type="number"
              min={1}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <div style={{ marginTop: 'var(--space-6)' }}>
              <Button type="submit" variant="primary" size="lg" fullWidth isLoading={loading}>
                Donate
              </Button>
            </div>
          </form>
        </Card>
      </Container>
    </section>
  );
}

export default function DonatePage() {
  return (
    <RequireAuth message="Log in to make a privacy-preserving donation.">
      <PageLayout>
        <DonateContent />
      </PageLayout>
    </RequireAuth>
  );
}
