import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { setAppSpeech } from '@/audio/recognizer';
import { analyzeSpeechClauses, type ClauseLanguage, type SpeechClause } from '@/utils/clauses';

export { analyzeSpeechClauses, classifyClause, splitIntoClauses, type ClauseLanguage, type SpeechClause } from '@/utils/clauses';

/**
 * Handles "Taglish" messages — English and Filipino mixed in the same
 * sentence (e.g. "I'm gonna kain na, sobrang gutom ko") — by reading each
 * clause aloud in whichever language it's actually written in, instead of
 * reading the whole message in one language.
 *
 * `expo-speech` can only set one `language` per call to `Speech.speak()` —
 * there's no way to switch language mid-utterance. So the practical unit
 * of "switching" is a clause, not a single word: this file splits a
 * message into clauses at natural boundaries (commas, periods, and a
 * handful of Filipino conjunctions), decides each clause's language from
 * whether it contains recognizably-Filipino words, then speaks the clauses
 * one after another, back to back, swapping the voice language between
 * them. A clause that itself mixes languages (e.g. "I'm gonna kain na,")
 * is read as whichever language it leans toward as a whole — true
 * word-by-word switching isn't possible with a single TTS engine call.
 */

const FILIPINO_LOCALE = 'fil-PH';
const ENGLISH_LOCALE = 'en-US';

/** The voice locale for a language. Also used for speech-to-text (hooks/use-speech-to-text.ts). */
export function localeFor(language: ClauseLanguage): string {
  return language === 'fil' ? FILIPINO_LOCALE : ENGLISH_LOCALE;
}

/** A specific voice per language (ids from utils/voices.ts); null = the phone's normal voice. */
export type ClauseVoices = { en?: string | null; fil?: string | null };

// The app-wide voice (Settings → Conversation & speech → Voice), set by
// hooks/use-app-voice.ts so every caller of speakMixed follows it.
let defaultVoices: ClauseVoices = {};
export function setDefaultVoices(voices: ClauseVoices): void {
  defaultVoices = voices;
}

// Ends the clause being spoken right now. A stop ends it at once, without
// waiting for the phone to report it stopped.
let endClause: (() => void) | null = null;

function speakClause(clause: SpeechClause, rate: number, voice: string | null | undefined): Promise<void> {
  return new Promise((resolve) => {
    endClause = resolve;
    Speech.speak(clause.text, {
      // Android reads "fil-PH" as one unknown language, so it gets the plain
      // language code; iPhones want the full locale.
      language: Platform.OS === 'android' ? clause.language : localeFor(clause.language),
      rate,
      pitch: 1,
      ...(voice ? { voice } : {}),
      onDone: resolve,
      onStopped: resolve,
      // A voice the phone no longer has: say it again in the normal voice.
      onError: () => (voice ? void speakClause(clause, rate, null).then(resolve) : resolve()),
    });
  });
}

// "Hey Laya" keeps listening while the app talks (so it can interrupt), and
// is told what's being said, so the app's own voice can't wake it.
let speaking = 0;

// Bumped by every stop. A message started before the last stop never goes
// on: its clause-by-clause loop checks this before each clause.
let generation = 0;

// The message being spoken now: who started it, and whether it's about an
// SOS. Null when the app is quiet.
let current: { generation: number; owner: string | null; sos: boolean } | null = null;

function stopAll(): void {
  generation += 1;
  current = null;
  void Speech.stop();
  endClause?.();
  endClause = null;
}

export type SpeakOptions = {
  /** The user's voice speed (1 = normal), from Settings. */
  rate?: number;
  voices?: ClauseVoices;
  /**
   * About an SOS. Only more SOS speech, or an SOS screen's own stop, cuts it
   * off; ordinary speech that starts meanwhile is skipped.
   */
  sos?: boolean;
  /** Who's speaking, so `stopMixed({ owner })` stops only this. */
  owner?: string;
  /** Said to the end. */
  onDone?: () => void;
  /** Over for any reason: said to the end, cut off, or skipped. */
  onEnd?: () => void;
  onError?: (error: unknown) => void;
};

/**
 * Speaks a full message clause by clause, switching between the Filipino
 * and English voice as needed.
 *
 * The newest message always wins: whatever was being said stops first, so
 * tapping a read-aloud button again starts it over instead of piling up
 * readings. The one exception is SOS speech (`sos`).
 *
 * Resolves true when the message was said to the end, false when it was
 * cut off or skipped.
 */
export async function speakMixed(message: string, options: SpeakOptions = {}): Promise<boolean> {
  if (current?.sos && !options.sos) {
    options.onEnd?.();
    return false;
  }
  stopAll();
  const mine = generation;
  current = { generation: mine, owner: options.owner ?? null, sos: options.sos === true };
  speaking += 1;
  setAppSpeech(message);
  const voices = options.voices ?? defaultVoices;
  let said = false;
  try {
    for (const clause of analyzeSpeechClauses(message)) {
      if (mine !== generation) {
        return false;
      }
      await speakClause(clause, options.rate ?? 1, voices[clause.language]);
    }
    said = mine === generation;
    if (said) {
      options.onDone?.();
    }
    return said;
  } catch (error) {
    options.onError?.(error);
    return false;
  } finally {
    if (current?.generation === mine) {
      current = null;
    }
    speaking -= 1;
    // Counted as talking a little longer, so the end of the sentence (and
    // its echo) still counts as the app's own voice.
    if (speaking === 0) setTimeout(() => speaking === 0 && setAppSpeech(null), 400);
    options.onEnd?.();
  }
}

/**
 * Stops what `speakMixed` is saying, mid-message if needed.
 * - `owner`: only if that owner's message is the one playing, so a bubble
 *   or Laya stopping its own reading never cuts off someone else's.
 * - SOS speech stops only for an SOS screen (`sos: true`).
 */
export function stopMixed(options: { owner?: string; sos?: boolean } = {}): void {
  if (current?.sos && !options.sos) {
    return;
  }
  if (options.owner !== undefined && current?.owner !== options.owner) {
    return;
  }
  stopAll();
}
