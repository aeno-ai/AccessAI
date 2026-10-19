// https://docs.expo.dev/versions/v57.0.0/config/metro/
const { getDefaultConfig } = require('expo/metro-config');
const { buildSignClips } = require('./scripts/build-sign-clips');

// Learn's sign clips: list whatever is in assets/signs/ each time the bundler
// starts, so a new recording only needs a restart (`npx expo start -c`).
buildSignClips();

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// The sign models' weights (assets/sign-models/*/model.bin), bundled as files.
config.resolver.assetExts.push('bin');

module.exports = config;
