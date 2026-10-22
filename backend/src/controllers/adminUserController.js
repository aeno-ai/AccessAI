const { matchedData } = require('express-validator');
const User = require('../models/Users');
const EmergencyContact = require('../models/EmergencyContact');
const Conversation = require('../models/Conversation');
const SOSEvent = require('../models/SOSEvent');
const { recordAdminAction } = require('../utils/auditLog');
const { ADMIN_DELETION_DAYS } = require('../constants/legal');
const { isAdminDeletion, isSuspended, usableFilter } = require('../utils/accountState');
const { disconnectUser, notifyFriendsChanged } = require('../realtime/io');
const { statusOf } = require('./adminRecordsController');

const DEFAULT_PAGE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

// Search text goes into a RegExp, so every regex special character is
// escaped first — otherwise a search like ".*" or "(a+)+$" would be
// interpreted as a pattern instead of plain text.
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The only shape a user is ever sent to the admin panel in. The password
// hash never leaves the server.
const toAdminView = (user) => ({
  id: user._id.toString(),
  name: user.name,
  // null for accounts created before first/last name were collected
  firstName: user.firstName ?? null,
  lastName: user.lastName ?? null,
  email: user.email,
  role: user.role,
  isActive: user.isActive !== false,
  // 'active', 'suspended', 'deleting' or 'deactivated' (the old switch).
  status: statusOf(user),
  emailVerified: user.emailVerified !== false,
  suspendedUntil: isSuspended(user) ? user.suspendedUntil : null,
  suspendedReason: isSuspended(user) ? user.suspendedReason ?? null : null,
  suspendedAt: isSuspended(user) ? user.suspendedAt ?? null : null,
  deletionScheduledFor: user.deletionScheduledFor ?? null,
  // 'admin' (only an admin can undo it) or 'user' (they asked for it).
  deletionBy: user.deletionScheduledFor ? (user.deletionBy === 'admin' ? 'admin' : 'user') : null,
  deletionReason: isAdminDeletion(user) ? user.deletionReason ?? null : null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// The list's status filter, as MongoDB conditions.
const STATUS_FILTERS = {
  active: () => usableFilter(),
  suspended: () => ({ isActive: { $ne: false }, deletionScheduledFor: null, suspendedUntil: { $gt: new Date() } }),
  deleting: () => ({ isActive: { $ne: false }, deletionScheduledFor: { $ne: null } }),
  deactivated: () => ({ isActive: false }),
};
// 'inactive' was the old name for deactivated.
STATUS_FILTERS.inactive = STATUS_FILTERS.deactivated;

const listUsers = async (req, res, next) => {
  try {
    // matchedData, not req.query: Express 5 re-parses req.query on every
    // read, so only matchedData has the validators' sanitized values.
    const { search, role, status, page = 1, limit = DEFAULT_PAGE_SIZE } = matchedData(req, {
      locations: ['query'],
    });

    // $and: the status conditions have their own $or.
    const conditions = [];
    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      conditions.push({ $or: [{ name: pattern }, { email: pattern }] });
    }
    if (role) conditions.push({ role });
    if (status) conditions.push(STATUS_FILTERS[status]());
    const filter = conditions.length ? { $and: conditions } : {};

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      users: users.map(toAdminView),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    next(error);
  }
};

// Counts only — admins can see that a user has conversations or SOS
// events, never what's in them.
const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const userId = user._id;
    const [emergencyContacts, conversations, sosEvents, activeSosEvents] = await Promise.all([
      EmergencyContact.countDocuments({ userId }),
      Conversation.countDocuments({ userId }),
      SOSEvent.countDocuments({ userId }),
      SOSEvent.countDocuments({ userId, status: 'active' }),
    ]);

    res.json({
      user: toAdminView(user),
      stats: { emergencyContacts, conversations, sosEvents, activeSosEvents },
    });
  } catch (error) {
    next(error);
  }
};

// Only turns an old "deactivated" account back on (the validator only
// accepts isActive: true). Locking an account is Suspend or Delete in 30
// days now (HANDOFF.md §42).
const updateUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const wasActive = user.isActive !== false;
    user.isActive = true;
    await user.save();

    await recordAdminAction(req, {
      action: 'user.reactivate',
      targetType: 'user',
      targetId: user._id,
      details: { email: user.email, wasActive },
    });
    if (!wasActive) void notifyFriendsChanged(user._id);

    res.json({ user: toAdminView(user) });
  } catch (error) {
    next(error);
  }
};

// After an admin locks an account: its open connections close (the
// reconnect is refused), and its friends' lists drop it at once.
const lockedOut = (userId) => {
  disconnectUser(userId);
  void notifyFriendsChanged(userId);
};

// POST /users/:id/suspend { days: 1 | 7 | 30, reason }. Suspending again
// replaces the old end date and reason.
const suspendUser = async (req, res, next) => {
  try {
    const { days, reason } = req.body;
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.isActive === false || isAdminDeletion(user)) {
      return res.status(409).json({ message: 'This account is already locked.' });
    }

    const now = new Date();
    user.suspendedUntil = new Date(now.getTime() + days * DAY_MS);
    user.suspendedReason = reason;
    user.suspendedAt = now;
    user.suspendedBy = req.admin._id;
    await user.save();

    await recordAdminAction(req, {
      action: 'user.suspend',
      targetType: 'user',
      targetId: user._id,
      details: { email: user.email, days, reason, until: user.suspendedUntil },
    });
    lockedOut(user._id);
    res.json({ user: toAdminView(user) });
  } catch (error) {
    next(error);
  }
};

// DELETE /users/:id/suspend: lifts it now.
const liftSuspension = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!isSuspended(user)) return res.status(400).json({ message: 'This account is not suspended.' });

    const until = user.suspendedUntil;
    user.suspendedUntil = undefined;
    user.suspendedReason = undefined;
    user.suspendedAt = undefined;
    user.suspendedBy = undefined;
    await user.save();

    await recordAdminAction(req, {
      action: 'user.suspend.lift',
      targetType: 'user',
      targetId: user._id,
      details: { email: user.email, until },
    });
    void notifyFriendsChanged(user._id);
    res.json({ user: toAdminView(user) });
  } catch (error) {
    next(error);
  }
};

// POST /users/:id/deletion { reason }: locked at once, erased after
// ADMIN_DELETION_DAYS by the same job as a person's own deletion
// (utils/accountDeletion.js). Replaces a deletion the person asked for.
const scheduleDeletion = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (isAdminDeletion(user)) {
      return res.status(409).json({ message: 'This account is already being deleted.' });
    }

    const previous = user.deletionScheduledFor ?? null;
    user.deletionScheduledFor = new Date(Date.now() + ADMIN_DELETION_DAYS * DAY_MS);
    user.deletionBy = 'admin';
    user.deletionReason = req.body.reason;
    user.deletionScheduledByAdmin = req.admin._id;
    await user.save();

    await recordAdminAction(req, {
      action: 'user.delete.schedule',
      targetType: 'user',
      targetId: user._id,
      details: { email: user.email, reason: req.body.reason, on: user.deletionScheduledFor, replaced: previous },
    });
    lockedOut(user._id);
    res.json({ user: toAdminView(user) });
  } catch (error) {
    next(error);
  }
};

// DELETE /users/:id/deletion: undoes an admin's deletion. A deletion the
// person asked for is theirs to cancel (by logging in), not an admin's.
const cancelDeletion = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!isAdminDeletion(user)) {
      return res.status(400).json({
        message: user.deletionScheduledFor
          ? 'This person asked to delete their account. Only they can cancel it, by logging in.'
          : 'This account is not being deleted.',
      });
    }

    const on = user.deletionScheduledFor;
    user.deletionScheduledFor = undefined;
    user.deletionBy = undefined;
    user.deletionReason = undefined;
    user.deletionScheduledByAdmin = undefined;
    await user.save();

    await recordAdminAction(req, {
      action: 'user.delete.cancel',
      targetType: 'user',
      targetId: user._id,
      details: { email: user.email, on },
    });
    void notifyFriendsChanged(user._id);
    res.json({ user: toAdminView(user) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listUsers,
  getUser,
  updateUserStatus,
  suspendUser,
  liftSuspension,
  scheduleDeletion,
  cancelDeletion,
  STATUS_FILTERS,
};
