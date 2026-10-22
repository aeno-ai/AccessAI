const { matchedData } = require('express-validator');
const AdminAuditLog = require('../models/AdminAuditLog');
const DirectMessage = require('../models/DirectMessage');
const LearnCompletion = require('../models/LearnCompletion');
const SOSEvent = require('../models/SOSEvent');
const User = require('../models/Users');
const UserActivity = require('../models/UserActivity');
const { ACTIVITY_RETENTION_DAYS } = require('../constants/legal');
const { STATUS_FILTERS } = require('./adminUserController');
const { computeSuspicious } = require('./adminRecordsController');
const { MANILA_OFFSET_MS } = require('../utils/dateRange');

// The admin dashboard (HANDOFF.md §52): every log as numbers over time.
// Counts and totals only — never what anyone said, sent or where they were
// (SOS place/location/message and message bodies are never read here).
// Times are grouped by Philippine time (the app's time zone).

const TZ = 'Asia/Manila';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// The ranges the dashboard offers: how many buckets of which size.
const RANGES = {
  '24h': { unit: 'hour', count: 24 },
  '7d': { unit: 'day', count: 7 },
  '30d': { unit: 'day', count: 30 },
  '90d': { unit: 'day', count: 90 },
};

/** The bucket starts for a range, oldest first, ending with the one `now` is in. */
function bucketsFor(range, now = new Date()) {
  const { unit, count } = RANGES[range];
  const size = unit === 'hour' ? HOUR_MS : DAY_MS;
  // Manila is UTC+8 all year (no daylight saving), so a Manila hour starts
  // on a UTC hour, and a Manila day starts at 16:00 UTC the day before.
  const local = now.getTime() + MANILA_OFFSET_MS;
  const current = Math.floor(local / size) * size - MANILA_OFFSET_MS;
  return Array.from({ length: count }, (_, i) => new Date(current - (count - 1 - i) * size));
}

// $dateTrunc to the bucket, in Manila time.
const bucketOf = (field, unit) => ({ $dateTrunc: { date: `$${field}`, unit, timezone: TZ } });

/** Rows of { _id: { bucket, key? }, count } → one array per key, aligned to `buckets`. */
function toSeries(rows, buckets, keys) {
  const index = new Map(buckets.map((b, i) => [b.getTime(), i]));
  const series = Object.fromEntries(keys.map((k) => [k, new Array(buckets.length).fill(0)]));
  for (const row of rows) {
    const i = index.get(new Date(row._id.bucket).getTime());
    const key = keys.length === 1 && keys[0] === 'total' ? 'total' : String(row._id.key);
    if (i !== undefined && series[key]) series[key][i] += row.count;
  }
  return series;
}

const countBy = (Model, match, field, unit, key) =>
  Model.aggregate([
    { $match: match },
    { $group: { _id: key ? { bucket: bucketOf(field, unit), key } : { bucket: bucketOf(field, unit) }, count: { $sum: 1 } } },
  ]);

const breakdown = (Model, match, key, limit = 10) =>
  Model.aggregate([
    { $match: match },
    { $group: { _id: key, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]).then((rows) => rows.map((r) => ({ key: r._id === null || r._id === undefined ? 'unknown' : String(r._id), count: r.count })));

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// GET /admin/dashboard?range=24h|7d|30d|90d
const getDashboard = async (req, res, next) => {
  try {
    const { range = '7d' } = matchedData(req, { locations: ['query'] });
    const { unit } = RANGES[range];
    const now = new Date();
    const buckets = bucketsFor(range, now);
    const since = buckets[0];
    const inRange = { $gte: since };
    const activity = (type) => ({ createdAt: inRange, type });

    const [
      loginRows,
      signupRows,
      sosRows,
      limitRows,
      learnRows,
      messageRows,
      adminRows,
      activeUsers,
      usersTotal,
      usersByRole,
      statusCounts,
      newSignups,
      sosList,
      adminActions,
      appVersions,
      failedReasons,
      limiters,
      sosTriggers,
      sosOutcomes,
      heatRows,
      suspicious,
    ] = await Promise.all([
      countBy(UserActivity, { createdAt: inRange, type: { $in: ['login.success', 'login.failed', 'login.refused'] } }, 'createdAt', unit, '$type'),
      countBy(User, { createdAt: inRange }, 'createdAt', unit),
      countBy(SOSEvent, { createdAt: inRange }, 'createdAt', unit, { $cond: [{ $eq: ['$isTest', true] }, 'test', 'real'] }),
      countBy(UserActivity, activity('limit.hit'), 'createdAt', unit),
      countBy(LearnCompletion, { completedAt: inRange }, 'completedAt', unit, '$course'),
      countBy(DirectMessage, { createdAt: inRange }, 'createdAt', unit),
      countBy(AdminAuditLog, { createdAt: inRange }, 'createdAt', unit),
      UserActivity.distinct('userId', activity('login.success')),
      User.countDocuments({}),
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      Promise.all(['active', 'suspended', 'deleting', 'deactivated'].map((s) => User.countDocuments(STATUS_FILTERS[s]()))),
      User.countDocuments({ createdAt: inRange }),
      // Only when it was sent, test or not, and when friends answered.
      SOSEvent.find({ createdAt: inRange }).select('createdAt occurredAt isTest responses.at').lean(),
      AdminAuditLog.countDocuments({ createdAt: inRange }),
      breakdown(UserActivity, activity('login.success'), '$appVersion', 8),
      breakdown(UserActivity, activity('login.failed'), '$reason'),
      breakdown(UserActivity, activity('limit.hit'), '$limiter'),
      breakdown(SOSEvent, { createdAt: inRange }, '$triggerMethod'),
      breakdown(SOSEvent, { createdAt: inRange }, { $ifNull: ['$resolvedReason', '$status'] }),
      UserActivity.aggregate([
        { $match: { createdAt: inRange } },
        {
          $group: {
            _id: { day: { $dayOfWeek: { date: '$createdAt', timezone: TZ } }, hour: { $hour: { date: '$createdAt', timezone: TZ } } },
            count: { $sum: 1 },
          },
        },
      ]),
      computeSuspicious(now),
    ]);

    // SOS: real vs test, no one answered, and how fast the first friend answered.
    const real = sosList.filter((e) => e.isTest !== true);
    const answerMinutes = real
      .filter((e) => e.responses?.length)
      .map((e) => (Math.min(...e.responses.map((r) => new Date(r.at).getTime())) - new Date(e.occurredAt ?? e.createdAt).getTime()) / 60000)
      .filter((m) => m >= 0);

    // Busiest hours: 7 rows (Sunday first) × 24 hours, Manila time.
    const heatmap = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const row of heatRows) heatmap[row._id.day - 1][row._id.hour] += row.count;

    const logins = toSeries(loginRows, buckets, ['login.success', 'login.failed', 'login.refused']);
    const [active, suspended, deleting, deactivated] = statusCounts;
    const roles = Object.fromEntries(usersByRole.map((r) => [r._id ?? 'unknown', r.count]));
    const sum = (values) => values.reduce((a, b) => a + b, 0);

    res.json({
      range,
      unit,
      since,
      generatedAt: now,
      // Login and activity records are kept this long (Terms), so older days are empty.
      activityRetentionDays: ACTIVITY_RETENTION_DAYS,
      buckets,
      kpis: {
        users: usersTotal,
        pwd: roles.pwd ?? 0,
        nonPwd: roles.non_pwd ?? 0,
        newSignups,
        activeUsers: activeUsers.length,
        loginsOk: sum(logins['login.success']),
        loginsFailed: sum(logins['login.failed']),
        loginsRefused: sum(logins['login.refused']),
        sosReal: real.length,
        sosTest: sosList.length - real.length,
        sosUnanswered: real.filter((e) => !e.responses?.length).length,
        sosMedianAnswerMinutes: median(answerMinutes),
        suspicious: suspicious.items.length,
        suspiciousHigh: suspicious.items.filter((i) => i.severity === 'high').length,
        adminActions,
      },
      series: {
        logins: { success: logins['login.success'], failed: logins['login.failed'], refused: logins['login.refused'] },
        signups: toSeries(signupRows, buckets, ['total']).total,
        sos: toSeries(sosRows, buckets, ['real', 'test']),
        limitHits: toSeries(limitRows, buckets, ['total']).total,
        learn: toSeries(learnRows, buckets, ['fsl', 'asl']),
        messages: toSeries(messageRows, buckets, ['total']).total,
        adminActions: toSeries(adminRows, buckets, ['total']).total,
      },
      breakdowns: {
        userStatus: [
          { key: 'active', count: active },
          { key: 'suspended', count: suspended },
          { key: 'deleting', count: deleting },
          { key: 'deactivated', count: deactivated },
        ],
        appVersions,
        failedReasons,
        limiters,
        sosTriggers,
        sosOutcomes,
      },
      heatmap,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard, bucketsFor, RANGES };
