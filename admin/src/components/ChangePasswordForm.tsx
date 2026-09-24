import { useState, type FormEvent } from 'react';
import { apiFetch, errorMessage } from '../api/client';
import { useAuth } from '../auth/auth-context';
import type { Admin } from '../types';
import { isStrongPassword } from '../utils/validation';
import { PasswordRules } from './PasswordRules';

export function ChangePasswordForm({ onChanged }: { onChanged?: () => void }) {
  const { updateAdmin } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!isStrongPassword(newPassword)) {
      setError("The new password doesn't meet all the requirements.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('The new password must be different from your current one.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiFetch<{ admin: Admin }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      updateAdmin(data.admin);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onChanged?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="form" onSubmit={(event) => void handleSubmit(event)} noValidate>
      <div className="field">
        <label htmlFor="current-password">Current password</label>
        <input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="new-password">New password</label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          aria-describedby="new-password-rules"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
        />
        <PasswordRules password={newPassword} id="new-password-rules" />
      </div>
      <div className="field">
        <label htmlFor="confirm-password">Confirm new password</label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn btn-primary" disabled={submitting || !currentPassword || !newPassword}>
        {submitting ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}
