// Lets Node load src/utils/speechHelper.ts for scripts/speech-check.ts:
// stand-ins for the phone's speech engine and React Native. The fake engine
// says each utterance until the check calls `finish()` (or a stop ends it).
/// <reference types="node" />
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('node:module') as { _load: (request: string, ...rest: unknown[]) => unknown };

type Utterance = { text: string; onDone?: () => void; onStopped?: () => void };

export const engine = {
  /** Everything the phone was asked to say, in order. */
  said: [] as string[],
  /** What it's saying now. */
  playing: [] as Utterance[],
  /** Some phones don't always report that a stop happened. */
  reportsStops: true,
  /** The utterance now playing ends by itself. */
  finish() {
    const utterance = engine.playing.shift();
    utterance?.onDone?.();
  },
};

const fakeSpeech = {
  speak(text: string, options: { onDone?: () => void; onStopped?: () => void } = {}) {
    engine.said.push(text);
    engine.playing.push({ text, onDone: options.onDone, onStopped: options.onStopped });
  },
  async stop() {
    const stopped = engine.playing.splice(0);
    if (engine.reportsStops) for (const utterance of stopped) utterance.onStopped?.();
  },
};

const load = Module._load;
Module._load = function (request: string, ...rest: unknown[]) {
  if (request === 'expo-speech') return fakeSpeech;
  if (request === 'react-native') return { Platform: { OS: 'android' } };
  if (request === 'expo') return { requireOptionalNativeModule: () => null };
  return load.call(this, request, ...rest);
};
