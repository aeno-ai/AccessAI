import { useId, useState } from 'react';
import { apiFetch, errorMessage } from '../api/client';
import type { AppUser } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

type SuspendDialogProps = {
  user: AppUser;
  onDone: (updated: AppUser) => void;
  onCancel: () => void;
};

const DAYS = [1, 7, 30] as const;

// Suspend for 1, 7 or 30 days. The person sees the end date and the reason
// when they try to log in, so the reason is required.
export function SuspendDialog({ user, onDone, onCancel }: SuspendDialogProps) {
  const [days, setDays] = useState<(typeof DAYS)[number]>(7);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const daysId = useId();
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
      const data = await apiFetch<{ user: AppUser }>(`/users/${user.id}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ days, reason: reason.trim() }),
      });
      onDone(data.user);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      title="Suspend account?"
      confirmLabel={`Suspend for ${days} ${days === 1 ? 'day' : 'days'}`}
      danger
      busy={busy}
      error={error}
      onConfirm={() => void confirm()}
      onCancel={onCancel}
    >
      <p>
        <strong>{user.name}</strong> ({user.email}) is signed out at once and can't use the app until the suspension
        ends. Friends stop seeing them until then.
      </p>
      <div className="form dialog-form">
        <div className="field">
          <label htmlFor={daysId}>How long</label>
          <select
            id={daysId}
            value={days}
            onChange={(event) => setDays(Number(event.target.value) as (typeof DAYS)[number])}
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d} {d === 1 ? 'day' : 'days'}
              </option>
            ))}
          </select>
        </div>
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
            They see this when they try to log in.
          </p>
        </div>
      </div>
    </ConfirmDialog>
  );
}
