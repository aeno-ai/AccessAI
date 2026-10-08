import { requireOptionalNativeModule } from 'expo';
import type * as SpeechRecognition from 'expo-speech-recognition';

/**
 * The ONE place that talks to the phone's speech recognizer.
 *
 * The phone has a single recognizer, but several parts of the app want it:
 * the mic in Conversation, the mic in each friend chat, Accel's "listening…"
 * and the "Hey Accel" listener. The native module sends every result to
 * every listener — so without this, words said in one place would also land
 * in another screen's message box.
 *
 * Here the mic always has exactly one OWNER, and only the owner hears the
 * results. Taking the mic from someone else stops their session first and
 * waits for it to really end, so its last events can't leak into the new
 * one. "Blockers" (Accel talking, an SOS countdown, AccessAI in the
 * background…) tell the "Hey Accel" listener to pause.
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
let active = false; // a native session is running
let waitForEnd: (() => void) | null = null;
const blockers = new Set<string>();
const watchers = new Set<() => void>();
let subscribed = false;

function changed() {
  watchers.forEach((watch) => watch());
}

function dispatch<K extends keyof RecognizerHandlers>(name: K, ...args: Parameters<NonNullable<RecognizerHandlers[K]>>) {
  if (!owner) return;
  const handler = handlers.get(owner)?.[name] as ((...a: unknown[]) => void) | undefined;
  handler?.(...args);
}

function subscribeOnce() {
  if (subscribed || !speechModule) return;
  subscribed = true;
  speechModule.addListener('start', () => dispatch('start'));
  speechModule.addListener('speechstart', () => dispatch('speechstart'));
  speechModule.addListener('speechend', () => dispatch('speechend'));
  speechModule.addListener('volumechange', (event) => dispatch('volumechange', event));
  speechModule.addListener('result', (event) => dispatch('result', event));
  speechModule.addListener('nomatch', () => dispatch('nomatch'));
  speechModule.addListener('error', (event) => dispatch('error', event));
  speechModule.addListener('end', () => {
    active = false;
    if (waitForEnd) {
      // This "end" belongs to a session that was stopped to hand the mic
      // over — its owner already knows.
      const resolve = waitForEnd;
      waitForEnd = null;
      resolve();
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

/** Takes the mic for `id`, stopping (and waiting out) whoever had it. */
export async function acquire(id: string): Promise<void> {
  subscribeOnce();
  if (owner === id) return;
  const previous = owner;
  if (previous && active && speechModule) {
    await new Promise<void>((resolve) => {
      waitForEnd = resolve;
      speechModule.abort();
      // Never wait forever if the phone doesn't send "end".
      setTimeout(() => {
        if (waitForEnd === resolve) {
          waitForEnd = null;
          active = false;
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
  speechModule.start(options);
}

export function stopSession(id: string) {
  if (owner === id) speechModule?.stop();
}

export function abortSession(id: string) {
  if (owner === id && active) speechModule?.abort();
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

/** Pause the "Hey Accel" listener while `reason` lasts (Accel talking, SOS…). */
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
