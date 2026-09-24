const { matchedData } = require('express-validator');
const User = require('../models/Users');
const EmergencyContact = require('../models/EmergencyContact');
const Conversation = require('../models/Conversation');
const SOSEvent = require('../models/SOSEvent');
const { recordAdminAction } = require('../utils/auditLog');

const DEFAULT_PAGE_SIZE = 20;

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
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const listUsers = async (req, res, next) => {
  try {
    // matchedData, not req.query: Express 5 re-parses req.query on every
    // read, so only matchedData has the validators' sanitized values.
    const { search, role, status, page = 1, limit = DEFAULT_PAGE_SIZE } = matchedData(req, {
      locations: ['query'],
    });

    const filter = {};
    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: pattern }, { email: pattern }];
    }
    if (role) filter.role = role;
    if (status === 'active') filter.isActive = { $ne: false };
    if (status === 'inactive') filter.isActive = false;

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

const updateUserStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const wasActive = user.isActive !== false;
    user.isActive = isActive;
    await user.save();

    await recordAdminAction(req, {
      action: isActive ? 'user.reactivate' : 'user.deactivate',
      targetType: 'user',
      targetId: user._id,
      details: { email: user.email, wasActive },
    });

    res.json({ user: toAdminView(user) });
  } catch (error) {
    next(error);
  }
};

module.exports = { listUsers, getUser, updateUserStatus };
