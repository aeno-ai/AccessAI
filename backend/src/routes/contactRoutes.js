const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const {
  createContactValidators,
  updateContactValidators,
  contactIdValidators,
} = require('../validators/contactValidators');
const { createContact, getContacts, updateContact, deleteContact } = require('../controllers/contactController');

router.use(protect); // applies to every route below, instead of repeating it 4 times

router.post('/', createContactValidators, validate, createContact);
router.get('/', getContacts);
router.put('/:id', updateContactValidators, validate, updateContact);
router.delete('/:id', contactIdValidators, validate, deleteContact);

module.exports = router;