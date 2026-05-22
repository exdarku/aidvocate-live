import type { ReactNode } from 'react';
import Navigation from '@/components/app/Navigation';
import Footer from '@/components/app/Footer';

interface PageLayoutProps {
  children: ReactNode;
  hideNav?: boolean;
  hideFooter?: boolean;
}

export function PageLayout({ children, hideNav = false, hideFooter = false }: PageLayoutProps) {
  return (
    <div className="page-layout" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {!hideNav && <Navigation />}
      <main style={{ flex: 1 }}>{children}</main>
      {!hideFooter && <Footer />}
    </div>
  );
}
