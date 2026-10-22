import { useState, type FormEvent } from 'react';
import { ActivityTable } from '../components/ActivityTable';
import { AddressToggle } from '../components/AddressToggle';
import { DateRangeFields } from '../components/DateRangeFields';
import { ExportButton } from '../components/ExportButton';
import { useAddressVisibility } from '../hooks/useAddressVisibility';
import { PageLoader } from '../components/PageLoader';
import { Pagination } from '../components/Pagination';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useListQuery } from '../hooks/useListQuery';
import type { ActivityListResponse, ActivityType } from '../types';
import { ACTIVITY_LABELS } from '../utils/format';

const PAGE_SIZE = 25;
const TYPES = Object.keys(ACTIVITY_LABELS) as ActivityType[];

// Everyone's login and activity records, newest first. Kept 90 days.
export default function ActivityPage() {
  useDocumentTitle('Activity');
  const { data, loading, error, filters, updateParams } = useListQuery<ActivityListResponse>(
    '/activity',
    ['type', 'ip', 'from', 'to'],
    PAGE_SIZE,
  );
  const { shown: showAddresses } = useAddressVisibility();
  const [draftIp, setDraftIp] = useState(filters.ip);
  // The address changed from outside the box (a link in the table).
  const [shownIp, setShownIp] = useState(filters.ip);
  if (filters.ip !== shownIp) {
    setShownIp(filters.ip);
    setDraftIp(filters.ip);
  }

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    updateParams({ ip: draftIp.trim() });
  };

  return (
    <section className="page">
      <h1>Activity</h1>
      <p className="muted">
        Logins, sign-ups, account changes and limits hit, with the phone and network address. Kept 90 days. Never what
        anyone said or sent.
      </p>

      <form className="filters" role="search" onSubmit={handleSearch}>
        <div className="field">
          <label htmlFor="activity-type">What</label>
          <select id="activity-type" value={filters.type} onChange={(event) => updateParams({ type: event.target.value })}>
            <option value="">All</option>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {ACTIVITY_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="field field-grow">
          <label htmlFor="activity-ip">Network address</label>
          <input
            id="activity-ip"
            // Dots while addresses are hidden, like everywhere else.
            type={showAddresses ? 'search' : 'password'}
            autoComplete="off"
            value={draftIp}
            onChange={(event) => setDraftIp(event.target.value)}
            maxLength={100}
          />
        </div>
        <DateRangeFields idPrefix="activity" from={filters.from} to={filters.to} onChange={updateParams} />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
        <AddressToggle />
        <ExportButton endpoint="/activity/export.csv" filters={filters} />
      </form>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {loading && !data ? <PageLoader /> : null}

      {data ? (
        <>
          <ActivityTable records={data.records} caption={`Activity, page ${data.page} of ${data.pages}`} busy={loading} />
          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            noun={['record', 'records']}
            disabled={loading}
            onPage={(page) => updateParams({ page: String(page) })}
          />
        </>
      ) : null}
    </section>
  );
}
