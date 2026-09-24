const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/Users');

// Shared by register and login so both hand out exactly the same kind of
// token.
const signUserToken = (user) =>
  jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

// email/password/firstName/lastName/role are already guaranteed to be well-formed strings
// (right type, right shape, right length) by the validator chains wired up
// in routes/authRoutes.js, which run — and reject the request — before this
// function ever executes. That's also what closes off NoSQL operator
// injection here: an object payload like `{"$gt": ""}` fails `isString()`
// at the route layer and never reaches the `User.findOne({ email })` query
// below.
const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      role,
    });

    // The token lets the app log the new user straight in (and on into
    // onboarding) without making them type their password a second time.
    res.status(201).json({ message: 'User created', userId: user._id, token: signUserToken(user) });
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

    // Only revealed after the correct password, so it can't be used to
    // probe which emails have accounts.
    if (user.isActive === false) {
      return res.status(403).json({ message: 'This account has been deactivated. Please contact support.' });
    }

    res.json({ token: signUserToken(user) });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login };