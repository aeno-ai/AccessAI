import { useState } from 'react';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export default function AccountPasswordPage() {
  useDocumentTitle('Change password');
  const [changed, setChanged] = useState(false);

  return (
    <section className="page page-narrow">
      <h1>Change password</h1>
      <p className="muted">Changing your password signs you out everywhere else.</p>
      {changed ? (
        <p className="notice notice-success" role="status">
          Password changed.
        </p>
      ) : null}
      <div className="card">
        <ChangePasswordForm onChanged={() => setChanged(true)} />
      </div>
    </section>
  );
}
