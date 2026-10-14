const mongoose = require('mongoose');

// How often a code was emailed to each address, per kind of code — for the
// wait between two emails (60 s) and the daily cap (5). See utils/codeGate.js.
//
// Kept for every address asked about, whether or not it has an account, so
// the answers can't be used to find out which emails are registered. The
// address itself is never stored: `key` is a hash of the kind + address.
const codeRequestSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  // When the last code went out (Date(0) after a failed send: no wait).
  lastSentAt: { type: Date, required: true },
  // Start of the current 24-hour window, and how many codes went out in it.
  dayStart: { type: Date, required: true },
  dayCount: { type: Number, default: 0 },
  // MongoDB deletes the record on its own once the 24-hour window is over.
  expiresAt: { type: Date, required: true, expires: 0 },
});

module.exports = mongoose.model('CodeRequest', codeRequestSchema);
