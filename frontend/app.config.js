// Expo reads app.json first, then this file can adjust it.
//
// Push notifications on Android need Firebase's google-services.json (see
// HANDOFF.md §2.4). It's kept out of git (the repo is public), so:
// - EAS builds get it from the GOOGLE_SERVICES_JSON file variable set on
//   expo.dev (EAS puts the file on the build machine and this points to it);
// - local runs use frontend/google-services.json if it's there.
// With neither, it's left out and builds still work — just without push.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const local = fs.existsSync(path.join(__dirname, 'google-services.json')) ? './google-services.json' : undefined;
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || local;
  return {
    ...config,
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
