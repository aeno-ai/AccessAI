const User = require('../models/Users');
const { usableFilter } = require('./accountState');

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
  // Naming the hidden field includes it, and nothing else but _id. Only
  // accounts that may be used now: a suspended one gets no notifications.
  const users = await User.find({ _id: { $in: userIds }, ...usableFilter() }).select('pushTokens').lean();
  const tokens = [];
  // One message per address, even if an old save left it listed twice.
  const seen = new Set();
  for (const user of users) {
    for (const entry of user.pushTokens ?? []) {
      if (seen.has(entry.token)) continue;
      seen.add(entry.token);
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Expo busy (429) or failing (5xx), or no answer: worth another try.
const isPassing = (status) => status === 429 || status >= 500;

// `retries`: how many more tries after a busy/failed answer, waiting 1 s,
// then 2 s (or what Expo's Retry-After asks, up to 5 s). SOS alerts get 2;
// everything else 0, so one busy moment drops only a chat notification.
async function postToExpo(messages, retries = 0) {
  for (let attempt = 0; ; attempt += 1) {
    let response;
    try {
      response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      if (attempt >= retries) throw error;
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (isPassing(response.status) && attempt < retries) {
      const asked = Number(response.headers.get('retry-after')) * 1000;
      await sleep(Math.min(5000, asked > 0 ? asked : 1000 * 2 ** attempt));
      continue;
    }
    if (isPassing(response.status)) console.error(`Push notification failed: Expo answered ${response.status}`);
    const result = await response.json().catch(() => null);
    return Array.isArray(result?.data) ? result.data : [];
  }
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
        notification.channelId === 'sos_alerts' ? 2 : 0,
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
