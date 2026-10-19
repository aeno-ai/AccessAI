const express = require('express');
const { PERMISSIONS } = require('../constants/adminRoles');
const {
  protectAdmin,
  requirePasswordChanged,
  requirePermission,
} = require('../middleware/adminAuthMiddleware');
const validate = require('../middleware/validate');
const {
  userListValidators,
  userIdValidators,
  userStatusValidators,
  suspendValidators,
  deletionValidators,
  userRecordsValidators,
} = require('../validators/adminValidators');
const {
  listUsers,
  getUser,
  updateUserStatus,
  suspendUser,
  liftSuspension,
  scheduleDeletion,
  cancelDeletion,
} = require('../controllers/adminUserController');
const { getUserActivity, getUserSos } = require('../controllers/adminRecordsController');

const router = express.Router();

router.use(protectAdmin, requirePasswordChanged);

router.get('/', requirePermission(PERMISSIONS.USERS_READ), userListValidators, validate, listUsers);
router.get('/:id', requirePermission(PERMISSIONS.USERS_READ), userIdValidators, validate, getUser);

// Only turns an old deactivated account back on (HANDOFF.md §42).
router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.USERS_UPDATE),
  userStatusValidators,
  validate,
  updateUserStatus,
);

// Suspend for 1, 7 or 30 days / lift it.
router.post('/:id/suspend', requirePermission(PERMISSIONS.USERS_SUSPEND), suspendValidators, validate, suspendUser);
router.delete('/:id/suspend', requirePermission(PERMISSIONS.USERS_SUSPEND), userIdValidators, validate, liftSuspension);

// Delete in 30 days / cancel that — super admins only.
router.post('/:id/deletion', requirePermission(PERMISSIONS.USERS_DELETE), deletionValidators, validate, scheduleDeletion);
router.delete('/:id/deletion', requirePermission(PERMISSIONS.USERS_DELETE), userIdValidators, validate, cancelDeletion);

// One person's login/activity records and SOS records (never the place,
// location or message). Opening them is recorded in the audit log.
router.get('/:id/activity', requirePermission(PERMISSIONS.ACTIVITY_READ), userRecordsValidators, validate, getUserActivity);
router.get('/:id/sos', requirePermission(PERMISSIONS.SOS_READ), userRecordsValidators, validate, getUserSos);

module.exports = router;
