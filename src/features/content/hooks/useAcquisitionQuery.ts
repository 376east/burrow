import { useEffect, useState } from 'react';

export function useAcquisitionQuery(initialQuery: string, debounceMs: number) {
  const [query, setQueryState] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  if (debounceMs <= 0 && debouncedQuery !== query) setDebouncedQuery(query);

  useEffect(() => {
    if (debounceMs <= 0) return;
    const timeoutId = window.setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => window.clearTimeout(timeoutId);
  }, [debounceMs, query]);

  return { query, setQueryState, debouncedQuery, setDebouncedQuery };
}
