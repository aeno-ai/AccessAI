const { body, param } = require('express-validator');

const PHONE_REGEX = /^[+]?[\d\s()-]{7,20}$/;
const CONTACT_NOT_FOUND = "That contact couldn't be found.";

const nameRule = () =>
  body('name')
    .isString()
    .withMessage('Name is required')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Names can be up to 100 characters');

const phoneRule = () =>
  body('phoneNumber')
    .isString()
    .withMessage('Phone number is required')
    .bail()
    .trim()
    .matches(PHONE_REGEX)
    .withMessage('Enter a valid phone number');

const relationshipRule = () =>
  body('relationship')
    .optional()
    .isString()
    .withMessage('Relationship must be text')
    .bail()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Relationship can be up to 50 characters');

const emailRule = () =>
  body('email')
    .optional()
    .isString()
    .withMessage('Enter a valid email')
    .bail()
    .trim()
    .isEmail()
    .withMessage('Enter a valid email')
    .normalizeEmail();

const createContactValidators = [nameRule(), phoneRule(), relationshipRule(), emailRule()];

// Update allows any subset of the same fields, so nothing is required here —
// but whatever IS sent still has to be well-formed.
const updateContactValidators = [
  param('id').isMongoId().withMessage(CONTACT_NOT_FOUND),
  nameRule().optional(),
  phoneRule().optional(),
  relationshipRule(),
  emailRule(),
];

const contactIdValidators = [param('id').isMongoId().withMessage(CONTACT_NOT_FOUND)];

module.exports = { createContactValidators, updateContactValidators, contactIdValidators };
