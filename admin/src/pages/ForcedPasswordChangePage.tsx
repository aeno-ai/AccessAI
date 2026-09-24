import { Navigate } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { AuthCard } from '../components/AuthCard';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

// Where RequireAuth sends an admin who's still on a temporary password. Once
// the change succeeds, mustChangePassword flips to false and this page
// redirects into the panel on its own.
export default function ForcedPasswordChangePage() {
  useDocumentTitle('Set a new password');
  const { admin, logout } = useAuth();

  if (!admin?.mustChangePassword) {
    return <Navigate to="/users" replace />;
  }

  return (
    <AuthCard
      title="Set a new password"
      subtitle="You're signed in with a temporary password. Choose your own before continuing."
    >
      <ChangePasswordForm />
      <button type="button" className="btn btn-link" onClick={() => void logout()}>
        Log out instead
      </button>
    </AuthCard>
  );
}
