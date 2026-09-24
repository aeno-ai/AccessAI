import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { PageLoader } from '../components/PageLoader';
import type { Permission } from '../types';
import { useAuth } from './auth-context';

// Layout route that wraps every page except /login. Not logged in → login
// page, remembering where they were headed so they land back there after
// logging in again — unless they clicked "Log out", in which case whoever
// logs in next on this browser starts fresh. Still on a temporary password
// → the forced change-password page, and nowhere else.
export function RequireAuth() {
  const { admin, loading, loggedOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoader />;
  }

  if (!admin) {
    const state = loggedOut ? undefined : { from: `${location.pathname}${location.search}` };
    return <Navigate to="/login" replace state={state} />;
  }

  if (admin.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}

export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return (
      <section className="page">
        <h1>No access</h1>
        <p className="muted">Your role doesn't include access to this page. Ask a super admin if you need it.</p>
      </section>
    );
  }

  return children;
}
