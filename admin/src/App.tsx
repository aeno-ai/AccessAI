import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth, RequirePermission } from './auth/guards';
import { Layout } from './components/Layout';
import AccountPasswordPage from './pages/AccountPasswordPage';
import ActivityPage from './pages/ActivityPage';
import AdminsPage from './pages/AdminsPage';
import AuditLogPage from './pages/AuditLogPage';

import ForcedPasswordChangePage from './pages/ForcedPasswordChangePage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import ReviewPage from './pages/ReviewPage';
import SosPage from './pages/SosPage';
import UserDetailPage from './pages/UserDetailPage';
import UsersPage from './pages/UsersPage';
import { PageLoader } from './components/PageLoader';

// The dashboard brings the chart library; loaded only when it's opened.
const DashboardPage = lazy(() => import('./pages/DashboardPage'));

export default function App() {
  return (
    <Routes>
      {/* The only page reachable without a session. There is no sign-up
          page — admins are created by a super admin, or by the
          create-admin script on the server. */}
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/change-password" element={<ForcedPasswordChangePage />} />

        <Route element={<Layout />}>
          {/* Home: the dashboard (HANDOFF.md §52); admins without the record
              permissions go straight to Users. */}
          <Route
            index
            element={
              <RequirePermission permission="activity:read" fallback={<Navigate to="/users" replace />}>
                <RequirePermission permission="sos:read" fallback={<Navigate to="/users" replace />}>
                  <Suspense fallback={<PageLoader />}>
                    <DashboardPage />
                  </Suspense>
                </RequirePermission>
              </RequirePermission>
            }
          />
          <Route
            path="users"
            element={
              <RequirePermission permission="users:read">
                <UsersPage />
              </RequirePermission>
            }
          />
          <Route
            path="users/:id"
            element={
              <RequirePermission permission="users:read">
                <UserDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="review"
            element={
              <RequirePermission permission="activity:read">
                <RequirePermission permission="sos:read">
                  <ReviewPage />
                </RequirePermission>
              </RequirePermission>
            }
          />
          <Route
            path="activity"
            element={
              <RequirePermission permission="activity:read">
                <ActivityPage />
              </RequirePermission>
            }
          />
          <Route
            path="sos"
            element={
              <RequirePermission permission="sos:read">
                <SosPage />
              </RequirePermission>
            }
          />
          <Route
            path="admins"
            element={
              <RequirePermission permission="admins:read">
                <AdminsPage />
              </RequirePermission>
            }
          />
          <Route
            path="audit"
            element={
              <RequirePermission permission="audit:read">
                <AuditLogPage />
              </RequirePermission>
            }
          />
          <Route path="account/password" element={<AccountPasswordPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
