const jwt = require('jsonwebtoken');
const UserActivity = require('../models/UserActivity');

// Writing the activity log (models/UserActivity.js, HANDOFF.md §41). Never
// waits and never throws: a record that can't be saved is logged, and the
// request carries on as if nothing happened.

const PLATFORMS = ['android', 'ios', 'web'];
const VERSION = /^[\w.+-]{1,32}$/;

// The phone type and app version the app sends with every request
// (frontend api/apiClient.ts), checked — anything else is "unknown" — and
// the network address (req.ip honours the proxy setting in app.js).
function deviceOf(req) {
  const platform = String(req.get?.('x-app-platform') ?? '').toLowerCase();
  const version = String(req.get?.('x-app-version') ?? '');
  return {
    platform: PLATFORMS.includes(platform) ? platform : 'unknown',
    ...(VERSION.test(version) ? { appVersion: version } : {}),
    ip: String(req.ip ?? '').replace(/^::ffff:/, '').slice(0, 100),
  };
}

/** Records one thing an account did: { userId?, type, method?, reason?, limiter? }. */
function recordUserActivity(req, { userId, type, method, reason, limiter }) {
  UserActivity.create({
    ...(userId ? { userId } : {}),
    type,
    ...(method ? { method } : {}),
    ...(reason ? { reason: String(reason).slice(0, 100) } : {}),
    ...(limiter ? { limiter } : {}),
    ...deviceOf(req),
  }).catch((error) => console.error(`Couldn't record activity (${type}):`, error.message));
}

// The signed-in account, for limiters that run before protect() sets req.user.
function tokenUserId(req) {
  if (req.user?.userId) return req.user.userId;
  const header = req.headers?.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(header.slice(7), process.env.JWT_SECRET).userId ?? null;
  } catch {
    return null;
  }
}

// A spammer is refused hundreds of times a minute: one record per person (or
// address) per limit per minute is enough to show it.
const HIT_EVERY_MS = 60 * 1000;
const lastHit = new Map();

/** Someone was refused by a limit (`limiter`: "messages", "general"…). */
function recordLimitHit(req, limiter) {
  const userId = tokenUserId(req);
  const key = `${userId ?? req.ip}:${limiter}`;
  const now = Date.now();
  if ((lastHit.get(key) ?? 0) > now - HIT_EVERY_MS) return;
  lastHit.set(key, now);
  if (lastHit.size > 10000) {
    for (const [oldKey, at] of lastHit) if (at <= now - HIT_EVERY_MS) lastHit.delete(oldKey);
  }
  recordUserActivity(req, { userId, type: 'limit.hit', limiter });
}

module.exports = { recordUserActivity, recordLimitHit, deviceOf };
