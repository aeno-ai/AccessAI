const mongoose = require('mongoose');

// One message in an online chat between two friends.
const directMessageSchema = new mongoose.Schema(
  {
    friendshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Friendship', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Made by the sender's phone, so a message re-sent after a dropped
    // connection is recognized instead of saved twice.
    clientId: { type: String, required: true, trim: true, maxlength: 100 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    // 'sos' = an emergency alert, posted into the chat so a friend who was
    // offline still finds it there.
    kind: { type: String, enum: ['text', 'sos'], default: 'text' },
    sos: {
      eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'SOSEvent' },
      latitude: { type: Number },
      longitude: { type: Number },
      isTest: { type: Boolean },
    },
    // The send time on the sender's phone (may be well before it reached us,
    // if it was written offline).
    clientCreatedAt: { type: Number, required: true },
  },
  { timestamps: true },
);

directMessageSchema.index({ senderId: 1, clientId: 1 }, { unique: true });
directMessageSchema.index({ friendshipId: 1, createdAt: 1 });

module.exports = mongoose.model('DirectMessage', directMessageSchema);
