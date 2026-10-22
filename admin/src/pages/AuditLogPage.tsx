import { Link } from 'react-router';
import { Address } from '../components/Address';
import { AddressToggle } from '../components/AddressToggle';
import { DateRangeFields } from '../components/DateRangeFields';
import { ExportButton } from '../components/ExportButton';
import { PageLoader } from '../components/PageLoader';
import { Pagination } from '../components/Pagination';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useListQuery } from '../hooks/useListQuery';
import type { AuditEntry, AuditListResponse } from '../types';
import { auditActionLabel, formatDateTime } from '../utils/format';

const PAGE_SIZE = 25;

// Why an admin login failed (adminAuthController), in plain words.
const LOGIN_REASONS: Record<string, string> = {
  unknown_email: 'no admin with that email',
  wrong_password: 'wrong password',
  wrong_password_now_locked: 'wrong password — now locked for 15 minutes',
  locked: 'account locked',
  disabled: 'account disabled',
};

// A few details worth showing in the table (the CSV has all of them).
function detailsOf(entry: AuditEntry): string {
  const d = entry.details ?? {};
  const parts: string[] = [];
  if (typeof d.reason === 'string') parts.push(`Reason: ${LOGIN_REASONS[d.reason] ?? d.reason}`);
  if (typeof d.days === 'number') parts.push(`${d.days} days`);
  if (typeof d.rows === 'number') parts.push(`${d.rows} rows`);
  if (typeof d.flagged === 'number') parts.push(`${d.flagged} flagged`);
  if (typeof d.role === 'string') parts.push(`Role: ${d.role}`);
  return parts.join(' · ');
}

// The admin log (super admins only, HANDOFF.md §52): every admin login and
// every action an admin took — kept for good. Admins' own accountability.
export default function AuditLogPage() {
  useDocumentTitle('Admin log');
  const { data, loading, error, filters, updateParams } = useListQuery<AuditListResponse>(
    '/audit',
    ['action', 'success', 'from', 'to'],
    PAGE_SIZE,
  );

  return (
    <section className="page">
      <h1>Admin log</h1>
      <p className="muted">
        Every admin login and every action an admin took — suspensions, deletions, records opened, downloads. Kept
        permanently, for accountability.
      </p>

      <div className="filters">
        <div className="field">
          <label htmlFor="audit-action">Action</label>
          <select id="audit-action" value={filters.action} onChange={(event) => updateParams({ action: event.target.value })}>
            <option value="">All</option>
            {(data?.actions ?? []).map((action) => (
              <option key={action} value={action}>
                {auditActionLabel(action)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="audit-result">Result</label>
          <select id="audit-result" value={filters.success} onChange={(event) => updateParams({ success: event.target.value })}>
            <option value="">All</option>
            <option value="true">Succeeded</option>
            <option value="false">Failed or refused</option>
          </select>
        </div>
        <DateRangeFields idPrefix="audit" from={filters.from} to={filters.to} onChange={updateParams} />
        <AddressToggle />
        <ExportButton endpoint="/audit/export.csv" filters={filters} />
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {loading && !data ? <PageLoader /> : null}

      {data ? (
        <>
          <div className="table-wrap" aria-busy={loading}>
            <table>
              <caption className="visually-hidden">{`Admin log, page ${data.page} of ${data.pages}`}</caption>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Admin</th>
                  <th scope="col">Action</th>
                  <th scope="col">About</th>
                  <th scope="col">Result</th>
                  <th scope="col">Address</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      Nothing matches these filters.
                    </td>
                  </tr>
                ) : (
                  data.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDateTime(entry.at)}</td>
                      <td>{entry.admin?.name ?? entry.email ?? 'Unknown'}</td>
                      <td>{auditActionLabel(entry.action)}</td>
                      <td>
                        {entry.target?.type === 'user' ? (
                          <Link to={`/users/${entry.target.id}`}>{entry.target.name ?? 'Deleted account'}</Link>
                        ) : entry.target?.type === 'admin' ? (
                          <>Admin: {entry.target.name ?? 'Deleted admin'}</>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${entry.success ? 'badge-success' : 'badge-danger'}`}>
                          {entry.success ? 'Succeeded' : 'Failed'}
                        </span>
                      </td>
                      <td>
                        <Address ip={entry.ip} />
                      </td>
                      <td className="muted">{detailsOf(entry)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            noun={['entry', 'entries']}
            disabled={loading}
            onPage={(page) => updateParams({ page: String(page) })}
          />
        </>
      ) : null}
    </section>
  );
}
