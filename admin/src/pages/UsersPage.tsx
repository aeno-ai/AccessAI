import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { apiFetch, errorMessage } from '../api/client';
import { useAuth } from '../auth/auth-context';
import { PageLoader } from '../components/PageLoader';
import { UserStatusDialog } from '../components/UserStatusDialog';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { AppUser, UserListResponse } from '../types';
import { formatDate, USER_TYPE_LABELS } from '../utils/format';

const PAGE_SIZE = 20;

export default function UsersPage() {
  useDocumentTitle('Users');
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission('users:update');

  // Filters live in the URL, so the back button, a refresh, or a shared link
  // all keep the same view.
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') ?? '';
  const role = searchParams.get('role') ?? '';
  const status = searchParams.get('status') ?? '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (search) query.set('search', search);
  if (role) query.set('role', role);
  if (status) query.set('status', status);
  const queryString = query.toString();

  const [draftSearch, setDraftSearch] = useState(search);
  const [data, setData] = useState<UserListResponse | null>(null);
  // Which query the last response (or error) belongs to. "Loading" just
  // means the current filters haven't been answered yet — the previous
  // results stay on screen, dimmed, until they are.
  const [answered, setAnswered] = useState({ query: '', error: '' });
  const loading = answered.query !== queryString;
  const error = loading ? '' : answered.error;
  const [pendingUser, setPendingUser] = useState<AppUser | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;

    apiFetch<UserListResponse>(`/users?${queryString}`)
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
  }, [queryString]);

  const updateParams = (changes: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page'); // any filter change goes back to page 1
    setSearchParams(next);
  };

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    updateParams({ search: draftSearch.trim() });
  };

  const handleStatusChanged = (updated: AppUser) => {
    setPendingUser(null);
    setData((current) =>
      current ? { ...current, users: current.users.map((u) => (u.id === updated.id ? updated : u)) } : current,
    );
    setNotice(`${updated.name} has been ${updated.isActive ? 'reactivated' : 'deactivated'}.`);
  };

  return (
    <section className="page">
      <h1>Users</h1>
      <p className="muted">Everyone registered in the AccessAI mobile app.</p>

      <form className="filters" role="search" onSubmit={handleSearch}>
        <div className="field field-grow">
          <label htmlFor="user-search">Search by name or email</label>
          <input
            id="user-search"
            type="search"
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            maxLength={100}
          />
        </div>
        <div className="field">
          <label htmlFor="user-role">Type</label>
          <select id="user-role" value={role} onChange={(event) => updateParams({ role: event.target.value })}>
            <option value="">All</option>
            <option value="pwd">PWD</option>
            <option value="non_pwd">Non-PWD</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="user-status">Status</label>
          <select id="user-status" value={status} onChange={(event) => updateParams({ status: event.target.value })}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Deactivated</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      <p className={notice ? 'notice notice-success' : 'visually-hidden'} role="status">
        {notice}
      </p>

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
              <caption className="visually-hidden">Users, page {data.page} of {data.pages}</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Type</th>
                  <th scope="col">Status</th>
                  <th scope="col">Joined</th>
                  {canUpdate ? (
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {data.users.length === 0 ? (
                  <tr>
                    <td colSpan={canUpdate ? 6 : 5} className="empty">
                      No users match these filters.
                    </td>
                  </tr>
                ) : (
                  data.users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <Link to={`/users/${user.id}`}>{user.name}</Link>
                      </td>
                      <td>{user.email}</td>
                      <td>{USER_TYPE_LABELS[user.role]}</td>
                      <td>
                        <span className={`badge ${user.isActive ? 'badge-success' : 'badge-danger'}`}>
                          {user.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td>{formatDate(user.createdAt)}</td>
                      {canUpdate ? (
                        <td className="cell-actions">
                          <button
                            type="button"
                            className={`btn btn-small ${user.isActive ? 'btn-danger-outline' : 'btn-secondary'}`}
                            onClick={() => setPendingUser(user)}
                            aria-label={`${user.isActive ? 'Deactivate' : 'Reactivate'} ${user.name}`}
                          >
                            {user.isActive ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <nav className="pagination" aria-label="Pagination">
            <button
              type="button"
              className="btn btn-secondary btn-small"
              disabled={data.page <= 1 || loading}
              onClick={() => updateParams({ page: String(data.page - 1) })}
            >
              Previous
            </button>
            <span>
              Page {data.page} of {data.pages} · {data.total} {data.total === 1 ? 'user' : 'users'}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              disabled={data.page >= data.pages || loading}
              onClick={() => updateParams({ page: String(data.page + 1) })}
            >
              Next
            </button>
          </nav>
        </>
      ) : null}

      {pendingUser ? (
        <UserStatusDialog user={pendingUser} onDone={handleStatusChanged} onCancel={() => setPendingUser(null)} />
      ) : null}
    </section>
  );
}
