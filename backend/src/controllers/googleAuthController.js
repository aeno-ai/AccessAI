const crypto = require('crypto');
const User = require('../models/Users');
const { TERMS_VERSION } = require('../constants/legal');
const { purgeUser } = require('../utils/accountDeletion');
const { signTicket, verifyTicket } = require('../utils/authTickets');
const google = require('../utils/googleOAuth');
const { DEACTIVATED, signUserToken, isDeletionDue } = require('../utils/userSession');

// How "Continue with Google" works:
//
//   1. The app opens GET /google/start in a browser, passing the link it's
//      waiting for (`redirect`).
//   2. start → authorize (on BACKEND_PUBLIC_URL) → Google's sign-in page →
//      Google sends the browser to /google/callback.
//   3. The callback learns who signed in and sends the browser back to the
//      app with a 5-minute ticket (never a login token) on the link.
//   4. The app POSTs the ticket to /google/exchange: a login token for an
//      existing account; for a new one, a sign-up ticket that
//      /google/complete turns into an account once the user has chosen PWD
//      or non-PWD and accepted the terms.

const STATE_COOKIE = 'google_oauth_state';
const STATE_COOKIE_PATH = '/api/auth/google';
const STATE_TTL_MS = 10 * 60 * 1000;

const TICKET_EXPIRED = { message: 'Your Google sign-in has expired. Please continue with Google again.' };

// Sends the browser back into the app with `params` added to the app's
// link. openAuthSessionAsync in the app is waiting for exactly that link.
const backToApp = (res, appRedirect, params) => {
  const url = new URL(appRedirect);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  res.redirect(url.toString());
};

// The page someone sees if they reach these links outside the app.
const plainError = (res, message) => res.status(400).type('text').send(message);

const googleStart = (req, res) => {
  const { redirect } = req.query;
  if (!google.isAllowedAppRedirect(redirect)) {
    return plainError(res, 'Open this from the AccessAI app.');
  }
  if (!google.isConfigured()) {
    return backToApp(res, redirect, { error: 'Google sign-in is not set up on the server yet.' });
  }
  // The app may have called a LAN address. Carry on at the public address
  // Google will send the user back to, so the cookie set next is there
  // waiting when they return.
  res.redirect(`${google.publicUrl()}/api/auth/google/authorize?${new URLSearchParams({ redirect })}`);
};

const googleAuthorize = (req, res) => {
  const { redirect } = req.query;
  if (!google.isAllowedAppRedirect(redirect)) {
    return plainError(res, 'Open this from the AccessAI app.');
  }
  if (!google.isConfigured()) {
    return backToApp(res, redirect, { error: 'Google sign-in is not set up on the server yet.' });
  }

  // The same random value goes in a cookie and in the signed `state` Google
  // hands back. The callback insists they match, so only the browser that
  // started a sign-in can finish it.
  const nonce = crypto.randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: google.publicUrl().startsWith('https://'),
    // 'lax' still sends it on the top-level redirect back from Google.
    sameSite: 'lax',
    maxAge: STATE_TTL_MS,
    path: STATE_COOKIE_PATH,
  });
  const state = signTicket('google_state', { redirect, nonce }, STATE_TTL_MS / 1000);
  res.redirect(google.buildAuthUrl(state));
};

const googleCallback = async (req, res) => {
  const { code, state, error } = req.query;

  const saved = verifyTicket(state, 'google_state');
  if (!saved) {
    return plainError(res, 'This sign-in has expired. Go back to AccessAI and try again.');
  }

  const sameBrowser = req.cookies[STATE_COOKIE] === saved.nonce;
  res.clearCookie(STATE_COOKIE, { path: STATE_COOKIE_PATH });
  if (!sameBrowser) {
    return backToApp(res, saved.redirect, { error: 'Sign-in could not be finished. Please try again.' });
  }

  // e.g. "access_denied" when the user backs out of Google's page.
  if (error || typeof code !== 'string') {
    return backToApp(res, saved.redirect, { cancelled: '1' });
  }

  try {
    const profile = await google.fetchGoogleProfile(code);
    if (!profile.email || !profile.emailVerified) {
      return backToApp(res, saved.redirect, {
        error: 'Your Google account needs a verified email address to use with AccessAI.',
      });
    }
    const ticket = signTicket(
      'google_login',
      {
        googleId: profile.googleId,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
      },
      '5m',
    );
    backToApp(res, saved.redirect, { ticket });
  } catch (err) {
    console.error('Google sign-in failed:', err);
    backToApp(res, saved.redirect, { error: 'Google sign-in failed. Please try again.' });
  }
};

// Swaps the callback's ticket for a login token — or, for someone new to
// AccessAI, a sign-up ticket.
const googleExchange = async (req, res, next) => {
  try {
    const profile = verifyTicket(req.body.ticket, 'google_login');
    if (!profile) return res.status(400).json(TICKET_EXPIRED);

    let user = await User.findOne({ googleId: profile.googleId });

    if (!user) {
      user = await User.findOne({ email: profile.email });
      if (user && user.emailVerified === false) {
        // An email/password sign-up that never entered its code. Google has
        // just proved this person owns the address, so that half-finished
        // account (which holds nothing) makes way for theirs.
        await User.deleteOne({ _id: user._id });
        user = null;
      } else if (user && user.googleId) {
        return res.status(409).json({ message: 'This email is already linked to a different Google account.' });
      } else if (user) {
        // An existing account with this email. Google has confirmed the
        // email belongs to this person, so link it: from now on either way
        // of logging in works.
        await User.updateOne({ _id: user._id }, { googleId: profile.googleId });
      }
    }

    if (user && user.isActive === false) {
      return res.status(403).json(DEACTIVATED);
    }

    if (user && user.deletionScheduledFor) {
      if (isDeletionDue(user)) {
        // Erased now, so they carry on as someone new.
        await purgeUser(user._id);
        user = null;
      } else {
        // Same prompt as a password login. The restore ticket stands in for
        // the password that /restore would ask for.
        return res.status(403).json({
          code: 'ACCOUNT_PENDING_DELETION',
          message: 'This account is scheduled for deletion.',
          deletionScheduledFor: user.deletionScheduledFor,
          restoreTicket: signTicket('google_restore', { userId: user._id.toString() }, '15m'),
        });
      }
    }

    if (!user) {
      // The app still needs their account type and consent. 30 minutes, so
      // nobody is rushed through the declaration.
      const { googleId, email, firstName, lastName } = profile;
      return res.json({
        needsSignup: true,
        signupTicket: signTicket('google_signup', { googleId, email }, '30m'),
        profile: { email, firstName, lastName },
      });
    }

    res.json({ token: signUserToken(user) });
  } catch (error) {
    next(error);
  }
};

// Creates the account for someone new, once they've filled in the rest of
// sign-up. Validated like register, minus email and password: the email
// comes from Google (already verified), and there's no password.
const googleComplete = async (req, res, next) => {
  try {
    const signup = verifyTicket(req.body.signupTicket, 'google_signup');
    if (!signup) return res.status(400).json(TICKET_EXPIRED);

    const { firstName, lastName, role } = req.body;
    const now = new Date();
    const user = await User.create({
      email: signup.email,
      googleId: signup.googleId,
      emailVerified: true,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      role,
      termsAcceptedAt: now,
      termsVersion: TERMS_VERSION,
      ...(role === 'pwd' ? { pwdDeclaredAt: now } : {}),
    });

    res.status(201).json({ message: 'User created', userId: user._id, token: signUserToken(user) });
  } catch (error) {
    // Someone registered this email (or Google account) while the form was
    // open — e.g. the same ticket sent twice.
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'An account with this email already exists. Go back and continue with Google again to log in.',
      });
    }
    if (error.name === 'ValidationError') {
      console.error(error);
      return res.status(400).json({ message: 'Please check your details and try again.' });
    }
    next(error);
  }
};

// /restore for an account signed into with Google: the ticket from
// googleExchange stands in for the password.
const googleRestore = async (req, res, next) => {
  try {
    const ticket = verifyTicket(req.body.restoreTicket, 'google_restore');
    if (!ticket) return res.status(400).json(TICKET_EXPIRED);

    const user = await User.findById(ticket.userId);
    if (!user) return res.status(404).json({ message: 'This account no longer exists' });

    if (user.isActive === false) {
      return res.status(403).json(DEACTIVATED);
    }

    if (!user.deletionScheduledFor) {
      return res.status(400).json({ message: 'This account is not scheduled for deletion' });
    }

    if (isDeletionDue(user)) {
      await purgeUser(user._id);
      return res.status(404).json({ message: 'This account no longer exists' });
    }

    await User.updateOne({ _id: user._id }, { $unset: { deletionScheduledFor: 1 } });
    res.json({ message: 'Account restored', token: signUserToken(user) });
  } catch (error) {
    next(error);
  }
};

module.exports = { googleStart, googleAuthorize, googleCallback, googleExchange, googleComplete, googleRestore };
