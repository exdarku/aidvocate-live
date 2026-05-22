import { createFileRoute } from '@tanstack/react-router';
import PaymentSuccessPage from '@/pages/PaymentSuccessPage';

type SearchParams = { ref?: string };

export const Route = createFileRoute('/payment-success')({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    ref: typeof s.ref === 'string' ? s.ref : undefined,
  }),
  component: PaymentSuccessRoute,
});

function PaymentSuccessRoute() {
  const { ref } = Route.useSearch();
  return <PaymentSuccessPage reference={ref} />;
}
