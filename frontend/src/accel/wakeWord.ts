import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import {
  abortSession,
  acquire,
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
import { afterWakeWord } from '@/accel/language';

/**
 * "Hey Accel" — free, with no extra app or paid wake-word engine: while
 * AccessAI is open, the phone's own speech recognizer listens on the phone
 * itself (on-device, so no audio leaves the phone) for "Hey Accel".
 *
 * It steps aside whenever anything else needs the mic (the message box's
 * mic, Accel listening for a command), whenever the app is talking (so it
 * never hears itself), during an SOS, when AccessAI goes to the background,
 * and after 10 minutes without anyone touching the phone (battery) — any
 * touch wakes it again.
 *
 * Needs the development build, Android 13+ or iOS 17+, and English speech
 * downloaded to the phone (Settings → Accel explains how).
 */
export type WakeStatus = 'off' | 'listening' | 'paused' | 'unsupported' | 'needs-download' | 'needs-permission';

const OWNER = 'wake-word';
const IDLE_MS = 10 * 60 * 1000;
const ON_DEVICE_SERVICE = 'com.google.android.as';

// ---- a tiny store so Settings can show what "Hey Accel" is doing
let status: WakeStatus = 'off';
const statusListeners = new Set<() => void>();
function setStatus(next: WakeStatus) {
  if (status === next) return;
  status = next;
  statusListeners.forEach((listener) => listener());
}
export function useWakeStatus(): WakeStatus {
  return useSyncExternalStore(
    (listener) => {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    () => status,
  );
}

// ---- touches keep it awake
let lastActivity = Date.now();
const activityListeners = new Set<() => void>();
/** Called on every touch anywhere in the app (AccelProvider). */
export function noteActivity() {
  const wasIdle = Date.now() - lastActivity > IDLE_MS;
  lastActivity = Date.now();
  if (wasIdle) activityListeners.forEach((listener) => listener());
}

export const wakeWordSupported =
  speechModule !== null && (Platform.OS === 'ios' || (Platform.OS === 'android' && Number(Platform.Version) >= 33));

/** Is English speech on the phone, so "Hey Accel" can listen offline? */
async function englishOnDevice(): Promise<'ok' | 'needs-download' | 'unsupported'> {
  if (!speechModule || !speechModule.supportsOnDeviceRecognition()) return 'unsupported';
  if (Platform.OS !== 'android') return 'ok';
  try {
    const { installedLocales } = await speechModule.getSupportedLocales({ androidRecognitionServicePackage: ON_DEVICE_SERVICE });
    return installedLocales.some((locale) => locale.toLowerCase().replace('_', '-').startsWith('en')) ? 'ok' : 'needs-download';
  } catch {
    return 'unsupported';
  }
}

/** Downloads English speech for offline use (Android). */
export async function downloadEnglishForWakeWord(): Promise<string> {
  if (!speechModule || Platform.OS !== 'android') return 'Nothing to download on this phone.';
  try {
    const result = await speechModule.androidTriggerOfflineModelDownload({ locale: 'en-US' });
    return result.status === 'download_success'
      ? 'English speech is ready. "Hey Accel" works now.'
      : 'Downloading English speech. It may wait until you are on Wi-Fi.';
  } catch {
    return "Couldn't start the download. Connect to the internet and try again.";
  }
}

/**
 * Listens for "Hey Accel" while `enabled`. Calls onWake with whatever was
 * said after it ("hey accel open friends" → "open friends"; just "hey
 * accel" → "").
 */
export function useWakeWord(enabled: boolean, onWake: (remainder: string) => void) {
  const onWakeRef = useRef(onWake);
  useEffect(() => {
    onWakeRef.current = onWake;
  });

  useEffect(() => {
    if (!enabled) {
      setStatus('off');
      return;
    }
    if (!wakeWordSupported || !speechModule) {
      setStatus('unsupported');
      return;
    }
    let stopped = false;
    let ready = false;
    let backoff = 500;
    let restartTimer: ReturnType<typeof setTimeout> | undefined;
    let commandTimer: ReturnType<typeof setTimeout> | undefined;
    let remainder: string | null = null;

    const canRun = () =>
      !stopped &&
      ready &&
      AppState.currentState === 'active' &&
      !isBlocked() &&
      Date.now() - lastActivity < IDLE_MS &&
      (currentOwner() === null || currentOwner() === OWNER);

    const begin = async () => {
      if (!canRun()) {
        setStatus('paused');
        return;
      }
      if (isOwner(OWNER) && isActive()) return;
      await acquire(OWNER);
      setStatus('listening');
      startSession(OWNER, {
        lang: 'en-US',
        interimResults: true,
        continuous: true,
        requiresOnDeviceRecognition: true,
        addsPunctuation: false,
        contextualStrings: ['Hey Accel', 'Accel'],
        ...(Platform.OS === 'android' ? { androidRecognitionServicePackage: ON_DEVICE_SERVICE } : {}),
      });
    };

    const scheduleRestart = (delay = backoff) => {
      clearTimeout(restartTimer);
      restartTimer = setTimeout(() => void begin(), delay);
    };

    const fire = () => {
      clearTimeout(commandTimer);
      const said = remainder ?? '';
      remainder = null;
      abortSession(OWNER);
      onWakeRef.current(said);
    };

    const unlisten = listen(OWNER, {
      start: () => {
        backoff = 500;
      },
      result: (event) => {
        const rest = afterWakeWord(event.results[0]?.transcript ?? '');
        if (rest === null) return;
        remainder = rest;
        // Words after "Hey Accel": wait for the sentence to finish.
        if (rest && !event.isFinal) {
          clearTimeout(commandTimer);
          commandTimer = setTimeout(fire, 1200);
          return;
        }
        fire();
      },
      error: (event) => {
        if (event.error === 'not-allowed') {
          stopped = true;
          setStatus('needs-permission');
        } else if (event.error === 'language-not-supported') {
          stopped = true;
          setStatus('needs-download');
        } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
          backoff = Math.min(backoff * 2, 30000);
        }
      },
      end: () => {
        release(OWNER);
        if (canRun()) scheduleRestart();
        else if (!stopped) setStatus('paused');
      },
    });

    // Someone else took the mic, the app started/stopped talking, an SOS…
    const unwatch = watch(() => {
      if (stopped) return;
      if (!canRun()) {
        if (isOwner(OWNER)) abortSession(OWNER);
        setStatus('paused');
      } else if (currentOwner() === null) {
        scheduleRestart(300);
      }
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') scheduleRestart(300);
      else if (isOwner(OWNER)) abortSession(OWNER);
    });
    const onActivity = () => scheduleRestart(300);
    activityListeners.add(onActivity);

    void (async () => {
      const permission = await speechModule.getPermissionsAsync();
      if (!permission.granted) {
        setStatus('needs-permission');
        return;
      }
      const model = await englishOnDevice();
      if (model !== 'ok') {
        setStatus(model);
        return;
      }
      ready = true;
      void begin();
    })();

    return () => {
      stopped = true;
      clearTimeout(restartTimer);
      clearTimeout(commandTimer);
      activityListeners.delete(onActivity);
      appState.remove();
      unwatch();
      unlisten();
      if (isOwner(OWNER)) {
        abortSession(OWNER);
        release(OWNER);
      }
      setStatus('off');
    };
  }, [enabled]);
}
