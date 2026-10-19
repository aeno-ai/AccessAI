// Whether an app account may be used right now, in one place (HANDOFF.md
// §42), so logging in, every request, the live connection, friends' lists,
// the SOS circle and notifications all agree. An account can't be used when
// it's:
//   - deactivated (isActive false — the old admin switch, still honoured);
//   - waiting to be deleted (by the person, or by an admin);
//   - suspended by an admin, until suspendedUntil.

const MANILA = 'Asia/Manila';

/** "24 October 2026", the way the app says dates (Philippine time). */
const longDate = (date) =>
  new Date(date).toLocaleDateString('en-PH', { timeZone: MANILA, day: 'numeric', month: 'long', year: 'numeric' });

/**
 * MongoDB conditions for accounts that may be used now. Missing fields count
 * as fine (older accounts don't have them). Put it inside an `$and` when the
 * query has its own `$or`.
 */
const usableFilter = (now = new Date()) => ({
  isActive: { $ne: false },
  deletionScheduledFor: null,
  $or: [{ suspendedUntil: null }, { suspendedUntil: { $lte: now } }],
});

const isSuspended = (user, now = new Date()) => Boolean(user.suspendedUntil) && new Date(user.suspendedUntil) > now;
const isAdminDeletion = (user) => Boolean(user.deletionScheduledFor) && user.deletionBy === 'admin';

/**
 * Why an account that otherwise checks out can't log in — or null. A
 * deletion the person asked for isn't here: login offers to cancel it.
 * Returns { status, body } to send as is.
 */
function refusalFor(user, now = new Date()) {
  if (user.isActive === false) {
    return { status: 403, body: { code: 'ACCOUNT_DEACTIVATED', message: 'This account has been deactivated. Please contact support.' } };
  }
  if (isAdminDeletion(user)) {
    return {
      status: 403,
      body: {
        code: 'ACCOUNT_DELETION_BY_ADMIN',
        message: `This account will be deleted on ${longDate(user.deletionScheduledFor)}. Contact support if you think this is a mistake.`,
        deletionScheduledFor: user.deletionScheduledFor,
      },
    };
  }
  if (isSuspended(user, now)) {
    const reason = user.suspendedReason ? ` Reason: ${user.suspendedReason}` : '';
    return {
      status: 403,
      body: {
        code: 'ACCOUNT_SUSPENDED',
        message: `Your account is paused until ${longDate(user.suspendedUntil)}.${reason} Contact support if you think this is a mistake.`,
        suspendedUntil: user.suspendedUntil,
      },
    };
  }
  return null;
}

module.exports = { usableFilter, refusalFor, isSuspended, isAdminDeletion, longDate };
