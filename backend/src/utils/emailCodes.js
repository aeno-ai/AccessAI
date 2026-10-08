const crypto = require('crypto');
const bcrypt = require('bcrypt');
const EmailCode = require('../models/EmailCode');
const { sendMail } = require('./mailer');

const CODE_TTL_MINUTES = 10;
// Shortest wait between two emails for the same account and purpose. Keeps
// "Resend code" from flooding someone's inbox — or our sending limit.
const RESEND_WAIT_SECONDS = 60;
// Wrong guesses allowed per code. 5 guesses at a 6-digit code is a
// 1-in-200,000 chance; after that a new code has to be emailed.
const MAX_ATTEMPTS = 5;

const EMAIL_TEXT = {
  verify_email: 'Enter this code in AccessAI to finish creating your account:',
  reset_password: 'Enter this code in AccessAI to reset your password:',
  delete_account: 'Enter this code in AccessAI to confirm deleting your account:',
};

// Emails `user` a fresh code for `purpose`, replacing any earlier one.
// Returns { sent: true }, or { sent: false, retryAfter } (in seconds) when
// the last code went out too recently.
async function sendCode(user, purpose) {
  const now = Date.now();
  const previous = await EmailCode.findOne({ userId: user._id, purpose }).select('sentAt').lean();
  if (previous) {
    const secondsSince = (now - previous.sentAt.getTime()) / 1000;
    if (secondsSince < RESEND_WAIT_SECONDS) {
      return { sent: false, retryAfter: Math.ceil(RESEND_WAIT_SECONDS - secondsSince) };
    }
  }

  // randomInt, not Math.random: the code has to be unguessable.
  const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  await EmailCode.updateOne(
    { userId: user._id, purpose },
    {
      codeHash: await bcrypt.hash(code, 10),
      attempts: 0,
      sentAt: new Date(now),
      expiresAt: new Date(now + CODE_TTL_MINUTES * 60 * 1000),
    },
    { upsert: true },
  );

  try {
    await sendMail({
      to: user.email,
      // The code is in the subject so it shows in the notification — no
      // need to open the email at all.
      subject: `${code} is your AccessAI code`,
      text: `${EMAIL_TEXT[purpose]}\n\n${code}\n\nIt expires in ${CODE_TTL_MINUTES} minutes. If you didn't ask for this, you can ignore this email.`,
    });
  } catch (error) {
    // Nobody received this code, so don't let it block a retry.
    await EmailCode.deleteOne({ userId: user._id, purpose });
    throw error;
  }

  return { sent: true };
}

// True only if `code` is the account's live code for `purpose`. A correct
// code is used up; a wrong one counts toward MAX_ATTEMPTS.
async function checkCode(userId, purpose, code) {
  // The attempt is counted before comparing, in one atomic step, so
  // guesses sent in parallel can't slip past MAX_ATTEMPTS.
  const entry = await EmailCode.findOneAndUpdate(
    { userId, purpose, attempts: { $lt: MAX_ATTEMPTS }, expiresAt: { $gt: new Date() } },
    { $inc: { attempts: 1 } },
  );
  if (!entry || !(await bcrypt.compare(code, entry.codeHash))) return false;

  await EmailCode.deleteOne({ _id: entry._id });
  return true;
}

module.exports = { sendCode, checkCode };
