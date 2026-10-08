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
    // 254 is the longest an email address can be. (It used to be 30, which
    // turned away plenty of real Gmail addresses.)
    maxlength: 254,
  },
  // A bcrypt hash. Missing on accounts created with Google, until they set
  // one through "Forgot password".
  password: { type: String },
  // Google's permanent id for the account ("sub"), once it has signed in
  // with Google. Sparse so the many accounts without one don't clash.
  googleId: { type: String, unique: true, sparse: true },
  // false only while a new email/password sign-up is waiting for the code
  // emailed to it — such an account can't log in. Accounts created before
  // this field existed don't have it and count as verified, the same way
  // isActive treats "missing" as active.
  emailVerified: { type: Boolean },
  // Set whenever the password is reset. protect() refuses tokens issued
  // before it, so a reset signs the account out everywhere.
  passwordChangedAt: { type: Date },
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
  // Proof of consent, set by register() from the server's clock and
  // constants/legal.js — never taken from the request. Optional for the same
  // reason as firstName: older accounts don't have them. pwdDeclaredAt is
  // only set for accounts registered as 'pwd'.
  termsAcceptedAt: { type: Date },
  termsVersion: { type: String },
  pwdDeclaredAt: { type: Date },
  // Set when the user asks to delete their account; unset if they restore
  // it. Once this date passes, utils/accountDeletion.js erases the account
  // and everything that belongs to it. Indexed for that cleanup query.
  deletionScheduledFor: { type: Date, index: true },
  // Shared to add someone as a friend ("ABCD-2345"); there's no lookup by
  // email. Made the first time it's needed (utils/friendCode.js). Sparse
  // so accounts that never asked for one don't clash.
  friendCode: { type: String, unique: true, sparse: true },
  // Optional, written by the user, shown to their friends — e.g. "I'm
  // Deaf, please type". Never filled in automatically.
  friendNote: { type: String, trim: true, maxlength: 80 },
  // Where to send push notifications (friends' SOS alerts and messages
  // while AccessAI is closed): one Expo push token per phone the user is
  // signed in on. deviceId is a random id the app made for that phone, so
  // signing in again on the same phone replaces its old token. Never sent
  // to anyone; select: false keeps it out of every normal query.
  pushTokens: {
    type: [
      {
        token: { type: String, required: true, maxlength: 200 },
        deviceId: { type: String, required: true, maxlength: 64 },
        platform: { type: String, enum: ['android', 'ios'], required: true },
        updatedAt: { type: Date, required: true },
        _id: false,
      },
    ],
    select: false,
    default: undefined,
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

// ITO YUNG SCHEMA KAPAG MAY NEED NA I RETREIVE NG USER DATA,
//  KAGAYA NG PAG LOGIN, PAG REGISTER, PAG GET NG USER INFO, ETC.