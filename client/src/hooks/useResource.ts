import { useEffect, useState } from 'react';

interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Run an async fetcher once on mount, return {data, loading, error}.
 * Deps array reruns the fetcher when any dep changes.
 */
export function useResource<T>(fetcher: () => Promise<T>, deps: unknown[] = []): ResourceState<T> & {
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher();
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch: run };
}
