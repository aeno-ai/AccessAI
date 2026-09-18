const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

/**
 * Accepts one conversation plus its messages from the phone's local
 * (offline) database and upserts them by `clientId` — the id the phone
 * generated when it first created the conversation/message. Upserting
 * instead of always inserting means re-sending the same data (e.g. after a
 * dropped connection mid-sync) never creates duplicates.
 */
const syncConversation = async (req, res, next) => {
  try {
    const { clientId, title, mode, messages } = req.body;

    const conversation = await Conversation.findOneAndUpdate(
      { userId: req.user.userId, clientId },
      { userId: req.user.userId, clientId, title, mode },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    for (const message of messages) {
      await Message.findOneAndUpdate(
        { conversationId: conversation._id, clientId: message.clientId },
        {
          conversationId: conversation._id,
          clientId: message.clientId,
          sender: message.sender,
          body: message.body,
          clientCreatedAt: message.createdAt,
        },
        { upsert: true, setDefaultsOnInsert: true },
      );
    }

    res.status(200).json({ conversationId: conversation._id, syncedAt: Date.now() });
  } catch (error) {
    next(error);
  }
};

module.exports = { syncConversation };
