const { Server } = require('socket.io');
const mongoose = require('mongoose');
const Friendship = require('../models/Friendship');
const { verifyUserToken } = require('../utils/verifyUserToken');

// Live updates for the mobile app: new chat messages, friend requests, SOS
// alerts and who's online. Only ever pushes server → phone; everything the
// phone *does* (send a message, accept a request…) stays a normal REST call,
// so a phone that was offline just retries those requests.
//
// Events the app listens for:
//   dm:new          { friendId, message }      a friend sent a message
//   dm:read         { friendId, readAt }       a friend read the chat
//   friends:changed {}                         requests/friends/SOS circle changed — reload
//   presence        { userId, online }         a friend came online / went offline
//   sos:alert       { … }                      a friend in whose SOS circle you are sent an SOS
//   sos:location    { eventId, friendId, location }   that friend's phone shared a newer position
//   sos:resolved    { eventId, friendId, name, reason }  the SOS ended ('safe' / 'expired' / 'replaced')
//   sos:response    { eventId, friendId, name, kind }   (to the sender) a friend saw it / is on the way
//
// Event the app sends:
//   app:state       { foreground }             AccessAI went to the background or came back.
//                                               A phone keeps its socket for a while in the
//                                               background, so "connected" isn't "looking at
//                                               the app" — push notifications use this instead.
//
// Several server copies (HANDOFF.md §52): every question below ("is this
// user online?", "close their connections") is asked of socket.io's rooms,
// never of a list kept in this process. With one copy the rooms are local;
// with SOCKET_ADAPTER=mongo they're shared through MongoDB Atlas (the
// @socket.io/mongo-adapter), so a phone connected to copy A gets what
// copy B sends, and presence counts phones on every copy.

let io = null;

const roomOf = (userId) => `user:${userId}`;

// The users (of `userIds`) with at least one open connection, on any copy.
// One question for the whole list, however long.
async function socketsOf(userIds) {
  const ids = [...new Set([...userIds].map(String))];
  if (!io || !ids.length) return [];
  return io.in(ids.map(roomOf)).fetchSockets();
}

async function onlineUsers(userIds) {
  return new Set((await socketsOf(userIds)).map((socket) => socket.data.userId));
}

// …and those with AccessAI open on screen on at least one phone — they see
// things live, so a push notification would be a duplicate.
async function foregroundUsers(userIds) {
  return new Set((await socketsOf(userIds)).filter((socket) => socket.data.foreground).map((socket) => socket.data.userId));
}

const isOnline = async (userId) => (await onlineUsers([userId])).has(String(userId));
const isForeground = async (userId) => (await foregroundUsers([userId])).has(String(userId));

function emitToUser(userId, event, payload = {}) {
  io?.to(roomOf(userId)).emit(event, payload);
}

// Closes every live connection of one account, on every copy — an admin
// suspended it or is deleting it (HANDOFF.md §42). The phone's reconnect is
// then refused by the token check, and its next REST request gets the reason.
function disconnectUser(userId) {
  io?.in(roomOf(userId)).disconnectSockets(true);
}

// Everyone with a friendship or a request with this account reloads their
// lists — it was suspended, is being deleted, or is back. Never throws.
async function notifyFriendsChanged(userId) {
  try {
    const friendships = await Friendship.find({ $or: [{ requester: userId }, { recipient: userId }] })
      .select('requester recipient')
      .lean();
    for (const f of friendships) {
      emitToUser(String(f.requester) === String(userId) ? f.recipient : f.requester, 'friends:changed');
    }
  } catch (error) {
    console.error("Couldn't tell friends about an account change:", error);
  }
}

async function acceptedFriendIds(userId) {
  const friendships = await Friendship.find({
    status: 'accepted',
    $or: [{ requester: userId }, { recipient: userId }],
  })
    .select('requester recipient')
    .lean();
  return friendships.map((f) => (String(f.requester) === String(userId) ? f.recipient : f.requester));
}

async function broadcastPresence(userId, online) {
  try {
    for (const friendId of await acceptedFriendIds(userId)) {
      emitToUser(friendId, 'presence', { userId: String(userId), online });
    }
  } catch (error) {
    console.error('Failed to broadcast presence:', error);
  }
}

// How many connections this user has right now, on every copy.
async function connectionCount(userId) {
  try {
    return (await socketsOf([userId])).length;
  } catch (error) {
    console.error('Failed to count connections:', error);
    return null;
  }
}

// SOCKET_ADAPTER=mongo: rooms shared by every copy through one MongoDB
// collection. Its events expire after an hour (TTL); copies watch it with a
// change stream (Atlas is a replica set, which change streams need).
const ADAPTER_COLLECTION = 'socket_io_events';

async function useMongoAdapter(server) {
  const { createAdapter } = require('@socket.io/mongo-adapter');
  const collection = mongoose.connection.db.collection(ADAPTER_COLLECTION);
  await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 });
  server.adapter(
    createAdapter(collection, {
      addCreatedAtField: true,
      // A copy that stopped answering is skipped after 2 s, not 5.
      requestsTimeout: 2000,
    }),
  );
  console.log('Realtime: shared across server copies through MongoDB (SOCKET_ADAPTER=mongo).');
}

async function initRealtime(httpServer, allowedOrigins) {
  io = new Server(httpServer, {
    // Phones send no Origin header; browsers (the web build) are held to the
    // same allow-list as the REST API.
    cors: { origin: allowedOrigins ?? true },
  });
  if (process.env.SOCKET_ADAPTER === 'mongo') await useMongoAdapter(io);

  // Same check as protect() on REST requests: a valid token for an account
  // that may still use it.
  io.use(async (socket, next) => {
    try {
      const user = await verifyUserToken(socket.handshake.auth?.token);
      if (!user) {
        return next(new Error('unauthorized'));
      }
      socket.data.userId = String(user.userId);
      next();
    } catch (error) {
      // Logged here; the phone only learns that it couldn't connect.
      console.error('Socket login check failed:', error);
      next(new Error('unavailable'));
    }
  });

  io.on('connection', (socket) => {
    const { userId } = socket.data;
    socket.join(roomOf(userId));
    // A phone connects when the app opens, so it starts as on screen.
    socket.data.foreground = true;

    // Their first connection anywhere: friends see them come online.
    void connectionCount(userId).then((count) => {
      if (count === 1) void broadcastPresence(userId, true);
    });

    socket.on('app:state', (state) => {
      socket.data.foreground = state?.foreground === true;
    });

    socket.on('disconnect', () => {
      // Their last connection anywhere closed: friends see them go offline.
      void connectionCount(userId).then((count) => {
        if (count === 0) void broadcastPresence(userId, false);
      });
    });
  });

  return io;
}

module.exports = {
  initRealtime,
  emitToUser,
  disconnectUser,
  notifyFriendsChanged,
  isOnline,
  isForeground,
  onlineUsers,
  foregroundUsers,
};
