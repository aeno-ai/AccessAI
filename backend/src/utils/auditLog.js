const AdminAuditLog = require('../models/AdminAuditLog');

// Records something an admin did (or tried to do). `entry` can override
// adminId/email — login does, because req.admin isn't set yet at that point.
//
// Never throws: a failed audit write is logged to the server console and
// swallowed, so a logging hiccup can't turn a successful admin action into
// an error response.
async function recordAdminAction(req, entry) {
  try {
    await AdminAuditLog.create({
      adminId: req.admin?._id,
      email: req.admin?.email,
      ip: req.ip,
      userAgent: req.get('user-agent')?.slice(0, 500),
      ...entry,
    });
  } catch (error) {
    console.error('Failed to write admin audit log:', error);
  }
}

module.exports = { recordAdminAction };
