const crypto = require('crypto');
const bcrypt = require('bcrypt');
const User = require('../models/Users');

// Saves a new password and PROVES it was saved: after writing, it reads the
// account back from the database and checks that the stored hash really
// matches the new password. "Forgot password" and "Change password" only
// tell the app "changed" when this returns true — a password change that
// never reached the database must never look like it worked.
//
// passwordChangedAt signs out every device (verifyUserToken refuses tokens
// issued before it). It's set to just before the current second, because a
// token's `iat` is in whole seconds: a token signed right after this (to
// keep the phone that made the change signed in) is still accepted.
async function setPasswordVerified(userId, newPassword, extra = {}) {
  const changedAt = new Date(Math.floor(Date.now() / 1000) * 1000 - 1);
  const result = await User.updateOne(
    { _id: userId },
    { password: await bcrypt.hash(newPassword, 10), passwordChangedAt: changedAt, ...extra },
  );
  if (result.matchedCount !== 1) {
    console.error(`Password change for user ${userId}: account not found`);
    return false;
  }

  const saved = await User.findById(userId).select('password passwordChangedAt').lean();
  const confirmed =
    typeof saved?.password === 'string' &&
    saved.passwordChangedAt?.getTime() === changedAt.getTime() &&
    (await bcrypt.compare(newPassword, saved.password));
  if (confirmed) {
    console.log(`Password changed for user ${userId}`);
  } else {
    console.error(`Password change for user ${userId} could not be confirmed in the database`);
  }
  return confirmed;
}

// A short fingerprint of the account's current password hash. Put inside a
// reset ticket, it makes the ticket single-use: once the password changes,
// the fingerprint no longer matches and the ticket is refused.
const passwordFingerprint = (user) =>
  crypto
    .createHash('sha256')
    .update(user.password || 'no-password')
    .digest('hex')
    .slice(0, 16);

module.exports = { setPasswordVerified, passwordFingerprint };
