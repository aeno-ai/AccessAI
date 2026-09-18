const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { syncConversationValidators } = require('../validators/conversationValidators');
const { syncConversation } = require('../controllers/conversationController');

router.use(protect);

router.post('/sync', syncConversationValidators, validate, syncConversation);

module.exports = router;
