const mongoose = require('mongoose');
const { ACTIVITY_RETENTION_DAYS } = require('../constants/legal');

// What app accounts do that admins may need to look at (HANDOFF.md §41):
// logins (and failed or refused ones), logouts, sign-ups and account
// changes, and hitting the app's limits (spam). With the phone type, app
// version and network address. Kept ACTIVITY_RETENTION_DAYS, then MongoDB
// removes it by itself (the TTL index below), and erased with the account.
// Never what was said, sent or where someone was.
const ACTIVITY_TYPES = [
  'login.success',
  'login.failed',
  'login.refused',
  'logout',
  'signup',
  'email.verified',
  'password.changed',
  'password.reset',
  'email.changed',
  'deletion.requested',
  'deletion.cancelled',
  'limit.hit',
];

const userActivitySchema = new mongoose.Schema(
  {
    // Missing for a failed login with an email that has no account.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    // How they signed in or up.
    method: { type: String, enum: ['password', 'google'] },
    // Why a login failed or was refused ("wrong password", "suspended"…).
    reason: { type: String, maxlength: 100 },
    // Which limit was hit ("messages", "friend requests"…).
    limiter: { type: String, maxlength: 40 },
    platform: { type: String, enum: ['android', 'ios', 'web', 'unknown'], default: 'unknown' },
    appVersion: { type: String, maxlength: 32 },
    ip: { type: String, maxlength: 100 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

userActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 });
// One account's records, newest first (its page in the admin panel).
userActivitySchema.index({ userId: 1, createdAt: -1 });
// "Needs a look": failed logins and limit hits in the last day.
userActivitySchema.index({ type: 1, createdAt: -1 });
// Failed logins from one network address.
userActivitySchema.index({ ip: 1, createdAt: -1 });

module.exports = mongoose.model('UserActivity', userActivitySchema);
module.exports.ACTIVITY_TYPES = ACTIVITY_TYPES;
