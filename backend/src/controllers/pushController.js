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
    // Replace this phone's previous entry (same deviceId or same token) and
    // add the new one in a single step, so two saves arriving together can
    // never both add it (that used to leave duplicates — and duplicate
    // notifications). $literal: these are plain values, never field names.
    await User.updateOne(
      { _id: me },
      [
        {
          $set: {
            pushTokens: {
              $slice: [
                {
                  $concatArrays: [
                    {
                      $filter: {
                        input: { $ifNull: ['$pushTokens', []] },
                        cond: {
                          $and: [
                            { $ne: ['$$this.deviceId', { $literal: deviceId }] },
                            { $ne: ['$$this.token', { $literal: token }] },
                          ],
                        },
                      },
                    },
                    [{ token: { $literal: token }, deviceId: { $literal: deviceId }, platform: { $literal: platform }, updatedAt: '$$NOW' }],
                  ],
                },
                -MAX_PHONES,
              ],
            },
          },
        },
      ],
      { updatePipeline: true },
    );
    res.json({ saved: true });
  } catch (error) {
    next(error);
  }
};

// This phone stops getting this account's notifications. Also used by
// POST /auth/logout.
const removePushDevice = (userId, deviceId) =>
  User.updateOne({ _id: userId }, { $pull: { pushTokens: { deviceId } } });

// Signing out (older app versions; newer ones use POST /auth/logout).
const removeToken = async (req, res, next) => {
  try {
    await removePushDevice(req.user.userId, req.body.deviceId);
    res.json({ removed: true });
  } catch (error) {
    next(error);
  }
};

module.exports = { registerToken, removeToken, removePushDevice };
