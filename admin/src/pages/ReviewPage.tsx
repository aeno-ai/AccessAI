import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { apiFetch, errorMessage } from '../api/client';
import { useAuth } from '../auth/auth-context';
import { Address } from '../components/Address';
import { AddressToggle } from '../components/AddressToggle';
import { ExportButton } from '../components/ExportButton';
import { PageLoader } from '../components/PageLoader';
import { SuspendDialog } from '../components/SuspendDialog';
import { UserStatusBadge } from '../components/UserStatusBadge';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { AppUser, ReviewItem, ReviewResponse, Severity } from '../types';
import {
  REVIEW_RULE_TEXT,
  REVIEW_SIGN_LABELS,
  SEVERITY_BADGES,
  SEVERITY_LABELS,
  USER_TYPE_LABELS,
  describeFlag,
  formatDateTime,
} from '../utils/format';

const activityFrom = (ip: string | null) => `/activity?ip=${encodeURIComponent(ip ?? '')}`;
const SEVERITIES: Severity[] = ['high', 'medium', 'low'];

// Suspicious Activities (HANDOFF.md §43, §52): accounts and network
// addresses that set off a warning rule in the last 24 hours, most serious
// first, each with what exactly was captured. Nothing is blocked by this —
// an admin looks and decides (and can act from here).
export default function ReviewPage() {
  useDocumentTitle('Suspicious Activities');
  const { hasPermission } = useAuth();
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [error, setError] = useState('');
  const [severity, setSeverity] = useState<Severity | ''>('');
  const [suspending, setSuspending] = useState<AppUser | null>(null);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    let cancelled = false;
    apiFetch<ReviewResponse>('/review')
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(load, [load]);

  // One click from a flag: load the account, then the same Suspend dialog as its page.
  const startSuspend = async (item: ReviewItem) => {
    if (!item.user) return;
    setActionError('');
    try {
      const { user } = await apiFetch<{ user: AppUser }>(`/users/${item.user.id}`);
      setSuspending(user);
    } catch (e) {
      setActionError(errorMessage(e));
    }
  };

  const items = data?.items.filter((item) => !severity || item.severity === severity) ?? [];
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, data?.items.filter((item) => item.severity === s).length ?? 0]));

  return (
    <section className="page">
      <h1>Suspicious Activities</h1>
      <p className="muted">
        Accounts and network addresses that set off a warning rule in the last 24 hours, most serious first, with
        exactly what was captured. Nothing is blocked automatically; review each one and decide.
      </p>

      {data ? (
        <ul className="severity-summary" aria-label="Flagged in the last 24 hours">
          {SEVERITIES.map((s) => (
            <li key={s}>
              <span className={`badge ${SEVERITY_BADGES[s]}`}>{SEVERITY_LABELS[s]}</span>
              <strong>{counts[s]}</strong>
            </li>
          ))}
          <li className="muted">since {formatDateTime(data.since)}</li>
        </ul>
      ) : null}

      <div className="filters">
        <div className="field">
          <label htmlFor="review-severity">Severity</label>
          <select id="review-severity" value={severity} onChange={(event) => setSeverity(event.target.value as Severity | '')}>
            <option value="">All</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <AddressToggle />
        <ExportButton endpoint="/review/export.csv" />
      </div>

      {data ? (
        <details className="rules">
          <summary>How flags are raised</summary>
          <ul>
            {data.rules.map((rule) => (
              <li key={rule.id}>
                <span className={`badge ${SEVERITY_BADGES[rule.severity]}`}>{SEVERITY_LABELS[rule.severity]}</span>{' '}
                <strong>{REVIEW_SIGN_LABELS[rule.id]}:</strong> {REVIEW_RULE_TEXT[rule.id](rule.threshold)}.
              </li>
            ))}
            <li>An entry with three or more flags is always High.</li>
          </ul>
        </details>
      ) : null}

      {error || actionError ? (
        <p className="form-error" role="alert">
          {error || actionError}
        </p>
      ) : null}
      {notice ? (
        <p className="notice notice-success" role="status">
          {notice}
        </p>
      ) : null}
      {!data && !error ? <PageLoader /> : null}

      {data ? (
        items.length === 0 ? (
          <p className="notice notice-success" role="status">
            {severity ? `No ${SEVERITY_LABELS[severity].toLowerCase()}-severity activity` : 'No suspicious activity'} since{' '}
            {formatDateTime(data.since)}.
          </p>
        ) : (
          <ul className="review-list">
            {items.map((item) => (
              <li key={item.user?.id ?? `ip:${item.ip}`} className={`review-item review-${item.severity}`}>
                <div className="review-head">
                  <span className={`badge ${SEVERITY_BADGES[item.severity]}`}>{SEVERITY_LABELS[item.severity]}</span>
                  {item.user ? (
                    <>
                      <Link to={`/users/${item.user.id}`} className="review-name">
                        {item.user.name || item.user.email}
                      </Link>
                      <span className="badge">{USER_TYPE_LABELS[item.user.role]}</span>
                      <UserStatusBadge status={item.user.status} />
                    </>
                  ) : (
                    <span className="review-name">
                      Network address <Address ip={item.ip} to={activityFrom(item.ip)} />
                    </span>
                  )}
                  <span className="muted review-when">Last seen {formatDateTime(item.lastAt)}</span>
                </div>
                <ul className="review-signs">
                  {item.signs.map((flag) => (
                    <li key={flag.sign}>
                      <strong>{REVIEW_SIGN_LABELS[flag.sign]}</strong>
                      <span>{describeFlag(flag)}</span>
                      {flag.addresses?.length ? (
                        <span className="review-addresses">
                          Addresses:{' '}
                          {flag.addresses.map((ip) => (
                            <Address key={ip} ip={ip} to={activityFrom(ip)} />
                          ))}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <div className="review-actions">
                  {item.user ? (
                    <>
                      <Link className="btn btn-secondary btn-small" to={`/users/${item.user.id}`}>
                        View account
                      </Link>
                      {hasPermission('users:suspend') && item.user.status === 'active' ? (
                        <button type="button" className="btn btn-danger-outline btn-small" onClick={() => void startSuspend(item)}>
                          Suspend…
                        </button>
                      ) : null}
                    </>
                  ) : (
                    // Still reachable while addresses are hidden.
                    <Link className="btn btn-secondary btn-small" to={activityFrom(item.ip)}>
                      See activity from this address
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {suspending ? (
        <SuspendDialog
          user={suspending}
          onCancel={() => setSuspending(null)}
          onDone={(updated) => {
            setSuspending(null);
            setNotice(`${updated.name || updated.email} is suspended.`);
            load();
          }}
        />
      ) : null}
    </section>
  );
}
