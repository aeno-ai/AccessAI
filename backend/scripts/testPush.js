// Sends a test push notification to every phone signed in to one account —
// for checking notifications with just one phone.
//
//   npm run test-push -- --email you@example.com              (an SOS-style alert)
//   npm run test-push -- --email you@example.com --channel chat_messages
//
// The phone must have the development build WITH notifications (rebuilt
// after expo-notifications was added), be signed in to that account, and
// have allowed notifications. Close AccessAI (or switch to another app)
// first, so the notification shows as a banner.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const { parseArgs } = require('util');
const mongoose = require('mongoose');
const User = require('../src/models/Users');

const HINTS = {
  InvalidCredentials:
    'Expo has no Firebase key for this app yet. Upload the FCM V1 service-account key: `npx eas-cli credentials` in frontend/ (see HANDOFF.md).',
  DeviceNotRegistered: 'This phone token is no longer valid (app reinstalled?). Open the app and sign in again.',
  MismatchSenderId: "google-services.json doesn't match the Firebase key uploaded to EAS — use the same Firebase project for both.",
  MessageRateExceeded: 'Too many test notifications — wait a minute.',
};

async function main() {
  const { values } = parseArgs({
    options: { email: { type: 'string' }, channel: { type: 'string', default: 'sos_alerts' } },
  });
  const email = values.email?.trim().toLowerCase();
  if (!email) throw new Error('Usage: npm run test-push -- --email you@example.com [--channel sos_alerts|sos_updates|chat_messages]');

  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email }).select('+pushTokens firstName');
  if (!user) throw new Error(`No account with email ${email}.`);
  const tokens = (user.pushTokens ?? []).map((entry) => entry.token);
  if (!tokens.length) {
    throw new Error(
      'No phone is registered for notifications on this account yet. On the phone: install the rebuilt dev APK, sign in, and tap Allow when asked about notifications. (Expo Go cannot receive push.)',
    );
  }

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(
      tokens.map((to) => ({
        to,
        title: values.channel === 'chat_messages' ? 'Test message' : '🚨 Test SOS notification',
        body: `Hi ${user.firstName || 'there'} — push notifications work. Tap to open AccessAI.`,
        channelId: values.channel,
        priority: 'high',
        sound: 'default',
        data: { type: 'sos', userId: String(user._id) },
      })),
    ),
  });
  const result = await response.json();
  (result.data ?? []).forEach((ticket, index) => {
    const phone = `phone ${index + 1} of ${tokens.length}`;
    if (ticket.status === 'ok') {
      console.log(`✓ ${phone}: Expo accepted it — it should appear on the phone within a few seconds.`);
    } else {
      const reason = ticket.details?.error;
      console.log(`✗ ${phone}: ${ticket.message}`);
      if (HINTS[reason]) console.log(`  → ${HINTS[reason]}`);
    }
  });
  if (result.errors) console.log(result.errors);
}

main()
  .catch((error) => {
    console.error(`\n${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
