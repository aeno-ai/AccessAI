import { useCallback, useEffect, useRef, useState } from 'react';
import { signLandmarksAvailable } from 'react-native-sign-landmarks';
import type { SignLanguage, SignUnit } from '@/hooks/use-preferences';
import { hasSignModel, loadSignModel } from '@/sign/models';
import { SignReader, type SignEvent } from '@/sign/reader';

/**
 * Sign language → words, hands-free, all on the phone (HANDOFF.md §49):
 * MediaPipe Holistic reads every camera frame, src/sign/ notices where a
 * sign starts and ends and reads it with the model that comes with the app
 * (src/sign/reader.ts). Nothing is sent anywhere, so it works offline. Only
 * the "make a sentence" step afterwards needs the internet.
 */
export type { SignDebug, SignEvent } from '@/sign/reader';

/** WAIT: watching for a sign · SIGN: someone is signing · TAIL: reading the sign */
export type SignPhase = 'off' | 'starting' | 'WAIT' | 'SIGN' | 'TAIL' | 'paused';

export type SignModelInfo = { language: SignLanguage; unit: SignUnit; available: boolean };

const MODELS: SignModelInfo[] = (['fsl', 'asl'] as const).flatMap((language) =>
  (['words', 'letters'] as const).map((unit) => ({
    language,
    unit,
    available: signLandmarksAvailable && hasSignModel(language, unit),
  })),
);

/** Which sign options this phone can use (the models come with the app). */
export function useSignModels(): SignModelInfo[] {
  return MODELS;
}

/** Whether `language` + `unit` can be used now. */
export const signReady = (models: SignModelInfo[] | null, language: SignLanguage, unit: SignUnit) =>
  models?.some((model) => model.language === language && model.unit === unit && model.available) ?? false;

/** Whether this phone can read signs at all (the native part is in this app build). */
export const signReadingAvailable = signLandmarksAvailable;

type Options = {
  /** Sign mode is on (and the camera allowed). */
  active: boolean;
  language: SignLanguage;
  unit: SignUnit;
  minConfidence: number;
  flip: boolean;
  onEvent: (event: SignEvent) => void;
  /** Keep the latest points for the testing landmark view. */
  debug?: boolean;
};

export function useSignRecognition({ active, language, unit, minConfidence, flip, onEvent, debug = false }: Options) {
  // One reader (and camera output) for the life of the screen.
  const [reader] = useState(() => new SignReader());
  const [phase, setPhase] = useState<SignPhase>('WAIT');
  const [paused, setPaused] = useState(false);
  const [loadedKey, setLoadedKey] = useState('');
  const [loadFailed, setLoadFailed] = useState('');
  const key = `${language}/${unit}`;
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => reader.configure({ active, minConfidence, flip, debug }), [reader, active, minConfidence, flip, debug]);

  useEffect(
    () =>
      reader.listen({
        event: (event) => onEventRef.current(event),
        phase: setPhase,
        paused: setPaused,
      }),
    [reader],
  );

  // The model for this language and unit (loaded once, a few MB).
  useEffect(() => {
    if (!active || !signLandmarksAvailable) return;
    let cancelled = false;
    loadSignModel(language, unit)
      .then((model) => {
        if (cancelled) return;
        reader.setModel(model);
        setLoadedKey(`${language}/${unit}`);
      })
      .catch((error) => {
        console.warn('[sign] could not load the model:', error);
        if (!cancelled) setLoadFailed(`${language}/${unit}`);
      });
    return () => {
      cancelled = true;
    };
  }, [reader, active, language, unit]);

  const resume = useCallback(() => reader.resume(), [reader]);

  let message = '';
  let shown: SignPhase = phase;
  if (!signLandmarksAvailable) {
    message = "Sign language isn't available on this phone yet.";
    shown = 'off';
  } else if (loadFailed === key) {
    message = `${unit === 'letters' ? 'Letters' : 'Words'} aren't ready yet for ${language.toUpperCase()}. Try the other option.`;
    shown = 'off';
  } else if (!active) {
    shown = 'off';
  } else if (loadedKey !== key) {
    shown = 'starting';
  } else if (paused) {
    message = 'Paused because no one signed for a while. Tap Resume to keep going.';
    shown = 'paused';
  }

  return { phase: shown, message, resume, output: reader.output, debug: reader.debug };
}
