const { body } = require('express-validator');

// Same password rule the controller used to enforce by hand — now declared
// once, up front, before the request ever reaches register().
const passwordRules = body('password')
  .isString()
  .withMessage('Password is required')
  .bail()
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters long')
  .matches(/[A-Z]/)
  .withMessage('Password must contain at least one uppercase letter')
  .matches(/\d/)
  .withMessage('Password must contain at least one number');

const registerValidators = [
  body('email')
    .isString()
    .withMessage('Email is required')
    .bail()
    .trim()
    .isEmail()
    .withMessage('A valid email is required')
    .normalizeEmail(),
  passwordRules,
  body('name')
    .isString()
    .withMessage('Name is required')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Name must be 100 characters or fewer'),
  body('role')
    .isIn(['pwd', 'non_pwd'])
    .withMessage('Role must be either "pwd" or "non_pwd"'),
];

const loginValidators = [
  body('email')
    .isString()
    .withMessage('Email is required')
    .bail()
    .trim()
    .isEmail()
    .withMessage('A valid email is required')
    .normalizeEmail(),
  body('password').isString().withMessage('Password is required').bail().notEmpty().withMessage('Password is required'),
];

module.exports = { registerValidators, loginValidators };
