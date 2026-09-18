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

module.exports = { authLimiter, generalLimiter };