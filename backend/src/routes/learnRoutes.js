const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { syncLearnValidators } = require('../validators/learnValidators');
const { syncCompletions, getProgress, getLeaderboard } = require('../controllers/learnController');

// Learn, the sign-language course (see controllers/learnController.js).
router.use(protect);

router.post('/sync', syncLearnValidators, validate, syncCompletions);
router.get('/progress', getProgress);
router.get('/leaderboard', getLeaderboard);

module.exports = router;
