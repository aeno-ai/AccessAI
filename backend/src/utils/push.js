const User = require('../models/Users');

// Push notifications through Expo's free push service. The phone gets an
// "Expo push token" (an address) from expo-notifications and saves it with
// PUT /api/push/token; to notify someone we POST the message and their
// token(s) to Expo, which hands it to Google (Android, via Firebase) or
// Apple (iPhone). No SDK needed — it's one HTTPS call.
//
// Pushing never blocks or breaks the request that caused it: every function
// here catches its own errors and just logs them.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100; // Expo's limit per request

async function tokensOf(userIds) {
  const users = await User.find({ _id: { $in: userIds } }).select('+pushTokens');
  const tokens = [];
  for (const user of users) {
    for (const entry of user.pushTokens ?? []) {
      tokens.push({ userId: String(user._id), token: entry.token });
    }
  }
  return tokens;
}

// A phone that uninstalled the app (or turned notifications off for good)
// answers "DeviceNotRegistered" — forget that token everywhere.
async function forgetToken(token) {
  await User.updateMany({ 'pushTokens.token': token }, { $pull: { pushTokens: { token } } });
}

async function postToExpo(messages) {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(5000),
  });
  const result = await response.json().catch(() => null);
  return Array.isArray(result?.data) ? result.data : [];
}

/**
 * Sends one notification to every phone of every user in `userIds`.
 * `notification`: { title, body, data, channelId, priority }.
 * `data.userId` is set per recipient, so a phone that has since been signed
 * into another account ignores taps on it.
 */
async function pushToUsers(userIds, notification) {
  try {
    if (!userIds.length) return;
    const targets = await tokensOf(userIds);
    for (let start = 0; start < targets.length; start += BATCH) {
      const batch = targets.slice(start, start + BATCH);
      const tickets = await postToExpo(
        batch.map(({ userId, token }) => ({
          to: token,
          title: notification.title,
          body: notification.body,
          data: { ...notification.data, userId },
          sound: 'default',
          priority: notification.priority ?? 'high',
          channelId: notification.channelId,
          ttl: notification.ttl ?? 3600,
        })),
      );
      // Tickets come back in the same order as the messages.
      await Promise.all(
        tickets.map((ticket, index) =>
          ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
            ? forgetToken(batch[index].token)
            : null,
        ),
      );
    }
  } catch (error) {
    console.error('Push notification failed:', error.message);
  }
}

module.exports = { pushToUsers };
