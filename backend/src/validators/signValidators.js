const { body, param, header } = require('express-validator');
const { GENERIC, numberInRange, strictBoolean } = require('./common');

const startSessionValidators = [
  body('language').isString().withMessage(GENERIC).bail().isIn(['fsl', 'asl']).withMessage(GENERIC),
  body('unit').isString().withMessage(GENERIC).bail().isIn(['words', 'letters']).withMessage(GENERIC),
  numberInRange('minConfidence', 0.05, 0.99).optional(),
  strictBoolean('flip').optional(),
];

// Session ids are made by the AI service: 32 hex characters.
const sessionIdRule = param('id').matches(/^[a-f0-9]{32}$/).withMessage('Sign language stopped. Please start it again.');

const sessionIdValidators = [sessionIdRule];

// Each video piece says when (on the phone's clock, in ms) it started
// recording and which piece it is, so the AI service can stitch the pieces
// into one continuous stream and spot signs that cross from one to the next.
const chunkValidators = [
  sessionIdRule,
  header('x-chunk-start').matches(/^\d{10,15}$/).withMessage(GENERIC),
  header('x-chunk-index').matches(/^\d{1,6}$/).withMessage(GENERIC),
  header('x-chunk-final').optional().isIn(['0', '1']).withMessage(GENERIC),
];

module.exports = { startSessionValidators, sessionIdValidators, chunkValidators };
