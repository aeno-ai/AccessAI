const { body } = require('express-validator');
const { GENERIC, numberInRange } = require('./common');

// Completions are sent by the app in the background, so nothing here is
// typed by a person: anything wrong means a buggy or tampered client.
const EARLIEST = Date.UTC(2026, 0, 1); // Learn didn't exist before this
const FUTURE_SLACK_MS = 10 * 60 * 1000; // phones' clocks drift a little

const text = (chain, max) =>
  chain.isString().withMessage(GENERIC).bail().trim().notEmpty().withMessage(GENERIC).isLength({ max }).withMessage(GENERIC);

const syncLearnValidators = [
  body('completions').isArray({ min: 1, max: 200 }).withMessage(GENERIC),
  text(body('completions.*.clientId'), 100),
  body('completions.*.course').isString().withMessage(GENERIC).bail().isIn(['fsl', 'asl']).withMessage(GENERIC),
  text(body('completions.*.lessonId'), 80)
    .matches(/^(fsl|asl)-[a-z0-9-]+$/)
    .withMessage(GENERIC),
  // Only sent by app versions from before Learn stopped keeping score (2026-10-17).
  numberInRange('completions.*.xp', 0, 30).optional(),
  numberInRange('completions.*.mistakes', 0, 50),
  numberInRange('completions.*.cameraPassed', 0, 10),
  // The phone's time in ms; not before Learn existed, not in the future.
  body('completions.*.completedAt')
    .custom((value) => Number.isInteger(value) && value >= EARLIEST && value <= Date.now() + FUTURE_SLACK_MS)
    .withMessage(GENERIC),
];

module.exports = { syncLearnValidators };
