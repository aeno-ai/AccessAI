const bcrypt = require('bcrypt');
const Admin = require('../models/Admin');
const { recordAdminAction } = require('../utils/auditLog');
const {
  SESSION_COOKIE,
  clearAdminSession,
  issueAdminSession,
  verifyAdminToken,
} = require('../utils/adminSession');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Every rejected login gets this exact response — unknown email, wrong
// password, locked account and disabled account all look identical from
// the outside, so the login form can't be used to discover which admin
// emails exist. The real reason is written to the audit log instead.
const INVALID_CREDENTIALS = { message: 'Invalid credentials' };

// Compared against when there's no real hash to check (unknown email,
// locked account), so those rejections take as long as a wrong password
// does and response timing doesn't give anything away either.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-not-a-real-password', 12);

// email/password are already guaranteed to be well-formed strings by
// adminLoginValidators (routes/adminAuthRoutes.js), which also rules out
// NoSQL operator injection in the findOne below.
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email }).select('+password');

    const reject = async (reason) => {
      await recordAdminAction(req, {
        action: 'login.failed',
        adminId: admin?._id,
        email,
        success: false,
        details: { reason },
      });
      return res.status(401).json(INVALID_CREDENTIALS);
    };

    if (!admin) {
      await bcrypt.compare(password, DUMMY_HASH);
      return reject('unknown_email');
    }

    if (admin.isLocked()) {
      await bcrypt.compare(password, DUMMY_HASH);
      return reject('locked');
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      // $inc is atomic, so parallel guesses can't race past the limit.
      const updated = await Admin.findByIdAndUpdate(
        admin._id,
        { $inc: { failedLoginAttempts: 1 } },
        { returnDocument: 'after' },
      );
      if (updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        await Admin.updateOne(
          { _id: admin._id },
          { failedLoginAttempts: 0, lockUntil: new Date(Date.now() + LOCK_DURATION_MS) },
        );
        return reject('wrong_password_now_locked');
      }
      return reject('wrong_password');
    }

    // Checked only after the password matched, and still answered with the
    // generic message — see INVALID_CREDENTIALS above.
    if (!admin.isActive) {
      return reject('disabled');
    }

    admin.failedLoginAttempts = 0;
    admin.lockUntil = undefined;
    admin.lastLoginAt = new Date();
    await admin.save();

    issueAdminSession(res, admin);
    await recordAdminAction(req, { action: 'login.success', adminId: admin._id, email: admin.email });

    res.json({ admin: admin.toSafeObject() });
  } catch (error) {
    next(error);
  }
};

// Deliberately not behind protectAdmin: an expired session should still be
// able to "log out" and get its cookie cleared. When the session IS still
// valid, bumping tokenVersion kills the token server-side too, so logging
// out means the token is dead everywhere — not just deleted from this
// browser.
const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) {
      try {
        const { adminId, tv } = verifyAdminToken(token);
        await Admin.updateOne({ _id: adminId, tokenVersion: tv }, { $inc: { tokenVersion: 1 } });
      } catch {
        // Expired or invalid token — nothing to revoke.
      }
    }

    clearAdminSession(res);
    res.json({ message: 'Logged out' });
  } catch (error) {
    next(error);
  }
};

const me = (req, res) => {
  res.json({ admin: req.admin.toSafeObject() });
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = await Admin.findById(req.admin._id).select('+password');

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      await recordAdminAction(req, {
        action: 'password.change',
        success: false,
        details: { reason: 'wrong_current_password' },
      });
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    admin.password = await Admin.hashPassword(newPassword);
    admin.mustChangePassword = false;
    admin.tokenVersion += 1; // signs out any other session using the old password
    await admin.save();

    // ...but keeps this one: hand the browser a fresh token for the new
    // tokenVersion.
    issueAdminSession(res, admin);
    await recordAdminAction(req, { action: 'password.change' });

    res.json({ admin: admin.toSafeObject() });
  } catch (error) {
    next(error);
  }
};

module.exports = { login, logout, me, changePassword };
