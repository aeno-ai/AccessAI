// Shapes returned by the backend's /api/admin/* endpoints.

export type AdminRole = 'super_admin' | 'admin' | 'viewer';

export type Permission = 'users:read' | 'users:update' | 'admins:read' | 'admins:manage';

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
  createdAt: string;
  updatedAt: string;
};

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
