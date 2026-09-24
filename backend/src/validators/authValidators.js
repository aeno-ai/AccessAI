const { body } = require('express-validator');

// Same password rule the controller used to enforce by hand — now declared
// once, up front, before the request ever reaches register(). A function of
// the field name so the admin panel's forms (newPassword, temporary
// passwords) enforce exactly the same rule.
const strongPassword = (field) =>
  body(field)
    .isString()
    .withMessage('Password is required')
    .bail()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/\d/)
    .withMessage('Password must contain at least one number');

const passwordRules = strongPassword('password');

const nameRules = (field, label) =>
  body(field)
    .isString()
    .withMessage(`${label} is required`)
    .bail()
    .trim()
    .notEmpty()
    .withMessage(`${label} is required`)
    .isLength({ max: 30 })
    .withMessage(`${label} must be 30 characters or fewer`);

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
  nameRules('firstName', 'First name'),
  nameRules('lastName', 'Last name'),
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

module.exports = { registerValidators, loginValidators, strongPassword };
