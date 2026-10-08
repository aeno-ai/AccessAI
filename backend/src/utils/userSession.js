const jwt = require('jsonwebtoken');

// Shared by the password and Google controllers, so every way of logging
// in hands out exactly the same kind of token and the same answers.

const DEACTIVATED = { message: 'This account has been deactivated. Please contact support.' };

// firstName is for the app's "Hello, <name>" — the app reads it straight
// from the token, like role, so it shows offline too. Accounts from before
// first names were collected use the first word of their full name.
const signUserToken = (user) =>
  jwt.sign(
    { userId: user._id, role: user.role, firstName: user.firstName || user.name?.split(' ')[0] },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  );

// The hourly job in server.js normally erases accounts once their grace
// period is over. Checking again at login means an account past its date
// can never be logged into or restored — even if the server was asleep when
// the job was due.
const isDeletionDue = (user) => Boolean(user.deletionScheduledFor) && user.deletionScheduledFor <= new Date();

module.exports = { DEACTIVATED, signUserToken, isDeletionDue };
