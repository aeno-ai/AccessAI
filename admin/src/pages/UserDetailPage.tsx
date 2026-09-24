import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { apiFetch, errorMessage } from '../api/client';
import { useAuth } from '../auth/auth-context';
import { PageLoader } from '../components/PageLoader';
import { UserStatusDialog } from '../components/UserStatusDialog';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { UserDetailResponse } from '../types';
import { formatDate, formatDateTime, USER_TYPE_LABELS } from '../utils/format';

export default function UserDetailPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const [data, setData] = useState<UserDetailResponse | null>(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState('');
  useDocumentTitle(data ? data.user.name : 'User');

  useEffect(() => {
    let cancelled = false;
    apiFetch<UserDetailResponse>(`/users/${id}`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const backLink = (
    <Link to="/users" className="back-link">
      ← Back to users
    </Link>
  );

  if (error) {
    return (
      <section className="page">
        {backLink}
        <h1>User</h1>
        <p className="form-error" role="alert">
          {error}
        </p>
      </section>
    );
  }

  if (!data) {
    return <PageLoader />;
  }

  const { user, stats } = data;

  return (
    <section className="page">
      {backLink}
      <div className="page-heading">
        <h1>{user.name}</h1>
        <span className={`badge ${user.isActive ? 'badge-success' : 'badge-danger'}`}>
          {user.isActive ? 'Active' : 'Deactivated'}
        </span>
      </div>

      <p className={notice ? 'notice notice-success' : 'visually-hidden'} role="status">
        {notice}
      </p>

      <div className="card">
        <dl className="details">
          {user.firstName ? (
            <div>
              <dt>First name</dt>
              <dd>{user.firstName}</dd>
            </div>
          ) : null}
          {user.lastName ? (
            <div>
              <dt>Last name</dt>
              <dd>{user.lastName}</dd>
            </div>
          ) : null}
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{USER_TYPE_LABELS[user.role]}</dd>
          </div>
          <div>
            <dt>Joined</dt>
            <dd>{formatDate(user.createdAt)}</dd>
          </div>
          <div>
            <dt>Last updated</dt>
            <dd>{formatDateTime(user.updatedAt)}</dd>
          </div>
        </dl>
      </div>

      <h2>Activity</h2>
      <p className="muted">Counts only. Message and conversation content stays private.</p>
      <ul className="stats">
        <li>
          <span className="stat-value">{stats.emergencyContacts}</span> Emergency contacts
        </li>
        <li>
          <span className="stat-value">{stats.conversations}</span> Synced conversations
        </li>
        <li>
          <span className="stat-value">{stats.sosEvents}</span> SOS events
        </li>
        <li>
          <span className="stat-value">{stats.activeSosEvents}</span> Active SOS events
        </li>
      </ul>

      {hasPermission('users:update') ? (
        <div className="danger-zone">
          <button
            type="button"
            className={`btn ${user.isActive ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => setConfirming(true)}
          >
            {user.isActive ? 'Deactivate account' : 'Reactivate account'}
          </button>
        </div>
      ) : null}

      {confirming ? (
        <UserStatusDialog
          user={user}
          onDone={(updated) => {
            setConfirming(false);
            setData({ ...data, user: updated });
            setNotice(`Account ${updated.isActive ? 'reactivated' : 'deactivated'}.`);
          }}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </section>
  );
}
