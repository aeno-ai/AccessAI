const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { ADMIN_ROLES, permissionsFor } = require('../constants/adminRoles');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Higher than the mobile app's cost of 10 — admin accounts are worth more to
// an attacker, and admins log in rarely enough that the extra hashing time
// doesn't matter.
const BCRYPT_ROUNDS = 12;

// Admins are deliberately NOT stored in the User collection. They log in
// through their own endpoint with their own token secret, so a bug in the
// public sign-up flow (or a leaked mobile token) can never produce admin
// access.
const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [EMAIL_REGEX, 'Invalid email address'],
    maxlength: 254,
  },
  // select: false — the hash is never loaded unless a query explicitly asks
  // for it with .select('+password'), so it can't leak into a response by
  // accident.
  password: { type: String, required: true, select: false },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  role: { type: String, enum: ADMIN_ROLES, required: true },
  isActive: { type: Boolean, default: true },
  // New admins get a temporary password from whoever created them and must
  // replace it before they can do anything else.
  mustChangePassword: { type: Boolean, default: true },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  // Baked into every session token. Bumping it (password change, role
  // change, deactivation, logout) instantly invalidates every token issued
  // before — see middleware/adminAuthMiddleware.js.
  tokenVersion: { type: Number, default: 0 },
  lastLoginAt: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });

adminSchema.statics.hashPassword = function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
};

adminSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockUntil && this.lockUntil > Date.now());
};

// The only shape an admin is ever sent to the browser in.
adminSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    email: this.email,
    name: this.name,
    role: this.role,
    isActive: this.isActive,
    isLocked: this.isLocked(),
    mustChangePassword: this.mustChangePassword,
    lastLoginAt: this.lastLoginAt ?? null,
    createdAt: this.createdAt,
    permissions: permissionsFor(this.role),
  };
};

module.exports = mongoose.model('Admin', adminSchema);
