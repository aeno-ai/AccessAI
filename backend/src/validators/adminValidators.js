const { body, param, query } = require('express-validator');
const { ADMIN_ROLES } = require('../constants/adminRoles');
const { strongPassword } = require('./authValidators');
const { GENERIC, strictBoolean } = require('./common');

const emailRules = (field = 'email') =>
  body(field)
    .isString()
    .withMessage('Email is required')
    .bail()
    .trim()
    .isEmail()
    .withMessage('A valid email is required')
    .normalizeEmail();

const idParam = param('id').isMongoId().withMessage("That account couldn't be found.");

// A single query value — ?role=pwd&role=non_pwd arrives as an array, and
// isIn/isInt would otherwise check it item by item.
const singleQuery = (field) => query(field).optional().isString().withMessage(GENERIC).bail();

// ============== /api/admin/auth ==============

const adminLoginValidators = [
  emailRules(),
  body('password')
    .isString()
    .withMessage('Password is required')
    .bail()
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ max: 200 })
    .withMessage('Password is too long'),
];

const changePasswordValidators = [
  body('currentPassword')
    .isString()
    .withMessage('Current password is required')
    .bail()
    .notEmpty()
    .withMessage('Current password is required'),
  strongPassword('newPassword')
    .custom((value, { req }) => value !== req.body.currentPassword)
    .withMessage('New password must be different from your current password'),
];

// ============== /api/admin/users ==============

// Query values are read in the controller through matchedData(), which
// returns these sanitized versions (e.g. page as a number, not a string).
const userListValidators = [
  query('search').optional().isString().trim().isLength({ max: 100 }).withMessage('Search is too long'),
  singleQuery('role').isIn(['pwd', 'non_pwd']).withMessage(GENERIC),
  singleQuery('status').isIn(['active', 'inactive']).withMessage(GENERIC),
  singleQuery('page').isInt({ min: 1, max: 10000 }).withMessage(GENERIC).toInt(),
  singleQuery('limit').isInt({ min: 1, max: 50 }).withMessage(GENERIC).toInt(),
];

const userIdValidators = [idParam];

const userStatusValidators = [idParam, strictBoolean('isActive')];

// ============== /api/admin/admins ==============

const createAdminValidators = [
  emailRules(),
  body('name')
    .isString()
    .withMessage('Name is required')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Name must be 100 characters or fewer'),
  body('role').isString().withMessage('Choose a role').bail().isIn(ADMIN_ROLES).withMessage('Choose a role'),
  strongPassword('password'),
];

const updateAdminValidators = [
  idParam,
  body('role').optional().isString().withMessage('Choose a role').bail().isIn(ADMIN_ROLES).withMessage('Choose a role'),
  strictBoolean('isActive').optional(),
  body()
    .custom((value) => value?.role !== undefined || value?.isActive !== undefined)
    .withMessage('Nothing to update'),
];

const resetAdminPasswordValidators = [idParam, strongPassword('password')];

module.exports = {
  adminLoginValidators,
  changePasswordValidators,
  userListValidators,
  userIdValidators,
  userStatusValidators,
  createAdminValidators,
  updateAdminValidators,
  resetAdminPasswordValidators,
};
