const EmergencyContact = require('../models/EmergencyContact');

// Only these fields may ever be set by a client. Never spread `req.body`
// directly into a create/update call — a stray `userId` key in the payload
// would otherwise silently override the trusted value below and let one
// user attribute a contact to someone else's account.
const CONTACT_FIELDS = ['name', 'phoneNumber', 'relationship', 'email'];

function pickContactFields(body) {
  const picked = {};
  for (const field of CONTACT_FIELDS) {
    if (body[field] !== undefined) {
      picked[field] = body[field];
    }
  }
  return picked;
}

const createContact = async (req, res, next) => {
  try {
    const contact = await EmergencyContact.create({
      userId: req.user.userId,
      ...pickContactFields(req.body),
    });
    res.status(201).json(contact);
  } catch (error) {
    next(error);
  }
};

const getContacts = async (req, res, next) => {
  try {
    const contacts = await EmergencyContact.find({ userId: req.user.userId });
    res.json(contacts);
  } catch (error) {
    next(error);
  }
};

const updateContact = async (req, res, next) => {
  try {
    const contact = await EmergencyContact.findById(req.params.id);

    // Does a contact with this ID even exist?
    if (!contact) return res.status(404).json({ message: 'Contact not found' });

    // It exists — but does it actually belong to whoever's asking?
    // (protect already confirmed WHO they are — this checks WHAT they're allowed to touch.)
    if (contact.userId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to edit this contact' });
    }

    // Both checks passed — safe to actually update. Only whitelisted fields,
    // same reasoning as createContact: never let the client touch `userId`.
    Object.assign(contact, pickContactFields(req.body));
    await contact.save();
    res.json(contact);
  } catch (error) {
    next(error);
  }
};

const deleteContact = async (req, res, next) => {
  try {
    const contact = await EmergencyContact.findById(req.params.id);
    if (!contact) return res.status(404).json({ message: 'Contact not found' });
    if (contact.userId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this contact' });
    }
    await contact.deleteOne();
    res.json({ message: 'Contact deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = { createContact, getContacts, updateContact, deleteContact };