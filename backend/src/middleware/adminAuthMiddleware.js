const Admin = require('../models/Admin');
const { permissionsFor } = require('../constants/adminRoles');
const { recordAdminAction } = require('../utils/auditLog');
const { SESSION_COOKIE, clearAdminSession, verifyAdminToken } = require('../utils/adminSession');

const SESSION_EXPIRED = { message: 'Your session has expired. Please log in again.' };

// Admin equivalent of authMiddleware's protect(). A valid token alone isn't
// enough: the admin is re-loaded from the database on every request, so
// disabling an admin, changing their role, or resetting their password
// (all of which bump tokenVersion) takes effect on their very next request
// instead of whenever their token would have expired.
const protectAdmin = async (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    return res.status(401).json({ message: 'Not logged in' });
  }

  let decoded;
  try {
    decoded = verifyAdminToken(token);
  } catch {
    clearAdminSession(res);
    return res.status(401).json(SESSION_EXPIRED);
  }

  try {
    const admin = await Admin.findById(decoded.adminId);
    if (!admin || !admin.isActive || admin.tokenVersion !== decoded.tv) {
      clearAdminSession(res);
      return res.status(401).json(SESSION_EXPIRED);
    }

    req.admin = admin;
    next();
  } catch (error) {
    next(error);
  }
};

// Goes after protectAdmin on every route except /me, /logout and
// /change-password: an admin still on a temporary password can't do
// anything until they've replaced it.
const requirePasswordChanged = (req, res, next) => {
  if (req.admin.mustChangePassword) {
    return res.status(403).json({
      message: 'You must change your temporary password before continuing',
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
  }
  next();
};

// The RBAC check itself. Routes ask for a permission, never a role name —
// see constants/adminRoles.js for which roles have which permissions.
const requirePermission = (permission) => async (req, res, next) => {
  if (permissionsFor(req.admin.role).includes(permission)) {
    return next();
  }

  await recordAdminAction(req, {
    action: 'permission.denied',
    success: false,
    details: { permission, method: req.method, path: req.originalUrl },
  });
  return res.status(403).json({ message: 'You do not have permission to do that' });
};

module.exports = { protectAdmin, requirePasswordChanged, requirePermission };
