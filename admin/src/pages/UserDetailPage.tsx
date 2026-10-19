import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { apiFetch, errorMessage } from '../api/client';
import { useAuth } from '../auth/auth-context';
import { ActivityTable } from '../components/ActivityTable';
import { AddressToggle } from '../components/AddressToggle';
import { DeleteDialog } from '../components/DeleteDialog';
import { PageLoader } from '../components/PageLoader';
import { Pagination } from '../components/Pagination';
import { SosTable } from '../components/SosTable';
import { SuspendDialog } from '../components/SuspendDialog';
import { UserActionDialog, type UserAction } from '../components/UserActionDialog';
import { UserStatusBadge } from '../components/UserStatusBadge';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { ActivityListResponse, AppUser, SosListResponse, UserDetailResponse } from '../types';
import { formatDate, formatDateTime, USER_TYPE_LABELS } from '../utils/format';

const RECORDS_PAGE_SIZE = 10;

type Dialog = 'suspend' | 'delete' | UserAction | null;

const DONE_NOTICES: Record<NonNullable<Dialog>, string> = {
  suspend: 'Account suspended. They were signed out.',
  delete: 'Account will be deleted in 30 days. They were signed out.',
  reactivate: 'Account reactivated.',
  lift: 'Suspension lifted.',
  cancelDeletion: 'Deletion cancelled.',
};

// One page of a person's records, paged here (not in the URL). Opening
// them is recorded in the admin log by the backend.
function useRecords<T>(url: string | null) {
  const [page, setPage] = useState(1);
  const [answer, setAnswer] = useState<{ key: string; data: T | null; error: string }>({ key: '', data: null, error: '' });
  const key = url ? `${url}?page=${page}&limit=${RECORDS_PAGE_SIZE}` : '';

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    apiFetch<T>(key)
      .then((data) => {
        if (!cancelled) setAnswer({ key, data, error: '' });
      })
      .catch((e: unknown) => {
        if (!cancelled) setAnswer((current) => ({ key, data: current.data, error: errorMessage(e) }));
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { data: answer.data, error: answer.key === key ? answer.error : '', loading: answer.key !== key, setPage };
}

export default function UserDetailPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const [data, setData] = useState<UserDetailResponse | null>(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState('');
  useDocumentTitle(data ? data.user.name : 'User');

  const canSos = hasPermission('sos:read');
  const canActivity = hasPermission('activity:read');
  const sos = useRecords<SosListResponse>(canSos ? `/users/${id}/sos` : null);
  const activity = useRecords<ActivityListResponse>(canActivity ? `/users/${id}/activity` : null);

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
  const adminDeleting = user.status === 'deleting' && user.deletionBy === 'admin';
  const actions = {
    reactivate: hasPermission('users:update') && user.status === 'deactivated',
    suspend: hasPermission('users:suspend') && user.status !== 'deactivated' && !adminDeleting && !user.suspendedUntil,
    lift: hasPermission('users:suspend') && Boolean(user.suspendedUntil),
    delete: hasPermission('users:delete') && !adminDeleting,
    cancelDeletion: hasPermission('users:delete') && adminDeleting,
  };

  const done = (updated: AppUser) => {
    setNotice(dialog ? DONE_NOTICES[dialog] : '');
    setDialog(null);
    setData({ ...data, user: updated });
  };

  return (
    <section className="page">
      {backLink}
      <div className="page-heading">
        <h1>{user.name}</h1>
        <UserStatusBadge status={user.status} />
      </div>

      <p className={notice ? 'notice notice-success' : 'visually-hidden'} role="status">
        {notice}
      </p>

      {user.suspendedUntil ? (
        <p className="status-note">
          Suspended until <strong>{formatDateTime(user.suspendedUntil)}</strong>
          {user.suspendedReason ? <> — “{user.suspendedReason}”</> : null}. They see the date and the reason.
        </p>
      ) : null}
      {user.deletionScheduledFor ? (
        <p className="status-note status-danger">
          {adminDeleting ? (
            <>
              An admin is deleting this account. It will be erased on{' '}
              <strong>{formatDate(user.deletionScheduledFor)}</strong>
              {user.deletionReason ? <> — “{user.deletionReason}”</> : null}.
            </>
          ) : (
            <>
              They asked to delete their account. It will be erased on{' '}
              <strong>{formatDate(user.deletionScheduledFor)}</strong> unless they log in and keep it.
            </>
          )}
        </p>
      ) : null}

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
            <dd>
              {user.email}
              {user.emailVerified ? null : <span className="muted"> (not verified)</span>}
            </dd>
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

      <h2>Counts</h2>
      <p className="muted">Message and conversation content stays private.</p>
      <ul className="stats">
        <li>
          <span className="stat-value">{stats.emergencyContacts}</span> Emergency contacts
        </li>
        <li>
          <span className="stat-value">{stats.conversations}</span> Synced conversations
        </li>
        <li>
          <span className="stat-value">{stats.sosEvents}</span> SOS sent
        </li>
        <li>
          <span className="stat-value">{stats.activeSosEvents}</span> Active SOS
        </li>
      </ul>

      {canSos ? (
        <>
          <h2>SOS</h2>
          <p className="muted">
            {sos.data?.counts
              ? `${sos.data.counts.real} real, ${sos.data.counts.test} test. `
              : ''}
            The place, location and message stay private.
          </p>
          {sos.error ? (
            <p className="form-error" role="alert">
              {sos.error}
            </p>
          ) : null}
          {sos.data ? (
            <>
              <SosTable events={sos.data.events} caption={`${user.name}'s SOS`} showSender={false} busy={sos.loading} />
              {sos.data.pages > 1 ? (
                <Pagination
                  page={sos.data.page}
                  pages={sos.data.pages}
                  total={sos.data.total}
                  noun={['SOS', 'SOS']}
                  disabled={sos.loading}
                  onPage={sos.setPage}
                />
              ) : null}
            </>
          ) : sos.loading ? (
            <PageLoader />
          ) : null}
        </>
      ) : null}

      {canActivity ? (
        <>
          <div className="section-heading">
            <h2>Activity</h2>
            <AddressToggle />
          </div>
          <p className="muted">Logins, account changes and limits hit, kept 90 days.</p>
          {activity.error ? (
            <p className="form-error" role="alert">
              {activity.error}
            </p>
          ) : null}
          {activity.data ? (
            <>
              <ActivityTable
                records={activity.data.records}
                caption={`${user.name}'s activity`}
                showUser={false}
                busy={activity.loading}
              />
              {activity.data.pages > 1 ? (
                <Pagination
                  page={activity.data.page}
                  pages={activity.data.pages}
                  total={activity.data.total}
                  noun={['record', 'records']}
                  disabled={activity.loading}
                  onPage={activity.setPage}
                />
              ) : null}
            </>
          ) : activity.loading ? (
            <PageLoader />
          ) : null}
        </>
      ) : null}

      {Object.values(actions).some(Boolean) ? (
        <div className="danger-zone action-row">
          {actions.reactivate ? (
            <button type="button" className="btn btn-primary" onClick={() => setDialog('reactivate')}>
              Reactivate account
            </button>
          ) : null}
          {actions.lift ? (
            <button type="button" className="btn btn-primary" onClick={() => setDialog('lift')}>
              Lift suspension
            </button>
          ) : null}
          {actions.cancelDeletion ? (
            <button type="button" className="btn btn-primary" onClick={() => setDialog('cancelDeletion')}>
              Cancel deletion
            </button>
          ) : null}
          {actions.suspend ? (
            <button type="button" className="btn btn-danger-outline" onClick={() => setDialog('suspend')}>
              Suspend
            </button>
          ) : null}
          {actions.delete ? (
            <button type="button" className="btn btn-danger" onClick={() => setDialog('delete')}>
              Delete in 30 days
            </button>
          ) : null}
        </div>
      ) : null}

      {dialog === 'suspend' ? <SuspendDialog user={user} onDone={done} onCancel={() => setDialog(null)} /> : null}
      {dialog === 'delete' ? <DeleteDialog user={user} onDone={done} onCancel={() => setDialog(null)} /> : null}
      {dialog === 'reactivate' || dialog === 'lift' || dialog === 'cancelDeletion' ? (
        <UserActionDialog user={user} action={dialog} onDone={done} onCancel={() => setDialog(null)} />
      ) : null}
    </section>
  );
}
