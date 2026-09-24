import { useState } from 'react';
import { apiFetch, errorMessage } from '../api/client';
import type { AppUser } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

type UserStatusDialogProps = {
  user: AppUser;
  onDone: (updated: AppUser) => void;
  onCancel: () => void;
};

// Confirms, then deactivates or reactivates a mobile-app user.
export function UserStatusDialog({ user, onDone, onCancel }: UserStatusDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const deactivating = user.isActive;

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await apiFetch<{ user: AppUser }>(`/users/${user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      onDone(data.user);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      title={deactivating ? 'Deactivate account?' : 'Reactivate account?'}
      confirmLabel={deactivating ? 'Deactivate' : 'Reactivate'}
      danger={deactivating}
      busy={busy}
      error={error}
      onConfirm={() => void confirm()}
      onCancel={onCancel}
    >
      {deactivating ? (
        <p>
          <strong>{user.name}</strong> ({user.email}) will be signed out of the app right away and won't be able to
          log in until the account is reactivated.
        </p>
      ) : (
        <p>
          <strong>{user.name}</strong> ({user.email}) will be able to log in to the app again.
        </p>
      )}
    </ConfirmDialog>
  );
}
