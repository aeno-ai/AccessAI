const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { triggerSOS, resolveSOS } = require('../controllers/sosController');

router.use(protect);

router.post('/trigger', triggerSOS);
router.patch('/:id/resolve', resolveSOS);

module.exports = router;