const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { pushLimiter } = require('../middleware/rateLimiter');
const { registerTokenValidators, removeTokenValidators } = require('../validators/pushValidators');
const { registerToken, removeToken } = require('../controllers/pushController');

router.use(protect, pushLimiter);

router.put('/token', registerTokenValidators, validate, registerToken);
router.delete('/token', removeTokenValidators, validate, removeToken);

module.exports = router;
