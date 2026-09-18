const express = require('express');
const protect = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter'); // this makes login and register have limits to prevent brute force attacks
const validate = require('../middleware/validate');
const { registerValidators, loginValidators } = require('../validators/authValidators');
const { register, login } = require('../controllers/authController');

const router = express.Router();

router.post('/register', authLimiter, registerValidators, validate, register);
router.post('/login', authLimiter, loginValidators, validate, login);

router.get('/me', protect, (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
    message: 'You are authenticated'
  });

});

module.exports = router;