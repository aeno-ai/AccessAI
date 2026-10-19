const jwt = require('jsonwebtoken');

// Shared by the password and Google controllers, so every way of logging
// in hands out exactly the same kind of token and the same answers.

// firstName is for the app's "Hello, <name>" — the app reads it straight
// from the token, like role, so it shows offline too. Accounts from before
// first names were collected use the first word of their full name.
//
// A login lasts 30 days and is renewed whenever the app opens (GET /auth/me
// hands back a fresh token once the current one is a day old), so someone
// who uses the app at least once a month stays logged in. Disabling or
// deleting the account, or a password reset, still signs them out at once
// (verifyUserToken checks the account on every request).
const TOKEN_LIFETIME = '30d';
const RENEW_AFTER_SECONDS = 24 * 60 * 60;

const signUserToken = (user) =>
  jwt.sign(
    { userId: user._id, role: user.role, firstName: user.firstName || user.name?.split(' ')[0] },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_LIFETIME },
  );

// Whether a token (its decoded payload) is old enough to hand out a fresh one.
const shouldRenew = (decoded) => typeof decoded?.iat === 'number' && Date.now() / 1000 - decoded.iat >= RENEW_AFTER_SECONDS;

// The hourly job in server.js normally erases accounts once their grace
// period is over. Checking again at login means an account past its date
// can never be logged into or restored — even if the server was asleep when
// the job was due.
const isDeletionDue = (user) => Boolean(user.deletionScheduledFor) && user.deletionScheduledFor <= new Date();

module.exports = { signUserToken, shouldRenew, isDeletionDue };
