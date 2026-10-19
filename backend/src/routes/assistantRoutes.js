const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { assistantLimiter } = require('../middleware/rateLimiter');
const { interpretValidators, polishValidators } = require('../validators/assistantValidators');
const { interpret, polish } = require('../controllers/assistantController');

// Laya, the voice assistant (see the app's src/laya/ and the ai/ folder).
router.use(protect, assistantLimiter);

router.post('/interpret', interpretValidators, validate, interpret);
router.post('/polish', polishValidators, validate, polish);

module.exports = router;
