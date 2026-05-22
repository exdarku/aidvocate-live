import type { ReactNode } from 'react';
import AuthDetails from './AuthDetails';
import './authLayout.css';

interface AuthLayoutProps {
  step: number;
  variant: 'login' | 'register';
  totalSteps?: number;
  children: ReactNode;
}

export function AuthLayout({ step, variant, totalSteps, children }: AuthLayoutProps) {
  return (
    <div className={`auth-page auth-page--${variant}`}>
      <AuthDetails step={step} totalSteps={totalSteps} />
      <div className="auth-container">{children}</div>
    </div>
  );
}
