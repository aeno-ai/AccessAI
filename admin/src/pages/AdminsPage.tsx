import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch, errorMessage } from '../api/client';
import { useAuth } from '../auth/auth-context';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { PageLoader } from '../components/PageLoader';
import { PasswordRules } from '../components/PasswordRules';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { Admin, AdminRole } from '../types';
import { formatDateTime, ROLE_LABELS } from '../utils/format';
import { EMAIL_REGEX, generateTemporaryPassword, isStrongPassword } from '../utils/validation';

const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  viewer: 'Can view users. Cannot change anything.',
  admin: 'Can view users and deactivate or reactivate their accounts.',
  super_admin: 'Everything an admin can do, plus managing other admins.',
};

type PendingChange = { target: Admin; role?: AdminRole; isActive?: boolean };
type SharedPassword = { name: string; email: string; password: string };

export default function AdminsPage() {
  useDocumentTitle('Admins');
  const { admin: me, hasPermission } = useAuth();
  const canManage = hasPermission('admins:manage');

  const [admins, setAdmins] = useState<Admin[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<Admin | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [sharedPassword, setSharedPassword] = useState<SharedPassword | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ admins: Admin[] }>('/admins')
      .then((data) => {
        if (!cancelled) setAdmins(data.admins);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const replaceAdmin = (updated: Admin) => {
    setAdmins((current) => current?.map((a) => (a.id === updated.id ? updated : a)) ?? null);
  };

  return (
    <section className="page">
      <div className="page-heading">
        <h1>Admins</h1>
        {canManage ? (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            Add admin
          </button>
        ) : null}
      </div>
      <p className="muted">People who can sign in to this panel, and what their role lets them do.</p>

      <ul className="role-legend">
        {(Object.keys(ROLE_DESCRIPTIONS) as AdminRole[]).map((role) => (
          <li key={role}>
            <span className={`badge badge-role-${role}`}>{ROLE_LABELS[role]}</span> {ROLE_DESCRIPTIONS[role]}
          </li>
        ))}
      </ul>

      <p className={notice ? 'notice notice-success' : 'visually-hidden'} role="status">
        {notice}
      </p>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {!admins && !error ? <PageLoader /> : null}

      {admins ? (
        <div className="table-wrap">
          <table>
            <caption className="visually-hidden">Admins</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Last login</th>
                {canManage ? (
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => {
                const isMe = admin.id === me?.id;
                const editable = canManage && !isMe;
                return (
                  <tr key={admin.id}>
                    <td>
                      {admin.name}
                      {isMe ? <span className="muted"> (you)</span> : null}
                    </td>
                    <td>{admin.email}</td>
                    <td>
                      {editable ? (
                        <select
                          aria-label={`Role for ${admin.name}`}
                          value={admin.role}
                          onChange={(event) =>
                            setPendingChange({ target: admin, role: event.target.value as AdminRole })
                          }
                        >
                          {(Object.keys(ROLE_LABELS) as AdminRole[]).map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`badge badge-role-${admin.role}`}>{ROLE_LABELS[admin.role]}</span>
                      )}
                    </td>
                    <td>
                      <span className="badge-group">
                        <span className={`badge ${admin.isActive ? 'badge-success' : 'badge-danger'}`}>
                          {admin.isActive ? 'Active' : 'Disabled'}
                        </span>
                        {admin.isLocked ? <span className="badge badge-warning">Locked</span> : null}
                        {admin.mustChangePassword ? <span className="badge">Temporary password</span> : null}
                      </span>
                    </td>
                    <td>{formatDateTime(admin.lastLoginAt)}</td>
                    {canManage ? (
                      <td className="cell-actions">
                        {editable ? (
                          <>
                            <button
                              type="button"
                              className={`btn btn-small ${admin.isActive ? 'btn-danger-outline' : 'btn-secondary'}`}
                              onClick={() => setPendingChange({ target: admin, isActive: !admin.isActive })}
                              aria-label={`${admin.isActive ? 'Disable' : 'Enable'} ${admin.name}`}
                            >
                              {admin.isActive ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-small btn-secondary"
                              onClick={() => setResetting(admin)}
                              aria-label={`Reset password for ${admin.name}`}
                            >
                              Reset password
                            </button>
                          </>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {pendingChange ? (
        <AdminChangeDialog
          change={pendingChange}
          onDone={(updated) => {
            setPendingChange(null);
            replaceAdmin(updated);
            setNotice(`${updated.name} updated.`);
          }}
          onCancel={() => setPendingChange(null)}
        />
      ) : null}

      {creating ? (
        <CreateAdminDialog
          onCreated={(created, password) => {
            setCreating(false);
            setAdmins((current) => (current ? [...current, created] : [created]));
            setSharedPassword({ name: created.name, email: created.email, password });
          }}
          onCancel={() => setCreating(false)}
        />
      ) : null}

      {resetting ? (
        <ResetPasswordDialog
          target={resetting}
          onDone={(updated, password) => {
            setResetting(null);
            replaceAdmin(updated);
            setSharedPassword({ name: updated.name, email: updated.email, password });
          }}
          onCancel={() => setResetting(null)}
        />
      ) : null}

      {sharedPassword ? (
        <SharePasswordDialog shared={sharedPassword} onClose={() => setSharedPassword(null)} />
      ) : null}
    </section>
  );
}

function AdminChangeDialog({
  change,
  onDone,
  onCancel,
}: {
  change: PendingChange;
  onDone: (updated: Admin) => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { target, role, isActive } = change;

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await apiFetch<{ admin: Admin }>(`/admins/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify(role !== undefined ? { role } : { isActive }),
      });
      onDone(data.admin);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  let title: string;
  let message: string;
  if (role !== undefined) {
    title = 'Change role?';
    message = `${target.name} will become ${ROLE_LABELS[role]}. They'll be signed out and need to log in again.`;
  } else if (isActive) {
    title = 'Enable admin?';
    message = `${target.name} will be able to sign in to the admin panel again.`;
  } else {
    title = 'Disable admin?';
    message = `${target.name} will be signed out right away and won't be able to sign in until re-enabled.`;
  }

  return (
    <ConfirmDialog
      title={title}
      confirmLabel={role !== undefined ? 'Change role' : isActive ? 'Enable' : 'Disable'}
      danger={isActive === false}
      busy={busy}
      error={error}
      onConfirm={() => void confirm()}
      onCancel={onCancel}
    >
      <p>{message}</p>
    </ConfirmDialog>
  );
}

// Temporary passwords are visible (not dots) on purpose: the person
// creating them has to pass them on.
function TemporaryPasswordField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="field">
      <label htmlFor="temp-password">Temporary password</label>
      <div className="input-row">
        <input
          id="temp-password"
          type="text"
          autoComplete="off"
          spellCheck={false}
          aria-describedby="temp-password-rules temp-password-hint"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="button" className="btn btn-secondary" onClick={() => onChange(generateTemporaryPassword())}>
          Generate
        </button>
      </div>
      <PasswordRules password={value} id="temp-password-rules" />
      <p className="hint" id="temp-password-hint">
        They'll have to replace it the first time they sign in.
      </p>
    </div>
  );
}

function CreateAdminDialog({
  onCreated,
  onCancel,
}: {
  onCreated: (admin: Admin, temporaryPassword: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('viewer'); // least privilege by default
  const [password, setPassword] = useState(generateTemporaryPassword);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!name.trim()) return setError('Enter a name.');
    if (!EMAIL_REGEX.test(email.trim())) return setError('Enter a valid email address.');
    if (!isStrongPassword(password)) return setError("The temporary password doesn't meet the requirements.");

    setBusy(true);
    try {
      const data = await apiFetch<{ admin: Admin }>('/admins', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), email: email.trim(), role, password }),
      });
      onCreated(data.admin, password);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Modal title="Add admin" onClose={() => !busy && onCancel()}>
      <form className="form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <div className="field">
          <label htmlFor="new-admin-name">Name</label>
          <input
            id="new-admin-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="new-admin-email">Email</label>
          <input
            id="new-admin-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="new-admin-role">Role</label>
          <select
            id="new-admin-role"
            value={role}
            onChange={(event) => setRole(event.target.value as AdminRole)}
            aria-describedby="new-admin-role-hint"
          >
            {(Object.keys(ROLE_LABELS) as AdminRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <p className="hint" id="new-admin-role-hint">
            {ROLE_DESCRIPTIONS[role]}
          </p>
        </div>
        <TemporaryPasswordField value={password} onChange={setPassword} />

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Adding…' : 'Add admin'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordDialog({
  target,
  onDone,
  onCancel,
}: {
  target: Admin;
  onDone: (admin: Admin, temporaryPassword: string) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState(generateTemporaryPassword);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!isStrongPassword(password)) return setError("The temporary password doesn't meet the requirements.");

    setBusy(true);
    try {
      const data = await apiFetch<{ admin: Admin }>(`/admins/${target.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      onDone(data.admin, password);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Modal title={`Reset password for ${target.name}`} onClose={() => !busy && onCancel()}>
      <form className="form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <p>
          This signs {target.name} out everywhere and unlocks their account if it was locked.
        </p>
        <TemporaryPasswordField value={password} onChange={setPassword} />

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-danger" disabled={busy}>
            {busy ? 'Resetting…' : 'Reset password'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SharePasswordDialog({ shared, onClose }: { shared: SharedPassword; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shared.password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal title="Share the temporary password" onClose={onClose}>
      <p>
        Give this to <strong>{shared.name}</strong> ({shared.email}) privately, in person or through a private
        message. It won't be shown again.
      </p>
      <p className="temp-password">
        <span className="muted">Temporary password</span>
        <code>{shared.password}</code>
      </p>
      <p className={copied ? 'notice notice-success' : 'visually-hidden'} role="status">
        {copied ? 'Copied to clipboard.' : ''}
      </p>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={() => void copy()}>
          Copy
        </button>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
