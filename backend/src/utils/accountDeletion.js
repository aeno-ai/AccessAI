const User = require('../models/Users');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const EmergencyContact = require('../models/EmergencyContact');
const SOSEvent = require('../models/SOSEvent');
const Friendship = require('../models/Friendship');
const DirectMessage = require('../models/DirectMessage');

// Permanently erases a user and everything that belongs to them. The user
// document goes last: if any step fails part-way, the account (and its
// deletionScheduledFor date) is still there, so the next run simply tries
// again instead of leaving orphaned data behind with nothing pointing at it.
//
// Admin audit log entries that mention the user are deliberately kept —
// they're the admins' own security records, and the privacy notice says so.
async function purgeUser(userId) {
  const conversationIds = await Conversation.find({ userId }).distinct('_id');
  await Message.deleteMany({ conversationId: { $in: conversationIds } });
  await Conversation.deleteMany({ userId });
  await EmergencyContact.deleteMany({ userId });
  await SOSEvent.deleteMany({ userId });
  // Their name also leaves other people's SOS events (as an alerted friend
  // or someone who answered).
  await SOSEvent.updateMany({ recipients: userId }, { $pull: { recipients: userId, responses: { userId } } });
  // Friendships go both ways, and so do their chats: everything between
  // this user and anyone else is erased.
  const friendshipIds = await Friendship.find({ $or: [{ requester: userId }, { recipient: userId }] }).distinct('_id');
  await DirectMessage.deleteMany({ $or: [{ friendshipId: { $in: friendshipIds } }, { senderId: userId }] });
  await Friendship.deleteMany({ _id: { $in: friendshipIds } });
  await User.deleteOne({ _id: userId });
}

// Sign-ups whose email was never verified are erased after this long. They
// can't log in and hold nothing, but would otherwise sit in the admin
// panel's user list forever.
const UNVERIFIED_SIGNUP_DAYS = 7;

// Erases every account whose grace period has run out, and every sign-up
// left unverified for UNVERIFIED_SIGNUP_DAYS. Run on startup and hourly by
// server.js. Never throws: one account failing is logged and the rest still
// get processed.
async function purgeExpiredAccounts() {
  const now = new Date();
  const unverifiedBefore = new Date(now.getTime() - UNVERIFIED_SIGNUP_DAYS * 24 * 60 * 60 * 1000);
  let expired;
  try {
    expired = await User.find({
      $or: [
        { deletionScheduledFor: { $lte: now } },
        { emailVerified: false, createdAt: { $lte: unverifiedBefore } },
      ],
    }).select('_id');
  } catch (error) {
    console.error('Failed to look up accounts due for deletion:', error);
    return;
  }

  for (const { _id } of expired) {
    try {
      await purgeUser(_id);
    } catch (error) {
      console.error(`Failed to delete account ${_id}:`, error);
    }
  }
}

module.exports = { purgeUser, purgeExpiredAccounts };
