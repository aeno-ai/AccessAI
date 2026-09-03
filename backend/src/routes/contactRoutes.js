const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { createContact, getContacts, updateContact, deleteContact } = require('../controllers/contactController');

router.use(protect); // applies to every route below, instead of repeating it 4 times

router.post('/', createContact);
router.get('/', getContacts);
router.put('/:id', updateContact);
router.delete('/:id', deleteContact);

module.exports = router;