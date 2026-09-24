const jwt = require('jsonwebtoken');
const User = require('../models/Users');

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  try {
    // A valid signature only proves we issued the token — not that the
    // account is still allowed in. Checking here means an admin
    // deactivating a user takes effect on that user's very next request,
    // not whenever their 7-day token happens to expire. The mobile app
    // already signs the user out on any 401.
    const isActive = await User.exists({ _id: decoded.userId, isActive: { $ne: false } });
    if (!isActive) {
      return res.status(401).json({ message: 'Account not found or deactivated' });
    }
  } catch (error) {
    return next(error);
  }

  req.user = decoded; // { userId, role }
  next();
};

module.exports = protect;
