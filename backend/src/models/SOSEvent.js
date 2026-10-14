const mongoose = require('mongoose');

const point = {
  latitude: { type: Number, min: -90, max: 90 },
  longitude: { type: Number, min: -180, max: 180 },
};

const sosEventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['active', 'resolved'], default: 'active' },
  triggerMethod: { type: String, required: true }, // deliberately NOT an enum — see reasoning above
  // Where the SOS was sent from, and how exact the phone's GPS was (meters).
  location: {
    ...point,
    accuracy: { type: Number, min: 0 },
  },
  // When the person actually pressed SOS — earlier than createdAt when it
  // was made offline and sent once the phone was back online.
  occurredAt: { type: Date },
  // The newest position the sender's phone shared since (it keeps sharing
  // for 30 minutes while AccessAI is open) — what friends' "Open map" uses.
  lastLocation: {
    ...point,
    accuracy: { type: Number, min: 0 },
    at: { type: Date },
  },
  // A readable place from the sender's phone ("Near Rizal Ave, Manila").
  place: { type: String, trim: true, maxlength: 200 },
  message: { type: String, default: 'Emergency — I need help' },
  silentMode: { type: Boolean, default: false },
  isTest: { type: Boolean, default: false },
  // The friends alerted, fixed at the moment of the SOS — so a friend taken
  // out of the circle later still gets the live updates and the "safe" news
  // for an SOS they already received.
  recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Live location is accepted until this time (real SOS only).
  shareUntil: { type: Date },
  // Still shown as active to friends until this time, unless resolved first.
  expiresAt: { type: Date },
  resolvedAt: { type: Date },
  // 'safe' = the sender said so; 'expired' = nobody resolved it in time;
  // 'replaced' = the sender sent a new SOS.
  resolvedReason: { type: String, enum: ['safe', 'expired', 'replaced'] },
  // Friends' answers, one per friend: "I've seen it" / "I'm on my way".
  responses: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      kind: { type: String, enum: ['seen', 'on_my_way'], required: true },
      at: { type: Date, required: true },
      _id: false,
    },
  ],
}, { timestamps: true });

// "Active SOS from my friends": the events I was alerted about.
sosEventSchema.index({ recipients: 1, status: 1, createdAt: -1 });
// "My active SOS", newest first — read in index order, no sorting.
sosEventSchema.index({ userId: 1, status: 1, createdAt: -1 });
// The expiry job: only the active ones that are past their time.
sosEventSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('SOSEvent', sosEventSchema);
