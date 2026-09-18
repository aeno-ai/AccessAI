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
    maxlength: 254,
  },
  password: { type: String, required: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  role: {
    type: String,
    enum: ['pwd', 'non_pwd'],
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

// ITO YUNG SCHEMA KAPAG MAY NEED NA I RETREIVE NG USER DATA,
//  KAGAYA NG PAG LOGIN, PAG REGISTER, PAG GET NG USER INFO, ETC.