const { pushToUsers } = require('./push');
const { sendMail } = require('./mailer');

// "Your account was just signed in on another phone" (owner, HANDOFF §56).
// After a successful login, every OTHER phone still signed in to the account
// (its push entry, one per phone) gets a notification, and the account's
// email gets a note — so the owner hears about it even if those phones are
// off. Tapping the notification opens "Secure my account" in the app.

// The app sends its push device id with every request (X-Device-Id).
const deviceIdOf = (req) => {
  const id = req.get('X-Device-Id');
  return typeof id === 'string' && /^[\w-]{1,64}$/.test(id) ? id : null;
};

const PHONE = { android: 'an Android phone', ios: 'an iPhone' };

/**
 * Tells the account's other phones (and its email) about this login.
 * Returns how many other phones are signed in, for the new phone to show.
 * Never throws: a failed alert must not fail the login.
 */
function alertOtherDevices(req, user) {
  try {
    const here = deviceIdOf(req);
    const others = new Set((user.pushTokens ?? []).map((entry) => entry.deviceId).filter((id) => id && id !== here));
    if (!others.size) return 0;

    const what = PHONE[req.get('X-App-Platform')] ?? 'another phone';
    const when = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
    void pushToUsers([user._id], {
      title: 'New sign-in to your account',
      body: `Your AccessAI account was just signed in on ${what}. Not you? Tap to secure it.`,
      data: { type: 'login_alert' },
      channelId: 'chat_messages',
      exceptDeviceId: here,
    });
    const google = Boolean(user.googleId);
    void sendMail({
      to: user.email,
      subject: 'New sign-in to your AccessAI account',
      text: [
        `Hi ${user.firstName || user.name || ''},`.trim(),
        '',
        `Your AccessAI account was signed in on ${what} on ${when} (Philippine time).`,
        '',
        'If this was you, you can ignore this email.',
        google
          ? "If it wasn't you: open AccessAI, go to Edit profile → Secure my account and sign out the other phones, then check your Google account's security."
          : "If it wasn't you: open AccessAI, go to Edit profile → Secure my account, and change your password (that signs out every other phone).",
        '',
        '— AccessAI',
      ].join('\n'),
    }).catch((error) => console.error(`[login alert] email failed: ${error.message}`));
    return others.size;
  } catch (error) {
    console.error(`[login alert] ${error.message}`);
    return 0;
  }
}

module.exports = { alertOtherDevices, deviceIdOf };
