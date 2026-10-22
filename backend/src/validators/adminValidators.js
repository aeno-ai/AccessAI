const { body, param, query } = require('express-validator');
const { ADMIN_ROLES } = require('../constants/adminRoles');
const { strongPassword } = require('./authValidators');
const { GENERIC, strictBoolean } = require('./common');
const { ACTIVITY_TYPES } = require('../models/UserActivity');
const { manilaDayStart } = require('../utils/dateRange');

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

// ?page= and ?limit=, as numbers (read through matchedData).
const pageRules = () => [
  singleQuery('page').isInt({ min: 1, max: 10000 }).withMessage(GENERIC).toInt(),
  singleQuery('limit').isInt({ min: 1, max: 50 }).withMessage(GENERIC).toInt(),
];

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
  // 'inactive' is the old name for 'deactivated'.
  singleQuery('status').isIn(['active', 'suspended', 'deleting', 'deactivated', 'inactive']).withMessage(GENERIC),
  ...pageRules(),
];

const userIdValidators = [idParam];

// Only reactivating an old deactivated account (HANDOFF.md §42).
const userStatusValidators = [
  idParam,
  strictBoolean('isActive')
    .bail()
    .custom((value) => value === true)
    .withMessage('To lock an account, use Suspend or Delete in 30 days.'),
];

// Shown to the person when they try to log in, so it's required.
const reasonRule = () =>
  body('reason')
    .isString()
    .withMessage('Write the reason.')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Write the reason.')
    .isLength({ max: 300 })
    .withMessage('Keep the reason to 300 characters or fewer.');

const suspendValidators = [
  idParam,
  body('days')
    .custom((value) => [1, 7, 30].includes(value))
    .withMessage('Choose 1, 7 or 30 days.'),
  reasonRule(),
];

const deletionValidators = [idParam, reasonRule()];

const userRecordsValidators = [idParam, ...pageRules()];

// ============== /api/admin/activity, /sos, /review, /audit, /dashboard ==============

// From/to days (YYYY-MM-DD, Manila days, both included; HANDOFF.md §52).
const dayRules = () => [
  singleQuery('from').custom((value) => manilaDayStart(value) !== null).withMessage('Pick a valid start date'),
  singleQuery('to').custom((value) => manilaDayStart(value) !== null).withMessage('Pick a valid end date'),
  query().custom((value) => !value?.from || !value?.to || value.from <= value.to).withMessage('The start date must be on or before the end date'),
];

const activityListValidators = [
  singleQuery('type').isIn(ACTIVITY_TYPES).withMessage(GENERIC),
  singleQuery('ip').trim().isLength({ min: 1, max: 100 }).withMessage(GENERIC),
  ...dayRules(),
  ...pageRules(),
];

const sosListValidators = [
  singleQuery('kind').isIn(['real', 'test']).withMessage(GENERIC),
  singleQuery('unanswered').isIn(['true', 'false']).withMessage(GENERIC),
  ...dayRules(),
  ...pageRules(),
];

// The admin log (super admins only).
const auditListValidators = [
  singleQuery('action').trim().isLength({ min: 1, max: 100 }).withMessage(GENERIC),
  singleQuery('adminId').isMongoId().withMessage(GENERIC),
  singleQuery('success').isIn(['true', 'false']).withMessage(GENERIC),
  ...dayRules(),
  ...pageRules(),
];

const dashboardValidators = [singleQuery('range').isIn(['24h', '7d', '30d', '90d']).withMessage(GENERIC)];

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
  suspendValidators,
  deletionValidators,
  userRecordsValidators,
  activityListValidators,
  sosListValidators,
  auditListValidators,
  dashboardValidators,
  createAdminValidators,
  updateAdminValidators,
  resetAdminPasswordValidators,
};
