const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
});

// ANTI BURAT-FORCE ATTACK

// Looser, general-purpose limit applied to every route as a baseline
// defense against abuse/DoS. authLimiter above stays much stricter and
// specific to register/login.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
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

module.exports = { authLimiter, generalLimiter, adminLoginLimiter };