const { body, param } = require('express-validator');
const { strictBoolean } = require('./common');

// The controller normalizes the code itself ("abcd 2345" → "ABCD-2345");
// this only keeps out anything that isn't a short string.
const sendRequestValidators = [
  body('code').isString().withMessage('Enter a friend code').bail().trim().isLength({ min: 8, max: 12 }).withMessage('Enter a friend code like ABCD-2345'),
];

const requestIdValidators = [param('id').isMongoId().withMessage('That request is no longer there.')];

const friendIdValidators = [param('friendId').isMongoId().withMessage("That friend couldn't be found.")];

const sosCircleValidators = [...friendIdValidators, strictBoolean('inCircle')];

module.exports = { sendRequestValidators, requestIdValidators, friendIdValidators, sosCircleValidators };
