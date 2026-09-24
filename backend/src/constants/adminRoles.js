// Roles for people who use the web admin panel. These are completely
// separate from User.role ('pwd' / 'non_pwd'), which describes what kind of
// app user someone is — not what they're allowed to do.
const ADMIN_ROLES = ['super_admin', 'admin', 'viewer'];

const PERMISSIONS = {
  USERS_READ: 'users:read',
  USERS_UPDATE: 'users:update',
  ADMINS_READ: 'admins:read',
  ADMINS_MANAGE: 'admins:manage',
};

// The single source of truth for "who can do what". Routes check a
// permission (never a role name), so changing what a role can do only ever
// means editing this map.
const ROLE_PERMISSIONS = {
  viewer: [PERMISSIONS.USERS_READ],
  admin: [PERMISSIONS.USERS_READ, PERMISSIONS.USERS_UPDATE],
  super_admin: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.ADMINS_READ,
    PERMISSIONS.ADMINS_MANAGE,
  ],
};

function permissionsFor(role) {
  return ROLE_PERMISSIONS[role] ?? [];
}

module.exports = { ADMIN_ROLES, PERMISSIONS, ROLE_PERMISSIONS, permissionsFor };
