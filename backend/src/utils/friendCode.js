const crypto = require('crypto');
const User = require('../models/Users');

// No 0/O, 1/I/L — easy to read out loud and to type from a screen.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode() {
  const bytes = crypto.randomBytes(8);
  const chars = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

// "abcd 2345", "ABCD2345" and "abcd-2345" all mean ABCD-2345. Null if it
// can't be a code at all.
function normalizeFriendCode(input) {
  const compact = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return compact.length === 8 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : null;
}

// The account's friend code, made (and saved) the first time it's needed.
// 31^8 possible codes, so a clash is vanishingly rare — but it's retried
// anyway, since the unique index would otherwise reject the save.
async function ensureFriendCode(user) {
  if (user.friendCode) {
    return user.friendCode;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const updated = await User.findOneAndUpdate(
      { _id: user._id, friendCode: { $exists: false } },
      { friendCode: code },
      { new: true },
    ).catch((error) => {
      if (error.code === 11000) return null; // that code is taken — try another
      throw error;
    });
    if (updated) {
      return updated.friendCode;
    }
    // Either the code clashed, or another request just gave this account one.
    const fresh = await User.findById(user._id).select('friendCode');
    if (fresh?.friendCode) {
      return fresh.friendCode;
    }
  }
  throw new Error('Could not create a friend code');
}

module.exports = { ensureFriendCode, normalizeFriendCode };
