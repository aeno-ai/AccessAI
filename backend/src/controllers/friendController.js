const Friendship = require('../models/Friendship');
const DirectMessage = require('../models/DirectMessage');
const User = require('../models/Users');
const { emitToUser, isOnline } = require('../realtime/io');
const { ensureFriendCode, normalizeFriendCode } = require('../utils/friendCode');

// Accounts that can be found, befriended and messaged: active, verified,
// not waiting to be deleted. (Missing fields count as fine, like protect().)
const USABLE_ACCOUNT = { isActive: { $ne: false }, deletionScheduledFor: null, emailVerified: { $ne: false } };

const PUBLIC_FIELDS = 'name firstName friendNote';

const isRequester = (friendship, userId) => String(friendship.requester) === String(userId);
const otherIdOf = (friendship, userId) => (isRequester(friendship, userId) ? friendship.recipient : friendship.requester);

// What a friend's app may know about someone: their name and the note they
// chose to share — never their email, role or anything else.
const publicProfile = (user) => ({
  userId: String(user._id),
  name: user.name,
  firstName: user.firstName || user.name?.split(' ')[0] || '',
  note: user.friendNote || '',
});

// Your friend code (made the first time) and the note friends see.
const getMyFriendInfo = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('friendCode friendNote');
    if (!user) return res.status(404).json({ message: 'Account not found' });
    res.json({ friendCode: await ensureFriendCode(user), note: user.friendNote || '' });
  } catch (error) {
    next(error);
  }
};

const listFriends = async (req, res, next) => {
  try {
    const me = req.user.userId;
    const friendships = await Friendship.find({
      status: 'accepted',
      $or: [{ requester: me }, { recipient: me }],
    });

    const otherIds = friendships.map((f) => otherIdOf(f, me));
    const users = await User.find({ _id: { $in: otherIds }, ...USABLE_ACCOUNT }).select(PUBLIC_FIELDS);
    const usersById = new Map(users.map((u) => [String(u._id), u]));

    const friends = [];
    for (const friendship of friendships) {
      const other = usersById.get(String(otherIdOf(friendship, me)));
      if (!other) continue; // deactivated or being deleted — hidden, not removed
      const mine = isRequester(friendship, me);
      const readAt = mine ? friendship.requesterReadAt : friendship.recipientReadAt;

      const [lastMessage, unread] = await Promise.all([
        DirectMessage.findOne({ friendshipId: friendship._id }).sort({ createdAt: -1 }),
        DirectMessage.countDocuments({
          friendshipId: friendship._id,
          senderId: { $ne: me },
          ...(readAt ? { createdAt: { $gt: readAt } } : {}),
        }),
      ]);

      friends.push({
        ...publicProfile(other),
        friendshipId: String(friendship._id),
        online: isOnline(other._id),
        // You put them in your SOS circle / they put you in theirs.
        inMySosCircle: mine ? friendship.requesterSos : friendship.recipientSos,
        inTheirSosCircle: mine ? friendship.recipientSos : friendship.requesterSos,
        // When they last read the chat — for "Seen" under your messages.
        theirReadAt: (mine ? friendship.recipientReadAt : friendship.requesterReadAt)?.getTime() ?? null,
        unread,
        lastMessage: lastMessage
          ? {
              body: lastMessage.body,
              kind: lastMessage.kind,
              fromMe: String(lastMessage.senderId) === String(me),
              createdAt: lastMessage.createdAt.getTime(),
            }
          : null,
      });
    }

    // Most recent conversation first, then friends never messaged, by name.
    friends.sort(
      (a, b) =>
        (b.lastMessage?.createdAt ?? 0) - (a.lastMessage?.createdAt ?? 0) || a.name.localeCompare(b.name),
    );
    res.json(friends);
  } catch (error) {
    next(error);
  }
};

const listRequests = async (req, res, next) => {
  try {
    const me = req.user.userId;
    const pending = await Friendship.find({ status: 'pending', $or: [{ requester: me }, { recipient: me }] }).sort({
      createdAt: -1,
    });
    const otherIds = pending.map((f) => otherIdOf(f, me));
    const users = await User.find({ _id: { $in: otherIds }, ...USABLE_ACCOUNT }).select(PUBLIC_FIELDS);
    const usersById = new Map(users.map((u) => [String(u._id), u]));

    const incoming = [];
    const outgoing = [];
    for (const friendship of pending) {
      const other = usersById.get(String(otherIdOf(friendship, me)));
      if (!other) continue;
      const entry = { id: String(friendship._id), person: publicProfile(other), createdAt: friendship.createdAt.getTime() };
      (isRequester(friendship, me) ? outgoing : incoming).push(entry);
    }
    res.json({ incoming, outgoing });
  } catch (error) {
    next(error);
  }
};

// Add a friend by their code. If they had already asked to be your friend,
// this simply accepts it.
const sendRequest = async (req, res, next) => {
  try {
    const me = req.user.userId;
    const code = normalizeFriendCode(req.body.code);
    // Same answer for "malformed" and "nobody has it", so codes can't be
    // probed for shape.
    const target = code ? await User.findOne({ friendCode: code, ...USABLE_ACCOUNT }).select(PUBLIC_FIELDS) : null;
    if (!target) {
      return res.status(404).json({ message: 'No account has that friend code. Check it and try again.' });
    }
    if (String(target._id) === String(me)) {
      return res.status(400).json({ message: "That's your own friend code." });
    }

    const pairKey = Friendship.pairKeyOf(me, target._id);
    const existing = await Friendship.findOne({ pairKey });

    if (existing?.status === 'accepted') {
      return res.status(409).json({ message: `You're already friends with ${target.firstName || target.name}.` });
    }
    if (existing && isRequester(existing, me)) {
      return res.status(409).json({ message: 'You already sent a request. Waiting for them to accept.' });
    }
    if (existing) {
      // They asked first — this accepts it.
      existing.status = 'accepted';
      existing.acceptedAt = new Date();
      await existing.save();
      emitToUser(target._id, 'friends:changed');
      emitToUser(me, 'friends:changed');
      return res.json({ status: 'accepted', person: publicProfile(target) });
    }

    try {
      await Friendship.create({ requester: me, recipient: target._id, pairKey });
    } catch (error) {
      // Both sent a request at the same moment.
      if (error.code === 11000) {
        return res.status(409).json({ message: 'A request between you already exists. Pull down to refresh.' });
      }
      throw error;
    }
    emitToUser(target._id, 'friends:changed');
    res.status(201).json({ status: 'pending', person: publicProfile(target) });
  } catch (error) {
    next(error);
  }
};

const acceptRequest = async (req, res, next) => {
  try {
    const me = req.user.userId;
    const friendship = await Friendship.findOne({ _id: req.params.id, recipient: me, status: 'pending' });
    if (!friendship) return res.status(404).json({ message: 'That request is no longer there.' });
    friendship.status = 'accepted';
    friendship.acceptedAt = new Date();
    await friendship.save();
    emitToUser(friendship.requester, 'friends:changed');
    emitToUser(me, 'friends:changed');
    res.json({ status: 'accepted' });
  } catch (error) {
    next(error);
  }
};

// Decline a request you received, or cancel one you sent.
const removeRequest = async (req, res, next) => {
  try {
    const me = req.user.userId;
    const friendship = await Friendship.findOne({
      _id: req.params.id,
      status: 'pending',
      $or: [{ requester: me }, { recipient: me }],
    });
    if (friendship) {
      await friendship.deleteOne();
      emitToUser(otherIdOf(friendship, me), 'friends:changed');
    }
    res.json({ removed: Boolean(friendship) });
  } catch (error) {
    next(error);
  }
};

// Unfriend. The chat between you is deleted too, for both of you.
const removeFriend = async (req, res, next) => {
  try {
    const me = req.user.userId;
    const friendship = await Friendship.findOne({ pairKey: Friendship.pairKeyOf(me, req.params.friendId) });
    if (friendship) {
      await DirectMessage.deleteMany({ friendshipId: friendship._id });
      await friendship.deleteOne();
      emitToUser(req.params.friendId, 'friends:changed');
    }
    res.json({ removed: Boolean(friendship) });
  } catch (error) {
    next(error);
  }
};

// Put a friend in (or take them out of) your SOS circle — the friends
// alerted when you send an SOS. PWD accounts only, like SOS itself.
const setSosCircle = async (req, res, next) => {
  try {
    if (req.user.role === 'non_pwd') {
      return res.status(403).json({ message: 'SOS is only available for PWD accounts' });
    }
    const me = req.user.userId;
    const friendship = await Friendship.findOne({
      pairKey: Friendship.pairKeyOf(me, req.params.friendId),
      status: 'accepted',
    });
    if (!friendship) return res.status(404).json({ message: 'You are not friends with this person.' });
    friendship[isRequester(friendship, me) ? 'requesterSos' : 'recipientSos'] = req.body.inCircle;
    await friendship.save();
    emitToUser(req.params.friendId, 'friends:changed');
    res.json({ inMySosCircle: req.body.inCircle });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyFriendInfo,
  listFriends,
  listRequests,
  sendRequest,
  acceptRequest,
  removeRequest,
  removeFriend,
  setSosCircle,
  // Shared with the direct-message controller.
  USABLE_ACCOUNT,
  isRequester,
  otherIdOf,
};
