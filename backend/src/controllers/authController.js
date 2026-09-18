const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/Users');

// email/password/name/role are already guaranteed to be well-formed strings
// (right type, right shape, right length) by the validator chains wired up
// in routes/authRoutes.js, which run — and reject the request — before this
// function ever executes. That's also what closes off NoSQL operator
// injection here: an object payload like `{"$gt": ""}` fails `isString()`
// at the route layer and never reaches the `User.findOne({ email })` query
// below.
const register = async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;

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