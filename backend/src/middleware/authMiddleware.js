const { adminRefusalForToken, verifyUserToken } = require('../utils/verifyUserToken');

// Lets a request through only with a valid mobile-app login token for an
// account that may still use it — see utils/verifyUserToken.js for exactly
// what's checked. The mobile app signs the user out on any 401; when an
// admin paused or is deleting the account, the 401 says so (code and
// message), and the app shows it on the login screen.
const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Please log in again.' });
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = await verifyUserToken(token);
    if (!decoded) {
      const why = await adminRefusalForToken(token);
      return res.status(401).json(why ?? { message: 'Please log in again.' });
    }
  } catch (error) {
    return next(error);
  }

  req.user = decoded; // { userId, role, firstName }
  next();
};

module.exports = protect;
