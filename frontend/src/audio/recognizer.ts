import { requireOptionalNativeModule } from 'expo';
import type * as SpeechRecognition from 'expo-speech-recognition';

/**
 * The ONE place that talks to the phone's speech recognizer.
 *
 * The phone has a single recognizer, but several parts of the app want it:
 * the mic in Conversation, the mic in each friend chat, Laya's "listening…"
 * and the "Hey Laya" listener. The native module sends every result to
 * every listener — so without this, words said in one place would also land
 * in another screen's message box.
 *
 * Here the mic always has exactly one OWNER, and only the owner hears the
 * results. Taking the mic from someone else stops their session first and
 * waits for it to really end, so its last events can't leak into the new
 * one. "Blockers" (Laya open, an SOS countdown…) tell the "Hey Laya"
 * listener to pause. The app talking is NOT a blocker — "Hey Laya" keeps
 * listening so it can interrupt; it reads `appSpeech()` to ignore its own
 * voice.
 */
type SpeechModule = typeof SpeechRecognition.ExpoSpeechRecognitionModule;
type EventMap = SpeechRecognition.ExpoSpeechRecognitionNativeEventMap;

export const speechModule: SpeechModule | null = requireOptionalNativeModule('ExpoSpeechRecognition')
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-speech-recognition') as typeof SpeechRecognition).ExpoSpeechRecognitionModule
  : null;

export type RecognizerHandlers = {
  start?: () => void;
  speechstart?: () => void;
  speechend?: () => void;
  volumechange?: (event: EventMap['volumechange']) => void;
  result?: (event: EventMap['result']) => void;
  nomatch?: () => void;
  error?: (event: EventMap['error']) => void;
  end?: () => void;
  /** Someone else took the mic: reset to idle (no "end" will come). */
  preempted?: () => void;
};

const handlers = new Map<string, RecognizerHandlers>();
let owner: string | null = null;
let active = false; // a native session is running (its "end" hasn't arrived yet)
// abort() was sent and its "end" is on its way — never send it twice: each
// abort brings its own "end", and a spare one would stop the NEXT session.
let aborting = false;
// Who's waiting for the running session's "end" before taking the mic.
const endWaiters: (() => void)[] = [];
const blockers = new Set<string>();
const watchers = new Set<() => void>();
let subscribed = false;

/**
 * Looks at a finished result before its owner gets it; returning true keeps
 * it from the owner. Laya uses this to hear "Hey Laya" said into another
 * mic (Conversation, a friend chat) — there's only one recognizer.
 */
export type ResultInterceptor = (owner: string, event: EventMap['result']) => boolean;
let interceptor: ResultInterceptor | null = null;

function changed() {
  watchers.forEach((watch) => watch());
}

function dispatch<K extends keyof RecognizerHandlers>(name: K, ...args: Parameters<NonNullable<RecognizerHandlers[K]>>) {
  if (!owner) return;
  const handler = handlers.get(owner)?.[name] as ((...a: unknown[]) => void) | undefined;
  handler?.(...args);
}

function dispatchResult(event: EventMap['result']) {
  if (owner && event.isFinal && interceptor?.(owner, event)) return;
  dispatch('result', event);
}

function subscribeOnce() {
  if (subscribed || !speechModule) return;
  subscribed = true;
  speechModule.addListener('start', () => dispatch('start'));
  speechModule.addListener('speechstart', () => dispatch('speechstart'));
  speechModule.addListener('speechend', () => dispatch('speechend'));
  speechModule.addListener('volumechange', (event) => dispatch('volumechange', event));
  speechModule.addListener('result', dispatchResult);
  speechModule.addListener('nomatch', () => dispatch('nomatch'));
  speechModule.addListener('error', (event) => dispatch('error', event));
  speechModule.addListener('end', () => {
    active = false;
    aborting = false;
    if (endWaiters.length) {
      // This "end" belongs to a session that was stopped to hand the mic
      // over — its owner already knows.
      endWaiters.splice(0).forEach((resolve) => resolve());
      return;
    }
    dispatch('end');
    changed();
  });
}

/** Registers what `id` wants to hear while it owns the mic. Returns an unsubscribe. */
export function listen(id: string, eventHandlers: RecognizerHandlers): () => void {
  subscribeOnce();
  handlers.set(id, eventHandlers);
  return () => {
    if (handlers.get(id) === eventHandlers) handlers.delete(id);
  };
}

/**
 * Takes the mic for `id`. A session still running — or still stopping after
 * its owner let go — is stopped and waited out first, so its last events
 * (its "end" above all) can't land in the new session.
 */
export async function acquire(id: string): Promise<void> {
  subscribeOnce();
  if (owner === id) return;
  const previous = owner;
  if (active && speechModule) {
    await new Promise<void>((resolve) => {
      endWaiters.push(resolve);
      if (!aborting) {
        aborting = true;
        speechModule.abort();
      }
      // Never wait forever if the phone doesn't send "end".
      setTimeout(() => {
        const index = endWaiters.indexOf(resolve);
        if (index >= 0) {
          endWaiters.splice(index, 1);
          active = false;
          aborting = false;
          resolve();
        }
      }, 800);
    });
  }
  if (previous) handlers.get(previous)?.preempted?.();
  owner = id;
  changed();
}

/** Starts a recognition session for the current owner. */
export function startSession(id: string, options: SpeechRecognition.ExpoSpeechRecognitionOptions) {
  if (!speechModule || owner !== id) return;
  active = true;
  aborting = false;
  speechModule.start(options);
}

export function stopSession(id: string) {
  if (owner === id) speechModule?.stop();
}

export function abortSession(id: string) {
  if (owner === id && active && !aborting) {
    aborting = true;
    speechModule?.abort();
  }
}

/** Gives the mic back (after a session ended). */
export function release(id: string) {
  if (owner !== id) return;
  owner = null;
  changed();
}

export const isOwner = (id: string) => owner === id;
/** A native session is running (its "end" hasn't arrived yet). */
export const isActive = () => active;
export const currentOwner = () => owner;

/** Pause the "Hey Laya" listener while `reason` lasts (Laya talking, SOS…). */
export function block(reason: string) {
  if (blockers.has(reason)) return;
  blockers.add(reason);
  changed();
}

export function unblock(reason: string) {
  if (blockers.delete(reason)) changed();
}

export const isBlocked = () => blockers.size > 0;

/** Called whenever the owner or the blockers change. Returns an unsubscribe. */
export function watch(callback: () => void): () => void {
  watchers.add(callback);
  return () => watchers.delete(callback);
}

/** Sets the one result interceptor (see ResultInterceptor). Returns an unsubscribe. */
export function interceptResults(callback: ResultInterceptor): () => void {
  interceptor = callback;
  return () => {
    if (interceptor === callback) interceptor = null;
  };
}

// ---- what the app is saying right now (text-to-speech)
let speakingText: string | null = null;
let lastSpokenText: string | null = null;
let speechEndedAt = 0;

/** speechHelper reports what it's saying (null when it stops). */
export function setAppSpeech(text: string | null) {
  if (text === null) {
    if (speakingText !== null) speechEndedAt = Date.now();
  } else {
    lastSpokenText = text;
  }
  speakingText = text;
}

/** What the app is saying now (null if quiet), the last thing it said, and when it went quiet. */
export function appSpeech(): { text: string | null; last: string | null; endedAt: number } {
  return { text: speakingText, last: lastSpokenText, endedAt: speechEndedAt };
}
