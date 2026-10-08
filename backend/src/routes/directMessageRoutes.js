const express = require('express');
const protect = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { messageLimiter } = require('../middleware/rateLimiter');
const {
  listMessagesValidators,
  sendMessageValidators,
  markReadValidators,
} = require('../validators/messageValidators');
const { listMessages, sendMessage, markRead } = require('../controllers/directMessageController');

const router = express.Router();

// Chat needs more requests than the general limit allows, so it has its own
// (roomier) limit instead — see middleware/rateLimiter.js.
router.use(messageLimiter, protect);

router.get('/:friendId', listMessagesValidators, validate, listMessages);
router.post('/:friendId', sendMessageValidators, validate, sendMessage);
router.post('/:friendId/read', markReadValidators, validate, markRead);

module.exports = router;
