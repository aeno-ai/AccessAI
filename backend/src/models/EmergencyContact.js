const mongoose = require('mongoose');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[\d\s()-]{7,20}$/;

const emergencyContactSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phoneNumber: {
    type: String,
    required: true,
    trim: true,
    match: [PHONE_REGEX, 'Invalid phone number'],
  },
  relationship: { type: String, trim: true, maxlength: 50 },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [EMAIL_REGEX, 'Invalid email address'],
  },
}, { timestamps: true });

module.exports = mongoose.model('EmergencyContact', emergencyContactSchema);