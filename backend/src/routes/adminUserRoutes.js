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
} = require('../validators/adminValidators');
const { listUsers, getUser, updateUserStatus } = require('../controllers/adminUserController');

const router = express.Router();

router.use(protectAdmin, requirePasswordChanged);

router.get('/', requirePermission(PERMISSIONS.USERS_READ), userListValidators, validate, listUsers);
router.get('/:id', requirePermission(PERMISSIONS.USERS_READ), userIdValidators, validate, getUser);
router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.USERS_UPDATE),
  userStatusValidators,
  validate,
  updateUserStatus,
);

module.exports = router;
