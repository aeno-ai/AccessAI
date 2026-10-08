const User = require('../models/Users');

const MAX_PHONES = 10;

// Saves this phone's push address for the signed-in user.
//
// A phone can only belong to one account at a time: if the same token was
// saved for someone else (they signed out without internet, then a new
// person signed in on that phone), it's removed from them first — otherwise
// they'd keep getting the new person's notifications.
const registerToken = async (req, res, next) => {
  try {
    const me = req.user.userId;
    const { token, deviceId, platform } = req.body;
    await User.updateMany({ _id: { $ne: me }, 'pushTokens.token': token }, { $pull: { pushTokens: { token } } });
    // Replace this phone's previous entry (same deviceId or same token).
    await User.updateOne({ _id: me }, { $pull: { pushTokens: { deviceId } } });
    await User.updateOne({ _id: me }, { $pull: { pushTokens: { token } } });
    await User.updateOne(
      { _id: me },
      { $push: { pushTokens: { $each: [{ token, deviceId, platform, updatedAt: new Date() }], $slice: -MAX_PHONES } } },
    );
    res.json({ saved: true });
  } catch (error) {
    next(error);
  }
};

// Signing out: this phone stops getting this account's notifications.
const removeToken = async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user.userId }, { $pull: { pushTokens: { deviceId: req.body.deviceId } } });
    res.json({ removed: true });
  } catch (error) {
    next(error);
  }
};

module.exports = { registerToken, removeToken };
