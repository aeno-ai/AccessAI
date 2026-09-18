const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    clientId: { type: String, required: true, trim: true, maxlength: 100 },
    sender: { type: String, enum: ['me', 'them'], required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    // The original send time from the phone's local clock, so message
    // order survives syncing even if messages arrive out of order or late.
    clientCreatedAt: { type: Number, required: true },
  },
  { timestamps: true },
);

// One clientId per conversation — messages are immutable once sent, so
// syncing the same message twice should be a no-op, not a duplicate.
messageSchema.index({ conversationId: 1, clientId: 1 }, { unique: true });

module.exports = mongoose.model('Message', messageSchema);
