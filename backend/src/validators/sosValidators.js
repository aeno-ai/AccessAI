const { body, param } = require('express-validator');
const { GENERIC, strictBoolean, numberInRange } = require('./common');

// An SOS saved on the phone while offline is still sent up to this long after.
const MAX_OFFLINE_AGE_MS = 2 * 60 * 60 * 1000;

const triggerSosValidators = [
  // Free text on purpose (see models/SOSEvent.js), but short.
  body('triggerMethod').isString().withMessage(GENERIC).bail().trim().notEmpty().withMessage(GENERIC).isLength({ max: 30 }).withMessage(GENERIC),
  body('location').optional().isObject().withMessage(GENERIC),
  numberInRange('location.latitude', -90, 90).optional(),
  numberInRange('location.longitude', -180, 180).optional(),
  // How exact the phone's GPS was, in meters.
  numberInRange('location.accuracy', 0, 100000).optional(),
  // An SOS made offline and sent when the phone is back online: when it
  // really happened. Not in the future, and at most 2 hours old.
  body('occurredAt')
    .optional()
    .isISO8601()
    .withMessage(GENERIC)
    .bail()
    .custom((value) => {
      const age = Date.now() - Date.parse(value);
      if (age < -60 * 1000) throw new Error(GENERIC);
      if (age > MAX_OFFLINE_AGE_MS) throw new Error('This SOS is too old to send now.');
      return true;
    }),
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
  // The readable place, once the sender's phone has looked it up.
  body('place').optional().isString().withMessage(GENERIC).bail().trim().isLength({ max: 200 }).withMessage(GENERIC),
];

// A friend answering an SOS: "I've seen it" or "I'm on my way".
const respondValidators = [
  ...sosIdValidators,
  body('kind').isString().withMessage(GENERIC).bail().isIn(['seen', 'on_my_way']).withMessage(GENERIC),
];

module.exports = { triggerSosValidators, sosIdValidators, locationValidators, respondValidators };
