const mongoose = require('mongoose');

// clientId is the id the phone generated locally (in its offline SQLite
// database) when the conversation was first created. Syncing is "upsert by
// clientId" rather than always inserting, so re-sending the same
// conversation (e.g. after a dropped connection) updates the existing
// record instead of creating a duplicate.
const conversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    clientId: { type: String, required: true, trim: true, maxlength: 100 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    mode: { type: String, required: true, trim: true, maxlength: 50 },
  },
  { timestamps: true },
);

// One clientId per user — the same locally-generated id should never map to
// two different synced conversations for the same account.
conversationSchema.index({ userId: 1, clientId: 1 }, { unique: true });

module.exports = mongoose.model('Conversation', conversationSchema);
