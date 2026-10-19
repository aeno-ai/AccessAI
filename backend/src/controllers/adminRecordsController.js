const { matchedData } = require('express-validator');
const User = require('../models/Users');
const UserActivity = require('../models/UserActivity');
const SOSEvent = require('../models/SOSEvent');
const Friendship = require('../models/Friendship');
const { recordAdminAction } = require('../utils/auditLog');
const { isSuspended } = require('../utils/accountState');

// What admins can see of app accounts' records (HANDOFF.md §41, §43): the
// activity log, SOS records, and "Needs a look". Also used for one person's
// page (adminUserController.js).
//
// SOS records are read with a fixed list of fields and sent in a fixed
// shape: the place, the location (first or latest) and the message are
// never even loaded. Who answered is shown by name only.

const DEFAULT_PAGE_SIZE = 25;
const DAY_MS = 24 * 60 * 60 * 1000;

// Never add location, lastLocation, place or message here (Terms, §43).
const SOS_FIELDS = 'userId status isTest occurredAt createdAt recipients responses resolvedAt resolvedReason';

/** Where an account is: 'active', 'suspended', 'deleting' or 'deactivated' (the old switch). */
function statusOf(user, now = new Date()) {
  if (user.isActive === false) return 'deactivated';
  if (user.deletionScheduledFor) return 'deleting';
  if (isSuspended(user, now)) return 'suspended';
  return 'active';
}

// A person named in a record. Null when the account is gone.
const personOf = (user) =>
  user && typeof user === 'object' && user._id ? { id: String(user._id), name: user.name ?? '', email: user.email ?? null } : null;

const activityView = (a) => ({
  id: String(a._id),
  at: a.createdAt,
  type: a.type,
  method: a.method ?? null,
  reason: a.reason ?? null,
  limiter: a.limiter ?? null,
  platform: a.platform ?? 'unknown',
  appVersion: a.appVersion ?? null,
  ip: a.ip ?? null,
  user: personOf(a.userId),
});

const sosView = (e) => {
  const responses = e.responses ?? [];
  return {
    id: String(e._id),
    sender: personOf(e.userId),
    // When it was pressed (earlier than it reached us if it was sent offline).
    sentAt: e.occurredAt ?? e.createdAt,
    isTest: e.isTest === true,
    status: e.status,
    alerted: e.recipients?.length ?? 0,
    answers: responses.map((r) => ({
      id: r.userId?._id ? String(r.userId._id) : null,
      name: r.userId?.name ?? 'Deleted account',
      kind: r.kind,
      at: r.at,
    })),
    noOneAnswered: responses.length === 0,
    endedAt: e.resolvedAt ?? null,
    // 'safe' (marked safe), 'expired' (ran out) or 'replaced' (a new SOS).
    ended: e.resolvedReason ?? null,
  };
};

const pageOf = (q) => ({ page: q.page ?? 1, limit: q.limit ?? DEFAULT_PAGE_SIZE });

async function findActivity(filter, { page, limit }) {
  const [records, total] = await Promise.all([
    UserActivity.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name email')
      .lean(),
    UserActivity.countDocuments(filter),
  ]);
  return { records: records.map(activityView), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

async function findSos(filter, { page, limit }) {
  const [events, total] = await Promise.all([
    SOSEvent.find(filter)
      .select(SOS_FIELDS)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name email')
      .populate('responses.userId', 'name')
      .lean(),
    SOSEvent.countDocuments(filter),
  ]);
  return { events: events.map(sosView), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

// GET /admin/activity?type=&ip=&page=&limit=
const listActivity = async (req, res, next) => {
  try {
    const q = matchedData(req, { locations: ['query'] });
    const filter = {};
    if (q.type) filter.type = q.type;
    if (q.ip) filter.ip = q.ip;
    const result = await findActivity(filter, pageOf(q));
    if ((q.page ?? 1) === 1) await recordAdminAction(req, { action: 'activity.list.view', details: { type: q.type, ip: q.ip } });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// GET /admin/sos?kind=real|test&unanswered=true&page=&limit=
const listSos = async (req, res, next) => {
  try {
    const q = matchedData(req, { locations: ['query'] });
    const filter = {};
    if (q.kind === 'real') filter.isTest = { $ne: true };
    if (q.kind === 'test') filter.isTest = true;
    if (q.unanswered === 'true') filter['responses.0'] = { $exists: false };
    const result = await findSos(filter, pageOf(q));
    if ((q.page ?? 1) === 1) await recordAdminAction(req, { action: 'sos.list.view', details: { kind: q.kind, unanswered: q.unanswered } });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// One person's records, for their page. Opening them is recorded.
const getUserActivity = async (req, res, next) => {
  try {
    const q = matchedData(req, { locations: ['query'] });
    if (!(await User.exists({ _id: req.params.id }))) return res.status(404).json({ message: 'User not found' });
    const result = await findActivity({ userId: req.params.id }, pageOf(q));
    await recordAdminAction(req, { action: 'user.activity.view', targetType: 'user', targetId: req.params.id });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getUserSos = async (req, res, next) => {
  try {
    const q = matchedData(req, { locations: ['query'] });
    if (!(await User.exists({ _id: req.params.id }))) return res.status(404).json({ message: 'User not found' });
    const userId = req.params.id;
    const [result, real, test] = await Promise.all([
      findSos({ userId }, pageOf(q)),
      SOSEvent.countDocuments({ userId, isTest: { $ne: true } }),
      SOSEvent.countDocuments({ userId, isTest: true }),
    ]);
    await recordAdminAction(req, { action: 'user.sos.view', targetType: 'user', targetId: userId });
    res.json({ ...result, counts: { real, test } });
  } catch (error) {
    next(error);
  }
};

// "Needs a look" (§43): warning signs in the last 24 hours. Nothing is
// blocked by this — an admin looks and decides.
const REVIEW_SIGNS = {
  failed_logins: 10, // failed logins on one account
  failed_logins_ip: 20, // failed logins from one network address
  limit_hits: 5, // limits hit in this many different minutes
  real_sos: 3, // real (not test) SOS sent
  friend_requests: 20, // friend requests sent
};

const countsOf = (rows) => rows.map((r) => ({ key: String(r._id), count: r.count }));

const reviewList = async (req, res, next) => {
  try {
    const since = new Date(Date.now() - DAY_MS);
    const recent = { createdAt: { $gte: since } };
    const atLeast = (n) => ({ $match: { count: { $gte: n } } });
    const [failedLogins, failedByIp, limitHits, realSos, friendRequests] = await Promise.all([
      UserActivity.aggregate([
        { $match: { ...recent, type: 'login.failed', userId: { $exists: true } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        atLeast(REVIEW_SIGNS.failed_logins),
      ]),
      UserActivity.aggregate([
        { $match: { ...recent, type: 'login.failed', ip: { $nin: [null, ''] } } },
        { $group: { _id: '$ip', count: { $sum: 1 } } },
        atLeast(REVIEW_SIGNS.failed_logins_ip),
      ]),
      // Each limit is recorded at most once a minute; different minutes
      // show it kept going.
      UserActivity.aggregate([
        { $match: { ...recent, type: 'limit.hit', userId: { $exists: true } } },
        { $group: { _id: { userId: '$userId', minute: { $dateToString: { format: '%Y-%m-%dT%H:%M', date: '$createdAt' } } } } },
        { $group: { _id: '$_id.userId', count: { $sum: 1 } } },
        atLeast(REVIEW_SIGNS.limit_hits),
      ]),
      SOSEvent.aggregate([
        { $match: { ...recent, isTest: { $ne: true } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        atLeast(REVIEW_SIGNS.real_sos),
      ]),
      Friendship.aggregate([
        { $match: recent },
        { $group: { _id: '$requester', count: { $sum: 1 } } },
        atLeast(REVIEW_SIGNS.friend_requests),
      ]),
    ]);

    // One entry per account (or network address), with each sign it shows.
    const byUser = new Map();
    const add = (sign) => ({ key, count }) => {
      const entry = byUser.get(key) ?? { signs: [] };
      entry.signs.push({ sign, count, threshold: REVIEW_SIGNS[sign] });
      byUser.set(key, entry);
    };
    countsOf(failedLogins).forEach(add('failed_logins'));
    countsOf(limitHits).forEach(add('limit_hits'));
    countsOf(realSos).forEach(add('real_sos'));
    countsOf(friendRequests).forEach(add('friend_requests'));

    const users = await User.find({ _id: { $in: [...byUser.keys()] } })
      .select('name email role isActive deletionScheduledFor deletionBy suspendedUntil')
      .lean();
    const now = new Date();
    const accounts = users.map((u) => ({
      user: { ...personOf(u), role: u.role, status: statusOf(u, now) },
      ip: null,
      signs: byUser.get(String(u._id)).signs,
    }));
    const addresses = countsOf(failedByIp).map(({ key, count }) => ({
      user: null,
      ip: key,
      signs: [{ sign: 'failed_logins_ip', count, threshold: REVIEW_SIGNS.failed_logins_ip }],
    }));

    const weight = (entry) => entry.signs.reduce((sum, s) => sum + s.count / s.threshold, 0);
    const items = [...accounts, ...addresses].sort((a, b) => b.signs.length - a.signs.length || weight(b) - weight(a));
    res.json({ since, items });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listActivity,
  listSos,
  getUserActivity,
  getUserSos,
  reviewList,
  statusOf,
  REVIEW_SIGNS,
};
