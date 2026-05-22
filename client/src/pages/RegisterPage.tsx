import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AuthLayout } from '@/components/app/AuthLayout';
import { Button, FormField, SelectField } from '@/components/ui';
import { useAuth } from '@/hooks';

const CITIES = [
  'Manila', 'Quezon City', 'Caloocan', 'Davao City', 'Cebu City', 'Zamboanga City',
  'Taguig', 'Antipolo', 'Pasig', 'Cagayan de Oro', 'Parañaque', 'Dasmariñas',
  'Valenzuela', 'Bacoor', 'General Santos', 'Las Piñas', 'Makati',
  'San Jose del Monte', 'Bacolod', 'Muntinlupa', 'Marikina', 'Iloilo City',
  'Pasay', 'Angeles', 'Lapu-Lapu', 'Imus', 'Mandaluyong', 'Baguio',
  'Santa Rosa', 'Biñan', 'Butuan', 'Tarlac City',
];

const INTERESTS = [
  'Education', 'Animal Welfare', 'Environment', 'Health Care', 'Child Protection',
  'Feeding Program', 'Mental Health', 'Community Support', 'Disaster Relief',
  'Elderly Care', 'Sustainability', 'Tree Planting',
];

interface AccountStep {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface ProfileStep {
  contactNumber: string;
  dob: string;
  location: string;
  interestedIn: string;
}

function deriveUsername(firstName: string, lastName: string): string {
  const initials = firstName.split(' ').map((w) => w[0] || '').join('');
  return (initials + lastName).replace(/\s+/g, '').toLowerCase().trim();
}

const TOTAL_STEPS = 2;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [account, setAccount] = useState<AccountStep>({
    firstName: '', lastName: '', email: '', password: '',
  });
  const [profile, setProfile] = useState<ProfileStep>({
    contactNumber: '', dob: '', location: '', interestedIn: '',
  });

  const advance = () => {
    setError(null);
    if (step === 1) {
      if (!account.firstName || !account.lastName || !account.email || !account.password) {
        setError('Please fill in all fields.');
        return;
      }
      if (account.password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      setStep(2);
      return;
    }

    if (!profile.contactNumber || !profile.dob || !profile.location || !profile.interestedIn) {
      setError('Please fill in all fields.');
      return;
    }
    submit();
  };

  const submit = async () => {
    setLoading(true);
    try {
      await register({
        email: account.email,
        password: account.password,
        role: 'donor',
        firstName: account.firstName,
        lastName: account.lastName,
        username: deriveUsername(account.firstName, account.lastName),
        contactNumber: profile.contactNumber,
        dob: profile.dob,
        location: profile.location,
        interestedIn: profile.interestedIn,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout step={step} variant="register" totalSteps={TOTAL_STEPS}>
      <p>{step === 1 ? "LET'S GET YOU STARTED" : 'ALMOST THERE'}</p>
      <h1>{step === 1 ? 'Create an Account' : 'Tell Us About You'}</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          advance();
        }}
      >
        {step === 1 && (
          <>
            <FormField
              label="First Name"
              value={account.firstName}
              onChange={(e) => setAccount({ ...account, firstName: e.target.value })}
              required
              autoComplete="given-name"
            />
            <FormField
              label="Last Name"
              value={account.lastName}
              onChange={(e) => setAccount({ ...account, lastName: e.target.value })}
              required
              autoComplete="family-name"
            />
            <FormField
              label="Email"
              type="email"
              value={account.email}
              onChange={(e) => setAccount({ ...account, email: e.target.value })}
              required
              autoComplete="email"
            />
            <FormField
              label="Password"
              type="password"
              value={account.password}
              onChange={(e) => setAccount({ ...account, password: e.target.value })}
              required
              autoComplete="new-password"
              hint="At least 8 characters"
            />
          </>
        )}

        {step === 2 && (
          <>
            <FormField
              label="Contact Number"
              type="tel"
              value={profile.contactNumber}
              onChange={(e) => setProfile({ ...profile, contactNumber: e.target.value })}
              required
              maxLength={11}
              autoComplete="tel"
            />
            <FormField
              label="Date of Birth"
              type="date"
              value={profile.dob}
              onChange={(e) => setProfile({ ...profile, dob: e.target.value })}
              required
            />
            <SelectField
              label="Location"
              value={profile.location}
              onChange={(e) => setProfile({ ...profile, location: e.target.value })}
              required
              options={CITIES.map((c) => ({ value: c, label: c }))}
            />
            <SelectField
              label="Interested In"
              value={profile.interestedIn}
              onChange={(e) => setProfile({ ...profile, interestedIn: e.target.value })}
              required
              options={INTERESTS.map((i) => ({ value: i, label: i }))}
            />
          </>
        )}

        {error && (
          <p style={{ color: 'var(--brand-heart)', marginTop: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
            {error}
          </p>
        )}

        <div className="auth-actions">
          <Button type="submit" variant="primary" size="lg" fullWidth isLoading={loading}>
            {step === TOTAL_STEPS ? 'Create Account' : 'Continue'}
          </Button>
          {step > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              fullWidth
              onClick={() => {
                setError(null);
                setStep(step - 1);
              }}
            >
              Back
            </Button>
          )}
        </div>
      </form>

      <div className="auth-footer" style={{ marginTop: 'var(--space-8)' }}>
        <p>Already have an account?</p>
        <a
          href="/login"
          onClick={(e) => {
            e.preventDefault();
            navigate({ to: '/login' });
          }}
        >
          LOGIN HERE
        </a>
      </div>
    </AuthLayout>
  );
}
