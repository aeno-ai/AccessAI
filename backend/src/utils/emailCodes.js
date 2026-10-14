const crypto = require('crypto');
const bcrypt = require('bcrypt');
const EmailCode = require('../models/EmailCode');
const { sendMail } = require('./mailer');
const { releaseCodeSlot } = require('./codeGate');

const CODE_TTL_MINUTES = 10;
// Wrong guesses allowed per code. 5 guesses at a 6-digit code is a
// 1-in-200,000 chance; after that a new code has to be emailed.
const MAX_ATTEMPTS = 5;

const EMAIL_TEXT = {
  verify_email: 'Enter this code in AccessAI to finish creating your account:',
  reset_password: 'Enter this code in AccessAI to reset your password:',
  delete_account: 'Enter this code in AccessAI to confirm deleting your account:',
  change_email: 'Enter this code in AccessAI to confirm your new email address:',
};

// Emails `user` a fresh code for `purpose`, replacing any earlier one. The
// caller has already taken a slot from utils/codeGate.js (the 60 s wait and
// the daily cap); `kind` is that slot's kind (default: the purpose).
// The code goes to the account's own email, except when changing email:
// then it goes to the NEW address (`to`), which proves the person owns it,
// and that address is kept with the code.
//
// The code's `delivery` goes 'sending' → 'sent' or 'failed', so the app can
// tell the person when an email didn't go out (GET /auth/code-status).
// A failed send gives the slot back, so "Resend code" works at once.
async function sendCode(user, purpose, { to = user.email, newEmail = null, kind = purpose } = {}) {
  const now = Date.now();

  // randomInt, not Math.random: the code has to be unguessable.
  const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  await EmailCode.updateOne(
    { userId: user._id, purpose },
    {
      codeHash: await bcrypt.hash(code, 10),
      attempts: 0,
      sentAt: new Date(now),
      expiresAt: new Date(now + CODE_TTL_MINUTES * 60 * 1000),
      newEmail,
      delivery: 'sending',
    },
    { upsert: true },
  );

  try {
    await sendMail({
      to,
      // The code is in the subject so it shows in the notification — no
      // need to open the email at all.
      subject: `${code} is your AccessAI code`,
      text: `${EMAIL_TEXT[purpose]}\n\n${code}\n\nIt expires in ${CODE_TTL_MINUTES} minutes. If you didn't ask for this, you can ignore this email.`,
    });
  } catch (error) {
    console.error(`[mail] code (${kind}) to user ${user._id}: failed: ${error.responseCode ? `${error.responseCode} ` : ''}${error.message}`);
    await EmailCode.updateOne({ userId: user._id, purpose }, { delivery: 'failed' }).catch(() => undefined);
    await releaseCodeSlot(to, kind).catch(() => undefined);
    throw error;
  }

  await EmailCode.updateOne({ userId: user._id, purpose }, { delivery: 'sent' });
  console.log(`[mail] code (${kind}) to user ${user._id}: sent in ${((Date.now() - now) / 1000).toFixed(1)} s`);
  return { sent: true };
}

/** Whether the newest code for this account and purpose went out ('sending' | 'sent' | 'failed'). */
async function codeDelivery(userId, purpose) {
  const entry = await EmailCode.findOne({ userId, purpose }).select('delivery').lean();
  // No live code (used, expired, or from before delivery was tracked): nothing failed.
  return entry?.delivery ?? 'sent';
}

// The code's entry (truthy) only if `code` is the account's live code for
// `purpose`, else null. A correct code is used up; a wrong one counts toward
// MAX_ATTEMPTS. The entry carries `newEmail` for a change of email.
async function checkCode(userId, purpose, code) {
  // The attempt is counted before comparing, in one atomic step, so
  // guesses sent in parallel can't slip past MAX_ATTEMPTS.
  const entry = await EmailCode.findOneAndUpdate(
    { userId, purpose, attempts: { $lt: MAX_ATTEMPTS }, expiresAt: { $gt: new Date() } },
    { $inc: { attempts: 1 } },
  );
  if (!entry || !(await bcrypt.compare(code, entry.codeHash))) return null;

  await EmailCode.deleteOne({ _id: entry._id });
  return entry;
}

module.exports = { sendCode, checkCode, codeDelivery };
