const { Server } = require('socket.io');
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

let io = null;
// Each user's open sockets (a user can be on two phones).
const socketsByUser = new Map();

const roomOf = (userId) => `user:${userId}`;

function isOnline(userId) {
  return (socketsByUser.get(String(userId))?.size ?? 0) > 0;
}

// True if AccessAI is open on screen on at least one of the user's phones —
// then they see things live, and a push notification would be a duplicate.
function isForeground(userId) {
  for (const socket of socketsByUser.get(String(userId)) ?? []) {
    if (socket.data.foreground) return true;
  }
  return false;
}

function emitToUser(userId, event, payload = {}) {
  io?.to(roomOf(userId)).emit(event, payload);
}

async function acceptedFriendIds(userId) {
  const friendships = await Friendship.find({
    status: 'accepted',
    $or: [{ requester: userId }, { recipient: userId }],
  }).select('requester recipient');
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

function initRealtime(httpServer, allowedOrigins) {
  io = new Server(httpServer, {
    // Phones send no Origin header; browsers (the web build) are held to the
    // same allow-list as the REST API.
    cors: { origin: allowedOrigins ?? true },
  });

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

    const sockets = socketsByUser.get(userId) ?? new Set();
    sockets.add(socket);
    socketsByUser.set(userId, sockets);
    if (sockets.size === 1) {
      void broadcastPresence(userId, true);
    }

    socket.on('app:state', (state) => {
      socket.data.foreground = state?.foreground === true;
    });

    socket.on('disconnect', () => {
      const remaining = socketsByUser.get(userId);
      remaining?.delete(socket);
      if (!remaining?.size) {
        socketsByUser.delete(userId);
        void broadcastPresence(userId, false);
      }
    });
  });

  return io;
}

module.exports = { initRealtime, emitToUser, isOnline, isForeground };
