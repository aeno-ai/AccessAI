const mongoose = require('mongoose');

// Two accounts connected as friends (any roles: PWD with non-PWD, PWD with
// PWD…). One document per pair, whoever asked first.
const friendshipSchema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // The two ids sorted and joined, so a pair can only ever have one
    // document — whichever of them sends the request.
    pairKey: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
    acceptedAt: { type: Date },
    // Whether each side has put the other in their SOS circle (alerted when
    // they send an SOS). Only PWD accounts can send SOS, so only their flag
    // ever matters.
    requesterSos: { type: Boolean, default: false },
    recipientSos: { type: Boolean, default: false },
    // When each side last read the chat, for unread counts.
    requesterReadAt: { type: Date },
    recipientReadAt: { type: Date },
  },
  { timestamps: true },
);

friendshipSchema.statics.pairKeyOf = (a, b) => [String(a), String(b)].sort().join(':');

module.exports = mongoose.model('Friendship', friendshipSchema);
