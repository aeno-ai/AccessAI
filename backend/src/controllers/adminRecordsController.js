const { matchedData } = require('express-validator');
const Admin = require('../models/Admin');
const AdminAuditLog = require('../models/AdminAuditLog');
const User = require('../models/Users');
const UserActivity = require('../models/UserActivity');
const SOSEvent = require('../models/SOSEvent');
const Friendship = require('../models/Friendship');
const { recordAdminAction } = require('../utils/auditLog');
const { isSuspended } = require('../utils/accountState');
const { dayRangeFilter } = require('../utils/dateRange');
const { toCsv, sendCsv, MAX_ROWS } = require('../utils/csv');

// What admins can see of app accounts' records (HANDOFF.md §41, §43, §52):
// the activity log, SOS records, Suspicious Activities and the admin log,
// as pages and as CSV downloads. Also used for one person's page
// (adminUserController.js).
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
const pagesOf = (total, limit) => Math.max(1, Math.ceil(total / limit));

// ---- filters (shared by the pages and their CSV downloads)

function activityFilter(q) {
  const filter = { ...dayRangeFilter('createdAt', q) };
  if (q.type) filter.type = q.type;
  if (q.ip) filter.ip = q.ip;
  return filter;
}

function sosFilter(q) {
  const filter = { ...dayRangeFilter('createdAt', q) };
  if (q.kind === 'real') filter.isTest = { $ne: true };
  if (q.kind === 'test') filter.isTest = true;
  if (q.unanswered === 'true') filter['responses.0'] = { $exists: false };
  return filter;
}

function auditFilter(q) {
  const filter = { ...dayRangeFilter('createdAt', q) };
  if (q.action) filter.action = q.action;
  if (q.adminId) filter.adminId = q.adminId;
  if (q.success === 'true') filter.success = true;
  if (q.success === 'false') filter.success = false;
  return filter;
}

const activityQuery = (filter) => UserActivity.find(filter).sort({ createdAt: -1 }).populate('userId', 'name email');
const sosQuery = (filter) =>
  SOSEvent.find(filter)
    .select(SOS_FIELDS)
    .sort({ createdAt: -1 })
    .populate('userId', 'name email')
    .populate('responses.userId', 'name');

async function findActivity(filter, { page, limit }) {
  const [records, total] = await Promise.all([
    activityQuery(filter).skip((page - 1) * limit).limit(limit).lean(),
    UserActivity.countDocuments(filter),
  ]);
  return { records: records.map(activityView), total, page, pages: pagesOf(total, limit) };
}

async function findSos(filter, { page, limit }) {
  const [events, total] = await Promise.all([
    sosQuery(filter).skip((page - 1) * limit).limit(limit).lean(),
    SOSEvent.countDocuments(filter),
  ]);
  return { events: events.map(sosView), total, page, pages: pagesOf(total, limit) };
}

// GET /admin/activity?type=&ip=&from=&to=&page=&limit=
const listActivity = async (req, res, next) => {
  try {
    const q = matchedData(req, { locations: ['query'] });
    const result = await findActivity(activityFilter(q), pageOf(q));
    if ((q.page ?? 1) === 1) {
      await recordAdminAction(req, { action: 'activity.list.view', details: { type: q.type, ip: q.ip, from: q.from, to: q.to } });
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// GET /admin/sos?kind=real|test&unanswered=true&from=&to=&page=&limit=
const listSos = async (req, res, next) => {
  try {
    const q = matchedData(req, { locations: ['query'] });
    const result = await findSos(sosFilter(q), pageOf(q));
    if ((q.page ?? 1) === 1) {
      await recordAdminAction(req, { action: 'sos.list.view', details: { kind: q.kind, unanswered: q.unanswered, from: q.from, to: q.to } });
    }
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

// ---- Suspicious Activities (§43, renamed and extended in §52)
//
// Warning signs in the last 24 hours. Nothing is blocked by this — an admin
// looks and decides. Each rule: how many it takes, and how serious it is.
// Every flag carries its evidence (when it started and ended, from which
// addresses, the reasons…) so the admin panel can describe it exactly.
const SUSPICIOUS_RULES = {
  // Failed logins on one account with no successful login in between.
  failed_logins_streak: { threshold: 5, severity: 'high' },
  // Failed logins on one account in total.
  failed_logins: { threshold: 10, severity: 'medium' },
  // Failed logins from one network address, on any accounts.
  failed_logins_ip: { threshold: 20, severity: 'high' },
  // Limits hit in this many different minutes.
  limit_hits: { threshold: 5, severity: 'medium' },
  // Real (not test) SOS sent.
  real_sos: { threshold: 3, severity: 'medium' },
  // Friend requests sent.
  friend_requests: { threshold: 20, severity: 'low' },
};
// The old name, kept for anything that still reads the thresholds.
const REVIEW_SIGNS = Object.fromEntries(Object.entries(SUSPICIOUS_RULES).map(([id, rule]) => [id, rule.threshold]));
const SEVERITY_RANK = { low: 1, medium: 2, high: 3 };

const sorted = (values) => [...new Set((values ?? []).filter((v) => v !== null && v !== undefined && v !== ''))].map(String).sort();

/** The longest run of failed logins with no success in between, from time-sorted events. */
function longestFailedRun(events) {
  let best = null;
  let run = [];
  for (const event of events) {
    if (event.type === 'login.failed') {
      run.push(event);
      if (!best || run.length > best.length) best = [...run];
    } else {
      run = [];
    }
  }
  return best ?? [];
}

async function computeSuspicious(now = new Date()) {
  const since = new Date(now.getTime() - DAY_MS);
  const recent = { createdAt: { $gte: since } };
  const atLeast = (n) => ({ $match: { count: { $gte: n } } });
  const streakRule = SUSPICIOUS_RULES.failed_logins_streak;

  const [failedLogins, failedByIp, limitHits, realSos, friendRequests] = await Promise.all([
    UserActivity.aggregate([
      { $match: { ...recent, type: 'login.failed', userId: { $exists: true } } },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 },
          firstAt: { $min: '$createdAt' },
          lastAt: { $max: '$createdAt' },
          addresses: { $addToSet: '$ip' },
          reasons: { $addToSet: '$reason' },
        },
      },
      // The lower of the two rules: the streak check needs these accounts too.
      atLeast(Math.min(streakRule.threshold, SUSPICIOUS_RULES.failed_logins.threshold)),
    ]),
    UserActivity.aggregate([
      { $match: { ...recent, type: 'login.failed', ip: { $nin: [null, ''] } } },
      {
        $group: {
          _id: '$ip',
          count: { $sum: 1 },
          firstAt: { $min: '$createdAt' },
          lastAt: { $max: '$createdAt' },
          accounts: { $addToSet: '$userId' },
          reasons: { $addToSet: '$reason' },
        },
      },
      atLeast(SUSPICIOUS_RULES.failed_logins_ip.threshold),
    ]),
    // Each limit is recorded at most once a minute; different minutes
    // show it kept going.
    UserActivity.aggregate([
      { $match: { ...recent, type: 'limit.hit', userId: { $exists: true } } },
      {
        $group: {
          _id: { userId: '$userId', minute: { $dateToString: { format: '%Y-%m-%dT%H:%M', date: '$createdAt' } } },
          firstAt: { $min: '$createdAt' },
          lastAt: { $max: '$createdAt' },
          limiters: { $addToSet: '$limiter' },
          addresses: { $addToSet: '$ip' },
        },
      },
      {
        $group: {
          _id: '$_id.userId',
          count: { $sum: 1 },
          firstAt: { $min: '$firstAt' },
          lastAt: { $max: '$lastAt' },
          limiters: { $push: '$limiters' },
          addresses: { $push: '$addresses' },
        },
      },
      atLeast(SUSPICIOUS_RULES.limit_hits.threshold),
    ]),
    SOSEvent.aggregate([
      { $match: { ...recent, isTest: { $ne: true } } },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 },
          firstAt: { $min: '$createdAt' },
          lastAt: { $max: '$createdAt' },
          unanswered: { $sum: { $cond: [{ $eq: [{ $size: { $ifNull: ['$responses', []] } }, 0] }, 1, 0] } },
        },
      },
      atLeast(SUSPICIOUS_RULES.real_sos.threshold),
    ]),
    Friendship.aggregate([
      { $match: recent },
      {
        $group: {
          _id: '$requester',
          count: { $sum: 1 },
          firstAt: { $min: '$createdAt' },
          lastAt: { $max: '$createdAt' },
          accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
        },
      },
      atLeast(SUSPICIOUS_RULES.friend_requests.threshold),
    ]),
  ]);

  // Streaks: each candidate account's failed and successful logins, in order.
  const candidates = failedLogins.filter((row) => row.count >= streakRule.threshold).map((row) => row._id);
  const timelines = candidates.length
    ? await UserActivity.aggregate([
        { $match: { ...recent, userId: { $in: candidates }, type: { $in: ['login.failed', 'login.success'] } } },
        { $sort: { createdAt: 1, _id: 1 } },
        { $group: { _id: '$userId', events: { $push: { type: '$type', at: '$createdAt', ip: '$ip', reason: '$reason' } } } },
      ])
    : [];

  // One entry per account (or network address), with each sign it shows.
  const byUser = new Map();
  const add = (key, sign, evidence) => {
    const entry = byUser.get(key) ?? { signs: [] };
    const rule = SUSPICIOUS_RULES[sign];
    entry.signs.push({ sign, threshold: rule.threshold, severity: rule.severity, ...evidence });
    byUser.set(key, entry);
  };

  for (const { _id, events } of timelines) {
    const run = longestFailedRun(events);
    if (run.length < streakRule.threshold) continue;
    const addresses = sorted(run.map((e) => e.ip));
    add(String(_id), 'failed_logins_streak', {
      count: run.length,
      firstAt: run[0].at,
      lastAt: run[run.length - 1].at,
      addresses,
      addressCount: addresses.length,
      reasons: sorted(run.map((e) => e.reason)),
    });
  }
  for (const row of failedLogins) {
    if (row.count < SUSPICIOUS_RULES.failed_logins.threshold) continue;
    const addresses = sorted(row.addresses);
    add(String(row._id), 'failed_logins', {
      count: row.count,
      firstAt: row.firstAt,
      lastAt: row.lastAt,
      addresses,
      addressCount: addresses.length,
      reasons: sorted(row.reasons),
    });
  }
  for (const row of limitHits) {
    const addresses = sorted(row.addresses.flat());
    add(String(row._id), 'limit_hits', {
      count: row.count,
      firstAt: row.firstAt,
      lastAt: row.lastAt,
      limiters: sorted(row.limiters.flat()),
      addresses,
      addressCount: addresses.length,
    });
  }
  for (const row of realSos) {
    add(String(row._id), 'real_sos', { count: row.count, firstAt: row.firstAt, lastAt: row.lastAt, unanswered: row.unanswered });
  }
  for (const row of friendRequests) {
    add(String(row._id), 'friend_requests', { count: row.count, firstAt: row.firstAt, lastAt: row.lastAt, accepted: row.accepted });
  }

  const users = await User.find({ _id: { $in: [...byUser.keys()] } })
    .select('name email role isActive deletionScheduledFor deletionBy suspendedUntil')
    .lean();
  const accounts = users.map((u) => ({
    user: { ...personOf(u), role: u.role, status: statusOf(u, now) },
    ip: null,
    signs: byUser.get(String(u._id)).signs,
  }));
  const addresses = failedByIp.map((row) => ({
    user: null,
    ip: String(row._id),
    signs: [
      {
        sign: 'failed_logins_ip',
        threshold: SUSPICIOUS_RULES.failed_logins_ip.threshold,
        severity: SUSPICIOUS_RULES.failed_logins_ip.severity,
        count: row.count,
        firstAt: row.firstAt,
        lastAt: row.lastAt,
        accounts: sorted(row.accounts).length,
        reasons: sorted(row.reasons),
      },
    ],
  }));

  // An entry is as serious as its most serious sign; three or more signs
  // together count as high.
  const items = [...accounts, ...addresses].map((item) => {
    const top = Math.max(...item.signs.map((s) => SEVERITY_RANK[s.severity]));
    const severity = item.signs.length >= 3 ? 'high' : Object.keys(SEVERITY_RANK).find((k) => SEVERITY_RANK[k] === top);
    const lastAt = item.signs.reduce((latest, s) => (s.lastAt > latest ? s.lastAt : latest), item.signs[0].lastAt);
    return { ...item, severity, lastAt };
  });
  const weight = (entry) => entry.signs.reduce((sum, s) => sum + s.count / s.threshold, 0);
  items.sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.signs.length - a.signs.length || weight(b) - weight(a),
  );
  const rules = Object.entries(SUSPICIOUS_RULES).map(([id, rule]) => ({ id, ...rule }));
  return { since, rules, items };
}

// GET /admin/review
const reviewList = async (req, res, next) => {
  try {
    const result = await computeSuspicious();
    await recordAdminAction(req, { action: 'review.view', details: { flagged: result.items.length } });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// ---- the admin log (super admins only)

const auditView = (entry, names) => ({
  id: String(entry._id),
  at: entry.createdAt,
  admin: entry.adminId ? { id: String(entry.adminId), email: entry.email ?? null, name: names.admins.get(String(entry.adminId)) ?? null } : null,
  email: entry.email ?? null,
  action: entry.action,
  success: entry.success !== false,
  target: entry.targetId
    ? {
        type: entry.targetType ?? null,
        id: String(entry.targetId),
        name:
          (entry.targetType === 'admin' ? names.admins.get(String(entry.targetId)) : names.users.get(String(entry.targetId))) ??
          null,
      }
    : null,
  ip: entry.ip ?? null,
  details: entry.details ?? null,
});

// Names for the people an admin-log page mentions (deleted ones stay null).
async function namesFor(entries) {
  const adminIds = new Set();
  const userIds = new Set();
  for (const e of entries) {
    if (e.adminId) adminIds.add(String(e.adminId));
    if (e.targetId && e.targetType === 'admin') adminIds.add(String(e.targetId));
    if (e.targetId && e.targetType === 'user') userIds.add(String(e.targetId));
  }
  const [admins, users] = await Promise.all([
    Admin.find({ _id: { $in: [...adminIds] } }).select('name').lean(),
    User.find({ _id: { $in: [...userIds] } }).select('name').lean(),
  ]);
  return {
    admins: new Map(admins.map((a) => [String(a._id), a.name])),
    users: new Map(users.map((u) => [String(u._id), u.name])),
  };
}

// GET /admin/audit?action=&adminId=&success=&from=&to=&page=&limit=
const listAudit = async (req, res, next) => {
  try {
    const q = matchedData(req, { locations: ['query'] });
    const { page, limit } = pageOf(q);
    const filter = auditFilter(q);
    const [entries, total, actions] = await Promise.all([
      AdminAuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AdminAuditLog.countDocuments(filter),
      AdminAuditLog.distinct('action'),
    ]);
    const names = await namesFor(entries);
    res.json({ entries: entries.map((e) => auditView(e, names)), total, page, pages: pagesOf(total, limit), actions: actions.sort() });
  } catch (error) {
    next(error);
  }
};

// ---- CSV downloads (same filters as the pages; at most MAX_ROWS rows)

const iso = (date) => (date ? new Date(date).toISOString() : '');

const exportActivity = async (req, res, next) => {
  try {
    const q = matchedData(req, { locations: ['query'] });
    const rows = (await activityQuery(activityFilter(q)).limit(MAX_ROWS).lean()).map(activityView);
    await recordAdminAction(req, { action: 'activity.export', details: { rows: rows.length, type: q.type, ip: q.ip, from: q.from, to: q.to } });
    const csv = toCsv(
      [
        { header: 'When (UTC)', value: (r) => iso(r.at) },
        { header: 'Account name', value: (r) => r.user?.name ?? '' },
        { header: 'Account email', value: (r) => r.user?.email ?? '' },
        { header: 'What', value: (r) => r.type },
        { header: 'Method', value: (r) => r.method ?? '' },
        { header: 'Reason', value: (r) => r.reason ?? '' },
        { header: 'Limit', value: (r) => r.limiter ?? '' },
        { header: 'Phone', value: (r) => r.platform },
        { header: 'App version', value: (r) => r.appVersion ?? '' },
        { header: 'Network address', value: (r) => r.ip ?? '' },
      ],
      rows,
    );
    sendCsv(res, 'accessai-activity', csv);
  } catch (error) {
    next(error);
  }
};

const exportSos = async (req, res, next) => {
  try {
    const q = matchedData(req, { locations: ['query'] });
    const rows = (await sosQuery(sosFilter(q)).limit(MAX_ROWS).lean()).map(sosView);
    await recordAdminAction(req, { action: 'sos.export', details: { rows: rows.length, kind: q.kind, unanswered: q.unanswered, from: q.from, to: q.to } });
    const csv = toCsv(
      [
        { header: 'Sent (UTC)', value: (r) => iso(r.sentAt) },
        { header: 'Sender name', value: (r) => r.sender?.name ?? 'Deleted account' },
        { header: 'Sender email', value: (r) => r.sender?.email ?? '' },
        { header: 'Kind', value: (r) => (r.isTest ? 'test' : 'real') },
        { header: 'Friends alerted', value: (r) => r.alerted },
        { header: 'Answers', value: (r) => r.answers.map((a) => `${a.name}: ${a.kind}`).join('; ') },
        { header: 'No one answered', value: (r) => (r.noOneAnswered ? 'yes' : 'no') },
        { header: 'Status', value: (r) => r.status },
        { header: 'Ended (UTC)', value: (r) => iso(r.endedAt) },
        { header: 'How it ended', value: (r) => r.ended ?? '' },
      ],
      rows,
    );
    sendCsv(res, 'accessai-sos', csv);
  } catch (error) {
    next(error);
  }
};

const exportReview = async (req, res, next) => {
  try {
    const { items } = await computeSuspicious();
    const rows = items.flatMap((item) => item.signs.map((sign) => ({ item, sign })));
    await recordAdminAction(req, { action: 'review.export', details: { rows: rows.length } });
    const csv = toCsv(
      [
        { header: 'Severity', value: (r) => r.item.severity },
        { header: 'Account name', value: (r) => r.item.user?.name ?? '' },
        { header: 'Account email', value: (r) => r.item.user?.email ?? '' },
        { header: 'Account status', value: (r) => r.item.user?.status ?? '' },
        { header: 'Network address', value: (r) => r.item.ip ?? '' },
        { header: 'Rule', value: (r) => r.sign.sign },
        { header: 'Count', value: (r) => r.sign.count },
        { header: 'Threshold', value: (r) => r.sign.threshold },
        { header: 'First (UTC)', value: (r) => iso(r.sign.firstAt) },
        { header: 'Last (UTC)', value: (r) => iso(r.sign.lastAt) },
        { header: 'Addresses', value: (r) => (r.sign.addresses ?? []).join('; ') },
        { header: 'Reasons', value: (r) => (r.sign.reasons ?? []).join('; ') },
        { header: 'Limits', value: (r) => (r.sign.limiters ?? []).join('; ') },
      ],
      rows,
    );
    sendCsv(res, 'accessai-suspicious-activities', csv);
  } catch (error) {
    next(error);
  }
};

const exportAudit = async (req, res, next) => {
  try {
    const q = matchedData(req, { locations: ['query'] });
    const entries = await AdminAuditLog.find(auditFilter(q)).sort({ createdAt: -1 }).limit(MAX_ROWS).lean();
    const names = await namesFor(entries);
    const rows = entries.map((e) => auditView(e, names));
    await recordAdminAction(req, { action: 'audit.export', details: { rows: rows.length, action: q.action, from: q.from, to: q.to } });
    const csv = toCsv(
      [
        { header: 'When (UTC)', value: (r) => iso(r.at) },
        { header: 'Admin', value: (r) => r.admin?.name ?? '' },
        { header: 'Admin email', value: (r) => r.email ?? '' },
        { header: 'Action', value: (r) => r.action },
        { header: 'Result', value: (r) => (r.success ? 'success' : 'failed') },
        { header: 'Target type', value: (r) => r.target?.type ?? '' },
        { header: 'Target', value: (r) => r.target?.name ?? r.target?.id ?? '' },
        { header: 'Network address', value: (r) => r.ip ?? '' },
        { header: 'Details', value: (r) => (r.details ? JSON.stringify(r.details) : '') },
      ],
      rows,
    );
    sendCsv(res, 'accessai-admin-log', csv);
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
  listAudit,
  exportActivity,
  exportSos,
  exportReview,
  exportAudit,
  computeSuspicious,
  statusOf,
  SUSPICIOUS_RULES,
  REVIEW_SIGNS,
  SOS_FIELDS,
};
