const { body, param, query } = require('express-validator');
const { GENERIC } = require('./common');

const friendIdRule = param('friendId').isMongoId().withMessage("That friend couldn't be found.");

// A whole number of milliseconds, sent by the app (never typed by a person).
// not().isArray() first: ?after=1&after=2 would otherwise pass item by item.
const timeQuery = (field, options) =>
  query(field).optional().not().isArray().withMessage(GENERIC).bail().isInt(options).withMessage(GENERIC);

const listMessagesValidators = [friendIdRule, timeQuery('after', { min: 0 }), timeQuery('limit', { min: 1, max: 200 })];

const sendMessageValidators = [
  friendIdRule,
  body('clientId').isString().withMessage(GENERIC).bail().trim().notEmpty().withMessage(GENERIC).isLength({ max: 100 }).withMessage(GENERIC),
  body('body')
    .isString()
    .withMessage('A message is required')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('A message is required')
    .isLength({ max: 2000 })
    .withMessage('Messages can be up to 2000 characters'),
  body('createdAt').not().isArray().withMessage(GENERIC).bail().isInt({ min: 0 }).withMessage(GENERIC),
];

const markReadValidators = [friendIdRule];

module.exports = { listMessagesValidators, sendMessageValidators, markReadValidators };
