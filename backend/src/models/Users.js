const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: {
    type: String,
    enum: ['pwd', 'non_pwd'],
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

// ITO YUNG SCHEMA KAPAG MAY NEED NA I RETREIVE NG USER DATA,
//  KAGAYA NG PAG LOGIN, PAG REGISTER, PAG GET NG USER INFO, ETC.