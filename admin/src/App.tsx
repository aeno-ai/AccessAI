import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth, RequirePermission } from './auth/guards';
import { Layout } from './components/Layout';
import AccountPasswordPage from './pages/AccountPasswordPage';
import AdminsPage from './pages/AdminsPage';
import ForcedPasswordChangePage from './pages/ForcedPasswordChangePage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import UserDetailPage from './pages/UserDetailPage';
import UsersPage from './pages/UsersPage';

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
          <Route index element={<Navigate to="/users" replace />} />
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
            path="admins"
            element={
              <RequirePermission permission="admins:read">
                <AdminsPage />
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
