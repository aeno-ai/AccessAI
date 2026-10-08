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

// normalizeEmail() is what every lookup relies on: an email is always
// stored and searched for in this one form. utils/googleOAuth.js
// normalizes Google's emails with the same function.
const emailRules = body('email')
  .isString()
  .withMessage('Email is required')
  .bail()
  .trim()
  .isEmail()
  .withMessage('A valid email is required')
  .normalizeEmail();

// The 6-digit codes from utils/emailCodes.js.
const codeRules = (field = 'code') =>
  body(field)
    .isString()
    .withMessage('Enter the 6-digit code from the email')
    .bail()
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('Enter the 6-digit code from the email');

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

// Everything sign-up asks besides email and password — shared by the
// email/password form and "Continue with Google".
const profileAndConsentRules = [
  nameRules('firstName', 'First name'),
  nameRules('lastName', 'Last name'),
  body('role')
    .isString()
    .withMessage('Choose whether this account is for a PWD or not')
    .bail()
    .isIn(['pwd', 'non_pwd'])
    .withMessage('Choose whether this account is for a PWD or not'),
  // Strictly the boolean true — the strings "true" or "1" don't count as
  // agreeing to anything.
  body('acceptedTerms')
    .custom((value) => value === true)
    .withMessage('You must accept the Terms of Use and Privacy Notice'),
  body('pwdDeclaration')
    .if(body('role').equals('pwd'))
    .custom((value) => value === true)
    .withMessage('You must confirm the PWD declaration'),
];

const registerValidators = [emailRules, passwordRules, ...profileAndConsentRules];

const loginValidators = [
  emailRules,
  body('password').isString().withMessage('Password is required').bail().notEmpty().withMessage('Password is required'),
];

// For endpoints that only take an email: resending a verification code
// and "Forgot password".
const emailOnlyValidators = [emailRules];

const verifyEmailValidators = [emailRules, codeRules()];

const resetPasswordValidators = [emailRules, codeRules(), passwordRules];

// Asking to delete an account needs the password again (or, for accounts
// with no password, an emailed code), so a phone left unlocked can't be
// used to do it. Which one is required depends on the account, so the
// controller checks that; these only make sure whatever was sent is sane.
const deleteAccountValidators = [
  body('password').optional().isString().withMessage('Password is required'),
  codeRules().optional(),
];

// The signed tickets "Continue with Google" passes around (see
// controllers/googleAuthController.js). Their contents are checked by
// verifyTicket; this only makes sure it's a string.
const ticketRules = (field) =>
  body(field).isString().withMessage('Your Google sign-in has expired. Please continue with Google again.');

const googleExchangeValidators = [ticketRules('ticket')];

const googleCompleteValidators = [ticketRules('signupTicket'), ...profileAndConsentRules];

const googleRestoreValidators = [ticketRules('restoreTicket')];

// "Edit profile" in the app. Same name rules as sign-up; the note friends
// see is optional and may be cleared with an empty string.
const updateMeValidators = [
  nameRules('firstName', 'First name'),
  nameRules('lastName', 'Last name'),
  body('friendNote')
    .optional()
    .isString()
    .withMessage('The note must be text')
    .bail()
    .trim()
    .isLength({ max: 80 })
    .withMessage('The note can be up to 80 characters'),
];

module.exports = {
  registerValidators,
  loginValidators,
  emailOnlyValidators,
  verifyEmailValidators,
  resetPasswordValidators,
  deleteAccountValidators,
  googleExchangeValidators,
  googleCompleteValidators,
  googleRestoreValidators,
  updateMeValidators,
  strongPassword,
};
