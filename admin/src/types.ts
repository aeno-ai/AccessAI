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
  | 'admins:manage';

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

export type ReviewSign = 'failed_logins' | 'failed_logins_ip' | 'limit_hits' | 'real_sos' | 'friend_requests';

export type ReviewItem = {
  user: (NonNullable<PersonRef> & { role: UserType; status: UserStatus }) | null;
  ip: string | null;
  signs: { sign: ReviewSign; count: number; threshold: number }[];
};

export type ReviewResponse = { since: string; items: ReviewItem[] };
