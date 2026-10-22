import { DateRangeFields } from '../components/DateRangeFields';
import { ExportButton } from '../components/ExportButton';
import { PageLoader } from '../components/PageLoader';
import { Pagination } from '../components/Pagination';
import { SosTable } from '../components/SosTable';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useListQuery } from '../hooks/useListQuery';
import type { SosListResponse } from '../types';

const PAGE_SIZE = 25;

// Every SOS: who sent it, when, who answered and how it ended. Never the
// place, the location or the message.
export default function SosPage() {
  useDocumentTitle('SOS');
  const { data, loading, error, filters, updateParams } = useListQuery<SosListResponse>(
    '/sos',
    ['kind', 'unanswered', 'from', 'to'],
    PAGE_SIZE,
  );

  return (
    <section className="page">
      <h1>SOS</h1>
      <p className="muted">
        Who sent an SOS, when, how many friends were alerted, who answered and how it ended. The place, location and
        message stay private.
      </p>

      <div className="filters">
        <div className="field">
          <label htmlFor="sos-kind">Kind</label>
          <select id="sos-kind" value={filters.kind} onChange={(event) => updateParams({ kind: event.target.value })}>
            <option value="">All</option>
            <option value="real">Real</option>
            <option value="test">Test</option>
          </select>
        </div>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={filters.unanswered === 'true'}
            onChange={(event) => updateParams({ unanswered: event.target.checked ? 'true' : '' })}
          />
          Only ones no one answered
        </label>
        <DateRangeFields idPrefix="sos" from={filters.from} to={filters.to} onChange={updateParams} />
        <ExportButton endpoint="/sos/export.csv" filters={filters} />
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {loading && !data ? <PageLoader /> : null}

      {data ? (
        <>
          <SosTable events={data.events} caption={`SOS records, page ${data.page} of ${data.pages}`} busy={loading} />
          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            noun={['SOS', 'SOS']}
            disabled={loading}
            onPage={(page) => updateParams({ page: String(page) })}
          />
        </>
      ) : null}
    </section>
  );
}
