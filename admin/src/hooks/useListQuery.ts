import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { apiFetch, errorMessage } from '../api/client';

// A list page whose filters live in the URL (so the back button, a refresh
// or a shared link keep the same view), like the Users page. `keys` are the
// filters read from the URL and sent to `endpoint` with page and limit.
export function useListQuery<T>(endpoint: string, keys: string[], pageSize: number) {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const filters = Object.fromEntries(keys.map((key) => [key, searchParams.get(key) ?? '']));

  const query = new URLSearchParams({ page: String(page), limit: String(pageSize) });
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  const queryString = query.toString();

  const [data, setData] = useState<T | null>(null);
  // Which query the last answer belongs to: the old results stay on screen,
  // dimmed, until the new ones arrive.
  const [answered, setAnswered] = useState({ query: '', error: '' });
  const loading = answered.query !== queryString;
  const error = loading ? '' : answered.error;

  useEffect(() => {
    let cancelled = false;
    apiFetch<T>(`${endpoint}?${queryString}`)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setAnswered({ query: queryString, error: '' });
      })
      .catch((e: unknown) => {
        if (!cancelled) setAnswered({ query: queryString, error: errorMessage(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint, queryString]);

  const updateParams = (changes: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page'); // any filter change goes back to page 1
    setSearchParams(next);
  };

  return { data, loading, error, page, filters, updateParams };
}
