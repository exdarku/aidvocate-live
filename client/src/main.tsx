// Aidvocate
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { Toaster } from 'react-hot-toast';
import { routeTree } from './routeTree.gen';
import { ErrorBoundary } from '@/components/ui';
import './styles/index.css';

// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1C1D28',
            color: '#FEFFF6',
            borderRadius: '12px',
            padding: '12px 16px',
          },
          success: {
            iconTheme: {
              primary: '#FCD384',
              secondary: '#1C1D28',
            },
          },
          error: {
            iconTheme: {
              primary: '#E25656',
              secondary: '#FEFFF6',
            },
          },
        }}
        />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
