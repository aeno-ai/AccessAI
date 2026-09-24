const express = require('express');
const { protectAdmin } = require('../middleware/adminAuthMiddleware');
const { adminLoginLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const { adminLoginValidators, changePasswordValidators } = require('../validators/adminValidators');
const { login, logout, me, changePassword } = require('../controllers/adminAuthController');

const router = express.Router();

router.post('/login', adminLoginLimiter, adminLoginValidators, validate, login);
router.post('/logout', logout);

// No requirePasswordChanged here: these are exactly the routes an admin on
// a temporary password still needs.
router.get('/me', protectAdmin, me);
router.post('/change-password', protectAdmin, changePasswordValidators, validate, changePassword);

module.exports = router;
