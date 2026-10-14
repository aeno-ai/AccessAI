// Lets Node load src/learn/clips.ts for scripts/learn-check.ts: to the app a
// bundled clip is just a number, so a stand-in number is enough here.
/// <reference types="node" />
for (const extension of ['.mp4', '.m4v', '.mov']) {
  require.extensions[extension] = (module) => {
    module.exports = 1;
  };
}
