const jwt = require('jsonwebtoken');
const User = require('../models/Users');

// Checks a mobile-app login token. Shared by protect() (every REST request)
// and the real-time socket (realtime/io.js), so both let in exactly the same
// people.
//
// Returns the token's payload ({ userId, role, firstName, iat, exp }) when
// it's valid AND the account may still use it, or null otherwise. Throws
// only if the database itself fails.
//
// A valid signature only proves we issued the token — not that the account
// is still allowed in. Checking the account too means an admin deactivating
// a user takes effect on that user's very next request, not whenever their
// 7-day token happens to expire. An account waiting to be deleted is treated
// the same way, so asking for deletion signs the user out on every device.
// (`null` also matches the field missing.) Tokens issued before the password
// was last reset are refused too, so "Forgot password" signs out whoever
// knew the old one. (`iat` is in whole seconds, so a token from the same
// second as the reset counts as older — at worst that means logging in
// again.)
async function verifyUserToken(token) {
  if (!token) {
    return null;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }

  const allowed = await User.exists({
    _id: decoded.userId,
    isActive: { $ne: false },
    deletionScheduledFor: null,
    $or: [{ passwordChangedAt: null }, { passwordChangedAt: { $lt: new Date(decoded.iat * 1000) } }],
  });
  return allowed ? decoded : null;
}

module.exports = { verifyUserToken };
