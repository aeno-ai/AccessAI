const mongoose = require('mongoose');

// Rate limits shared by every server copy (HANDOFF.md §52). Off by default:
// with RATE_LIMIT_STORE=mongo the counters live in MongoDB instead of each
// copy's memory, so 120 requests is 120 in total — not 120 per copy — and a
// block on one copy holds on all of them. Each check is ONE atomic update,
// so two copies can't both spend the last token.

const SHARED = process.env.RATE_LIMIT_STORE === 'mongo';
const BUCKETS = 'rate_buckets'; // the general token bucket
const COUNTERS = 'rate_counters'; // the express-rate-limit windows

const collection = (name) => mongoose.connection.db.collection(name);

// Old entries clean themselves up (TTL on expireAt / resetTime).
const ensured = new Set();
async function ensureTtl(name, field) {
  if (ensured.has(name)) return;
  ensured.add(name);
  await collection(name).createIndex({ [field]: 1 }, { expireAfterSeconds: 0 });
}

/**
 * The token bucket of tokenBucket.js, as one MongoDB update: refill by the
 * time passed, then take a token, or count a refusal (and block after
 * `blockAfter` of them within `blockWindowMs`). Same rules, same numbers.
 * → { outcome: 'ok' | 'empty' | 'blocked' | 'blockedNow', tokens, blockedUntil }
 */
async function takeSharedToken(key, t, { capacity, refillPerSecond, blockAfter, blockWindowMs, blockMs }) {
  await ensureTtl(BUCKETS, 'expireAt');
  const refreshed = { $gt: [{ $subtract: [t, '$windowStart'] }, blockWindowMs] };
  const doc = await collection(BUCKETS).findOneAndUpdate(
    { _id: key },
    [
      {
        $set: {
          tokens: { $ifNull: ['$tokens', capacity] },
          updatedAt: { $ifNull: ['$updatedAt', t] },
          refusals: { $ifNull: ['$refusals', 0] },
          windowStart: { $ifNull: ['$windowStart', t] },
          blockedUntil: { $ifNull: ['$blockedUntil', 0] },
        },
      },
      {
        $set: {
          tokens: {
            $min: [capacity, { $add: ['$tokens', { $multiply: [{ $divide: [{ $max: [0, { $subtract: [t, '$updatedAt'] }] }, 1000] }, refillPerSecond] }] }],
          },
          updatedAt: t,
        },
      },
      { $set: { outcome: { $cond: [{ $gt: ['$blockedUntil', t] }, 'blocked', { $cond: [{ $gte: ['$tokens', 1] }, 'ok', 'empty'] }] } } },
      {
        $set: {
          tokens: { $cond: [{ $eq: ['$outcome', 'ok'] }, { $subtract: ['$tokens', 1] }, '$tokens'] },
          // A refusal long after the last one starts a new count.
          windowStart: { $cond: [{ $and: [{ $eq: ['$outcome', 'empty'] }, refreshed] }, t, '$windowStart'] },
          refusals: { $cond: [{ $and: [{ $eq: ['$outcome', 'empty'] }, refreshed] }, 0, '$refusals'] },
        },
      },
      { $set: { refusals: { $cond: [{ $eq: ['$outcome', 'empty'] }, { $add: ['$refusals', 1] }, '$refusals'] } } },
      { $set: { outcome: { $cond: [{ $and: [{ $eq: ['$outcome', 'empty'] }, { $gte: ['$refusals', blockAfter] }] }, 'blockedNow', '$outcome'] } } },
      {
        $set: {
          blockedUntil: { $cond: [{ $eq: ['$outcome', 'blockedNow'] }, t + blockMs, '$blockedUntil'] },
          refusals: { $cond: [{ $eq: ['$outcome', 'blockedNow'] }, 0, '$refusals'] },
          // Kept until it would be full again (or the block is over).
          expireAt: new Date(t + Math.max(blockMs, (capacity / refillPerSecond) * 1000)),
        },
      },
    ],
    { upsert: true, returnDocument: 'after' },
  );
  return { outcome: doc.outcome, tokens: doc.tokens, blockedUntil: doc.blockedUntil };
}

/**
 * A store for express-rate-limit (fixed windows), shared through MongoDB.
 * One per limiter (express-rate-limit refuses a store used twice).
 */
class MongoRateLimitStore {
  constructor(name) {
    this.prefix = `${name}:`;
    // Counts are shared, not kept in this process.
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    await ensureTtl(COUNTERS, 'resetTime');
    const now = new Date();
    const expired = { $or: [{ $eq: [{ $type: '$resetTime' }, 'missing'] }, { $lte: ['$resetTime', now] }] };
    const doc = await collection(COUNTERS).findOneAndUpdate(
      { _id: this.prefix + key },
      [
        {
          $set: {
            totalHits: { $cond: [expired, 1, { $add: ['$totalHits', 1] }] },
            resetTime: { $cond: [expired, new Date(now.getTime() + this.windowMs), '$resetTime'] },
          },
        },
      ],
      { upsert: true, returnDocument: 'after' },
    );
    return { totalHits: doc.totalHits, resetTime: doc.resetTime };
  }

  async decrement(key) {
    await collection(COUNTERS).updateOne({ _id: this.prefix + key, totalHits: { $gt: 0 } }, { $inc: { totalHits: -1 } });
  }

  async resetKey(key) {
    await collection(COUNTERS).deleteOne({ _id: this.prefix + key });
  }
}

/** The store option for one express-rate-limit limiter: shared, or none (its own memory). */
const sharedStoreFor = (name) => (SHARED ? { store: new MongoRateLimitStore(name) } : {});

module.exports = { SHARED, takeSharedToken, MongoRateLimitStore, sharedStoreFor };
