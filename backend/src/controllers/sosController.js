const SOSEvent = require('../models/SOSEvent');
const EmergencyContact = require('../models/EmergencyContact');
const Friendship = require('../models/Friendship');
const DirectMessage = require('../models/DirectMessage');
const User = require('../models/Users');
const { emitToUser, isOnline, isForeground } = require('../realtime/io');
const { pushToUsers } = require('../utils/push');
const { toClient } = require('./directMessageController');

// How long things last.
const SHARE_LOCATION_MS = 30 * 60 * 1000; // the sender's phone keeps sharing its position for 30 min
const ACTIVE_MS = 24 * 60 * 60 * 1000; // friends see a real SOS as active for up to 24 h…
const TEST_ACTIVE_MS = 15 * 60 * 1000; // …and a test for 15 min
const LOCATION_MIN_GAP_MS = 10 * 1000; // ignore position updates closer together than this

const NOT_FOUND = { message: 'That SOS is no longer active.' };

// The friends to alert: everyone the sender has placed in their SOS circle,
// as long as their account is still usable.
async function sosCircleOf(userId) {
  const friendships = await Friendship.find({
    status: 'accepted',
    $or: [
      { requester: userId, requesterSos: true },
      { recipient: userId, recipientSos: true },
    ],
  })
    .select('requester recipient')
    .lean();
  const friendIds = friendships.map((f) => (String(f.requester) === String(userId) ? f.recipient : f.requester));
  const usable = await User.find({
    _id: { $in: friendIds },
    isActive: { $ne: false },
    deletionScheduledFor: null,
  })
    .select('_id')
    .lean();
  const usableIds = new Set(usable.map((u) => String(u._id)));
  return friendships
    .map((friendship, index) => ({ friendship, friendId: friendIds[index] }))
    .filter(({ friendId }) => usableIds.has(String(friendId)));
}

const nameOf = (user) => user?.firstName || user?.name || 'Your friend';

async function namesById(userIds) {
  const users = await User.find({ _id: { $in: userIds } }).select('firstName name').lean();
  return new Map(users.map((user) => [String(user._id), nameOf(user)]));
}

function isActive(event, now = new Date()) {
  return event.status === 'active' && (!event.expiresAt || event.expiresAt > now);
}

// Where the sender is, as far as we know: the newest shared position, or
// the one sent with the SOS.
function newestLocation(event) {
  const last = event.lastLocation;
  if (last?.latitude != null && last?.longitude != null) {
    return {
      latitude: last.latitude,
      longitude: last.longitude,
      accuracy: last.accuracy ?? null,
      at: (last.at ?? event.createdAt).getTime(),
    };
  }
  const first = event.location;
  if (first?.latitude != null && first?.longitude != null) {
    return { latitude: first.latitude, longitude: first.longitude, accuracy: first.accuracy ?? null, at: event.createdAt.getTime() };
  }
  return null;
}

// Ends an SOS and tells every friend who was alerted about it. Atomic: only
// the one call that actually flips it from active ends it and tells friends,
// so "I'm safe" racing the expiry job (or tapped twice) never sends
// sos:resolved twice. Returns whether this call ended it.
async function endEvent(event, reason, senderName) {
  const ended = await SOSEvent.findOneAndUpdate(
    { _id: event._id, status: 'active' },
    { $set: { status: 'resolved', resolvedAt: new Date(), resolvedReason: reason } },
    { returnDocument: 'after', projection: { userId: 1, recipients: 1 } },
  ).lean();
  if (!ended) return false;
  const payload = { eventId: String(ended._id), friendId: String(ended.userId), name: senderName, reason };
  for (const friendId of ended.recipients ?? []) {
    emitToUser(friendId, 'sos:resolved', payload);
  }
  return true;
}

// Records an SOS and alerts the sender's SOS circle three ways:
//   1. a live full-screen alert on every friend's phone that has AccessAI open,
//   2. a push notification (reaches phones where AccessAI is closed),
//   3. an SOS message in each chat, so nobody misses it for good.
// Emergency contacts (phone numbers) are texted from the sender's own phone,
// not from here — see the app's utils/sos.ts.
const triggerSOS = async (req, res, next) => {
  try {
    const { triggerMethod, location, place, message, silentMode, isTest, occurredAt } = req.body;
    const me = req.user.userId;
    const now = new Date();

    const [contacts, circle, sender, previous] = await Promise.all([
      EmergencyContact.countDocuments({ userId: me }),
      sosCircleOf(me),
      User.findById(me).select('name firstName').lean(),
      SOSEvent.find({ userId: me, status: 'active' }).select('_id').lean(),
    ]);
    const senderName = nameOf(sender);

    const event = await SOSEvent.create({
      userId: me,
      triggerMethod,
      location,
      lastLocation: location ? { ...location, at: now } : undefined,
      place,
      message,
      silentMode,
      isTest,
      // Made offline earlier: friends see "sent N min ago, while offline".
      occurredAt: occurredAt ? new Date(occurredAt) : undefined,
      recipients: circle.map(({ friendId }) => friendId),
      shareUntil: isTest ? undefined : new Date(now.getTime() + SHARE_LOCATION_MS),
      expiresAt: new Date(now.getTime() + (isTest ? TEST_ACTIVE_MS : ACTIVE_MS)),
    });

    // Only one SOS is active at a time: a new one replaces the old.
    for (const old of previous) {
      await endEvent(old, 'replaced', senderName);
    }

    const where = newestLocation(event);
    const alertPayload = {
      eventId: String(event._id),
      friendId: String(me),
      name: senderName,
      message: event.message,
      location: where ? { latitude: where.latitude, longitude: where.longitude, accuracy: where.accuracy } : null,
      place: event.place ?? null,
      isTest: event.isTest,
      createdAt: event.createdAt.getTime(),
      occurredAt: event.occurredAt?.getTime() ?? null,
      sharingUntil: event.shareUntil?.getTime() ?? null,
    };

    // The SOS message in each friend's chat, all in one database call.
    // Unordered: one friend's message failing (say, their chat can't be
    // written) doesn't stop the others' — and, as before, a friend counts as
    // alerted once their message is saved.
    const clientIdOf = (friendId) => `sos_${event._id}_${friendId}`; // one per friend: {senderId, clientId} is unique
    let saved;
    try {
      saved = await DirectMessage.insertMany(
        circle.map(({ friendship, friendId }) => ({
          friendshipId: friendship._id,
          senderId: me,
          clientId: clientIdOf(friendId),
          body: event.message,
          kind: 'sos',
          sos: {
            eventId: event._id,
            latitude: event.location?.latitude,
            longitude: event.location?.longitude,
            isTest: event.isTest,
          },
          clientCreatedAt: Date.now(),
        })),
        { ordered: false },
      );
    } catch (error) {
      saved = error.insertedDocs ?? [];
      console.error(`SOS ${event._id}: ${circle.length - saved.length} chat message(s) not saved:`, error.message);
    }
    const dmByClientId = new Map(saved.map((dm) => [dm.clientId, dm]));

    const alerted = [];
    let friendsOnline = 0;
    for (const { friendId } of circle) {
      const dm = dmByClientId.get(clientIdOf(friendId));
      if (!dm) continue;
      if (isOnline(friendId)) friendsOnline += 1;
      emitToUser(friendId, 'sos:alert', alertPayload);
      emitToUser(friendId, 'dm:new', { friendId: String(me), message: toClient(dm, friendId) });
      alerted.push(friendId);
    }

    // Every alerted friend gets a push, even with the app open — the app
    // hides it there, since the full-screen alert is already showing.
    void pushToUsers(alerted, {
      title: event.isTest ? `TEST: ${senderName} sent a test SOS` : `🚨 ${senderName} needs help (SOS)`,
      body: [event.message, event.place].filter(Boolean).join(' — '),
      channelId: 'sos_alerts',
      data: { type: 'sos', eventId: String(event._id), friendId: String(me) },
    });

    const names = await namesById(alerted);
    res.status(201).json({
      event,
      eventId: String(event._id),
      contactsToNotify: contacts,
      friendsAlerted: alerted.length,
      friendsOnline,
      alertedNames: alerted.map((id) => names.get(String(id))).filter(Boolean),
      sharingUntil: event.shareUntil?.getTime() ?? null,
    });
  } catch (error) {
    next(error);
  }
};

// The sender's phone sharing a newer position (every ~30 s for 30 minutes,
// while AccessAI is open). Friends' map links follow it live. It can also
// carry the readable place ("Near Rizal Ave, Manila"), looked up after the
// SOS went out — a new place is passed on at once, even within the 10 s gap.
const updateLocation = async (req, res, next) => {
  try {
    const me = req.user.userId;
    const event = await SOSEvent.findById(req.params.id);
    if (!event || String(event.userId) !== me) return res.status(404).json(NOT_FOUND);

    const now = new Date();
    if (!isActive(event, now) || !event.shareUntil || event.shareUntil < now) {
      return res.status(409).json({ message: 'Location sharing for this SOS has ended.', code: 'SOS_SHARING_ENDED' });
    }
    const { latitude, longitude, accuracy, place } = req.body;
    const newPlace = typeof place === 'string' && place && place !== event.place ? place : null;
    if (!newPlace && event.lastLocation?.at && now - event.lastLocation.at < LOCATION_MIN_GAP_MS) {
      return res.json({ saved: false });
    }

    event.lastLocation = { latitude, longitude, accuracy, at: now };
    if (newPlace) event.place = newPlace;
    await event.save();

    const payload = {
      eventId: String(event._id),
      friendId: me,
      location: { latitude, longitude, accuracy: accuracy ?? null, at: now.getTime() },
      place: event.place ?? null,
    };
    for (const friendId of event.recipients) {
      emitToUser(friendId, 'sos:location', payload);
    }
    res.json({ saved: true });
  } catch (error) {
    next(error);
  }
};

// "I'm safe": the sender ends their SOS. Every alerted friend is told.
const resolveSOS = async (req, res, next) => {
  try {
    const me = req.user.userId;
    const event = await SOSEvent.findById(req.params.id);
    if (!event || String(event.userId) !== me) return res.status(404).json(NOT_FOUND);

    if (event.status === 'active') {
      const sender = await User.findById(me).select('name firstName').lean();
      const senderName = nameOf(sender);
      // Only the call that ended it tells friends (not a double tap, nor
      // the expiry job at the same moment).
      const ended = await endEvent(event, 'safe', senderName);
      if (ended) void pushToUsers(
        event.recipients.filter((id) => !isForeground(id)).map(String),
        {
          title: `${senderName} is safe now`,
          body: event.isTest ? 'The test SOS has ended.' : `${senderName} ended their SOS.`,
          channelId: 'sos_updates',
          data: { type: 'sos', eventId: String(event._id), friendId: me },
        },
      );
    }
    // Over either way: status has only these two values.
    res.json({ eventId: String(event._id), status: 'resolved' });
  } catch (error) {
    next(error);
  }
};

// A friend answering an SOS they were alerted about: "I've seen it" or
// "I'm on my way". The sender hears it — important when they can't see the
// screen. "On my way" is never downgraded back to "seen".
const respondToSOS = async (req, res, next) => {
  try {
    const me = req.user.userId;
    const event = await SOSEvent.findById(req.params.id);
    if (!event || !event.recipients.some((id) => String(id) === me)) return res.status(404).json(NOT_FOUND);
    if (!isActive(event)) return res.status(409).json({ message: 'That SOS has already ended.' });

    const { kind } = req.body;
    const existing = event.responses.find((response) => String(response.userId) === me);
    let finalKind = kind;
    if (existing) {
      if (!(existing.kind === 'on_my_way' && kind === 'seen')) {
        existing.kind = kind;
        existing.at = new Date();
      }
      finalKind = existing.kind;
    } else {
      event.responses.push({ userId: me, kind, at: new Date() });
    }
    await event.save();

    const responder = await User.findById(me).select('name firstName');
    const responderName = nameOf(responder);
    const owner = String(event.userId);
    emitToUser(owner, 'sos:response', {
      eventId: String(event._id),
      friendId: me,
      name: responderName,
      kind: finalKind,
      at: Date.now(),
    });
    if (!isForeground(owner)) {
      void pushToUsers([owner], {
        title: finalKind === 'on_my_way' ? `${responderName} is on the way` : `${responderName} saw your SOS`,
        body: finalKind === 'on_my_way' ? 'Help is coming.' : 'They know you need help.',
        channelId: 'sos_updates',
        data: { type: 'sos', eventId: String(event._id), friendId: me },
      });
    }
    res.json({ kind: finalKind });
  } catch (error) {
    next(error);
  }
};

// What the app shows on Home: SOS alerts from friends that are still going
// (with the newest location), and the user's own active SOS with who
// answered. Asked for every time the app connects, so a friend who just
// opened AccessAI sees an SOS they missed.
const listActive = async (req, res, next) => {
  try {
    const me = req.user.userId;
    const now = new Date();
    const [friendEvents, mine] = await Promise.all([
      SOSEvent.find({ recipients: me, status: 'active', expiresAt: { $gt: now } })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('userId message isTest createdAt occurredAt location lastLocation place shareUntil responses')
        .lean(),
      SOSEvent.findOne({ userId: me, status: 'active', expiresAt: { $gt: now } })
        .sort({ createdAt: -1 })
        .select('createdAt isTest shareUntil recipients responses')
        .lean(),
    ]);

    const people = await namesById([
      ...friendEvents.map((event) => event.userId),
      ...(mine?.responses ?? []).map((response) => response.userId),
    ]);

    res.json({
      friends: friendEvents.map((event) => ({
        eventId: String(event._id),
        friendId: String(event.userId),
        name: people.get(String(event.userId)) ?? 'Your friend',
        message: event.message,
        isTest: event.isTest === true,
        createdAt: event.createdAt.getTime(),
        occurredAt: event.occurredAt?.getTime() ?? null,
        location: newestLocation(event),
        place: event.place ?? null,
        sharingUntil: event.shareUntil?.getTime() ?? null,
        myResponse: (event.responses ?? []).find((response) => String(response.userId) === me)?.kind ?? null,
      })),
      mine: mine
        ? {
            eventId: String(mine._id),
            createdAt: mine.createdAt.getTime(),
            isTest: mine.isTest === true,
            sharingUntil: mine.shareUntil?.getTime() ?? null,
            friendsAlerted: mine.recipients?.length ?? 0,
            responses: (mine.responses ?? []).map((response) => ({
              friendId: String(response.userId),
              name: people.get(String(response.userId)) ?? 'A friend',
              kind: response.kind,
              at: response.at.getTime(),
            })),
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
};

const RECENT_MS = 7 * 24 * 60 * 60 * 1000; // Home's "Recent SOS" goes back a week

const RECENT_FIELDS = 'userId isTest createdAt occurredAt location lastLocation place status expiresAt resolvedAt resolvedReason responses recipients';

// One SOS as Home's "Recent SOS" shows it: when, the last place sent, how it
// ended and who answered. An SOS past its time that the expiry job hasn't
// reached yet already counts as ended ("expired").
function recentOf(event, people, now) {
  const active = isActive(event, now);
  return {
    eventId: String(event._id),
    isTest: event.isTest === true,
    createdAt: event.createdAt.getTime(),
    occurredAt: event.occurredAt?.getTime() ?? null,
    place: event.place ?? null,
    location: newestLocation(event),
    active,
    endedAt: active ? null : (event.resolvedAt ?? event.expiresAt ?? event.createdAt).getTime(),
    endedReason: active ? null : event.resolvedReason ?? 'expired',
    responses: (event.responses ?? []).map((response) => ({
      friendId: String(response.userId),
      name: people.get(String(response.userId)) ?? 'A friend',
      kind: response.kind,
      at: response.at.getTime(),
    })),
  };
}

// Home's "Recent SOS": each friend's latest SOS sent to me in the last 7
// days, active or ended, and (for PWD accounts) my own latest. Private by
// design: only SOS I was alerted about, only from people who are still my
// friends, only the newest per friend, and only the last place they sent —
// never live tracking after it ended.
const listRecent = async (req, res, next) => {
  try {
    const me = req.user.userId;
    const now = new Date();
    const since = new Date(now.getTime() - RECENT_MS);
    const [received, friendships, mine] = await Promise.all([
      SOSEvent.find({ recipients: me, createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .limit(200)
        .select(RECENT_FIELDS)
        .lean(),
      Friendship.find({ status: 'accepted', $or: [{ requester: me }, { recipient: me }] })
        .select('requester recipient')
        .lean(),
      req.user.role === 'non_pwd'
        ? null
        : SOSEvent.findOne({ userId: me, createdAt: { $gte: since } })
            .sort({ createdAt: -1 })
            .select(RECENT_FIELDS)
            .lean(),
    ]);

    const friendIds = new Set(friendships.map((f) => (String(f.requester) === me ? String(f.recipient) : String(f.requester))));
    const latest = new Map();
    for (const event of received) {
      const sender = String(event.userId);
      if (friendIds.has(sender) && !latest.has(sender)) latest.set(sender, event);
    }
    const events = [...latest.values()];

    const people = await namesById([
      ...events.map((event) => event.userId),
      ...[...events, ...(mine ? [mine] : [])].flatMap((event) => (event.responses ?? []).map((response) => response.userId)),
    ]);

    res.json({
      friends: events.map((event) => ({
        ...recentOf(event, people, now),
        friendId: String(event.userId),
        name: people.get(String(event.userId)) ?? 'Your friend',
        myResponse: (event.responses ?? []).find((response) => String(response.userId) === me)?.kind ?? null,
      })),
      mine: mine ? { ...recentOf(mine, people, now), friendsAlerted: mine.recipients?.length ?? 0 } : null,
    });
  } catch (error) {
    next(error);
  }
};

// Ends SOS events nobody resolved within their time (24 h, or 15 min for a
// test), so they stop showing as active. Run every 10 minutes by server.js.
// Never throws.
async function expireStaleSos() {
  try {
    const stale = await SOSEvent.find({ status: 'active', expiresAt: { $lte: new Date() } }).select('userId').lean();
    if (!stale.length) return;
    const names = await namesById(stale.map((event) => event.userId));
    for (const event of stale) {
      await endEvent(event, 'expired', names.get(String(event.userId)) ?? 'Your friend');
    }
  } catch (error) {
    console.error('Failed to expire old SOS events:', error);
  }
}

module.exports = { triggerSOS, updateLocation, resolveSOS, respondToSOS, listActive, listRecent, expireStaleSos };
