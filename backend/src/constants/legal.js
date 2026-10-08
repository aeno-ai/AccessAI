// Version of the Terms of Use & Privacy Notice and the PWD declaration shown
// at sign-up (frontend/src/constants/legal.ts). Saved on each account when
// it agrees, so we can always tell which wording someone accepted. Bump it —
// here and in the app — whenever that wording changes.
const TERMS_VERSION = '2026-10-07';

// How long a deletion request waits before the account is erased for good.
// Logging in during this window lets the user cancel it.
const DELETION_GRACE_DAYS = 15;

module.exports = { TERMS_VERSION, DELETION_GRACE_DAYS };
