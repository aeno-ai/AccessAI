const { body } = require('express-validator');
const { GENERIC } = require('./common');

// Speech recognizers sometimes return odd invisible characters; they mean
// nothing and could confuse the AI, so they're removed before checking.
// (Control characters, zero-width marks and line/paragraph separators.)
const isInvisible = (code) =>
  code <= 0x1f || (code >= 0x7f && code <= 0x9f) || (code >= 0x200b && code <= 0x200f) || (code >= 0x2028 && code <= 0x202e);
const stripControl = (value) =>
  typeof value === 'string' ? Array.from(value, (char) => (isInvisible(char.codePointAt(0)) ? ' ' : char)).join('') : value;

const spokenText = (field, max) =>
  body(field)
    .isString()
    .withMessage(GENERIC)
    .bail()
    .customSanitizer(stripControl)
    .trim()
    .isLength({ min: 1, max })
    .withMessage(`That's too long for Accel. Please say it in fewer words.`);

// What Accel heard, and which screen the person was on.
const interpretValidators = [
  spokenText('text', 300),
  body('screen').optional().isString().withMessage(GENERIC).bail().isLength({ max: 100 }).withMessage(GENERIC),
];

// Tidying a message before it's sent: 'message' fixes grammar; 'gloss'
// turns sign-language words ("ME GO STORE TOMORROW") into a sentence.
const polishValidators = [
  spokenText('text', 500),
  body('kind').isString().withMessage(GENERIC).bail().isIn(['message', 'gloss']).withMessage(GENERIC),
  body('language').optional().isString().withMessage(GENERIC).bail().isIn(['en', 'fil', 'fsl', 'asl', 'auto']).withMessage(GENERIC),
];

module.exports = { interpretValidators, polishValidators };
