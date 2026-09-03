const EmergencyContact = require('../models/EmergencyContact');

const createContact = async (req, res) => {
  try {
    const contact = await EmergencyContact.create({ userId: req.user.userId, ...req.body });
    res.status(201).json(contact);
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong', error: error.message });
  }
};

const getContacts = async (req, res) => {
  try {
    const contacts = await EmergencyContact.find({ userId: req.user.userId });
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong', error: error.message });
  }
};

const updateContact = async (req, res) => {
  try {
    const contact = await EmergencyContact.findById(req.params.id);

    // Does a contact with this ID even exist?
    if (!contact) return res.status(404).json({ message: 'Contact not found' });

    // It exists — but does it actually belong to whoever's asking?
    // (protect already confirmed WHO they are — this checks WHAT they're allowed to touch.)
    if (contact.userId.toString() !== req.user.userId) {   
      return res.status(403).json({ message: 'Not authorized to edit this contact' });
    }

    // Both checks passed — safe to actually update.
    Object.assign(contact, req.body);
    await contact.save();
    res.json(contact);
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong. Cannot update contact.', error: error.message });
  }
};

const deleteContact = async (req, res) => {
  try {
    const contact = await EmergencyContact.findById(req.params.id);
    if (!contact) return res.status(404).json({ message: 'Contact not found' });
    if (contact.userId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this contact' });
    }
    await contact.deleteOne();
    res.json({ message: 'Contact deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong. Cannot delete contact.', error: error.message });
  }
};

module.exports = { createContact, getContacts, updateContact, deleteContact };