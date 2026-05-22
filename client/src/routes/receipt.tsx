import { createFileRoute } from '@tanstack/react-router';
import ReceiptLookupPage from '@/pages/ReceiptLookupPage';

type SearchParams = { ref?: string };

export const Route = createFileRoute('/receipt')({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    ref: typeof s.ref === 'string' ? s.ref : undefined,
  }),
  component: ReceiptLookupRoute,
});

function ReceiptLookupRoute() {
  const { ref } = Route.useSearch();
  return <ReceiptLookupPage initialRef={ref} />;
}
