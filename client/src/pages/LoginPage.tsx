import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import { AuthLayout } from '@/components/app/AuthLayout';
import { Button, FormField } from '@/components/ui';
import { useAuth } from '@/hooks';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login({ email, password });
    } catch {
      // toast handled in useAuth
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout step={1} variant="login">
      <p>WELCOME BACK</p>
      <h1>Log In to your Account</h1>

      <form onSubmit={handleSubmit}>
        <FormField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <FormField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        <div className="auth-meta">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            Remember me
          </label>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              toast('Password reset not yet available.');
            }}
          >
            Forgot Password?
          </a>
        </div>

        <div className="auth-actions">
          <Button type="submit" variant="primary" size="lg" fullWidth isLoading={loading}>
            Login
          </Button>
        </div>
      </form>

      <div className="auth-divider">Or</div>

      <div className="auth-footer">
        <p>New User?</p>
        <a
          href="/register"
          onClick={(e) => {
            e.preventDefault();
            navigate({ to: '/register' });
          }}
        >
          SIGN UP HERE
        </a>
      </div>
    </AuthLayout>
  );
}
