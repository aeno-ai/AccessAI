const { body } = require('express-validator');
const { GENERIC } = require('./common');

// The address expo-notifications gives a phone, e.g. ExponentPushToken[xxxx].
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,100}\]$/;

const deviceIdRule = body('deviceId')
  .isString()
  .withMessage(GENERIC)
  .bail()
  .matches(/^[A-Za-z0-9-]{8,64}$/)
  .withMessage(GENERIC);

const registerTokenValidators = [
  body('token').isString().withMessage(GENERIC).bail().matches(EXPO_TOKEN).withMessage(GENERIC),
  deviceIdRule,
  body('platform').isString().withMessage(GENERIC).bail().isIn(['android', 'ios']).withMessage(GENERIC),
];

const removeTokenValidators = [deviceIdRule];

module.exports = { registerTokenValidators, removeTokenValidators };
