const { verifyUserToken } = require('../utils/verifyUserToken');

// Lets a request through only with a valid mobile-app login token for an
// account that may still use it — see utils/verifyUserToken.js for exactly
// what's checked. The mobile app signs the user out on any 401.
const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Please log in again.' });
  }

  let decoded;
  try {
    decoded = await verifyUserToken(authHeader.split(' ')[1]);
  } catch (error) {
    return next(error);
  }
  if (!decoded) {
    return res.status(401).json({ message: 'Please log in again.' });
  }

  req.user = decoded; // { userId, role, firstName }
  next();
};

module.exports = protect;
