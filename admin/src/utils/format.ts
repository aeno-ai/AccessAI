import type { ActivityRecord, ActivityType, AdminRole, ReviewFlag, ReviewSign, Severity, SosRecord, UserStatus, UserType } from '../types';

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
  failed_logins_streak: 'Consecutive failed logins',
  failed_logins: 'Repeated failed logins',
  failed_logins_ip: 'Failed logins from one address',
  limit_hits: 'Repeated usage-limit hits',
  real_sos: 'Repeated real SOS alerts',
  friend_requests: 'Mass friend requests',
};

export const SEVERITY_LABELS: Record<Severity, string> = { high: 'High', medium: 'Medium', low: 'Low' };
export const SEVERITY_BADGES: Record<Severity, string> = { high: 'badge-danger', medium: 'badge-warning', low: 'badge' };

// What each rule watches for, in one line (the rules legend).
export const REVIEW_RULE_TEXT: Record<ReviewSign, (threshold: number) => string> = {
  failed_logins_streak: (n) => `${n}+ failed login attempts in a row on one account, with no successful login in between`,
  failed_logins: (n) => `${n}+ failed login attempts on one account in 24 hours`,
  failed_logins_ip: (n) => `${n}+ failed login attempts from one network address in 24 hours, on any accounts`,
  limit_hits: (n) => `Usage limits hit in ${n}+ different minutes in 24 hours`,
  real_sos: (n) => `${n}+ real (not test) SOS alerts sent in 24 hours`,
  friend_requests: (n) => `${n}+ friend requests sent in 24 hours`,
};

const LIMITER_LABELS: Record<string, string> = {
  general: 'general requests',
  logins: 'login attempts',
  'email codes': 'email codes',
  'code checks': 'code checks',
  'code status': 'code status checks',
  'friend requests': 'friend requests',
  messages: 'messages',
  sos: 'SOS',
  laya: 'voice assistant',
  'sign language': 'sign language',
  push: 'notifications',
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const listOf = (items: string[] = []) => items.join(', ');
const timeFormatter = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

/** "Oct 21, 2026, 2:14 AM – 2:31 AM" (one day) or two full date-times. */
export function formatSpan(first: string, last: string): string {
  const a = new Date(first);
  const b = new Date(last);
  if (a.getTime() === b.getTime()) return formatDateTime(first);
  if (a.toDateString() === b.toDateString()) return `${formatDateTime(first)} – ${timeFormatter.format(b)}`;
  return `${formatDateTime(first)} – ${formatDateTime(last)}`;
}

/** One flag as a sentence an admin can act on: what happened, when, from where, why. */
export function describeFlag(flag: ReviewFlag): string {
  const when = formatSpan(flag.firstAt, flag.lastAt);
  const from = flag.addressCount ? ` from ${plural(flag.addressCount, 'network address', 'network addresses')}` : '';
  const reasons = flag.reasons?.length ? ` Reason${flag.reasons.length === 1 ? '' : 's'}: ${listOf(flag.reasons)}.` : '';
  switch (flag.sign) {
    case 'failed_logins_streak':
      return `${flag.count} failed login attempts in a row with no successful login in between, ${when}${from}.${reasons}`;
    case 'failed_logins':
      return `${flag.count} failed login attempts in 24 hours (rule: ${flag.threshold}+), ${when}${from}.${reasons}`;
    case 'failed_logins_ip': {
      // Attempts on emails with no account aren't tied to any account.
      const target = flag.accounts ? `against ${plural(flag.accounts, 'different account')}` : 'on email addresses that have no account';
      return `${flag.count} failed login attempts from this network address ${target}, ${when}.${reasons}`;
    }
    case 'limit_hits': {
      const limits = (flag.limiters ?? []).map((name) => LIMITER_LABELS[name] ?? name);
      return `Usage limits hit in ${flag.count} different minutes (rule: ${flag.threshold}+), ${when}${from}.${limits.length ? ` Limits: ${listOf(limits)}.` : ''}`;
    }
    case 'real_sos': {
      const unanswered = flag.unanswered ?? 0;
      const answers = unanswered ? `${unanswered} ${unanswered === 1 ? 'was' : 'were'} not answered by anyone.` : 'Every one was answered.';
      return `${flag.count} real SOS alerts in 24 hours (rule: ${flag.threshold}+), ${when}. ${answers}`;
    }
    case 'friend_requests': {
      const accepted = flag.accepted ?? 0;
      return `${flag.count} friend requests sent in 24 hours (rule: ${flag.threshold}+), ${when}. ${accepted} ${accepted === 1 ? 'was' : 'were'} accepted.`;
    }
    default:
      return `${flag.count} in 24 hours.`;
  }
}

// The admin log's actions, in plain words (unknown ones are shown as they are).
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'login.success': 'Logged in',
  'login.failed': 'Login failed',
  'password.change': 'Changed own password',
  'permission.denied': 'Tried something not allowed',
  'user.reactivate': 'Reactivated an account',
  'user.suspend': 'Suspended an account',
  'user.suspend.lift': 'Lifted a suspension',
  'user.delete.schedule': 'Scheduled an account deletion',
  'user.delete.cancel': 'Cancelled an account deletion',
  'user.activity.view': "Opened someone's activity",
  'user.sos.view': "Opened someone's SOS records",
  'activity.list.view': 'Opened the activity list',
  'sos.list.view': 'Opened the SOS list',
  'review.view': 'Opened Suspicious Activities',
  'activity.export': 'Exported activity (CSV)',
  'sos.export': 'Exported SOS records (CSV)',
  'review.export': 'Exported Suspicious Activities (CSV)',
  'audit.export': 'Exported the admin log (CSV)',
  'admin.create': 'Created an admin',
  'admin.update': 'Changed an admin',
  'admin.reset_password': "Reset an admin's password",
};
export const auditActionLabel = (action: string) => AUDIT_ACTION_LABELS[action] ?? action;

/** "Login failed (wrong password) · password" — the details column of an activity record. */
export function activityDetails(record: ActivityRecord): string {
  const parts: string[] = [];
  if (record.reason) parts.push(REFUSAL_LABELS[record.reason] ?? record.reason);
  if (record.limiter) parts.push(record.limiter);
  if (record.method) parts.push(record.method === 'google' ? 'Google' : 'password');
  return parts.join(' · ');
}
