const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const {
  syncConversationValidators,
  conversationClientIdValidators,
} = require('../validators/conversationValidators');
const { syncConversation, deleteConversation } = require('../controllers/conversationController');

router.use(protect);

router.post('/sync', syncConversationValidators, validate, syncConversation);
router.delete('/:clientId', conversationClientIdValidators, validate, deleteConversation);

module.exports = router;
