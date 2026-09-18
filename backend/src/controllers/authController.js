const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/Users');

// Regex: At least 8 chars (.{8,}), 1 uppercase (?=.*[A-Z]), 1 number (?=.*\d)
const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

// Every field a query or bcrypt call touches must actually be a string —
// otherwise Mongo can interpret an object payload (e.g. `{"$gt": ""}`) as a
// query operator instead of a literal value. `!email` alone lets objects
// through, since a non-empty object is truthy.
function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

const register = async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;

    // 1. Check if required fields exist and are actually strings
    if (!isNonEmptyString(email) || !isNonEmptyString(password) || !isNonEmptyString(name)) {
      return res.status(400).json({ message: 'Email, password, and name are required' });
    }

    // 2. Validate password strength
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters long, contain at least one uppercase letter, and at least one number.'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashedPassword, name, role });

    res.status(201).json({ message: 'User created', userId: user._id });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Reject anything that isn't a plain string before it ever reaches a
    // query or bcrypt.compare — also short-circuits unnecessary DB lookups.
    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login };