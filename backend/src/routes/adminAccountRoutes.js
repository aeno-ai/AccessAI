const express = require('express');
const { PERMISSIONS } = require('../constants/adminRoles');
const {
  protectAdmin,
  requirePasswordChanged,
  requirePermission,
} = require('../middleware/adminAuthMiddleware');
const validate = require('../middleware/validate');
const {
  createAdminValidators,
  updateAdminValidators,
  resetAdminPasswordValidators,
} = require('../validators/adminValidators');
const {
  listAdmins,
  createAdmin,
  updateAdmin,
  resetAdminPassword,
} = require('../controllers/adminAccountController');

const router = express.Router();

router.use(protectAdmin, requirePasswordChanged);

router.get('/', requirePermission(PERMISSIONS.ADMINS_READ), listAdmins);
router.post('/', requirePermission(PERMISSIONS.ADMINS_MANAGE), createAdminValidators, validate, createAdmin);
router.patch('/:id', requirePermission(PERMISSIONS.ADMINS_MANAGE), updateAdminValidators, validate, updateAdmin);
router.post(
  '/:id/reset-password',
  requirePermission(PERMISSIONS.ADMINS_MANAGE),
  resetAdminPasswordValidators,
  validate,
  resetAdminPassword,
);

module.exports = router;
