import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { apiFetch, errorMessage } from '../api/client';
import { Address } from '../components/Address';
import { AddressToggle } from '../components/AddressToggle';
import { PageLoader } from '../components/PageLoader';
import { UserStatusBadge } from '../components/UserStatusBadge';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { ReviewResponse } from '../types';
import { REVIEW_SIGN_LABELS, USER_TYPE_LABELS, formatDateTime } from '../utils/format';

const failedFrom = (ip: string | null) => `/activity?type=login.failed&ip=${encodeURIComponent(ip ?? '')}`;

// "Needs a look": accounts (and network addresses) with warning signs in
// the last 24 hours. Nothing is blocked by this — an admin decides.
export default function ReviewPage() {
  useDocumentTitle('Needs a look');
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
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

  return (
    <section className="page">
      <h1>Needs a look</h1>
      <p className="muted">
        Warning signs in the last 24 hours: 10+ failed logins on an account or 20+ from one address, limits hit in 5+
        different minutes, 3+ real SOS, or 20+ friend requests. Nothing is blocked by itself.
      </p>
      <div className="page-actions">
        <AddressToggle />
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {!data && !error ? <PageLoader /> : null}

      {data ? (
        data.items.length === 0 ? (
          <p className="notice notice-success" role="status">
            Nothing needs a look since {formatDateTime(data.since)}.
          </p>
        ) : (
          <ul className="review-list">
            {data.items.map((item) => (
              <li key={item.user?.id ?? `ip:${item.ip}`}>
                <div className="review-head">
                  {item.user ? (
                    <>
                      <Link to={`/users/${item.user.id}`}>{item.user.name || item.user.email}</Link>
                      <span className="badge">{USER_TYPE_LABELS[item.user.role]}</span>
                      <UserStatusBadge status={item.user.status} />
                    </>
                  ) : (
                    <>
                      Network address <Address ip={item.ip} to={failedFrom(item.ip)} />
                      {/* Still reachable while addresses are hidden. */}
                      <Link to={failedFrom(item.ip)}>See its failed logins</Link>
                    </>
                  )}
                </div>
                <ul className="review-signs">
                  {item.signs.map((sign) => (
                    <li key={sign.sign}>
                      {REVIEW_SIGN_LABELS[sign.sign]}: <strong>{sign.count}</strong>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
