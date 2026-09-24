const jwt = require('jsonwebtoken');

const SESSION_COOKIE = 'admin_session';
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

// Every admin token is stamped with this audience and verified against it,
// on top of being signed with a different secret from mobile-app tokens.
const ADMIN_TOKEN_AUDIENCE = 'accessai-admin';

// httpOnly: page JavaScript can't read the cookie at all, so even an XSS bug
//   in the admin panel can't steal the session.
// sameSite 'strict': the browser won't attach it to requests started from
//   another site, which is what blocks cross-site request forgery.
// secure: HTTPS-only in production (plain http://localhost in dev).
// path: only ever sent to the admin API, never to the mobile routes.
function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/admin',
  };
}

function issueAdminSession(res, admin) {
  const token = jwt.sign(
    { adminId: admin._id.toString(), tv: admin.tokenVersion },
    process.env.ADMIN_JWT_SECRET,
    { expiresIn: SESSION_TTL_MS / 1000, audience: ADMIN_TOKEN_AUDIENCE, algorithm: 'HS256' },
  );
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_TTL_MS });
}

function clearAdminSession(res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

// Throws if the token is missing its signature, expired, signed with the
// wrong secret (e.g. a mobile-app token), or meant for a different audience.
function verifyAdminToken(token) {
  return jwt.verify(token, process.env.ADMIN_JWT_SECRET, {
    audience: ADMIN_TOKEN_AUDIENCE,
    algorithms: ['HS256'],
  });
}

module.exports = { SESSION_COOKIE, issueAdminSession, clearAdminSession, verifyAdminToken };
