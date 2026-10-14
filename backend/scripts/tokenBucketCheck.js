// Checks the token bucket (src/middleware/tokenBucket.js) with a fake clock,
// no server needed: `node scripts/tokenBucketCheck.js`. HANDOFF §18.
const { createTokenBucketLimiter } = require('../src/middleware/tokenBucket');

let passed = 0;
let failed = 0;
function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ''}`);
  }
}

let clock = 1_000_000;
const logs = [];
const limiter = createTokenBucketLimiter({
  capacity: 120,
  refillPerSecond: 2,
  blockAfter: 30,
  blockWindowMs: 60 * 1000,
  blockMs: 5 * 60 * 1000,
  keyGenerator: (req) => req.key,
  skip: (req) => req.path.startsWith('/api/sos'),
  now: () => clock,
  sweepEveryMs: 0,
  log: (line) => logs.push(line),
});

// One request through the middleware: what it answered, and its headers.
function hit(key, path = '/api/friends') {
  const headers = {};
  const result = { status: 200, passed: false, headers };
  const res = {
    set: (name, value) => {
      headers[name] = value;
      return res;
    },
    status: (code) => {
      result.status = code;
      return res;
    },
    json: (body) => {
      result.body = body;
      return res;
    },
  };
  limiter({ key, path }, res, () => {
    result.passed = true;
  });
  return result;
}

console.log('token bucket — 120 burst, 2/s refill, 30 refusals in 60 s → 5 min block');

let ok = 0;
for (let i = 0; i < 120; i += 1) if (hit('user:a').passed) ok += 1;
check('a burst of 120 all pass', ok === 120, ok);
let r = hit('user:a');
check('the 121st is a 429 "slow down"', r.status === 429 && r.body.message === 'Too many requests. Please slow down a little.', r);
check('…with Retry-After 1', r.headers['Retry-After'] === '1', r.headers);
check('another account is unaffected', hit('user:b').passed);
check('a path with its own limit is skipped', hit('user:a', '/api/sos/active').passed);

clock += 1000;
r = hit('user:a');
check('after 1 s two tokens are back: the next passes', r.passed && r.headers['RateLimit-Remaining'] === '1', r.headers);
check('…and one more', hit('user:a').passed);
check('…then empty again', hit('user:a').status === 429);

// That was refusal 2 (the 121st was the first). 28 more within the minute block it.
let last;
for (let i = 0; i < 28; i += 1) last = hit('user:a');
check('30 refusals within 60 s → blocked', last.status === 429 && last.body.message === 'Too many requests. Please wait a few minutes and try again.', last.body);
check('…with Retry-After ≈ 300', last.headers['Retry-After'] === '300', last.headers);
check('…and one log line', logs.length === 1 && logs[0] === '[rate] blocked user:a for 5 min', logs);

clock += 60 * 1000;
r = hit('user:a');
check('still blocked a minute later, though the bucket refilled', r.status === 429 && r.headers['Retry-After'] === '240', r.headers);

clock += 4 * 60 * 1000;
r = hit('user:a');
check('unblocked after 5 min, with a full bucket', r.passed && r.headers['RateLimit-Remaining'] === '119', r.headers);

// Slow refusals (fewer than 30 in any 60 s) never block.
const slow = 'user:slow';
for (let i = 0; i < 120; i += 1) hit(slow);
let blocked = false;
for (let i = 0; i < 40; i += 1) {
  // Empty: one refusal every 3 s (at most 21 in any 60 s).
  const answer = hit(slow);
  if (answer.status === 429 && answer.body.message.includes('few minutes')) blocked = true;
  clock += 3 * 1000; // 6 tokens back…
  for (let j = 0; j < 6; j += 1) hit(slow); // …used at once
}
check('40 refusals spread over 2 minutes never block', !blocked && logs.length === 1, logs);

// The sweep drops full, unblocked buckets.
clock += 10 * 60 * 1000;
hit('user:fresh');
const before = limiter.size();
limiter.sweep();
check('the sweep drops idle buckets and keeps busy ones', before >= 3 && limiter.size() === 1, { before, after: limiter.size() });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
