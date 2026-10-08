const DirectMessage = require('../models/DirectMessage');
const Friendship = require('../models/Friendship');
const User = require('../models/Users');
const { emitToUser, isForeground } = require('../realtime/io');
const { pushToUsers } = require('../utils/push');
const { USABLE_ACCOUNT, isRequester } = require('./friendController');

// The accepted friendship between the caller and :friendId, or null. Only
// friends can message each other, and only while the friend's account is
// usable.
async function friendshipWith(me, friendId) {
  const friendship = await Friendship.findOne({ pairKey: Friendship.pairKeyOf(me, friendId), status: 'accepted' });
  if (!friendship) return null;
  const usable = await User.exists({ _id: friendId, ...USABLE_ACCOUNT });
  return usable ? friendship : null;
}

// One message as a given person's app sees it.
const toClient = (message, viewerId) => ({
  id: String(message._id),
  clientId: message.clientId,
  fromMe: String(message.senderId) === String(viewerId),
  body: message.body,
  kind: message.kind,
  sos: message.kind === 'sos' ? message.sos : undefined,
  // Server time: the order everyone agrees on, and the cursor for `after`.
  createdAt: message.createdAt.getTime(),
  clientCreatedAt: message.clientCreatedAt,
});

const NOT_FRIENDS = { message: 'You can only message your friends.' };

// Messages newer than `after` (server time, ms), oldest first — the app asks
// for everything since the last one it has, after being offline.
const listMessages = async (req, res, next) => {
  try {
    const me = req.user.userId;
    const friendship = await friendshipWith(me, req.params.friendId);
    if (!friendship) return res.status(403).json(NOT_FRIENDS);

    const after = req.query.after ? new Date(Number(req.query.after)) : null;
    const limit = Number(req.query.limit) || 100;
    const messages = await DirectMessage.find({
      friendshipId: friendship._id,
      ...(after ? { createdAt: { $gt: after } } : {}),
    })
      .sort({ createdAt: 1 })
      .limit(limit);
    res.json(messages.map((message) => toClient(message, me)));
  } catch (error) {
    next(error);
  }
};

// Saves a message (once — re-sending the same clientId is a no-op) and
// pushes it to the friend's phone if it's online.
const sendMessage = async (req, res, next) => {
  try {
    const me = req.user.userId;
    const { friendId } = req.params;
    const friendship = await friendshipWith(me, friendId);
    if (!friendship) return res.status(403).json(NOT_FRIENDS);

    const { clientId, body, createdAt } = req.body;
    let message;
    let isNew;
    try {
      const result = await DirectMessage.findOneAndUpdate(
        { senderId: me, clientId },
        { $setOnInsert: { friendshipId: friendship._id, senderId: me, clientId, body, kind: 'text', clientCreatedAt: createdAt } },
        { upsert: true, new: true, includeResultMetadata: true },
      );
      message = result.value;
      isNew = !result.lastErrorObject?.updatedExisting;
    } catch (error) {
      // The same message arrived twice at the same moment (a retry racing
      // the original); the other request saved it.
      if (error.code !== 11000) throw error;
      message = await DirectMessage.findOne({ senderId: me, clientId });
      isNew = false;
    }

    if (isNew) {
      emitToUser(friendId, 'dm:new', { friendId: String(me), message: toClient(message, friendId) });
      // AccessAI isn't on the friend's screen: a phone notification instead.
      if (!isForeground(friendId)) {
        void pushToUsers([friendId], {
          title: req.user.firstName || 'New message',
          body: message.body.length > 120 ? `${message.body.slice(0, 117)}…` : message.body,
          channelId: 'chat_messages',
          data: { type: 'dm', friendId: String(me) },
        });
      }
    }
    res.status(isNew ? 201 : 200).json(toClient(message, me));
  } catch (error) {
    next(error);
  }
};

// The caller has read the chat up to now — clears their unread count and
// lets the friend's app show "Seen".
const markRead = async (req, res, next) => {
  try {
    const me = req.user.userId;
    const friendship = await friendshipWith(me, req.params.friendId);
    if (!friendship) return res.status(403).json(NOT_FRIENDS);
    const readAt = new Date();
    friendship[isRequester(friendship, me) ? 'requesterReadAt' : 'recipientReadAt'] = readAt;
    await friendship.save();
    emitToUser(req.params.friendId, 'dm:read', { friendId: String(me), readAt: readAt.getTime() });
    res.json({ readAt: readAt.getTime() });
  } catch (error) {
    next(error);
  }
};

module.exports = { listMessages, sendMessage, markRead, toClient };
