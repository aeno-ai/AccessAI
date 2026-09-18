const { body } = require('express-validator');

const syncConversationValidators = [
  body('clientId').isString().trim().notEmpty().withMessage('clientId is required').isLength({ max: 100 }),
  body('title').isString().trim().notEmpty().withMessage('title is required').isLength({ max: 200 }),
  body('mode').isString().trim().notEmpty().withMessage('mode is required').isLength({ max: 50 }),
  body('messages').isArray().withMessage('messages must be an array'),
  body('messages.*.clientId')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('each message needs a clientId')
    .isLength({ max: 100 }),
  body('messages.*.sender').isIn(['me', 'them']).withMessage('sender must be "me" or "them"'),
  body('messages.*.body')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('message body is required')
    .isLength({ max: 2000 }),
  body('messages.*.createdAt').isInt({ min: 0 }).withMessage('message createdAt must be a timestamp'),
];

module.exports = { syncConversationValidators };
