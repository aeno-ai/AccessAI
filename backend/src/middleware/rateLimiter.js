const rateLimit = require('express-rate-limit');

// Every limiter answers with JSON { message } (an object, not a string —
// express-rate-limit sends a plain string as an HTML page, which the app
// would show raw).

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: { message: 'Too many tries. Please wait 15 minutes and try again.' },
});

// ANTI BURAT-FORCE ATTACK

// Paths with their own, per-account limit (below). They are left out of the
// general per-IP limit because they're busy by design — a real chat easily
// passes 100 requests in 15 minutes, an SOS shares a live location every
// 30 seconds, and sign language uploads a short video every 2 seconds — and
// an SOS must never be refused because the same Wi-Fi was busy.
const OWN_LIMIT_PATHS = ['/api/messages', '/api/sos', '/api/assistant', '/api/sign', '/api/push'];

// Looser, general-purpose limit applied to every route as a baseline
// defense against abuse/DoS. authLimiter above stays much stricter and
// specific to register/login.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { message: 'Too many requests. Please wait a few minutes and try again.' },
  skip: (req) => OWN_LIMIT_PATHS.some((path) => req.path.startsWith(path)),
});

// Admin login only. Successful logins don't count toward the limit, so a
// real admin logging in and out a few times never locks themselves out —
// only failed guesses add up. This is per IP; the per-account lockout in
// adminAuthController covers attackers who rotate IPs.
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  skipSuccessfulRequests: true,
  message: { message: 'Too many login attempts. Please try again after 15 minutes.' },
});

// Endpoints that email a code. Mostly protects our sending allowance (a
// Gmail account sends a few hundred a day) and people's inboxes; each
// account also has to wait a minute between codes (utils/emailCodes.js).
const emailCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { message: 'Too many code requests. Please try again after 15 minutes.' },
});

// Endpoints that check a code. Each code already dies after 5 wrong
// guesses; this stops someone cycling through fresh codes from one IP.
// Roomier than authLimiter so a couple of typos don't lock anyone out.
const codeCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { message: 'Too many attempts. Please try again after 15 minutes.' },
});

// Adding a friend by code. Codes are random, but this keeps anyone from
// trying lots of them to find accounts.
const friendRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { message: 'Too many friend requests. Please try again in an hour.' },
});

// Online chat between friends: sending, reading and catching up after
// being offline.
const messageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600,
  message: { message: 'Too many messages. Please slow down and try again in a few minutes.' },
});

// Per-account limits — mount these AFTER protect(), which sets req.user.
// Counting per account (not per IP) means friends sharing one Wi-Fi never
// use up each other's allowance.
const perUser = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => `user:${req.user.userId}`,
    message: { message },
  });

// SOS: trigger, live location (every ~30 s for 30 min), responses, the
// active list. Generous — an emergency must not be throttled.
const sosLimiter = perUser(15 * 60 * 1000, 300, 'Too many SOS requests. Please wait a moment and try again.');

// Accel, the voice assistant: one call per spoken command.
const assistantLimiter = perUser(60 * 1000, 30, 'Accel needs a short break. Please try again in a minute.');

// Sign language: one short video every ~2 seconds while signing.
const signLimiter = perUser(60 * 1000, 60, 'Sign language is busy. Please wait a moment and try again.');

// Saving or removing this phone's notification address.
const pushLimiter = perUser(15 * 60 * 1000, 30, 'Too many requests. Please wait a few minutes and try again.');

module.exports = {
  authLimiter,
  generalLimiter,
  adminLoginLimiter,
  emailCodeLimiter,
  codeCheckLimiter,
  friendRequestLimiter,
  messageLimiter,
  sosLimiter,
  assistantLimiter,
  signLimiter,
  pushLimiter,
};
