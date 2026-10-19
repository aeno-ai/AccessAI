const express = require('express');
const { PERMISSIONS } = require('../constants/adminRoles');
const {
  protectAdmin,
  requirePasswordChanged,
  requirePermission,
} = require('../middleware/adminAuthMiddleware');
const validate = require('../middleware/validate');
const { activityListValidators, sosListValidators } = require('../validators/adminValidators');
const { listActivity, listSos, reviewList } = require('../controllers/adminRecordsController');

// Mounted at /api/admin. The checks are on each route (not router.use), so
// this router never answers for the other /api/admin paths.
const router = express.Router();
const admin = [protectAdmin, requirePasswordChanged];

// Everyone's login and activity records, newest first (HANDOFF.md §41).
router.get('/activity', ...admin, requirePermission(PERMISSIONS.ACTIVITY_READ), activityListValidators, validate, listActivity);

// Every SOS — never the place, location or message (§43).
router.get('/sos', ...admin, requirePermission(PERMISSIONS.SOS_READ), sosListValidators, validate, listSos);

// "Needs a look": accounts showing warning signs in the last 24 hours.
router.get(
  '/review',
  ...admin,
  requirePermission(PERMISSIONS.ACTIVITY_READ),
  requirePermission(PERMISSIONS.SOS_READ),
  reviewList,
);

module.exports = router;
