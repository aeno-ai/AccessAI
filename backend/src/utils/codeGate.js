const crypto = require('crypto');
const CodeRequest = require('../models/CodeRequest');

// One honest cooldown per email address and kind of code, the same whether
// or not the address has an account (so it can't be used to probe which
// emails are registered):
// - at most one code a minute — "Resend" or going back and asking again
//   can't flood an inbox, and the app shows the real wait;
// - at most 5 a day per kind, so a busy sign-up never blocks a password
//   reset, and nobody can use us to spam an address.
const WAIT_SECONDS = 60;
const DAILY_LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

// The kinds of code (purpose of the email). 'add_password' is the code a
// Google-made account uses to set a password in Edit profile.
const KINDS = ['verify_email', 'reset_password', 'add_password', 'change_email', 'delete_account'];

const keyOf = (email, kind) =>
  crypto.createHash('sha256').update(`${kind}:${String(email).trim().toLowerCase()}`).digest('hex');

/**
 * Takes the next code slot for `email` and `kind`. Returns
 * { ok: true, retryAfter } when a code may be sent (retryAfter: the wait
 * before the next one), or { ok: false, reason: 'wait' | 'daily', retryAfter }.
 * Two requests at the same moment can't both get a slot (compare-and-set).
 */
async function takeCodeSlot(email, kind) {
  const key = keyOf(email, kind);
  for (let tries = 0; tries < 3; tries += 1) {
    const now = new Date();
    const record = await CodeRequest.findOne({ key }).lean();
    if (!record) {
      try {
        await CodeRequest.create({
          key,
          lastSentAt: now,
          dayStart: now,
          dayCount: 1,
          expiresAt: new Date(now.getTime() + DAY_MS),
        });
        return { ok: true, retryAfter: WAIT_SECONDS };
      } catch (error) {
        if (error.code === 11000) continue; // someone else just made it — look again
        throw error;
      }
    }

    const secondsSince = (now - record.lastSentAt) / 1000;
    if (secondsSince < WAIT_SECONDS) {
      return { ok: false, reason: 'wait', retryAfter: Math.ceil(WAIT_SECONDS - secondsSince) };
    }
    const newDay = now - record.dayStart >= DAY_MS;
    if (!newDay && record.dayCount >= DAILY_LIMIT) {
      return { ok: false, reason: 'daily', retryAfter: Math.ceil((record.dayStart.getTime() + DAY_MS - now) / 1000) };
    }
    const update = newDay
      ? { lastSentAt: now, dayStart: now, dayCount: 1, expiresAt: new Date(now.getTime() + DAY_MS) }
      : { lastSentAt: now, $inc: { dayCount: 1 } };
    // Only if nobody took the slot since it was read.
    const result = await CodeRequest.updateOne({ key, lastSentAt: record.lastSentAt }, update);
    if (result.modifiedCount === 1) return { ok: true, retryAfter: WAIT_SECONDS };
  }
  return { ok: false, reason: 'wait', retryAfter: WAIT_SECONDS };
}

/** A code that couldn't be emailed: no wait for the next one, and it doesn't count toward today's 5. */
async function releaseCodeSlot(email, kind) {
  await CodeRequest.updateOne(
    { key: keyOf(email, kind), dayCount: { $gt: 0 } },
    { lastSentAt: new Date(0), $inc: { dayCount: -1 } },
  );
}

/** The 429 answer for a refused slot, in plain words. */
function slotRefused(slot, kind) {
  if (slot.reason === 'daily') {
    const what = kind === 'reset_password' ? 'reset codes' : 'codes';
    return {
      code: 'CODE_DAILY_LIMIT',
      message: `You've asked for too many ${what} today. Please try again tomorrow.`,
      retryAfter: slot.retryAfter,
    };
  }
  return {
    code: 'CODE_WAIT',
    message: `Please wait ${slot.retryAfter} seconds before asking for another code.`,
    retryAfter: slot.retryAfter,
  };
}

module.exports = { takeCodeSlot, releaseCodeSlot, slotRefused, KINDS, WAIT_SECONDS, DAILY_LIMIT, keyOf };
