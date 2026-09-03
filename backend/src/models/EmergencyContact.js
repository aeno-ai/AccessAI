const mongoose = require('mongoose');

const emergencyContactSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  relationship: { type: String },
  email: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('EmergencyContact', emergencyContactSchema);