// A token bucket with a cooldown block (a "penalty box", like fail2ban).
//
// Everyone (each key) has a bucket of `capacity` tokens. Each request takes
// one, and tokens flow back in at `refillPerSecond`, so a short burst —
// like the app's start, which fires about 8 requests at once — is fine, and
// steady use up to the refill rate never runs dry. An empty bucket answers
// 429 ("slow down"). Hammering on while empty — `blockAfter` refusals within
// `blockWindowMs` — earns a block of `blockMs`, which lifts by itself.
//
// Compared with the other ways to limit (HANDOFF §18):
// - fixed window (express-rate-limit's default): N per 15 minutes, counted
//   from the window's start, so 2×N can slip through around a window edge,
//   and someone who uses N up early waits out the whole window;
// - sliding window: smooths the edge, but still has no notion of a burst;
// - leaky bucket: requests drain at a steady rate, so a burst is queued or
//   dropped instead of served at once.
// The token bucket serves bursts at once and still caps the long-run rate;
// the block makes a spammer stop instead of getting a token every 0.5 s.
//
// State lives in this process's memory (one Map), like the other limiters.
// Running several server copies would need a shared store (HANDOFF §19).

const SWEEP_MS = 5 * 60 * 1000;

function createTokenBucketLimiter({
  capacity,
  refillPerSecond,
  blockAfter,
  blockWindowMs,
  blockMs,
  keyGenerator,
  skip = () => false,
  message = 'Too many requests. Please slow down a little.',
  blockedMessage = 'Too many requests. Please wait a few minutes and try again.',
  // Most keys kept at once. Past it the oldest unblocked buckets go first
  // (they come back full, which only ever lets a request through).
  maxKeys = 50000,
  now = Date.now,
  sweepEveryMs = SWEEP_MS,
  log = (line) => console.warn(line),
  // Told about each refused request (the activity log, HANDOFF.md §41).
  onRefuse = () => {},
}) {
  // key → { tokens, updatedAt, refusals, windowStart, blockedUntil }
  const buckets = new Map();

  // Lazy refill: tokens are topped up from the time passed, on each visit.
  const refill = (bucket, t) => {
    const elapsed = Math.max(0, t - bucket.updatedAt) / 1000;
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerSecond);
    bucket.updatedAt = t;
  };

  const isIdle = (bucket, t) =>
    bucket.blockedUntil <= t && bucket.tokens + (Math.max(0, t - bucket.updatedAt) / 1000) * refillPerSecond >= capacity;

  // Drops buckets that are full and not blocked — they hold nothing a fresh
  // bucket wouldn't.
  const sweep = () => {
    const t = now();
    for (const [key, bucket] of buckets) {
      if (isIdle(bucket, t)) buckets.delete(key);
    }
  };

  const makeRoom = (t) => {
    if (buckets.size < maxKeys) return;
    sweep();
    for (const [key, bucket] of buckets) {
      if (buckets.size < maxKeys) break;
      if (bucket.blockedUntil <= t) buckets.delete(key);
    }
  };

  if (sweepEveryMs > 0) setInterval(sweep, sweepEveryMs).unref();

  const refuse = (res, status, text, retryAfterS) => {
    res.set('Retry-After', String(Math.max(1, Math.ceil(retryAfterS))));
    return res.status(status).json({ message: text });
  };

  const middleware = (req, res, next) => {
    if (skip(req)) return next();
    const key = keyGenerator(req);
    const t = now();

    let bucket = buckets.get(key);
    if (!bucket) {
      makeRoom(t);
      bucket = { tokens: capacity, updatedAt: t, refusals: 0, windowStart: t, blockedUntil: 0 };
      buckets.set(key, bucket);
    }
    refill(bucket, t);

    res.set('RateLimit-Limit', String(capacity));

    if (bucket.blockedUntil > t) {
      res.set('RateLimit-Remaining', '0');
      onRefuse(req, { blocked: true });
      return refuse(res, 429, blockedMessage, (bucket.blockedUntil - t) / 1000);
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      res.set('RateLimit-Remaining', String(Math.floor(bucket.tokens)));
      res.set('RateLimit-Reset', String(Math.ceil((capacity - bucket.tokens) / refillPerSecond)));
      return next();
    }

    // Empty: count the refusal; enough of them close together earn a block.
    if (t - bucket.windowStart > blockWindowMs) {
      bucket.windowStart = t;
      bucket.refusals = 0;
    }
    bucket.refusals += 1;
    res.set('RateLimit-Remaining', '0');
    onRefuse(req, { blocked: bucket.refusals >= blockAfter });
    if (bucket.refusals >= blockAfter) {
      bucket.blockedUntil = t + blockMs;
      bucket.refusals = 0;
      log(`[rate] blocked ${key} for ${Math.round(blockMs / 60000)} min`);
      return refuse(res, 429, blockedMessage, blockMs / 1000);
    }
    return refuse(res, 429, message, (1 - bucket.tokens) / refillPerSecond);
  };

  middleware.sweep = sweep;
  middleware.size = () => buckets.size;
  return middleware;
}

module.exports = { createTokenBucketLimiter };
