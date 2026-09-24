const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { triggerSosValidators, sosIdValidators } = require('../validators/sosValidators');
const { triggerSOS, resolveSOS } = require('../controllers/sosController');

router.use(protect);

// SOS is a PWD-only feature — the app doesn't show it to non-PWD accounts,
// and this stops them reaching it by calling the API directly. The role
// comes from the signed token, so it can't be faked.
router.use((req, res, next) => {
  if (req.user.role === 'non_pwd') {
    return res.status(403).json({ message: 'SOS is only available for PWD accounts' });
  }
  next();
});

router.post('/trigger', triggerSosValidators, validate, triggerSOS);
router.patch('/:id/resolve', sosIdValidators, validate, resolveSOS);

module.exports = router;
