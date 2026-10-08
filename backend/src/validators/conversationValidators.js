const { body, param } = require('express-validator');
const { GENERIC } = require('./common');

// Conversations are synced by the app in the background, so none of these
// fields are typed by a person: anything wrong here means a buggy or
// tampered client, and gets the plain GENERIC message.
const shortText = (chain, max) =>
  chain.isString().withMessage(GENERIC).bail().trim().notEmpty().withMessage(GENERIC).isLength({ max }).withMessage(GENERIC);

const syncConversationValidators = [
  shortText(body('clientId'), 100),
  shortText(body('title'), 200),
  shortText(body('mode'), 50),
  body('messages').isArray().withMessage(GENERIC),
  shortText(body('messages.*.clientId'), 100),
  body('messages.*.sender').isString().withMessage(GENERIC).bail().isIn(['me', 'them']).withMessage(GENERIC),
  body('messages.*.body')
    .isString()
    .withMessage(GENERIC)
    .bail()
    .trim()
    .notEmpty()
    .withMessage(GENERIC)
    .isLength({ max: 2000 })
    .withMessage('Messages can be up to 2000 characters'),
  body('messages.*.createdAt').not().isArray().withMessage(GENERIC).bail().isInt({ min: 0 }).withMessage(GENERIC),
];

const conversationClientIdValidators = [shortText(param('clientId'), 100)];

module.exports = { syncConversationValidators, conversationClientIdValidators };
