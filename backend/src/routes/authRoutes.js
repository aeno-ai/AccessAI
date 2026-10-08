const express = require('express');
const protect = require('../middleware/authMiddleware');
const { authLimiter, emailCodeLimiter, codeCheckLimiter } = require('../middleware/rateLimiter'); // this makes login and register have limits to prevent brute force attacks
const validate = require('../middleware/validate');
const {
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
} = require('../validators/authValidators');
const {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  restore,
  getMe,
  updateMe,
  sendDeletionCode,
  requestDeletion,
} = require('../controllers/authController');
const {
  googleStart,
  googleAuthorize,
  googleCallback,
  googleExchange,
  googleComplete,
  googleRestore,
} = require('../controllers/googleAuthController');

const router = express.Router();

router.post('/register', authLimiter, registerValidators, validate, register);
router.post('/login', authLimiter, loginValidators, validate, login);

// New sign-ups enter the code emailed to them before they can log in.
router.post('/verify-email', codeCheckLimiter, verifyEmailValidators, validate, verifyEmail);
router.post('/resend-verification', emailCodeLimiter, emailOnlyValidators, validate, resendVerification);

// "Forgot password": email a code, then trade it for a new password.
router.post('/forgot-password', emailCodeLimiter, emailOnlyValidators, validate, forgotPassword);
router.post('/reset-password', codeCheckLimiter, resetPasswordValidators, validate, resetPassword);

// Cancels a pending account deletion. Checks email + password like login,
// so it gets login's rate limit too.
router.post('/restore', authLimiter, loginValidators, validate, restore);

// "Continue with Google" — see controllers/googleAuthController.js. The
// first three are opened in a browser, not called by the app. None needs
// its own rate limit: the browser ones only redirect, and the rest take a
// signed ticket that can't be guessed.
router.get('/google/start', googleStart);
router.get('/google/authorize', googleAuthorize);
router.get('/google/callback', googleCallback);
router.post('/google/exchange', googleExchangeValidators, validate, googleExchange);
router.post('/google/complete', googleCompleteValidators, validate, googleComplete);
router.post('/google/restore', googleRestoreValidators, validate, googleRestore);

router.get('/me', protect, getMe);

// "Edit profile". Answers with a fresh login token, because the app reads
// the first name for its greeting straight from the token (so it shows
// offline too).
router.patch('/me', protect, updateMeValidators, validate, updateMe);

// For accounts with no password (created with Google): emails the code
// that DELETE /me then asks for instead.
router.post('/me/deletion-code', emailCodeLimiter, protect, sendDeletionCode);

// Schedules the account for deletion. Takes the password, so it's rate
// limited like login to stop a stolen token being used to guess it.
router.delete('/me', authLimiter, protect, deleteAccountValidators, validate, requestDeletion);

module.exports = router;
