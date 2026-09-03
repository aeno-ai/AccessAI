const mongoose = require('mongoose');

const sosEventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['active', 'resolved'], default: 'active' },
  triggerMethod: { type: String, required: true }, // deliberately NOT an enum — see reasoning above
  location: {
    latitude: Number,
    longitude: Number,
  },
  message: { type: String, default: 'Emergency — I need help' },
  silentMode: { type: Boolean, default: false },
  isTest: { type: Boolean, default: false },
  resolvedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('SOSEvent', sosEventSchema);