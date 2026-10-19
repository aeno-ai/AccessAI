import { Link } from 'react-router';
import type { ActivityRecord } from '../types';
import { ACTIVITY_LABELS, PLATFORM_LABELS, activityDetails, formatDateTime } from '../utils/format';
import { Address } from './Address';

type ActivityTableProps = {
  records: ActivityRecord[];
  caption: string;
  // Hidden on one person's own page.
  showUser?: boolean;
  busy?: boolean;
};

// Login and activity records: what happened, when, from which phone and
// network address. Never what anyone said or sent.
export function ActivityTable({ records, caption, showUser = true, busy = false }: ActivityTableProps) {
  const columns = showUser ? 6 : 5;
  return (
    <div className="table-wrap" aria-busy={busy}>
      <table>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">When</th>
            {showUser ? <th scope="col">Account</th> : null}
            <th scope="col">What</th>
            <th scope="col">Details</th>
            <th scope="col">Phone</th>
            <th scope="col">Address</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr>
              <td colSpan={columns} className="empty">
                No records.
              </td>
            </tr>
          ) : (
            records.map((record) => (
              <tr key={record.id}>
                <td>{formatDateTime(record.at)}</td>
                {showUser ? (
                  <td>
                    {record.user ? (
                      <Link to={`/users/${record.user.id}`}>{record.user.name || record.user.email}</Link>
                    ) : (
                      <span className="muted">No account</span>
                    )}
                  </td>
                ) : null}
                <td>
                  <span className={`badge ${badgeFor(record.type)}`}>{ACTIVITY_LABELS[record.type]}</span>
                </td>
                <td>{activityDetails(record) || '—'}</td>
                <td>
                  {PLATFORM_LABELS[record.platform]}
                  {record.appVersion ? ` · ${record.appVersion}` : ''}
                </td>
                <td>
                  <Address ip={record.ip} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function badgeFor(type: ActivityRecord['type']): string {
  if (type === 'login.failed' || type === 'login.refused' || type === 'limit.hit') return 'badge-warning';
  if (type === 'login.success' || type === 'signup') return 'badge-success';
  return '';
}
