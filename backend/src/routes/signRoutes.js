const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { signLimiter } = require('../middleware/rateLimiter');
const { startSessionValidators, sessionIdValidators, chunkValidators } = require('../validators/signValidators');
const { listModels, startSession, sendChunk, stopSession } = require('../controllers/signController');

router.use(protect, signLimiter);

router.get('/models', listModels);
router.post('/session', startSessionValidators, validate, startSession);
// The video piece arrives as raw bytes (not JSON). 8 MB is far more than a
// 2-second 480p clip needs.
router.post(
  '/session/:id/chunk',
  express.raw({ type: () => true, limit: '8mb' }),
  chunkValidators,
  validate,
  sendChunk,
);
router.delete('/session/:id', sessionIdValidators, validate, stopSession);

module.exports = router;
