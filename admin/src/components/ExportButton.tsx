import { useState } from 'react';
import { apiDownload, errorMessage } from '../api/client';

type Props = {
  /** e.g. '/activity/export.csv' */
  endpoint: string;
  /** The list's current filters (empty ones are left out). */
  filters?: Record<string, string>;
  label?: string;
};

// "Export CSV": the same records as the list, with its filters, as a
// spreadsheet (at most 10,000 rows). Every download is in the admin log.
export function ExportButton({ endpoint, filters = {}, label = 'Export CSV' }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const download = async () => {
    setBusy(true);
    setError('');
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
    try {
      await apiDownload(query ? `${endpoint}?${query}` : endpoint);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => void download()} disabled={busy} aria-busy={busy}>
        {busy ? 'Preparing…' : label}
      </button>
      {error ? (
        <span className="form-error" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}
