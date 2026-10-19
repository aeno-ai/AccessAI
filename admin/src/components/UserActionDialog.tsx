import { useState } from 'react';
import { apiFetch, errorMessage } from '../api/client';
import type { AppUser } from '../types';
import { formatDate } from '../utils/format';
import { ConfirmDialog } from './ConfirmDialog';

export type UserAction = 'reactivate' | 'lift' | 'cancelDeletion';

type UserActionDialogProps = {
  user: AppUser;
  action: UserAction;
  onDone: (updated: AppUser) => void;
  onCancel: () => void;
};

const REQUESTS: Record<UserAction, { path: string; method: string; body?: object }> = {
  reactivate: { path: 'status', method: 'PATCH', body: { isActive: true } },
  lift: { path: 'suspend', method: 'DELETE' },
  cancelDeletion: { path: 'deletion', method: 'DELETE' },
};

// Confirms, then undoes a lock: reactivates an old deactivated account,
// lifts a suspension, or cancels an admin's "delete in 30 days".
export function UserActionDialog({ user, action, onDone, onCancel }: UserActionDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const { path, method, body } = REQUESTS[action];
      const data = await apiFetch<{ user: AppUser }>(`/users/${user.id}/${path}`, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      onDone(data.user);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  const who = (
    <>
      <strong>{user.name}</strong> ({user.email})
    </>
  );
  const text = {
    reactivate: { title: 'Reactivate account?', label: 'Reactivate', body: <p>{who} will be able to log in to the app again.</p> },
    lift: {
      title: 'Lift the suspension?',
      label: 'Lift suspension',
      body: (
        <p>
          {who} can use the app again now, instead of on {formatDate(user.suspendedUntil)}.
        </p>
      ),
    },
    cancelDeletion: {
      title: 'Cancel the deletion?',
      label: 'Cancel deletion',
      body: <p>{who} won't be deleted, and can log in to the app again.</p>,
    },
  }[action];

  return (
    <ConfirmDialog
      title={text.title}
      confirmLabel={text.label}
      busy={busy}
      error={error}
      onConfirm={() => void confirm()}
      onCancel={onCancel}
    >
      {text.body}
    </ConfirmDialog>
  );
}
