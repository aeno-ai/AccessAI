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

/**
 * Deletes one of the caller's synced conversations, and its messages, by the
 * `clientId` the phone generated. The phone deletes locally first and sends
 * this whenever it's next online, so the request can arrive late, twice, or
 * for a conversation that never finished syncing — none of those are
 * errors. The response always succeeds and just says whether anything was
 * there to delete.
 */
const deleteConversation = async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({
      userId: req.user.userId,
      clientId: req.params.clientId,
    });

    if (conversation) {
      await Message.deleteMany({ conversationId: conversation._id });
      await conversation.deleteOne();
    }

    res.status(200).json({ deleted: Boolean(conversation) });
  } catch (error) {
    next(error);
  }
};

module.exports = { syncConversation, deleteConversation };
