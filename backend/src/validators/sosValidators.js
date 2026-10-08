const { body, param } = require('express-validator');
const { GENERIC, strictBoolean, numberInRange } = require('./common');

const triggerSosValidators = [
  // Free text on purpose (see models/SOSEvent.js), but short.
  body('triggerMethod').isString().withMessage(GENERIC).bail().trim().notEmpty().withMessage(GENERIC).isLength({ max: 30 }).withMessage(GENERIC),
  body('location').optional().isObject().withMessage(GENERIC),
  numberInRange('location.latitude', -90, 90).optional(),
  numberInRange('location.longitude', -180, 180).optional(),
  body('place').optional().isString().withMessage(GENERIC).bail().trim().isLength({ max: 200 }).withMessage(GENERIC),
  body('message')
    .optional()
    .isString()
    .withMessage(GENERIC)
    .bail()
    .trim()
    .isLength({ max: 500 })
    .withMessage('The SOS message can be up to 500 characters'),
  strictBoolean('silentMode').optional(),
  strictBoolean('isTest').optional(),
];

const sosIdValidators = [param('id').isMongoId().withMessage('That SOS is no longer active.')];

// The sender's phone sharing where they are now (every ~30 s for 30 min).
const locationValidators = [
  ...sosIdValidators,
  numberInRange('latitude', -90, 90),
  numberInRange('longitude', -180, 180),
  numberInRange('accuracy', 0, 100000).optional(),
];

// A friend answering an SOS: "I've seen it" or "I'm on my way".
const respondValidators = [
  ...sosIdValidators,
  body('kind').isString().withMessage(GENERIC).bail().isIn(['seen', 'on_my_way']).withMessage(GENERIC),
];

module.exports = { triggerSosValidators, sosIdValidators, locationValidators, respondValidators };
