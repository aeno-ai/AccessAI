import { useId, useState } from 'react';
import { apiFetch, errorMessage } from '../api/client';
import type { AppUser } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

type DeleteDialogProps = {
  user: AppUser;
  onDone: (updated: AppUser) => void;
  onCancel: () => void;
};

// "Delete in 30 days" (super admins only). The account is locked at once
// and erased after 30 days; only an admin can undo it before then.
export function DeleteDialog({ user, onDone, onCancel }: DeleteDialogProps) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reasonId = useId();
  const hintId = useId();

  const confirm = async () => {
    if (!reason.trim()) {
      setError('Write the reason.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await apiFetch<{ user: AppUser }>(`/users/${user.id}/deletion`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      });
      onDone(data.user);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      title="Delete this account in 30 days?"
      confirmLabel="Delete in 30 days"
      danger
      busy={busy}
      error={error}
      onConfirm={() => void confirm()}
      onCancel={onCancel}
    >
      <p>
        <strong>{user.name}</strong> ({user.email}) is signed out and locked at once, and friends stop seeing them.
        After 30 days the account and everything in it is erased for good. Until then, a super admin can cancel it
        here; they can't cancel it themselves.
      </p>
      <div className="form dialog-form">
        <div className="field">
          <label htmlFor={reasonId}>Reason</label>
          <textarea
            id={reasonId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={300}
            rows={3}
            required
            aria-describedby={hintId}
          />
          <p id={hintId} className="hint">
            Kept in the admin log. They're told the date, not the reason.
          </p>
        </div>
      </div>
    </ConfirmDialog>
  );
}
