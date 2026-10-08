import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import type * as SpeechRecognition from 'expo-speech-recognition';
import {
  abortSession,
  acquire,
  isActive,
  isOwner,
  listen,
  release,
  speechModule,
  startSession,
  stopSession,
} from '@/audio/recognizer';
import type { OfflineSpeechLanguage } from '@/hooks/use-preferences';
import { localeFor, type ClauseLanguage } from '@/utils/speechHelper';

type SpeechModule = typeof SpeechRecognition.ExpoSpeechRecognitionModule;

// The phone's speech recognizer lives in audio/recognizer.ts (one owner of
// the mic at a time). It's null where it isn't built in — Expo Go and the
// web — and the mic then falls back to the keyboard's own dictation.

/** True in a development or store build; false in Expo Go and on the web. */
export const speechToTextSupported = speechModule !== null;

// Android's on-device recognizer (part of Android System Intelligence). The
// only Android service that works without internet, once the phone has
// downloaded the language.
const ANDROID_ON_DEVICE_SERVICE = 'com.google.android.as';

const LANGUAGE_NAMES: Record<ClauseLanguage, string> = { en: 'English', fil: 'Filipino' };

/**
 * Where a listening session is:
 * - starting: tapped, checking permission and picking a recognizer
 * - listening: the mic is open, waiting for speech
 * - hearing: speech is being picked up right now
 */
export type ListeningPhase = 'idle' | 'starting' | 'listening' | 'hearing';

export type SpeechMessage = {
  text: string;
  kind: 'error' | 'info';
  /** Android only: a language can be downloaded for offline use. */
  canDownload?: boolean;
};

const normalizeLocale = (locale: string) => locale.replace('_', '-').toLowerCase();
// Older Android versions list Filipino under Tagalog's code.
const primaryLanguage = (locale: string) => {
  const code = normalizeLocale(locale).split('-')[0];
  return code === 'tl' ? 'fil' : code;
};

// The phone's own name for `wanted` among `available`: the exact locale if
// it has it, otherwise any locale of the same language (an "en-GB" model
// still understands English).
function findLocale(available: string[], wanted: string): string | null {
  return (
    available.find((locale) => normalizeLocale(locale) === normalizeLocale(wanted)) ??
    available.find((locale) => primaryLanguage(locale) === primaryLanguage(wanted)) ??
    null
  );
}

async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

// One way of listening. A session may get several to try in turn (see
// planRecognition); the next is only used if one fails before hearing
// anything.
type Attempt = {
  lang: string;
  language: ClauseLanguage;
  onDevice: boolean;
  /** Android: a specific recognizer instead of the phone's default voice input. */
  servicePackage?: string;
};

type RecognitionPlan = { attempts: Attempt[] } | { message: SpeechMessage };

// Google's own online recognizers. Tried when the phone's default voice
// input — sometimes the manufacturer's — turns the language down.
const GOOGLE_SERVICES = ['com.google.android.tts', 'com.google.android.googlequicksearchbox'];

function googleFallbackService(module: SpeechModule): string | null {
  try {
    const available = module.getSpeechRecognitionServices();
    const current = module.getDefaultRecognitionService().packageName;
    return GOOGLE_SERVICES.find((service) => available.includes(service) && service !== current) ?? null;
  } catch {
    return null;
  }
}

/**
 * The order to try offline languages in. Each phone keeps one small
 * downloaded model per language, so offline only one language is heard at a
 * time; "auto" prefers Filipino (which also catches a lot of Taglish).
 */
function offlineOrder(preference: OfflineSpeechLanguage): ClauseLanguage[] {
  return preference === 'en' ? ['en', 'fil'] : ['fil', 'en'];
}

/**
 * The language is picked automatically — there's no language switch:
 * - Online, Google's Filipino recognizer, which also understands English and
 *   Taglish; English if the phone turns Filipino down.
 * - Offline, whichever language model is downloaded to the phone (Filipino
 *   first unless the user asked for English in Settings).
 * If nothing can work, says why before the mic even starts.
 */
async function planRecognition(module: SpeechModule, preference: OfflineSpeechLanguage): Promise<RecognitionPlan> {
  const online = await isOnline();
  const order = offlineOrder(preference);

  if (Platform.OS === 'android') {
    // Android lists exactly which languages are downloaded for offline use.
    let onDevice: { locales: string[]; installedLocales: string[] } | null = null;
    if (module.supportsOnDeviceRecognition()) {
      try {
        onDevice = await module.getSupportedLocales({ androidRecognitionServicePackage: ANDROID_ON_DEVICE_SERVICE });
      } catch {
        // Android 12 and below, or the service is missing: online only.
      }
    }

    const attempts: Attempt[] = [];
    if (online) {
      const google = googleFallbackService(module);
      for (const language of ['fil', 'en'] as const) {
        attempts.push({ lang: localeFor(language), language, onDevice: false });
        if (google) {
          attempts.push({ lang: localeFor(language), language, onDevice: false, servicePackage: google });
        }
      }
    } else if (onDevice) {
      for (const language of order) {
        const installed = findLocale(onDevice.installedLocales, localeFor(language));
        if (installed) {
          attempts.push({ lang: installed, language, onDevice: true, servicePackage: ANDROID_ON_DEVICE_SERVICE });
        }
      }
    }
    if (attempts.length > 0) {
      return { attempts };
    }

    const downloadable = Boolean(
      onDevice && order.some((language) => findLocale(onDevice.locales, localeFor(language))),
    );
    return {
      message: {
        kind: 'error',
        text: downloadable
          ? `Speech-to-text needs the internet until a language is downloaded to this phone. Connect once, then tap "Download for offline use".`
          : 'This phone can only turn speech into text with an internet connection.',
        canDownload: downloadable,
      },
    };
  }

  // iOS lists every language it recognizes, but not which of them work
  // offline — so offline it tries on-device in order, and the retry chain
  // moves on if a language isn't available.
  const { locales } = await module.getSupportedLocales({});
  const supported = (language: ClauseLanguage) => findLocale(locales, localeFor(language));

  if (online) {
    const attempts = (['fil', 'en'] as const)
      .map((language) => ({ language, lang: supported(language) }))
      .filter((entry): entry is { language: ClauseLanguage; lang: string } => entry.lang !== null)
      .map(({ language, lang }) => ({ lang, language, onDevice: false }));
    if (attempts.length > 0) {
      return { attempts };
    }
    return { message: { kind: 'error', text: "This phone can't turn speech into text." } };
  }
  if (module.supportsOnDeviceRecognition()) {
    const attempts = order
      .map((language) => ({ language, lang: supported(language) }))
      .filter((entry): entry is { language: ClauseLanguage; lang: string } => entry.lang !== null)
      .map(({ language, lang }) => ({ lang, language, onDevice: true }));
    if (attempts.length > 0) {
      return { attempts };
    }
  }
  return { message: { kind: 'error', text: 'This phone needs an internet connection to turn speech into text.' } };
}

type RecognitionError = Pick<SpeechRecognition.ExpoSpeechRecognitionErrorEvent, 'error' | 'code'>;

// Failures where a different recognizer or language might do better, so the
// next attempt is worth a try. Anything else (no speech, no permission…)
// would fail the same way again.
const RETRYABLE: SpeechRecognition.ExpoSpeechRecognitionErrorCode[] = [
  'language-not-supported',
  'service-not-allowed',
  'client',
];

// Android's own error number for "this language is supported, but not
// downloaded to the phone yet" (SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE).
const ANDROID_LANGUAGE_NOT_DOWNLOADED = 13;

function errorMessage({ error, code }: RecognitionError, attempt: Attempt | null): SpeechMessage {
  const name = attempt ? LANGUAGE_NAMES[attempt.language] : 'Speech';
  const text = ((): string => {
    switch (error) {
      case 'no-speech':
      case 'speech-timeout':
        return "Didn't catch that. Tap the mic and try again, closer to the phone.";
      case 'not-allowed':
        return "AccessAI isn't allowed to use the microphone. Turn it on in your phone's Settings.";
      case 'language-not-supported':
        if (Platform.OS === 'android' && code === ANDROID_LANGUAGE_NOT_DOWNLOADED) {
          return `${name} speech has to be downloaded to this phone first. Connect to the internet and tap "Download for offline use".`;
        }
        if (attempt?.onDevice) {
          return 'Speech-to-text isn\'t available offline on this phone. Connect to the internet and try again.';
        }
        return Platform.OS === 'android'
          ? `This phone's voice input can't turn speech into text. Set "Speech Recognition & Synthesis from Google" as the voice input in Settings → Apps → Default apps, then try again.`
          : "This phone can't turn speech into text.";
      case 'network':
        return 'The internet connection dropped while listening. Try again.';
      case 'service-not-allowed':
        return Platform.OS === 'ios'
          ? 'Speech recognition is turned off. Turn on Siri & Dictation in Settings, then try again.'
          : "This phone's speech recognition isn't available. Check that the Google app is installed and up to date.";
      case 'audio-capture':
        return "Couldn't use the microphone. Make sure no other app is using it.";
      case 'interrupted':
        return 'Listening was interrupted. Tap the mic to try again.';
      case 'busy':
        return 'The microphone is busy. Try again in a moment.';
      default:
        return 'Something went wrong while listening. Try again.';
    }
  })();

  // Development builds also show what actually happened, so a failure on a
  // tester's phone can be diagnosed without a cable and logs.
  const details = __DEV__
    ? ` [${error}${code !== undefined ? ` ${code}` : ''}${
        attempt ? `, ${attempt.lang}, ${attempt.onDevice ? 'on-device' : 'online'}${attempt.servicePackage ? ` via ${attempt.servicePackage}` : ''}` : ''
      }]`
    : '';

  return {
    kind: 'error',
    text: text + details,
    canDownload: Platform.OS === 'android' && error === 'language-not-supported' && code === ANDROID_LANGUAGE_NOT_DOWNLOADED,
  };
}

// volumechange reports -2…10; anything at or below 0 is silence.
const toLevel = (value: number) => Math.max(0, Math.min(1, value / 10));

type UseSpeechToTextOptions = {
  /** Called with each finished piece of speech (after a pause, or on stop). */
  onFinal: (text: string) => void;
  /** Which downloaded language to prefer when listening offline. */
  offlineLanguage?: OfflineSpeechLanguage;
  /**
   * 'dictation' (default): messages, long and punctuated.
   * 'command': short spoken commands for Accel — tuned for a few words.
   */
  mode?: 'dictation' | 'command';
  /** Words to listen out for (iOS uses them as hints): names, "Accel"… */
  contextualStrings?: string[];
};

/**
 * Live speech-to-text for the conversation screens. Only does anything when
 * `speechToTextSupported` is true — check that first and offer the
 * keyboard's dictation instead when it isn't.
 */
export function useSpeechToText({
  onFinal,
  offlineLanguage = 'auto',
  mode = 'dictation',
  contextualStrings,
}: UseSpeechToTextOptions) {
  // Who this is, to the shared recognizer: only the mic's current owner
  // hears results (see audio/recognizer.ts).
  const owner = `stt-${useId()}`;
  const [phase, setPhase] = useState<ListeningPhase>('idle');
  const [interimText, setInterimText] = useState('');
  const [level, setLevel] = useState(0);
  // When the mic actually opened, for the elapsed-time display.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  // Set while listening offline — the one language being heard then.
  const [offlineLanguageName, setOfflineLanguageName] = useState<string | null>(null);
  const [message, setMessage] = useState<SpeechMessage | null>(null);
  // Read by the native event handlers, which are subscribed once.
  const onFinalRef = useRef(onFinal);
  const startingRef = useRef(false);
  // The current listening session: the ways to try, which one is running,
  // whether anything has been heard yet, and the error waiting for "end".
  const attemptsRef = useRef<Attempt[]>([]);
  const attemptIndexRef = useRef(0);
  const heardRef = useRef(false);
  const pendingErrorRef = useRef<RecognitionError | null>(null);

  const contextRef = useRef(contextualStrings);
  useEffect(() => {
    onFinalRef.current = onFinal;
    contextRef.current = contextualStrings;
  });

  const resetToIdle = useCallback(() => {
    setPhase('idle');
    setInterimText('');
    setLevel(0);
    setStartedAt(null);
    setOfflineLanguageName(null);
  }, []);

  const runAttempt = useCallback((attempt: Attempt) => {
    setOfflineLanguageName(attempt.onDevice ? LANGUAGE_NAMES[attempt.language] : null);
    startSession(owner, {
      // Commands: a few words, so the recognizer expects a short, search-like
      // phrase rather than a long dictated message.
      ...(mode === 'command'
        ? {
            iosTaskHint: 'search' as const,
            androidIntentOptions: { EXTRA_LANGUAGE_MODEL: 'web_search' },
            contextualStrings: contextRef.current,
          }
        : {}),
      lang: attempt.lang,
      interimResults: true,
      // Stops by itself after a pause (works on every Android version);
      // tapping the mic again carries on.
      continuous: false,
      // Android only punctuates with on-device recognition — asking the
      // online recognizer to makes it turn the language down.
      addsPunctuation: Platform.OS === 'ios' || attempt.onDevice,
      requiresOnDeviceRecognition: attempt.onDevice,
      // Drives the live level bars in the listening panel.
      volumeChangeEventOptions: { enabled: true, intervalMillis: 150 },
      ...(attempt.servicePackage ? { androidRecognitionServicePackage: attempt.servicePackage } : {}),
    });
  }, [owner, mode]);

  useEffect(() => {
    if (!speechModule) {
      return;
    }
    const unsubscribe = listen(owner, {
      // The mic is actually open now — before this, it's still "starting".
      start: () => {
        setPhase('listening');
        setStartedAt((current) => current ?? Date.now());
      },
      speechstart: () => setPhase('hearing'),
      speechend: () => setPhase((current) => (current === 'idle' ? current : 'listening')),
      volumechange: (event) => setLevel(toLevel(event.value)),
      result: (event) => {
        heardRef.current = true;
        const transcript = event.results[0]?.transcript ?? '';
        if (!event.isFinal) {
          // Not every recognizer sends "speechstart"; words arriving prove it.
          setPhase('hearing');
          setInterimText(transcript);
          return;
        }
        setInterimText('');
        if (transcript.trim()) {
          onFinalRef.current(transcript.trim());
        }
      },
      nomatch: () => {
        pendingErrorRef.current ??= { error: 'no-speech' };
      },
      // An error is always followed by "end" — what to do about it is
      // decided there, so a retry doesn't get cut off by the failed
      // attempt's own "end".
      error: (event) => {
        setInterimText('');
        // "aborted" is this hook cancelling on purpose — nothing to report.
        pendingErrorRef.current = event.error === 'aborted' ? null : { error: event.error, code: event.code };
      },
      // Someone else (Accel, or another screen's mic) took the mic.
      preempted: () => {
        attemptsRef.current = [];
        pendingErrorRef.current = null;
        resetToIdle();
      },
      end: () => {
        const error = pendingErrorRef.current;
        pendingErrorRef.current = null;
        const attempts = attemptsRef.current;
        const next = attemptIndexRef.current + 1;
        if (error && !heardRef.current && RETRYABLE.includes(error.error) && next < attempts.length) {
          attemptIndexRef.current = next;
          setPhase('starting');
          runAttempt(attempts[next]);
          return;
        }
        release(owner);
        resetToIdle();
        if (error) {
          setMessage(errorMessage(error, attempts[attemptIndexRef.current] ?? null));
        }
      },
    });
    return () => {
      unsubscribe();
      // Only stops the mic if it's this screen's session.
      if (isOwner(owner)) {
        if (isActive()) abortSession(owner);
        release(owner);
      }
    };
  }, [owner, runAttempt, resetToIdle]);

  const start = useCallback(async () => {
    if (!speechModule || startingRef.current) {
      return;
    }
    startingRef.current = true;
    setMessage(null);
    setInterimText('');
    setPhase('starting');
    try {
      const permission = await speechModule.requestPermissionsAsync();
      if (!permission.granted) {
        setPhase('idle');
        setMessage(errorMessage({ error: 'not-allowed' }, null));
        return;
      }

      const plan = await planRecognition(speechModule, offlineLanguage);
      if ('message' in plan) {
        setPhase('idle');
        setMessage(plan.message);
        return;
      }

      // Take the mic (stopping "Hey Accel" or another screen's session first).
      await acquire(owner);
      attemptsRef.current = plan.attempts;
      attemptIndexRef.current = 0;
      heardRef.current = false;
      pendingErrorRef.current = null;
      runAttempt(plan.attempts[0]);
    } catch {
      setPhase('idle');
      setMessage(errorMessage({ error: 'unknown' }, null));
    } finally {
      startingRef.current = false;
    }
  }, [offlineLanguage, runAttempt, owner]);

  /** Stops listening and keeps what was heard so far. */
  const stop = useCallback(() => {
    stopSession(owner);
  }, [owner]);

  /** Stops listening and throws away anything not yet finished. */
  const cancel = useCallback(() => {
    // No retry after this: the session is over.
    attemptsRef.current = [];
    if (isOwner(owner)) {
      // The session's own "end" gives the mic back; with none running, now.
      if (isActive()) abortSession(owner);
      else release(owner);
    }
    resetToIdle();
  }, [owner, resetToIdle]);

  /**
   * Android only: downloads a language for offline recognition — Filipino
   * first (or English, if that's the user's offline preference), falling
   * back to the other if the phone doesn't offer it.
   */
  const downloadOfflineModel = useCallback(async () => {
    if (!speechModule) {
      return;
    }
    for (const language of offlineOrder(offlineLanguage)) {
      const name = LANGUAGE_NAMES[language];
      try {
        const result = await speechModule.androidTriggerOfflineModelDownload({ locale: localeFor(language) });
        setMessage({
          kind: 'info',
          text:
            result.status === 'download_success'
              ? `${name} speech now works offline.`
              : result.status === 'download_scheduled'
                ? `Downloading ${name} speech for offline use. It may wait until you're on Wi-Fi.`
                : `Follow the prompt to download ${name} speech for offline use.`,
        });
        return;
      } catch {
        // Not offered on this phone — try the next language.
      }
    }
    setMessage({ kind: 'error', text: "Couldn't start the download. Connect to the internet and try again." });
  }, [offlineLanguage]);

  const clearMessage = useCallback(() => setMessage(null), []);

  return {
    phase,
    listening: phase !== 'idle',
    interimText,
    level,
    startedAt,
    offlineLanguageName,
    message,
    clearMessage,
    start,
    stop,
    cancel,
    downloadOfflineModel,
  };
}
