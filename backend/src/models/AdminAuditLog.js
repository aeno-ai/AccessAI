const mongoose = require('mongoose');

// A permanent record of every admin login attempt and every change an admin
// makes. Failed logins are recorded here with the real reason (unknown
// email, wrong password, locked, disabled) even though the login response
// itself always says just "Invalid credentials".
const adminAuditLogSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', index: true },
  email: { type: String, lowercase: true, trim: true, maxlength: 254 },
  action: { type: String, required: true, maxlength: 100 }, // e.g. 'login.failed', 'user.deactivate'
  targetType: { type: String, enum: ['user', 'admin'] },
  targetId: { type: mongoose.Schema.Types.ObjectId },
  success: { type: Boolean, default: true },
  ip: { type: String, maxlength: 100 },
  userAgent: { type: String, maxlength: 500 },
  details: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

adminAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminAuditLog', adminAuditLogSchema);
