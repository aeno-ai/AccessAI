const jwt = require('jsonwebtoken');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { createTokenBucketLimiter } = require('./tokenBucket');
const { recordLimitHit } = require('../utils/activityLog');
const { SHARED, takeSharedToken, sharedStoreFor } = require('./sharedRateStores');

// Every limiter answers with JSON { message } (an object, not a string —
// express-rate-limit sends a plain string as an HTML page, which the app
// would show raw).
//
// The app's limiters also note each refusal (at most once a minute per
// person and limit) in the activity log, for the admin panel's "Needs a
// look" list (HANDOFF.md §41). `name` is what the admin sees.
// With several server copies (RATE_LIMIT_STORE=mongo, HANDOFF §52) each
// limiter keeps its counts in MongoDB, shared by every copy.
const limited = (name, options) =>
  rateLimit({
    ...options,
    ...sharedStoreFor(name),
    handler: (req, res, _next, used) => {
      recordLimitHit(req, name);
      res.status(used.statusCode).json(used.message);
    },
  });

// Login, sign-up and restoring an account. Only FAILED tries count, so a
// person who logs in and out a few times (or a family sharing one Wi-Fi)
// is never locked out; 20 wrong passwords in 15 minutes still is.
const authLimiter = limited('logins', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  skipSuccessfulRequests: true,
  message: { message: 'Too many tries. Please wait a few minutes and try again.' },
});

// Who a request counts against: the signed-in account when there's a valid
// login token, so people sharing one Wi-Fi (or the Cloudflare tunnel) never
// use up each other's allowance; otherwise the network address.
const accountOrIp = (req) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const { userId } = jwt.verify(header.slice(7), process.env.JWT_SECRET);
      if (userId) return `user:${userId}`;
    } catch {
      // Not a valid token: count it by address.
    }
  }
  return `ip:${ipKeyGenerator(req.ip)}`;
};

// ANTI BURAT-FORCE ATTACK

// Paths with their own, per-account limit (below). They are left out of the
// general limit because they're busy by design — a real chat easily passes
// 100 requests in 15 minutes, an SOS shares a live location every 30
// seconds, and sign language uploads a short video every 2 seconds — and an
// SOS must never be refused because of the general limit.
const OWN_LIMIT_PATHS = ['/api/messages', '/api/sos', '/api/assistant', '/api/sign', '/api/push'];

// A baseline against abuse on every route, per account (or per address when
// signed out): a token bucket with a cooldown block (tokenBucket.js, HANDOFF
// §18). Bursts of up to 120 requests are fine, and 2 a second can go on
// forever — far above what a person does (opening screens, chats, friends,
// sync). An empty bucket answers "slow down"; 30 refused requests within a
// minute block that account for 5 minutes. authLimiter above stays
// stricter, for passwords.
const generalLimiter = createTokenBucketLimiter({
  capacity: 120,
  refillPerSecond: 2,
  blockAfter: 30,
  blockWindowMs: 60 * 1000,
  blockMs: 5 * 60 * 1000,
  keyGenerator: accountOrIp,
  shared: SHARED ? takeSharedToken : null,
  onRefuse: (req) => recordLimitHit(req, 'general'),
  skip: (req) => OWN_LIMIT_PATHS.some((path) => req.path.startsWith(path)),
});

// Admin login only. Successful logins don't count toward the limit, so a
// real admin logging in and out a few times never locks themselves out —
// only failed guesses add up. This is per IP; the per-account lockout in
// adminAuthController covers attackers who rotate IPs.
const adminLoginLimiter = rateLimit({
  ...sharedStoreFor('admin logins'),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  skipSuccessfulRequests: true,
  message: { message: 'Too many login attempts. Please try again after 15 minutes.' },
});

// Endpoints that email a code. Mostly protects our sending allowance (a
// Gmail account sends a few hundred a day) and people's inboxes. The outer
// guard: each address also waits a minute between codes and gets at most 5
// a day (utils/codeGate.js).
const emailCodeLimiter = limited('email codes', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { message: 'Too many code requests. Please try again after 15 minutes.' },
});

// Endpoints that check a code. Each code already dies after 5 wrong
// guesses; this stops someone cycling through fresh codes from one IP.
// Roomier than authLimiter so a couple of typos don't lock anyone out.
const codeCheckLimiter = limited('code checks', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { message: 'Too many attempts. Please try again after 15 minutes.' },
});

// "Did my code email go out?" — the code page asks a few times per code.
const codeStatusLimiter = limited('code status', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  message: { message: 'Too many tries. Please wait a moment and try again.' },
});

// Adding a friend by code. Codes are random, but this keeps anyone from
// trying lots of them to find accounts.
const friendRequestLimiter = limited('friend requests', {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  message: { message: 'Too many friend requests. Please try again in an hour.' },
});

// Online chat between friends: sending, reading and catching up after
// being offline. Mounted before protect(), so it reads the login itself
// (accountOrIp): friends sharing one Wi-Fi each get their own 600.
const messageLimiter = limited('messages', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600,
  keyGenerator: accountOrIp,
  message: { message: 'Too many messages. Please slow down and try again in a few minutes.' },
});

// Per-account limits — mount these AFTER protect(), which sets req.user.
// Counting per account (not per IP) means friends sharing one Wi-Fi never
// use up each other's allowance.
const perUser = (name, windowMs, max, message) =>
  limited(name, {
    windowMs,
    max,
    keyGenerator: (req) => `user:${req.user.userId}`,
    message: { message },
  });

// SOS: trigger, live location (every ~30 s for 30 min), responses, the
// active list. Generous — an emergency must not be throttled.
const sosLimiter = perUser('sos', 15 * 60 * 1000, 300, 'Too many SOS requests. Please wait a moment and try again.');

// Laya, the voice assistant: one call per spoken command.
const assistantLimiter = perUser('laya', 60 * 1000, 30, 'Laya needs a short break. Please try again in a minute.');

// Sign language: one short video every ~2 seconds while signing.
const signLimiter = perUser('sign language', 60 * 1000, 60, 'Sign language is busy. Please wait a moment and try again.');

// Saving or removing this phone's notification address.
const pushLimiter = perUser('push', 15 * 60 * 1000, 30, 'Too many requests. Please wait a few minutes and try again.');

module.exports = {
  authLimiter,
  generalLimiter,
  adminLoginLimiter,
  emailCodeLimiter,
  codeCheckLimiter,
  codeStatusLimiter,
  friendRequestLimiter,
  messageLimiter,
  sosLimiter,
  assistantLimiter,
  signLimiter,
  pushLimiter,
};
