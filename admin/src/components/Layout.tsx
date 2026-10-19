import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { clearAddressVisibility } from '../hooks/useAddressVisibility';
import { AddressVisibilityProvider } from './AddressVisibilityProvider';
import { ROLE_LABELS } from '../utils/format';

export function Layout() {
  const { admin, logout, hasPermission } = useAuth();

  if (!admin) {
    return null; // RequireAuth never renders this without an admin
  }

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <aside className="sidebar">
        <div className="brand">
          <img src="/favicon.png" alt="" width={32} height={32} />
          <span>AccessAI Admin</span>
        </div>
        {/* Links are filtered by permission so people only see what they can
            use. The pages and the API still check on their own. */}
        <nav aria-label="Main">
          <ul>
            {hasPermission('users:read') && (
              <li>
                <NavLink to="/users">Users</NavLink>
              </li>
            )}
            {hasPermission('activity:read') && hasPermission('sos:read') && (
              <li>
                <NavLink to="/review">Needs a look</NavLink>
              </li>
            )}
            {hasPermission('activity:read') && (
              <li>
                <NavLink to="/activity">Activity</NavLink>
              </li>
            )}
            {hasPermission('sos:read') && (
              <li>
                <NavLink to="/sos">SOS</NavLink>
              </li>
            )}
            {hasPermission('admins:read') && (
              <li>
                <NavLink to="/admins">Admins</NavLink>
              </li>
            )}
            <li>
              <NavLink to="/account/password">Change password</NavLink>
            </li>
          </ul>
        </nav>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="whoami">
            <span className="whoami-name">{admin.name}</span>
            <span className={`badge badge-role-${admin.role}`}>{ROLE_LABELS[admin.role]}</span>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => {
              clearAddressVisibility();
              void logout();
            }}
          >
            Log out
          </button>
        </header>

        <main id="main" className="content" tabIndex={-1}>
          {/* One "Show addresses" switch for every page. */}
          <AddressVisibilityProvider>
            <Outlet />
          </AddressVisibilityProvider>
        </main>
      </div>
    </div>
  );
}
