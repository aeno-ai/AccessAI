// Shapes returned by the backend's /api/admin/* endpoints.

export type AdminRole = 'super_admin' | 'admin';

export type Permission =
  | 'users:read'
  | 'users:update'
  | 'users:suspend'
  | 'users:delete'
  | 'activity:read'
  | 'sos:read'
  | 'admins:read'
  | 'admins:manage'
  | 'audit:read';

export type Admin = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
  isLocked: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  permissions: Permission[];
};

export type UserType = 'pwd' | 'non_pwd';

export type AppUser = {
  id: string;
  name: string;
  firstName: string | null; // null for accounts created before sign-up asked for it
  lastName: string | null;
  email: string;
  role: UserType;
  isActive: boolean;
  // 'deactivated' is the old switch; locking is Suspend or Delete in 30 days now.
  status: UserStatus;
  emailVerified: boolean;
  suspendedUntil: string | null;
  suspendedReason: string | null;
  suspendedAt: string | null;
  deletionScheduledFor: string | null;
  // 'admin': only an admin can undo it. 'user': they asked for it.
  deletionBy: 'admin' | 'user' | null;
  deletionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserStatus = 'active' | 'suspended' | 'deleting' | 'deactivated';

export type UserListResponse = {
  users: AppUser[];
  total: number;
  page: number;
  pages: number;
};

export type UserDetailResponse = {
  user: AppUser;
  stats: {
    emergencyContacts: number;
    conversations: number;
    sosEvents: number;
    activeSosEvents: number;
  };
};

// Someone named in a record. Null when the account is gone.
export type PersonRef = { id: string; name: string; email: string | null } | null;

export type ActivityType =
  | 'login.success'
  | 'login.failed'
  | 'login.refused'
  | 'logout'
  | 'signup'
  | 'email.verified'
  | 'password.changed'
  | 'password.reset'
  | 'email.changed'
  | 'deletion.requested'
  | 'deletion.cancelled'
  | 'limit.hit';

export type ActivityRecord = {
  id: string;
  at: string;
  type: ActivityType;
  method: 'password' | 'google' | null;
  reason: string | null;
  limiter: string | null;
  platform: 'android' | 'ios' | 'web' | 'unknown';
  appVersion: string | null;
  ip: string | null;
  user: PersonRef;
};

export type ActivityListResponse = {
  records: ActivityRecord[];
  total: number;
  page: number;
  pages: number;
};

// Never has the place, location or message (the backend never sends them).
export type SosRecord = {
  id: string;
  sender: PersonRef;
  sentAt: string;
  isTest: boolean;
  status: 'active' | 'resolved';
  alerted: number;
  answers: { id: string | null; name: string; kind: 'seen' | 'on_my_way'; at: string }[];
  noOneAnswered: boolean;
  endedAt: string | null;
  ended: 'safe' | 'expired' | 'replaced' | null;
};

export type SosListResponse = {
  events: SosRecord[];
  total: number;
  page: number;
  pages: number;
  // Only on one person's page.
  counts?: { real: number; test: number };
};

// Suspicious Activities (HANDOFF.md §43, §52): the rules and their evidence.
export type ReviewSign =
  | 'failed_logins_streak'
  | 'failed_logins'
  | 'failed_logins_ip'
  | 'limit_hits'
  | 'real_sos'
  | 'friend_requests';

export type Severity = 'high' | 'medium' | 'low';

export type ReviewFlag = {
  sign: ReviewSign;
  count: number;
  threshold: number;
  severity: Severity;
  firstAt: string;
  lastAt: string;
  addresses?: string[];
  addressCount?: number;
  reasons?: string[];
  limiters?: string[];
  /** failed_logins_ip: how many different accounts were tried. */
  accounts?: number;
  /** real_sos: how many no one answered. */
  unanswered?: number;
  /** friend_requests: how many were accepted. */
  accepted?: number;
};

export type ReviewItem = {
  user: (NonNullable<PersonRef> & { role: UserType; status: UserStatus }) | null;
  ip: string | null;
  severity: Severity;
  lastAt: string;
  signs: ReviewFlag[];
};

export type ReviewRule = { id: ReviewSign; threshold: number; severity: Severity };

export type ReviewResponse = { since: string; rules: ReviewRule[]; items: ReviewItem[] };

// The admin log (super admins only).
export type AuditEntry = {
  id: string;
  at: string;
  admin: { id: string; email: string | null; name: string | null } | null;
  email: string | null;
  action: string;
  success: boolean;
  target: { type: 'user' | 'admin' | null; id: string; name: string | null } | null;
  ip: string | null;
  details: Record<string, unknown> | null;
};

export type AuditListResponse = { entries: AuditEntry[]; total: number; page: number; pages: number; actions: string[] };

// The dashboard.
export type DashboardRange = '24h' | '7d' | '30d' | '90d';
export type Breakdown = { key: string; count: number }[];

export type DashboardResponse = {
  range: DashboardRange;
  unit: 'hour' | 'day';
  since: string;
  generatedAt: string;
  activityRetentionDays: number;
  buckets: string[];
  kpis: {
    users: number;
    pwd: number;
    nonPwd: number;
    newSignups: number;
    activeUsers: number;
    loginsOk: number;
    loginsFailed: number;
    loginsRefused: number;
    sosReal: number;
    sosTest: number;
    sosUnanswered: number;
    sosMedianAnswerMinutes: number | null;
    suspicious: number;
    suspiciousHigh: number;
    adminActions: number;
  };
  series: {
    logins: { success: number[]; failed: number[]; refused: number[] };
    signups: number[];
    sos: { real: number[]; test: number[] };
    limitHits: number[];
    learn: { fsl: number[]; asl: number[] };
    messages: number[];
    adminActions: number[];
  };
  breakdowns: {
    userStatus: Breakdown;
    appVersions: Breakdown;
    failedReasons: Breakdown;
    limiters: Breakdown;
    sosTriggers: Breakdown;
    sosOutcomes: Breakdown;
  };
  /** 7 rows (Sunday first) × 24 hours, Manila time. */
  heatmap: number[][];
};
