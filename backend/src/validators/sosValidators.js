const { body, param } = require('express-validator');

const triggerSosValidators = [
  body('triggerMethod').isString().trim().notEmpty().withMessage('triggerMethod is required'),
  body('location').optional().isObject().withMessage('location must be an object'),
  body('location.latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('latitude must be between -90 and 90'),
  body('location.longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('longitude must be between -180 and 180'),
  body('message').optional().isString().trim().isLength({ max: 500 }),
  body('silentMode').optional().isBoolean().withMessage('silentMode must be true or false'),
  body('isTest').optional().isBoolean().withMessage('isTest must be true or false'),
];

const sosIdValidators = [param('id').isMongoId().withMessage('Invalid SOS event id')];

module.exports = { triggerSosValidators, sosIdValidators };
