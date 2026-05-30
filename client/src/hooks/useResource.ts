import { useEffect, useRef, useState } from 'react';

interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Run an async fetcher once on mount, return {data, loading, error}.
 * Deps array reruns the fetcher when any dep changes.
 *
 * Each run is tagged so that only the most recent one may commit state — this
 * prevents a slow earlier request from overwriting a faster later one (a stale
 * response landing after the user has already navigated/changed inputs).
 */
export function useResource<T>(fetcher: () => Promise<T>, deps: unknown[] = []): ResourceState<T> & {
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Monotonic token: only results from the latest run are allowed to commit.
  const runIdRef = useRef(0);

  const run = async () => {
    const runId = ++runIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher();
      if (runId === runIdRef.current) setData(res);
    } catch (err) {
      if (runId === runIdRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (runId === runIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    run();
    // On unmount / dep change, invalidate the in-flight run so it can't commit.
    return () => {
      runIdRef.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch: run };
}
