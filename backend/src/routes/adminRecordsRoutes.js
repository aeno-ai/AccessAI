const express = require('express');
const { PERMISSIONS } = require('../constants/adminRoles');
const {
  protectAdmin,
  requirePasswordChanged,
  requirePermission,
} = require('../middleware/adminAuthMiddleware');
const validate = require('../middleware/validate');
const {
  activityListValidators,
  sosListValidators,
  auditListValidators,
  dashboardValidators,
} = require('../validators/adminValidators');
const {
  listActivity,
  listSos,
  reviewList,
  listAudit,
  exportActivity,
  exportSos,
  exportReview,
  exportAudit,
} = require('../controllers/adminRecordsController');
const { getDashboard } = require('../controllers/adminDashboardController');

// Mounted at /api/admin. The checks are on each route (not router.use), so
// this router never answers for the other /api/admin paths.
const router = express.Router();
const admin = [protectAdmin, requirePasswordChanged];
const activityRead = requirePermission(PERMISSIONS.ACTIVITY_READ);
const sosRead = requirePermission(PERMISSIONS.SOS_READ);
const auditRead = requirePermission(PERMISSIONS.AUDIT_READ);

// The dashboard: every log as numbers over time (HANDOFF.md §52).
router.get('/dashboard', ...admin, activityRead, sosRead, dashboardValidators, validate, getDashboard);

// Everyone's login and activity records, newest first (HANDOFF.md §41).
router.get('/activity', ...admin, activityRead, activityListValidators, validate, listActivity);
router.get('/activity/export.csv', ...admin, activityRead, activityListValidators, validate, exportActivity);

// Every SOS — never the place, location or message (§43).
router.get('/sos', ...admin, sosRead, sosListValidators, validate, listSos);
router.get('/sos/export.csv', ...admin, sosRead, sosListValidators, validate, exportSos);

// Suspicious Activities: accounts and addresses with warning signs in the
// last 24 hours (§43, renamed in §52).
router.get('/review', ...admin, activityRead, sosRead, reviewList);
router.get('/review/export.csv', ...admin, activityRead, sosRead, exportReview);

// The admin log: every admin login and action (super admins only, §52).
router.get('/audit', ...admin, auditRead, auditListValidators, validate, listAudit);
router.get('/audit/export.csv', ...admin, auditRead, auditListValidators, validate, exportAudit);

module.exports = router;
