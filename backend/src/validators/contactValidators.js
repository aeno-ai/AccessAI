const { body, param } = require('express-validator');

const PHONE_REGEX = /^[+]?[\d\s()-]{7,20}$/;

const createContactValidators = [
  body('name').isString().trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('phoneNumber')
    .isString()
    .withMessage('Phone number is required')
    .bail()
    .trim()
    .matches(PHONE_REGEX)
    .withMessage('Enter a valid phone number'),
  body('relationship').optional().isString().trim().isLength({ max: 50 }),
  body('email').optional().isString().trim().isEmail().withMessage('Enter a valid email').normalizeEmail(),
];

// Update allows any subset of the same fields, so nothing is required here —
// but whatever IS sent still has to be well-formed.
const updateContactValidators = [
  param('id').isMongoId().withMessage('Invalid contact id'),
  body('name').optional().isString().trim().notEmpty().isLength({ max: 100 }),
  body('phoneNumber').optional().isString().trim().matches(PHONE_REGEX).withMessage('Enter a valid phone number'),
  body('relationship').optional().isString().trim().isLength({ max: 50 }),
  body('email').optional().isString().trim().isEmail().withMessage('Enter a valid email').normalizeEmail(),
];

const contactIdValidators = [param('id').isMongoId().withMessage('Invalid contact id')];

module.exports = { createContactValidators, updateContactValidators, contactIdValidators };
