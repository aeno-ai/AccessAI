const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { sosLimiter } = require('../middleware/rateLimiter');
const {
  triggerSosValidators,
  sosIdValidators,
  locationValidators,
  respondValidators,
} = require('../validators/sosValidators');
const {
  triggerSOS,
  updateLocation,
  resolveSOS,
  respondToSOS,
  listActive,
} = require('../controllers/sosController');

router.use(protect, sosLimiter);

// Sending an SOS is a PWD-only feature — the app doesn't show it to non-PWD
// accounts, and this stops them reaching it by calling the API directly.
// The role comes from the signed token, so it can't be faked.
const requirePwd = (req, res, next) => {
  if (req.user.role === 'non_pwd') {
    return res.status(403).json({ message: 'SOS is only available for PWD accounts.' });
  }
  next();
};

// The sender's side.
router.post('/trigger', requirePwd, triggerSosValidators, validate, triggerSOS);
router.patch('/:id/location', requirePwd, locationValidators, validate, updateLocation);
router.patch('/:id/resolve', requirePwd, sosIdValidators, validate, resolveSOS);

// The friends' side — friends can be any role.
router.get('/active', listActive);
router.post('/:id/respond', respondValidators, validate, respondToSOS);

module.exports = router;
