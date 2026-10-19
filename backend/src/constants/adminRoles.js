// Roles for people who use the web admin panel. These are completely
// separate from User.role ('pwd' / 'non_pwd'), which describes what kind of
// app user someone is — not what they're allowed to do.
// Two roles only (the read-only "viewer" was removed on 2026-10-12).
const ADMIN_ROLES = ['super_admin', 'admin'];

const PERMISSIONS = {
  USERS_READ: 'users:read',
  USERS_UPDATE: 'users:update',
  // Pause an account for 1, 7 or 30 days (HANDOFF.md §42).
  USERS_SUSPEND: 'users:suspend',
  // Delete an account in 30 days, or undo that — super admins only.
  USERS_DELETE: 'users:delete',
  // App accounts' login and activity records (§41), and SOS records
  // without the place, location or message (§43).
  ACTIVITY_READ: 'activity:read',
  SOS_READ: 'sos:read',
  ADMINS_READ: 'admins:read',
  ADMINS_MANAGE: 'admins:manage',
};

// The single source of truth for "who can do what". Routes check a
// permission (never a role name), so changing what a role can do only ever
// means editing this map.
const ROLE_PERMISSIONS = {
  admin: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_SUSPEND,
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.SOS_READ,
  ],
  super_admin: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_SUSPEND,
    PERMISSIONS.USERS_DELETE,
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.SOS_READ,
    PERMISSIONS.ADMINS_READ,
    PERMISSIONS.ADMINS_MANAGE,
  ],
};

function permissionsFor(role) {
  return ROLE_PERMISSIONS[role] ?? [];
}

module.exports = { ADMIN_ROLES, PERMISSIONS, ROLE_PERMISSIONS, permissionsFor };
