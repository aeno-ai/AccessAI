import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  abortSession,
  acquire,
  appSpeech,
  currentOwner,
  isActive,
  isBlocked,
  isOwner,
  listen,
  release,
  speechModule,
  startSession,
  watch,
} from '@/audio/recognizer';
import { afterWakeWord, findWakeWord } from '@/accel/language';
import { googleFallbackService } from '@/hooks/use-speech-to-text';

/**
 * "Hey Accel" — free, with no paid wake-word engine: while AccessAI is open,
 * the phone's own speech recognizer listens the whole time, and wakes Accel
 * when it hears "Hey Accel" — or what speech recognition makes of it
 * ("Axel", "axle", "Excel"…, see findWakeWord in language.ts). A thesis
 * prototype: always on, no idle pause, battery cost accepted.
 *
 * Two ways of listening ("engines"):
 * - on-device: Android 13+ with Android's offline recognizer and English
 *   installed, or iPhone. Works with no internet; no audio leaves the phone.
 * - online: everywhere else (most non-Pixel phones) — the phone's normal
 *   voice input, usually the Google app. Without internet it asks that for
 *   its own offline English; if that's missing too, it waits for the
 *   internet and starts again by itself.
 *
 * It keeps listening while the app talks, so "Hey Accel" can interrupt —
 * then only "hey / okay … Accel" counts, and never while the app is itself
 * saying "Hey Accel" (the intro). It steps aside while another mic is in
 * use (Accel catches "Hey Accel" said into that mic instead, see
 * interceptResults), while Accel is open, during an SOS, and while AccessAI
 * is in the background. Android 12 and below restart it after each pause,
 * which may beep.
 */
export type WakeStatus =
  | 'off'
  | 'starting'
  | 'listening'
  | 'paused'
  | 'unsupported'
  | 'needs-download'
  | 'needs-permission'
  | 'needs-internet';

export type WakeEngine = 'on-device' | 'online';
/** no-app: the speech module isn't built in (Expo Go); no-recognizer: the phone has no voice typing. */
export type WakeUnsupportedReason = 'no-app' | 'no-recognizer';

const OWNER = 'wake-word';
const ON_DEVICE_SERVICE = 'com.google.android.as';
// After a bare "Hey Accel", how long to wait for a command said in the same
// breath ("hey accel… open friends") before opening Accel to listen.
const FOLLOW_UP_MS = 800;
// After "Hey Accel open fri…", how long a pause ends the command.
const COMMAND_SETTLE_MS = 1200;
// After the app stops talking, how long its voice still counts as its own
// (the echo, and results the recognizer delivers late).
const STRICT_AFTER_SPEECH_MS = 800;
const ECHO_AFTER_SPEECH_MS = 2000;
const NAME_HINTS = ['Hey Accel', 'Accel', 'Hey Axel', 'Axel'];

/** How to get the Google app's offline English (shown and spoken). */
export const OFFLINE_ENGLISH_STEPS =
  'In the Google app, tap your picture, then Settings, Voice, Offline speech recognition, and download English.';

// ---- tiny stores so Settings can show what "Hey Accel" is doing
function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next: T) => {
      if (Object.is(value, next)) return;
      value = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const statusStore = createStore<WakeStatus>('off');
const engineStore = createStore<WakeEngine | null>(null);
const reasonStore = createStore<WakeUnsupportedReason | null>(null);
const heardStore = createStore('');
const offlineMissingStore = createStore(false);

export const useWakeStatus = () => useSyncExternalStore(statusStore.subscribe, statusStore.get);
/** Which way it's listening ('online' uses the internet when there is some). */
export const useWakeEngine = () => useSyncExternalStore(engineStore.subscribe, engineStore.get);
/** Why it can't work on this phone, when the status is 'unsupported'. */
export const useWakeUnsupportedReason = () => useSyncExternalStore(reasonStore.subscribe, reasonStore.get);
/** The newest thing it heard (≤ 60 characters), so testers can see what the phone hears. */
export const useWakeHeard = () => useSyncExternalStore(heardStore.subscribe, heardStore.get);
/** Listening online, and the phone may not have offline English yet. */
export const useWakeOfflineMissing = () => useSyncExternalStore(offlineMissingStore.subscribe, offlineMissingStore.get);

// ---- "check again" (after allowing the mic or downloading English)
const recheckStore = createStore(0);
/** Makes "Hey Accel" check the mic and English speech again, and start if it can. */
export function recheckWakeWord() {
  recheckStore.set(recheckStore.get() + 1);
}

/** False only where the speech module isn't built in (Expo Go). */
export const wakeWordSupported = speechModule !== null;

// The permission prompt is shown at most once per app launch.
let askedForMicThisLaunch = false;

/** The microphone is allowed — asking for it if it hasn't been refused for good. */
async function ensureMic(): Promise<boolean> {
  if (!speechModule) return false;
  const current = await speechModule.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain || askedForMicThisLaunch || AppState.currentState !== 'active') return false;
  askedForMicThisLaunch = true;
  const asked = await speechModule.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Which English the phone can listen in offline, with Android's own offline
 * recognizer (Android 13+). Uses the one actually installed (en-US, else
 * en-PH, else any English) — asking for en-US when only en-GB is there fails.
 */
async function englishOnDevice(): Promise<{ status: 'ok'; locale: string } | { status: 'needs-download' | 'unsupported' }> {
  if (!speechModule || !speechModule.supportsOnDeviceRecognition()) return { status: 'unsupported' };
  if (Platform.OS !== 'android') return { status: 'ok', locale: 'en-US' };
  if (Number(Platform.Version) < 33) return { status: 'unsupported' };
  try {
    const { installedLocales } = await speechModule.getSupportedLocales({ androidRecognitionServicePackage: ON_DEVICE_SERVICE });
    const english = installedLocales.map((locale) => locale.replace('_', '-')).filter((locale) => /^en\b/i.test(locale));
    if (!english.length) return { status: 'needs-download' };
    const pick =
      english.find((locale) => locale.toLowerCase() === 'en-us') ??
      english.find((locale) => locale.toLowerCase() === 'en-ph') ??
      english[0];
    return { status: 'ok', locale: pick };
  } catch {
    // This phone can't say which languages it has (a different speech
    // service): just try English, and an error will tell if it's missing.
    return { status: 'ok', locale: 'en-US' };
  }
}

function onlineAvailable(): boolean {
  try {
    return speechModule?.isRecognitionAvailable() ?? false;
  } catch {
    return false;
  }
}

type EngineChoice =
  | { engine: 'on-device'; locale: string }
  | { engine: 'online' }
  | { engine: null; status: 'needs-download' | 'unsupported' };

/** Offline on the phone if it can; otherwise the phone's normal voice input. */
async function chooseEngine(): Promise<EngineChoice> {
  const english = await englishOnDevice();
  if (english.status === 'ok') return { engine: 'on-device', locale: english.locale };
  if (onlineAvailable()) return { engine: 'online' };
  return { engine: null, status: english.status === 'needs-download' ? 'needs-download' : 'unsupported' };
}

// One way of running the online engine. If one fails before hearing
// anything, the next is tried: continuous (Android 13+ / iPhone, no beep)
// before restart-after-each-pause, the default voice input before Google's.
type OnlineSetup = { continuous: boolean; service?: string };

function onlineSetups(): OnlineSetup[] {
  const continuous = Platform.OS === 'ios' || Number(Platform.Version) >= 33;
  const google = Platform.OS === 'android' && speechModule ? googleFallbackService(speechModule) : null;
  const services: (string | undefined)[] = [undefined, ...(google ? [google] : [])];
  return [
    ...(continuous ? services.map((service) => ({ continuous: true, service })) : []),
    ...services.map((service) => ({ continuous: false, service })),
  ];
}

/**
 * Settings → Accel's "Get offline English": Android's own offline English
 * (Android 13+), or else how to get the Google app's.
 */
export async function downloadEnglishForWakeWord(): Promise<string> {
  if (!speechModule || Platform.OS !== 'android') return 'Nothing to download on this phone.';
  try {
    const result = await speechModule.androidTriggerOfflineModelDownload({ locale: 'en-US' });
    recheckWakeWord();
    return result.status === 'download_success'
      ? 'English is ready. "Hey Accel" works without internet now.'
      : result.status === 'download_scheduled'
        ? 'Downloading English. It may wait until you are on Wi-Fi.'
        : 'Follow the steps on the screen to download English.';
  } catch {
    return OFFLINE_ENGLISH_STEPS;
  }
}

const shorten = (text: string) => (text.length > 60 ? `…${text.slice(-59)}` : text);

/**
 * Listens for "Hey Accel" while `enabled`. Calls onWake with whatever was
 * said after it ("hey accel open friends" → "open friends"; just "hey
 * accel" → ""). `strict`: only "hey / okay … Accel" counts (TalkBack on).
 */
export function useWakeWord(enabled: boolean, onWake: (remainder: string) => void, options: { strict?: boolean } = {}) {
  const onWakeRef = useRef(onWake);
  const strictRef = useRef(options.strict ?? false);
  useEffect(() => {
    onWakeRef.current = onWake;
    strictRef.current = options.strict ?? false;
  });
  const recheck = useSyncExternalStore(recheckStore.subscribe, recheckStore.get);

  useEffect(() => {
    if (!enabled) {
      statusStore.set('off');
      engineStore.set(null);
      return;
    }
    if (!speechModule) {
      reasonStore.set('no-app');
      statusStore.set('unsupported');
      return;
    }
    let stopped = false;
    let ready = false;
    let engine: WakeEngine = 'on-device';
    let locale = 'en-US';
    let setups: OnlineSetup[] = [];
    let setupIndex = 0;
    let netOnline = true;
    // Online engine, no internet: this session asks for offline speech.
    let preferOffline = false;
    // Offline, and offline speech didn't work either.
    let waitingForInternet = false;
    let backoff = 500;
    let quickRestart = false;
    let restartTimer: ReturnType<typeof setTimeout> | undefined;
    let restartPending = false;
    let wakeTimer: ReturnType<typeof setTimeout> | undefined;
    // This session has heard something (so its errors aren't about the setup).
    let heardSomething = false;
    // What was said after the wake word, while waiting for the rest of it
    // (null = the wake word hasn't been heard).
    let afterWake: string | null = null;

    const canRun = () =>
      !stopped &&
      ready &&
      !waitingForInternet &&
      AppState.currentState === 'active' &&
      !isBlocked() &&
      (currentOwner() === null || currentOwner() === OWNER);

    const showWaiting = () => statusStore.set(waitingForInternet ? 'needs-internet' : 'paused');

    const sessionOptions = () => {
      const base = {
        lang: locale,
        interimResults: true,
        addsPunctuation: false,
        maxAlternatives: 5,
        contextualStrings: NAME_HINTS,
      };
      if (engine === 'on-device') {
        return {
          ...base,
          continuous: true,
          requiresOnDeviceRecognition: true,
          ...(Platform.OS === 'android' ? { androidRecognitionServicePackage: ON_DEVICE_SERVICE } : {}),
        };
      }
      const setup = setups[setupIndex] ?? { continuous: false };
      return {
        ...base,
        continuous: setup.continuous,
        requiresOnDeviceRecognition: false,
        ...(setup.service ? { androidRecognitionServicePackage: setup.service } : {}),
        ...(preferOffline && Platform.OS === 'android' ? { androidIntentOptions: { EXTRA_PREFER_OFFLINE: true } } : {}),
      };
    };

    const begin = async () => {
      restartPending = false;
      if (!canRun()) {
        if (ready && !stopped) showWaiting();
        return;
      }
      if (isOwner(OWNER) && isActive()) return;
      await acquire(OWNER);
      if (!canRun()) {
        release(OWNER);
        return;
      }
      heardSomething = false;
      preferOffline = engine === 'online' && !netOnline;
      startSession(OWNER, sessionOptions());
    };

    // One restart at a time, so a backed-off restart after errors isn't
    // replaced by a quick one (which used to retry every 300 ms forever).
    const scheduleRestart = (delay: number) => {
      if (restartPending || stopped) return;
      restartPending = true;
      clearTimeout(restartTimer);
      restartTimer = setTimeout(() => void begin(), delay);
    };

    const switchToOnline = () => {
      engine = 'online';
      locale = 'en-US';
      setups = onlineSetups();
      setupIndex = 0;
      engineStore.set('online');
      offlineMissingStore.set(Platform.OS === 'android');
    };

    const fire = () => {
      clearTimeout(wakeTimer);
      const said = afterWake ?? '';
      afterWake = null;
      abortSession(OWNER);
      onWakeRef.current(said);
    };

    const unlisten = listen(OWNER, {
      start: () => {
        backoff = 500;
        statusStore.set('listening');
      },
      result: (event) => {
        heardSomething = true;
        // Every guess the phone made, not just its first — "Accel" is often
        // only its second or third guess.
        const transcripts = event.results.map((result) => result.transcript ?? '');
        if (transcripts[0]) heardStore.set(shorten(transcripts[0]));

        // The app's own voice: while it talks (and just after), only "hey /
        // okay … Accel" counts — and nothing while it's itself saying "Hey
        // Accel" (the intro).
        const speech = appSpeech();
        const sinceSpeech = Date.now() - speech.endedAt;
        const talking = speech.text !== null || sinceSpeech < STRICT_AFTER_SPEECH_MS;
        const echo = speech.text ?? (sinceSpeech < ECHO_AFTER_SPEECH_MS ? speech.last : null);
        const sayingWakeWord = echo !== null && findWakeWord(echo) !== null;
        const strict = strictRef.current || talking;

        let rest: string | null = null;
        if (!sayingWakeWord) {
          for (const transcript of transcripts) {
            rest = afterWakeWord(transcript, { strict });
            if (rest !== null) break;
          }
        }
        if (rest === null) {
          if (afterWake === null) return; // not for Accel
          // The wake word came in the last breath; this is the command.
          rest = (transcripts[0] ?? '').trim();
          if (!rest) return;
        }
        afterWake = rest;
        clearTimeout(wakeTimer);
        wakeTimer = setTimeout(fire, event.isFinal && rest ? 0 : rest ? COMMAND_SETTLE_MS : FOLLOW_UP_MS);
      },
      error: (event) => {
        const error = event.error;
        // A quiet room, or this hook stopping on purpose: nothing wrong.
        if (error === 'aborted' || error === 'no-speech' || error === 'speech-timeout') return;
        if (error === 'not-allowed') {
          stopped = true;
          statusStore.set('needs-permission');
          return;
        }
        if (engine === 'on-device') {
          if (error === 'language-not-supported') {
            // English isn't really there offline: listen online instead.
            if (onlineAvailable()) {
              switchToOnline();
              quickRestart = true;
            } else {
              stopped = true;
              statusStore.set('needs-download');
            }
            return;
          }
          backoff = Math.min(backoff * 2, 30000);
          return;
        }
        // ---- online engine
        if (preferOffline && ['network', 'language-not-supported', 'service-not-allowed'].includes(error)) {
          // No internet, and no offline speech: wait for the internet.
          waitingForInternet = true;
          offlineMissingStore.set(true);
          return;
        }
        if (error === 'network') {
          backoff = Math.min(backoff * 2, 30000);
          return;
        }
        if (!heardSomething && ['language-not-supported', 'service-not-allowed', 'client'].includes(error) && setupIndex + 1 < setups.length) {
          setupIndex += 1;
          quickRestart = true;
          return;
        }
        if (error === 'language-not-supported' || error === 'service-not-allowed') {
          stopped = true;
          reasonStore.set('no-recognizer');
          statusStore.set('unsupported');
          return;
        }
        backoff = Math.min(backoff * 2, 30000);
      },
      end: () => {
        // Scheduled before giving the mic back, so the backoff wins over
        // the quick restart the "mic is free" watcher would start.
        if (!stopped && afterWake === null && !waitingForInternet) scheduleRestart(quickRestart ? 100 : backoff);
        quickRestart = false;
        release(OWNER);
        if (!stopped && !canRun()) showWaiting();
      },
    });

    // Someone else took the mic, Accel opened, an SOS…
    const unwatch = watch(() => {
      if (stopped || !ready) return;
      if (!canRun()) {
        if (isOwner(OWNER)) abortSession(OWNER);
        showWaiting();
      } else if (currentOwner() === null) {
        scheduleRestart(300);
      }
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // Back in AccessAI: the mic may need allowing now, or just a restart.
        if (!ready) void prepare();
        else scheduleRestart(300);
      } else if (isOwner(OWNER)) {
        abortSession(OWNER);
      }
    });
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      if (online === netOnline) return;
      netOnline = online;
      if (!ready || engine !== 'online') return;
      if (online && waitingForInternet) {
        // Back online: listen again by itself.
        waitingForInternet = false;
        backoff = 500;
        scheduleRestart(300);
      } else if (!online && isOwner(OWNER) && isActive()) {
        // Gone offline mid-session: start again asking for offline speech.
        quickRestart = true;
        abortSession(OWNER);
      }
    });

    const prepare = async () => {
      statusStore.set('starting');
      reasonStore.set(null);
      if (!(await ensureMic())) {
        if (!stopped) statusStore.set('needs-permission');
        return;
      }
      const net = await NetInfo.fetch().catch(() => null);
      if (net) netOnline = Boolean(net.isConnected && net.isInternetReachable !== false);
      const choice = await chooseEngine();
      if (stopped) return;
      if (choice.engine === null) {
        if (choice.status === 'unsupported') reasonStore.set('no-recognizer');
        statusStore.set(choice.status);
        return;
      }
      if (choice.engine === 'on-device') {
        engine = 'on-device';
        locale = choice.locale;
        engineStore.set('on-device');
        offlineMissingStore.set(false);
      } else {
        switchToOnline();
      }
      ready = true;
      scheduleRestart(0);
    };
    void prepare();

    return () => {
      stopped = true;
      clearTimeout(restartTimer);
      clearTimeout(wakeTimer);
      appState.remove();
      unsubscribeNet();
      unwatch();
      unlisten();
      if (isOwner(OWNER)) {
        if (isActive()) abortSession(OWNER);
        release(OWNER);
      }
      statusStore.set('off');
      engineStore.set(null);
    };
  }, [enabled, recheck]);
}
