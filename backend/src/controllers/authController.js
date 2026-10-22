const bcrypt = require('bcrypt');
const { matchedData } = require('express-validator');
const User = require('../models/Users');
const { TERMS_VERSION, DELETION_GRACE_DAYS } = require('../constants/legal');
const { purgeUser } = require('../utils/accountDeletion');
const { sendCode, checkCode, codeDelivery } = require('../utils/emailCodes');
const { takeCodeSlot, slotRefused } = require('../utils/codeGate');
const { signUserToken, shouldRenew, isDeletionDue } = require('../utils/userSession');
const { refusalFor } = require('../utils/accountState');
const { recordUserActivity } = require('../utils/activityLog');
const { ensureFriendCode } = require('../utils/friendCode');
const { signTicket, verifyTicket } = require('../utils/authTickets');
const { sendMail } = require('../utils/mailer');
const { setPasswordVerified, passwordFingerprint } = require('../utils/passwords');
const { removePushDevice } = require('./pushController');

// One answer for every failed login (no account, no password yet, wrong
// password), so it can't be used to probe which emails exist — but it says
// what to do. Why it failed goes to the server log only.
const INVALID_CREDENTIALS = {
  message:
    'Wrong email or password. If you signed up with Google, tap Continue with Google.',
};
const INVALID_CODE = { message: 'That code is wrong or has expired. Check your latest email, or ask for a new code.' };
const RESET_EXPIRED = { code: 'RESET_EXPIRED', message: 'This code has expired. Please ask for a new one.' };
const PASSWORD_NOT_CHANGED = { message: "Your password wasn't changed. Please try again." };
// 400, not 401: a 401 would sign the app out.
const WRONG_PASSWORD = { code: 'WRONG_PASSWORD', message: 'Your current password is wrong.' };
const EMAIL_TAKEN = { message: 'That email is already used by another account.' };
const GOOGLE_SIGNIN = { code: 'GOOGLE_ACCOUNT', message: 'This email signs in with Google. Tap Continue with Google.' };
const EMAIL_FAILED = { code: 'EMAIL_FAILED', message: "We couldn't send the email. Please try again." };
// Accounts made with "Continue with Google" have no password and never get
// one: they keep signing in with Google (owner, 2026-10-13).
const GOOGLE_ACCOUNT = { code: 'GOOGLE_ACCOUNT', message: 'Your account signs in with Google, so it has no password.' };
// How long the new-password page stays open after the code is entered.
const RESET_TICKET_MINUTES = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

// Shared by login and restore. Returns the account only when the email
// exists AND the password matches — every failure looks the same to the
// caller, so neither endpoint can be used to probe which emails exist.
// Accounts created with Google have no password until they set one.
// `why` is for the server log only.
const checkCredentials = async (email, password) => {
  const user = await User.findOne({ email });
  if (!user) return { user: null, why: 'no account with that email' };
  if (!user.password) return { user: null, who: user._id, why: 'no password (Google account)' };
  const isMatch = await bcrypt.compare(password, user.password);
  return isMatch ? { user } : { user: null, who: user._id, why: 'wrong password' };
};

// Sign-up, login and "Forgot password" don't wait for the email: sending
// through Gmail takes ~2 s, and the person would sit watching a spinner. The
// code arrives a moment after the next screen opens. sendCode logs how it
// went and records it, and the code page asks (GET /code-status) — so a
// failed email is shown to the person, who can tap "Resend code" at once.
//
// Every code first takes a slot from utils/codeGate.js: one a minute and 5
// a day per address, the same answer for addresses with no account.
const sendInBackground = (promise) => {
  promise.catch(() => undefined);
};

// email/password/firstName/lastName/role are already guaranteed to be well-formed strings
// (right type, right shape, right length) by the validator chains wired up
// in routes/authRoutes.js, which run — and reject the request — before this
// function ever executes. That's also what closes off NoSQL operator
// injection here: an object payload like `{"$gt": ""}` fails `isString()`
// at the route layer and never reaches the `User.findOne({ email })` query
// below. The same validators guarantee acceptedTerms (and, for 'pwd',
// pwdDeclaration) were ticked.
const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.emailVerified !== false) {
      // The app offers "Log in instead" (and says when it's a Google account).
      return res.status(409).json({
        code: 'EMAIL_IN_USE',
        message: 'This email already has an account.',
        google: !existingUser.password,
      });
    }
    // Someone started signing up with this email but never entered the
    // code. Only the owner of the inbox can finish either sign-up, and an
    // unverified account holds nothing, so this one simply starts over.
    const slot = await takeCodeSlot(email, 'verify_email');
    if (existingUser) {
      await User.deleteOne({ _id: existingUser._id });
    }

    // Consent is timestamped by the server and stamped with the server's
    // version of the terms — nothing about it is taken from the request.
    const now = new Date();
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      role,
      emailVerified: false,
      termsAcceptedAt: now,
      termsVersion: TERMS_VERSION,
      ...(role === 'pwd' ? { pwdDeclaredAt: now } : {}),
    });
    recordUserActivity(req, { userId: user._id, type: 'signup', method: 'password' });

    // No token yet: the account can't be used until the emailed code is
    // entered (verifyEmail below), which then logs the user straight in.
    // Too many codes for this address: the code page shows the wait.
    if (slot.ok) sendInBackground(sendCode(user, 'verify_email'));
    res.status(201).json({ message: 'User created', userId: user._id, codeSent: slot.ok, retryAfter: slot.retryAfter });
  } catch (error) {
    // The database's own message names internal fields and types — log it,
    // but only tell the person what they can act on.
    if (error.name === 'ValidationError') {
      console.error(error);
      return res.status(400).json({ message: 'Please check your details and try again.' });
    }
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { user, who, why } = await checkCredentials(email, password);
    if (!user) {
      // Tells the developer exactly why — the person sees the one message.
      console.log(`Login refused${who ? ` for user ${who}` : ''}: ${why}`);
      recordUserActivity(req, { userId: who, type: 'login.failed', method: 'password', reason: why });
      return res.status(401).json(INVALID_CREDENTIALS);
    }

    // Past its date (the person's own deletion or an admin's): erased now,
    // before anything else is said about it.
    if (isDeletionDue(user)) {
      await purgeUser(user._id);
      return res.status(401).json(INVALID_CREDENTIALS);
    }

    // Deactivated, suspended or being deleted by an admin. Only revealed
    // after the correct password, so it can't be used to probe which emails
    // have accounts.
    const refusal = refusalFor(user);
    if (refusal) {
      recordUserActivity(req, { userId: user._id, type: 'login.refused', method: 'password', reason: refusal.body.code });
      return res.status(refusal.status).json(refusal.body);
    }

    // Sends a fresh code (unless one went out in the last minute) and lets
    // the app take the user to the code screen, with the real wait.
    if (user.emailVerified === false) {
      const slot = await takeCodeSlot(user.email, 'verify_email');
      if (slot.ok) sendInBackground(sendCode(user, 'verify_email'));
      return res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email first.',
        codeSent: slot.ok,
        retryAfter: slot.retryAfter,
      });
    }

    // The person's own deletion (an admin's was refused above). No token:
    // the app shows a prompt instead, and only a call to /restore (which
    // re-checks the password) lets them back in.
    if (user.deletionScheduledFor) {
      recordUserActivity(req, { userId: user._id, type: 'login.refused', method: 'password', reason: 'ACCOUNT_PENDING_DELETION' });
      return res.status(403).json({
        code: 'ACCOUNT_PENDING_DELETION',
        message: 'This account is scheduled for deletion.',
        deletionScheduledFor: user.deletionScheduledFor,
      });
    }

    recordUserActivity(req, { userId: user._id, type: 'login.success', method: 'password' });
    res.json({ token: signUserToken(user) });
  } catch (error) {
    next(error);
  }
};

// Finishes a sign-up with the code emailed by register/login, and logs the
// user straight in.
const verifyEmail = async (req, res, next) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email });
    // One answer for an unknown email, an already verified account and a
    // wrong code, so this can't be used to probe which emails exist.
    if (!user || user.emailVerified !== false || !(await checkCode(user._id, 'verify_email', code))) {
      return res.status(400).json(INVALID_CODE);
    }

    const refusal = refusalFor(user);
    if (refusal) {
      return res.status(refusal.status).json(refusal.body);
    }

    await User.updateOne({ _id: user._id }, { emailVerified: true });
    console.log(`Email verified for user ${user._id}`);
    recordUserActivity(req, { userId: user._id, type: 'email.verified' });
    res.json({ message: 'Email verified', token: signUserToken(user) });
  } catch (error) {
    next(error);
  }
};

// The same answer whether or not the email has an account waiting to be
// verified — including the wait, which is per address (utils/codeGate.js).
const resendVerification = async (req, res, next) => {
  try {
    const slot = await takeCodeSlot(req.body.email, 'verify_email');
    if (!slot.ok) return res.status(429).json(slotRefused(slot, 'verify_email'));
    const user = await User.findOne({ email: req.body.email });
    if (user && user.emailVerified === false) {
      sendInBackground(sendCode(user, 'verify_email'));
    }
    res.json({ message: 'If that account is waiting to be verified, a new code is on its way.', retryAfter: slot.retryAfter });
  } catch (error) {
    next(error);
  }
};

// Step 1 of "Forgot password". Same answer whether or not the email has an
// account. Works for accounts created with Google too — that's how they
// can add a password.
const forgotPassword = async (req, res, next) => {
  try {
    // Before the account lookup: an email with no account gets the same
    // wait and the same daily cap, so this can't be used to probe.
    const slot = await takeCodeSlot(req.body.email, 'reset_password');
    if (!slot.ok) return res.status(429).json(slotRefused(slot, 'reset_password'));
    const user = await User.findOne({ email: req.body.email });
    // Signs in with Google (owner, HANDOFF §56): no code — even for the few
    // that added a password back when that was allowed — and the person is
    // told to use Google. Sign-up already says an email has a Google account.
    if (user && user.googleId && !refusalFor(user)) return res.status(409).json(GOOGLE_SIGNIN);
    // A Google account (no password) gets no email at all: it can't make a
    // password. It still gets the same answer as everyone, so this can't
    // tell anyone which emails have accounts; the screen tells people who
    // signed up with Google to use "Continue with Google". Nor does an
    // account an admin deactivated, paused or is deleting.
    if (user && !refusalFor(user) && user.password) {
      sendInBackground(sendCode(user, 'reset_password'));
    }
    res.json({ message: 'If an account uses that email, we sent a code to it.', retryAfter: slot.retryAfter });
  } catch (error) {
    next(error);
  }
};

// Whether the last code emailed for sign-up or "Forgot password" really
// went out (those are sent in the background). The code page asks a few
// times; 'failed' makes it say so. An unknown email answers 'sent', like
// any other, so this can't be used to probe which emails exist.
const codeStatus = async (req, res, next) => {
  try {
    const { email, purpose } = matchedData(req, { locations: ['query'] });
    const user = await User.findOne({ email }).select('_id').lean();
    res.json({ delivery: user ? await codeDelivery(user._id, purpose) : 'sent' });
  } catch (error) {
    next(error);
  }
};

// Step 2: the emailed code, on its own page. A right code is traded for a
// short-lived reset ticket that opens the new-password page. The ticket
// holds a fingerprint of the current password, so it works only once.
const verifyResetCode = async (req, res, next) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email });
    if (!user || !user.password || user.googleId || !(await checkCode(user._id, 'reset_password', code))) {
      return res.status(400).json(INVALID_CODE);
    }
    // The right code proves they own the inbox, so they may hear why (a
    // code sent before an admin paused the account, say).
    const refusal = refusalFor(user);
    if (refusal) {
      return res.status(refusal.status).json(refusal.body);
    }

    const resetTicket = signTicket(
      'password_reset',
      { sub: String(user._id), pw: passwordFingerprint(user) },
      `${RESET_TICKET_MINUTES}m`,
    );
    res.json({ resetTicket });
  } catch (error) {
    next(error);
  }
};

// Step 3: the new password. Answers "changed" only after the new password
// has been read back from the database (setPasswordVerified). Doesn't log
// in — the app sends the user back to the login screen, which handles every
// case (pending deletion etc.) in one place.
const resetPassword = async (req, res, next) => {
  try {
    const { resetTicket, password } = req.body;

    const ticket = verifyTicket(resetTicket, 'password_reset');
    const user = ticket ? await User.findById(ticket.sub) : null;
    if (!user || !user.password || user.googleId || ticket.pw !== passwordFingerprint(user)) {
      return res.status(400).json(RESET_EXPIRED);
    }
    const refusal = refusalFor(user);
    if (refusal) {
      return res.status(refusal.status).json(refusal.body);
    }

    // The code proved they own the inbox, so the email counts as verified.
    if (!(await setPasswordVerified(user._id, password, { emailVerified: true }))) {
      return res.status(500).json(PASSWORD_NOT_CHANGED);
    }
    recordUserActivity(req, { userId: user._id, type: 'password.reset' });
    res.json({ ok: true, verified: true, message: 'Your password is changed.' });
  } catch (error) {
    next(error);
  }
};

// Cancels a pending deletion and logs the user straight in. Takes the
// email and password again rather than a token, because an account waiting
// to be deleted is never handed a token (see login above). Accounts created
// with Google restore through /google/restore instead. Only the person's
// own deletion can be cancelled here — an admin's is refused like at login,
// and only an admin can undo it.
const restore = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { user, who, why } = await checkCredentials(email, password);
    if (!user) {
      // Counted with failed logins: this checks the password the same way.
      recordUserActivity(req, { userId: who, type: 'login.failed', method: 'password', reason: `${why} (restore)` });
      return res.status(401).json(INVALID_CREDENTIALS);
    }

    if (isDeletionDue(user)) {
      await purgeUser(user._id);
      return res.status(401).json(INVALID_CREDENTIALS);
    }

    const refusal = refusalFor(user);
    if (refusal) {
      recordUserActivity(req, { userId: user._id, type: 'login.refused', method: 'password', reason: refusal.body.code });
      return res.status(refusal.status).json(refusal.body);
    }

    if (!user.deletionScheduledFor) {
      return res.status(400).json({ message: 'This account is not scheduled for deletion' });
    }

    await User.updateOne({ _id: user._id }, { $unset: { deletionScheduledFor: 1, deletionBy: 1 } });
    recordUserActivity(req, { userId: user._id, type: 'deletion.cancelled', method: 'password' });
    res.json({ message: 'Account restored', token: signUserToken(user) });
  } catch (error) {
    next(error);
  }
};

// What "Edit profile" shows. Older accounts have only the full `name`, so
// it's split the same way the login token does it.
const profileOf = (user) => {
  const [first = '', ...rest] = (user.name || '').split(' ');
  return {
    email: user.email,
    firstName: user.firstName || first,
    lastName: user.lastName || rest.join(' '),
    // Shared to be added as a friend, and the optional note friends see.
    friendCode: user.friendCode,
    friendNote: user.friendNote || '',
  };
};

const getMe = async (req, res, next) => {
  try {
    // protect() already confirmed the account exists and is active.
    const user = await User.findById(req.user.userId).select(
      'email name firstName lastName role password googleId friendCode friendNote termsVersion',
    );
    if (!user) return res.status(404).json({ message: 'Account not found' });
    user.friendCode = await ensureFriendCode(user);
    res.status(200).json({
      success: true,
      user: {
        ...req.user,
        ...profileOf(user),
        // Tells the app how to confirm an account deletion: with the
        // password, or — for accounts created with Google — with an emailed
        // code.
        hasPassword: typeof user.password === 'string',
        // Signs in with Google: no password codes or changes (HANDOFF §56).
        google: Boolean(user.googleId),
      },
      // The Terms changed since this account agreed (or it's from before we
      // kept track): the app asks once, "We updated our Terms".
      needsTerms: user.termsVersion !== TERMS_VERSION,
      termsVersion: TERMS_VERSION,
      message: 'You are authenticated',
      // The app asks this each time it opens: a login in use keeps going.
      ...(shouldRenew(req.user) ? { token: signUserToken(user) } : {}),
    });
  } catch (error) {
    next(error);
  }
};

// firstName/lastName are already trimmed, non-empty strings of at most 30
// characters, and friendNote (if sent) a string of at most 80
// (updateMeValidators). An empty note removes it.
const updateMe = async (req, res, next) => {
  try {
    const { firstName, lastName, friendNote } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Account not found' });

    user.firstName = firstName;
    user.lastName = lastName;
    user.name = `${firstName} ${lastName}`;
    if (friendNote !== undefined) {
      user.friendNote = friendNote || undefined;
    }
    await user.save();

    res.json({ token: signUserToken(user), user: profileOf(user) });
  } catch (error) {
    next(error);
  }
};

// "Change password" in Edit profile. Accounts created with Google have no
// password yet, so they confirm with a code emailed by sendPasswordCode.
const sendPasswordCode = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('password googleId').lean();
    if (!user) return res.status(404).json({ message: 'Account not found' });
    // This used to email a code so a Google account could add a password.
    // Google accounts now stay Google-only, so there's nothing to send.
    if (!user.password || user.googleId) return res.status(403).json(GOOGLE_ACCOUNT);
    res.status(400).json({ message: 'Your account already has a password. Change it with your current password.' });
  } catch (error) {
    next(error);
  }
};

// Checks the current password (or the emailed code), saves the new one and
// reads it back. Every other device is signed out; this phone gets a fresh
// token so it stays signed in.
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, code, newPassword } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Account not found' });

    if (user.googleId) {
      return res.status(403).json(GOOGLE_ACCOUNT);
    } else if (user.password) {
      if (typeof currentPassword !== 'string' || !(await bcrypt.compare(currentPassword, user.password))) {
        return res.status(400).json(WRONG_PASSWORD);
      }
      if (await bcrypt.compare(newPassword, user.password)) {
        return res.status(400).json({ message: 'Choose a password different from your current one.' });
      }
    } else {
      // A Google account: no password to change, and none can be added.
      return res.status(403).json(GOOGLE_ACCOUNT);
    }

    if (!(await setPasswordVerified(user._id, newPassword))) {
      return res.status(500).json(PASSWORD_NOT_CHANGED);
    }
    recordUserActivity(req, { userId: user._id, type: 'password.changed' });
    res.json({ ok: true, verified: true, token: signUserToken(user), message: 'Your password is changed.' });
  } catch (error) {
    next(error);
  }
};

// "Change email", step 1: the code goes to the NEW address, proving the
// person owns it. Accounts with a password confirm it first, so a phone
// left unlocked can't be used to take the account over.
const sendEmailChangeCode = async (req, res, next) => {
  try {
    const { newEmail, password } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Account not found' });

    if (newEmail === user.email) {
      return res.status(400).json({ message: "That's already your email." });
    }
    if (user.password && (typeof password !== 'string' || !(await bcrypt.compare(password, user.password)))) {
      return res.status(400).json(WRONG_PASSWORD);
    }
    if (await User.exists({ email: newEmail })) {
      return res.status(409).json(EMAIL_TAKEN);
    }

    const slot = await takeCodeSlot(newEmail, 'change_email');
    if (!slot.ok) return res.status(429).json(slotRefused(slot, 'change_email'));
    try {
      await sendCode(user, 'change_email', { to: newEmail, newEmail });
    } catch {
      return res.status(500).json(EMAIL_FAILED);
    }
    res.json({ message: 'Code sent', email: newEmail, retryAfter: slot.retryAfter });
  } catch (error) {
    next(error);
  }
};

// "Change email", step 2: the code from the new inbox. Saves the address,
// reads it back, and tells the old address (in case it wasn't them). Google
// sign-in keeps working: it finds the account by Google's id first.
const changeEmail = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Account not found' });

    const entry = await checkCode(user._id, 'change_email', req.body.code);
    if (!entry || !entry.newEmail) return res.status(400).json(INVALID_CODE);

    const oldEmail = user.email;
    try {
      await User.updateOne({ _id: user._id }, { email: entry.newEmail, emailVerified: true });
    } catch (error) {
      // Someone else took the address in the meantime.
      if (error.code === 11000) return res.status(409).json(EMAIL_TAKEN);
      throw error;
    }
    const saved = await User.findById(user._id).select('email').lean();
    if (saved?.email !== entry.newEmail) {
      return res.status(500).json({ message: "Your email wasn't changed. Please try again." });
    }
    console.log(`Email changed for user ${user._id}`);
    recordUserActivity(req, { userId: user._id, type: 'email.changed' });

    sendMail({
      to: oldEmail,
      subject: 'Your AccessAI email was changed',
      text: `The email for your AccessAI account was changed to ${entry.newEmail}.\n\nIf you didn't do this, contact us right away.`,
    }).catch((error) => console.error(`Couldn't tell the old address about an email change for user ${user._id}:`, error));

    res.json({ ok: true, verified: true, email: entry.newEmail, message: 'Your email is changed.' });
  } catch (error) {
    next(error);
  }
};

// Emails the code that confirms deleting an account with no password.
const sendDeletionCode = async (req, res, next) => {
  try {
    // protect() already confirmed the account exists and is active.
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Account not found' });

    const slot = await takeCodeSlot(user.email, 'delete_account');
    if (!slot.ok) return res.status(429).json(slotRefused(slot, 'delete_account'));
    try {
      await sendCode(user, 'delete_account');
    } catch {
      return res.status(500).json(EMAIL_FAILED);
    }
    res.json({ message: 'Code sent', email: user.email, retryAfter: slot.retryAfter });
  } catch (error) {
    next(error);
  }
};

// Schedules the logged-in user's account for deletion. Nothing is erased
// yet — see utils/accountDeletion.js — and from this moment protect() stops
// accepting the account's tokens, so it's signed out on every device.
const requestDeletion = async (req, res, next) => {
  try {
    const { password, code } = req.body;

    // protect() already confirmed the account exists and is active.
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Account not found' });

    // Confirmed with the password, or — for accounts that don't have one —
    // with the code from sendDeletionCode.
    const confirmed = user.password
      ? typeof password === 'string' && (await bcrypt.compare(password, user.password))
      : typeof code === 'string' && (await checkCode(user._id, 'delete_account', code));
    if (!confirmed) {
      // 400, not 401: the app signs the user out on any 401, which would be
      // a strange response to a mistyped password.
      return res.status(400).json(user.password ? { message: 'Incorrect password' } : INVALID_CODE);
    }

    const deletionScheduledFor = new Date(Date.now() + DELETION_GRACE_DAYS * DAY_MS);
    await User.updateOne({ _id: user._id }, { deletionScheduledFor, deletionBy: 'user' });
    recordUserActivity(req, { userId: user._id, type: 'deletion.requested' });

    res.json({ message: 'Account scheduled for deletion', deletionScheduledFor });
  } catch (error) {
    next(error);
  }
};

// "I agree" on the "We updated our Terms" screen. The app sends the version
// it showed; an older one (the app wasn't updated yet) is refused, so
// nobody is recorded agreeing to wording they never saw. Stamped by the
// server's clock, like at sign-up.
const acceptTerms = async (req, res, next) => {
  try {
    if (req.body.version !== TERMS_VERSION) {
      return res.status(409).json({
        code: 'TERMS_OUTDATED',
        message: 'Please update AccessAI to read the latest Terms.',
        termsVersion: TERMS_VERSION,
      });
    }
    await User.updateOne({ _id: req.user.userId }, { termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION });
    res.json({ ok: true, termsVersion: TERMS_VERSION });
  } catch (error) {
    next(error);
  }
};

// Signing out on purpose (not a 401). Recorded for the admins' activity
// log; the phone's push address goes too, so it stops getting this
// account's notifications. The token itself simply stops being used: it
// can't be taken back, and the app forgets it.
const logout = async (req, res, next) => {
  try {
    if (req.body?.deviceId) await removePushDevice(req.user.userId, req.body.deviceId);
    recordUserActivity(req, { userId: req.user.userId, type: 'logout' });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  acceptTerms,
  verifyEmail,
  resendVerification,
  forgotPassword,
  codeStatus,
  verifyResetCode,
  resetPassword,
  restore,
  getMe,
  updateMe,
  sendPasswordCode,
  changePassword,
  sendEmailChangeCode,
  changeEmail,
  sendDeletionCode,
  requestDeletion,
};
