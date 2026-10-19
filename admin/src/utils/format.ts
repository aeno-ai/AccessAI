import type { ActivityRecord, ActivityType, AdminRole, ReviewSign, SosRecord, UserStatus, UserType } from '../types';

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
};

export const USER_TYPE_LABELS: Record<UserType, string> = {
  pwd: 'PWD',
  non_pwd: 'Non-PWD',
};

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function formatDate(iso: string | null | undefined): string {
  return iso ? dateFormatter.format(new Date(iso)) : '—';
}

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTimeFormatter.format(new Date(iso)) : 'Never';
}

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  deleting: 'Being deleted',
  deactivated: 'Deactivated (old)',
};

export const USER_STATUS_BADGES: Record<UserStatus, string> = {
  active: 'badge-success',
  suspended: 'badge-warning',
  deleting: 'badge-danger',
  deactivated: 'badge-danger',
};

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  'login.success': 'Logged in',
  'login.failed': 'Login failed',
  'login.refused': 'Login refused',
  logout: 'Logged out',
  signup: 'Signed up',
  'email.verified': 'Email verified',
  'password.changed': 'Password changed',
  'password.reset': 'Password reset',
  'email.changed': 'Email changed',
  'deletion.requested': 'Asked to delete account',
  'deletion.cancelled': 'Cancelled deletion',
  'limit.hit': 'Hit a limit',
};

// Why a login was refused (the code the app was sent).
export const REFUSAL_LABELS: Record<string, string> = {
  ACCOUNT_DEACTIVATED: 'deactivated',
  ACCOUNT_SUSPENDED: 'suspended',
  ACCOUNT_DELETION_BY_ADMIN: 'being deleted by an admin',
  ACCOUNT_PENDING_DELETION: 'waiting to be deleted (they asked)',
};

export const PLATFORM_LABELS: Record<ActivityRecord['platform'], string> = {
  android: 'Android',
  ios: 'iPhone',
  web: 'Web',
  unknown: 'Unknown',
};

export const SOS_ENDED_LABELS: Record<NonNullable<SosRecord['ended']>, string> = {
  safe: 'Marked safe',
  expired: 'Ran out',
  replaced: 'Replaced by a new SOS',
};

export const ANSWER_LABELS: Record<SosRecord['answers'][number]['kind'], string> = {
  seen: 'Seen',
  on_my_way: 'On the way',
};

export const REVIEW_SIGN_LABELS: Record<ReviewSign, string> = {
  failed_logins: 'Failed logins',
  failed_logins_ip: 'Failed logins from this address',
  limit_hits: 'Minutes with a limit hit',
  real_sos: 'Real SOS sent',
  friend_requests: 'Friend requests sent',
};

/** "Login failed (wrong password) · password" — the details column of an activity record. */
export function activityDetails(record: ActivityRecord): string {
  const parts: string[] = [];
  if (record.reason) parts.push(REFUSAL_LABELS[record.reason] ?? record.reason);
  if (record.limiter) parts.push(record.limiter);
  if (record.method) parts.push(record.method === 'google' ? 'Google' : 'password');
  return parts.join(' · ');
}
