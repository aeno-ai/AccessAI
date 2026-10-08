const bcrypt = require('bcrypt');
const User = require('../models/Users');
const { TERMS_VERSION, DELETION_GRACE_DAYS } = require('../constants/legal');
const { purgeUser } = require('../utils/accountDeletion');
const { sendCode, checkCode } = require('../utils/emailCodes');
const { DEACTIVATED, signUserToken, isDeletionDue } = require('../utils/userSession');
const { ensureFriendCode } = require('../utils/friendCode');

const INVALID_CREDENTIALS = { message: 'Invalid credentials' };
const INVALID_CODE = { message: 'That code is wrong or has expired. Check your latest email, or ask for a new code.' };
const DAY_MS = 24 * 60 * 60 * 1000;

// Shared by login and restore. Returns the account only when the email
// exists AND the password matches — both failures look the same to the
// caller, so neither endpoint can be used to probe which emails exist.
// Accounts created with Google have no password until they set one.
const findByCredentials = async (email, password) => {
  const user = await User.findOne({ email });
  if (!user || !user.password) return null;
  const isMatch = await bcrypt.compare(password, user.password);
  return isMatch ? user : null;
};

// Emails a sign-up verification code, but never lets a mail problem fail
// the request around it — the verify screen has a Resend button. True if a
// code is on its way (including one sent in the last minute).
const trySendVerificationCode = async (user) => {
  try {
    await sendCode(user, 'verify_email');
    return true;
  } catch (error) {
    console.error(`Failed to email a verification code for user ${user._id}:`, error);
    return false;
  }
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
      return res.status(400).json({ message: 'Email already in use' });
    }
    // Someone started signing up with this email but never entered the
    // code. Only the owner of the inbox can finish either sign-up, and an
    // unverified account holds nothing, so this one simply starts over.
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

    // No token yet: the account can't be used until the emailed code is
    // entered (verifyEmail below), which then logs the user straight in.
    const codeSent = await trySendVerificationCode(user);
    res.status(201).json({ message: 'User created', userId: user._id, codeSent });
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

    const user = await findByCredentials(email, password);
    if (!user) return res.status(401).json(INVALID_CREDENTIALS);

    // Only revealed after the correct password, so it can't be used to
    // probe which emails have accounts.
    if (user.isActive === false) {
      return res.status(403).json(DEACTIVATED);
    }

    // Sends a fresh code (unless one went out in the last minute) and lets
    // the app take the user to the code screen.
    if (user.emailVerified === false) {
      const codeSent = await trySendVerificationCode(user);
      return res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email first.',
        codeSent,
      });
    }

    if (user.deletionScheduledFor) {
      if (isDeletionDue(user)) {
        await purgeUser(user._id);
        return res.status(401).json(INVALID_CREDENTIALS);
      }
      // No token: the app shows a prompt instead, and only a call to
      // /restore (which re-checks the password) lets them back in.
      return res.status(403).json({
        code: 'ACCOUNT_PENDING_DELETION',
        message: 'This account is scheduled for deletion.',
        deletionScheduledFor: user.deletionScheduledFor,
      });
    }

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

    if (user.isActive === false) {
      return res.status(403).json(DEACTIVATED);
    }

    await User.updateOne({ _id: user._id }, { emailVerified: true });
    res.json({ message: 'Email verified', token: signUserToken(user) });
  } catch (error) {
    next(error);
  }
};

// Always gives the same answer, whether or not a code was actually sent
// (unknown email, already verified, or one sent in the last minute).
const resendVerification = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (user && user.emailVerified === false) {
      await sendCode(user, 'verify_email');
    }
    res.json({ message: 'If that account is waiting to be verified, a new code is on its way.' });
  } catch (error) {
    next(error);
  }
};

// Step 1 of "Forgot password". Same answer whether or not the email has an
// account. Works for accounts created with Google too — that's how they
// can add a password.
const forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (user && user.isActive !== false) {
      await sendCode(user, 'reset_password');
    }
    res.json({ message: 'If an account uses that email, we sent a code to it.' });
  } catch (error) {
    next(error);
  }
};

// Step 2: the emailed code plus the new password. Doesn't log in — the app
// sends the user back to the login screen, which handles every case
// (pending deletion etc.) in one place.
const resetPassword = async (req, res, next) => {
  try {
    const { email, code, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || user.isActive === false || !(await checkCode(user._id, 'reset_password', code))) {
      return res.status(400).json(INVALID_CODE);
    }

    await User.updateOne(
      { _id: user._id },
      {
        password: await bcrypt.hash(password, 10),
        // Signs the account out on every device (see protect()) — whoever
        // knew the old password shouldn't stay logged in.
        passwordChangedAt: new Date(),
        // The code proved they own the inbox.
        emailVerified: true,
      },
    );
    res.json({ message: 'Password updated. You can now log in with your new password.' });
  } catch (error) {
    next(error);
  }
};

// Cancels a pending deletion and logs the user straight in. Takes the
// email and password again rather than a token, because an account waiting
// to be deleted is never handed a token (see login above). Accounts created
// with Google restore through /google/restore instead.
const restore = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await findByCredentials(email, password);
    if (!user) return res.status(401).json(INVALID_CREDENTIALS);

    if (user.isActive === false) {
      return res.status(403).json(DEACTIVATED);
    }

    if (!user.deletionScheduledFor) {
      return res.status(400).json({ message: 'This account is not scheduled for deletion' });
    }

    if (isDeletionDue(user)) {
      await purgeUser(user._id);
      return res.status(401).json(INVALID_CREDENTIALS);
    }

    await User.updateOne({ _id: user._id }, { $unset: { deletionScheduledFor: 1 } });
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
      'email name firstName lastName password friendCode friendNote',
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
      },
      message: 'You are authenticated',
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

// Emails the code that confirms deleting an account with no password.
const sendDeletionCode = async (req, res, next) => {
  try {
    // protect() already confirmed the account exists and is active.
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Account not found' });

    const result = await sendCode(user, 'delete_account');
    if (!result.sent) {
      return res.status(429).json({
        message: `Please wait ${result.retryAfter} seconds before asking for another code.`,
        retryAfter: result.retryAfter,
      });
    }
    res.json({ message: 'Code sent', email: user.email });
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
    await User.updateOne({ _id: user._id }, { deletionScheduledFor });

    res.json({ message: 'Account scheduled for deletion', deletionScheduledFor });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  restore,
  getMe,
  updateMe,
  sendDeletionCode,
  requestDeletion,
};
