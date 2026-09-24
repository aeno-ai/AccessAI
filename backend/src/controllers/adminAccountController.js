const Admin = require('../models/Admin');
const { recordAdminAction } = require('../utils/auditLog');

const isSelf = (req) => req.params.id === req.admin._id.toString();

// Would this change leave the panel with no active super admin — and so
// nobody able to manage admins ever again?
async function wouldRemoveLastSuperAdmin(target, { role, isActive }) {
  const losesSuperAdmin =
    target.role === 'super_admin' &&
    target.isActive &&
    ((role !== undefined && role !== 'super_admin') || isActive === false);
  if (!losesSuperAdmin) return false;

  const others = await Admin.countDocuments({
    _id: { $ne: target._id },
    role: 'super_admin',
    isActive: true,
  });
  return others === 0;
}

const listAdmins = async (req, res, next) => {
  try {
    const admins = await Admin.find().sort({ createdAt: 1 });
    res.json({ admins: admins.map((admin) => admin.toSafeObject()) });
  } catch (error) {
    next(error);
  }
};

const createAdmin = async (req, res, next) => {
  try {
    const { email, name, role, password } = req.body;

    if (await Admin.exists({ email })) {
      return res.status(400).json({ message: 'An admin with this email already exists' });
    }

    const admin = await Admin.create({
      email,
      name,
      role,
      password: await Admin.hashPassword(password),
      mustChangePassword: true,
      createdBy: req.admin._id,
    });

    await recordAdminAction(req, {
      action: 'admin.create',
      targetType: 'admin',
      targetId: admin._id,
      details: { email: admin.email, role: admin.role },
    });

    res.status(201).json({ admin: admin.toSafeObject() });
  } catch (error) {
    // Two requests creating the same email at the same moment both pass the
    // exists() check above; the unique index catches the second one.
    if (error.code === 11000) {
      return res.status(400).json({ message: 'An admin with this email already exists' });
    }
    next(error);
  }
};

const updateAdmin = async (req, res, next) => {
  try {
    // Nobody can demote or disable themselves — the easiest way to
    // accidentally lock everyone out of the panel.
    if (isSelf(req)) {
      return res.status(400).json({ message: "You can't change your own role or status" });
    }

    const { role, isActive } = req.body;
    const target = await Admin.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'Admin not found' });

    if (await wouldRemoveLastSuperAdmin(target, { role, isActive })) {
      return res.status(400).json({ message: 'There must always be at least one active super admin' });
    }

    const changes = {};
    if (role !== undefined && role !== target.role) {
      changes.role = { from: target.role, to: role };
      target.role = role;
    }
    if (isActive !== undefined && isActive !== target.isActive) {
      changes.isActive = { from: target.isActive, to: isActive };
      target.isActive = isActive;
    }

    if (Object.keys(changes).length > 0) {
      // Forces them to log in again, so the new role/status applies
      // immediately rather than at their next login.
      target.tokenVersion += 1;
      await target.save();

      await recordAdminAction(req, {
        action: 'admin.update',
        targetType: 'admin',
        targetId: target._id,
        details: { email: target.email, ...changes },
      });
    }

    res.json({ admin: target.toSafeObject() });
  } catch (error) {
    next(error);
  }
};

// For an admin who forgot their password — there's no email-based reset.
// The new password is temporary: they must change it on their next login.
const resetAdminPassword = async (req, res, next) => {
  try {
    if (isSelf(req)) {
      return res.status(400).json({ message: 'Use Change Password to change your own password' });
    }

    const target = await Admin.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'Admin not found' });

    target.password = await Admin.hashPassword(req.body.password);
    target.mustChangePassword = true;
    target.tokenVersion += 1;
    target.failedLoginAttempts = 0;
    target.lockUntil = undefined;
    await target.save();

    await recordAdminAction(req, {
      action: 'admin.reset_password',
      targetType: 'admin',
      targetId: target._id,
      details: { email: target.email },
    });

    res.json({ admin: target.toSafeObject() });
  } catch (error) {
    next(error);
  }
};

module.exports = { listAdmins, createAdmin, updateAdmin, resetAdminPassword };
