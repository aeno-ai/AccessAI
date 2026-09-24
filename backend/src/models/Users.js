const mongoose = require('mongoose');


const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; 
//this means that the email should not contain spaces,
//should have an '@' symbol, and should have a domain name
//after the '@' symbol.

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [EMAIL_REGEX, 'Invalid email address'],
    maxlength: 30,
  },
  password: { type: String, required: true },
  // Collected separately at sign-up. Not `required` here: accounts created
  // before these fields existed don't have them, and a required field would
  // make every later save of those accounts fail (e.g. an admin
  // deactivating one). The register validator is what requires them.
  firstName: { type: String, trim: true, maxlength: 30 },
  lastName: { type: String, trim: true, maxlength: 30 },
  // The full name ("First Last"), kept for older accounts and for the admin
  // panel's list and search. 61 = 30 + a space + 30.
  name: { type: String, required: true, trim: true, maxlength: 61 },
  role: {
    type: String,
    enum: ['pwd', 'non_pwd'],
    required: true,
  },
  // Admins can deactivate an account from the web panel. Accounts created
  // before this field existed don't have it at all, so queries treat
  // "missing" as active: { isActive: { $ne: false } }.
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

// ITO YUNG SCHEMA KAPAG MAY NEED NA I RETREIVE NG USER DATA,
//  KAGAYA NG PAG LOGIN, PAG REGISTER, PAG GET NG USER INFO, ETC.