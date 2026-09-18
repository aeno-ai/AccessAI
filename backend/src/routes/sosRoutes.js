const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { triggerSosValidators, sosIdValidators } = require('../validators/sosValidators');
const { triggerSOS, resolveSOS } = require('../controllers/sosController');

router.use(protect);

router.post('/trigger', triggerSosValidators, validate, triggerSOS);
router.patch('/:id/resolve', sosIdValidators, validate, resolveSOS);

module.exports = router;