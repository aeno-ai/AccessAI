const mongoose = require('mongoose');

// The 6-digit codes emailed by utils/emailCodes.js. At most one live code
// per account per purpose — asking again replaces it. Only a bcrypt hash of
// the code is stored, never the code itself.
const emailCodeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  purpose: {
    type: String,
    enum: ['verify_email', 'reset_password', 'delete_account'],
    required: true,
  },
  codeHash: { type: String, required: true },
  // Wrong guesses so far. The code stops working after MAX_ATTEMPTS.
  attempts: { type: Number, default: 0 },
  // When this code was emailed — for the wait before another can be sent.
  sentAt: { type: Date, required: true },
  // MongoDB deletes the document on its own once this passes (TTL index).
  expiresAt: { type: Date, required: true, expires: 0 },
});

emailCodeSchema.index({ userId: 1, purpose: 1 }, { unique: true });

module.exports = mongoose.model('EmailCode', emailCodeSchema);
