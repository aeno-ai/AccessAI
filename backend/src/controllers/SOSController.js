const SOSEvent = require('../models/SOSEvent');
const EmergencyContact = require('../models/EmergencyContact');

const triggerSOS = async (req, res) => {
  try {
    const { triggerMethod, location, message, silentMode, isTest } = req.body;

    if (!triggerMethod) {
      return res.status(400).json({ message: 'triggerMethod is required' });
    }

    const event = await SOSEvent.create({
      userId: req.user.userId,
      triggerMethod,
      location,
      message,
      silentMode,
      isTest,
    });

    const contacts = await EmergencyContact.find({ userId: req.user.userId });

    res.status(201).json({
      event,
      contactsToNotify: contacts.length, // actual sending comes later — this just confirms the link works
    });
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong', error: error.message });
  }
};

const resolveSOS = async (req, res) => {
  try {
    const event = await SOSEvent.findById(req.params.id);

    if (!event) return res.status(404).json({ message: 'SOS event not found' });
    if (event.userId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    event.status = 'resolved';
    event.resolvedAt = new Date();
    await event.save();

    res.json(event);
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong', error: error.message });
  }
};

module.exports = { triggerSOS, resolveSOS };