import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PaletteFamily } from '@/constants/palettes';
import {
  PROFILE_PRESETS,
  suggestedQuickReplies,
  toProfile,
  type AccessibilityProfile,
} from '@/constants/profiles';
import { getAccessibilityPreference } from '@/utils/onboardingStorage';

export type ThemeMode = 'system' | 'light' | 'dark';
export type TextScale = 1 | 1.15 | 1.3 | 1.5;
export type SpeechRate = 0.75 | 1 | 1.25 | 1.5;
export type OfflineSpeechLanguage = 'auto' | 'fil' | 'en';
export type ShakeSensitivity = 'light' | 'normal' | 'firm';
export type SosCountdown = 3 | 5 | 10;
/** 'auto' = the phone's normal voice. */
export type VoiceChoice = 'auto' | 'man' | 'woman';
/** Accel's own voice: a man's or woman's, or the same as the app's. */
export type AccelVoice = 'man' | 'woman' | 'app';
export type SignLanguage = 'fsl' | 'asl';
export type SignUnit = 'words' | 'letters';
export type SignCamera = 'front' | 'back';
/** How sure the sign model must be before a word is added (Loose / Normal / Strict). */
export type SignConfidence = 0.35 | 0.5 | 0.7;

/**
 * Everything a user can adjust in Settings. Saved on this phone only, so it
 * works offline and needs no account round trip.
 */
export type Preferences = {
  profile: AccessibilityProfile;
  // Display
  theme: ThemeMode;
  palette: PaletteFamily;
  textScale: TextScale;
  boldText: boolean;
  relaxedSpacing: boolean;
  reduceMotion: boolean;
  // Conversation & speech
  /** After each message, flip Me ↔ Them. */
  autoSwitchSpeaker: boolean;
  /** Read "Them" messages and friends' messages aloud as they arrive. */
  readIncomingAloud: boolean;
  /** Speak the user's own messages aloud when they send them. */
  speakMyMessages: boolean;
  /** Start the mic by itself when it becomes Them's turn (live captions). */
  autoListenForThem: boolean;
  speechRate: SpeechRate;
  /** A man's or woman's voice for everything read aloud, or the phone's normal one. */
  appVoice: VoiceChoice;
  offlineSpeechLanguage: OfflineSpeechLanguage;
  showQuickReplies: boolean;
  quickReplies: string[];
  // Alerts
  vibrateAlerts: boolean;
  flashAlerts: boolean;
  // Emergency SOS (PWD accounts only)
  shakeToSos: boolean;
  shakeSensitivity: ShakeSensitivity;
  sosCountdown: SosCountdown;
  // Accel, the voice assistant (on by default for Blind / low vision)
  accelEnabled: boolean;
  /** Listen for "Hey Accel" while AccessAI is open (development build). */
  accelWakeWord: boolean;
  /** Let the AccessAI server's AI understand commands the phone's rules can't (online). */
  accelSmart: boolean;
  accelVoice: AccelVoice;
  /** The spoken "I'm Accel…" introduction has played. */
  accelIntroDone: boolean;
  // Sign language (in the message box's sign mode)
  signLanguage: SignLanguage;
  signUnit: SignUnit;
  signCamera: SignCamera;
  signConfidence: SignConfidence;
  /** Turn the signed words into a sentence (AI, online) when signing pauses. */
  signAutoSentence: boolean;
  /** Flip the video left↔right first — for phones that save front-camera video mirrored. */
  signFlip: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  profile: 'none',
  theme: 'system',
  palette: 'standard',
  textScale: 1,
  boldText: false,
  relaxedSpacing: false,
  reduceMotion: false,
  autoSwitchSpeaker: false,
  readIncomingAloud: false,
  speakMyMessages: false,
  autoListenForThem: false,
  speechRate: 1,
  appVoice: 'auto',
  offlineSpeechLanguage: 'auto',
  showQuickReplies: true,
  quickReplies: suggestedQuickReplies('none'),
  vibrateAlerts: true,
  flashAlerts: false,
  shakeToSos: false,
  shakeSensitivity: 'normal',
  sosCountdown: 5,
  accelEnabled: false,
  accelWakeWord: false,
  accelSmart: true,
  accelVoice: 'man',
  accelIntroDone: false,
  signLanguage: 'fsl',
  signUnit: 'words',
  signCamera: 'front',
  signConfidence: 0.5,
  signAutoSentence: true,
  signFlip: false,
};

const STORAGE_KEY = 'preferences:v1';

/** The defaults with a profile's preset applied on top. */
function withProfile(base: Preferences, profile: AccessibilityProfile): Preferences {
  // Quick replies the user never changed follow the profile; edited ones stay.
  const untouched = sameList(base.quickReplies, suggestedQuickReplies(base.profile));
  return {
    ...base,
    ...PROFILE_PRESETS[profile],
    profile,
    quickReplies: untouched ? suggestedQuickReplies(profile) : base.quickReplies,
  };
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

async function loadPreferences(): Promise<Preferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      // Merged over the defaults, so settings added in later versions get a
      // sensible value instead of `undefined`.
      const saved = JSON.parse(raw) as Partial<Preferences>;
      const profile = toProfile(saved.profile);
      // Accel came later: someone who already chose Blind / low vision gets
      // it switched on, like a new user with that profile would.
      const accel =
        saved.accelEnabled === undefined && profile === 'blind-low-vision'
          ? { accelEnabled: true, accelWakeWord: true }
          : {};
      return { ...DEFAULT_PREFERENCES, ...saved, ...accel, profile };
    }
  } catch {
    // Unreadable — fall through to first-run defaults.
  }
  // First run on this phone: start from whatever onboarding recorded.
  let onboardingChoice: string | null = null;
  try {
    onboardingChoice = await getAccessibilityPreference();
  } catch {
    // No choice recorded.
  }
  return withProfile(DEFAULT_PREFERENCES, toProfile(onboardingChoice));
}

async function savePreferences(prefs: Preferences): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Only lost if the app closes before the next successful save.
  }
}

type PreferencesContextValue = {
  ready: boolean;
  prefs: Preferences;
  setPref: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  /** Applies a profile's suggested settings. Edited quick replies are kept. */
  applyProfile: (profile: AccessibilityProfile) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  // A change made before loading finished must not be overwritten by it.
  const changedEarly = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadPreferences().then((loaded) => {
      if (cancelled) {
        return;
      }
      if (!changedEarly.current) {
        setPrefs(loaded);
        void savePreferences(loaded);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((change: (current: Preferences) => Preferences) => {
    changedEarly.current = true;
    setPrefs((current) => {
      const next = change(current);
      void savePreferences(next);
      return next;
    });
  }, []);

  const setPref = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
      update((current) => ({ ...current, [key]: value })),
    [update],
  );

  const applyProfile = useCallback(
    (profile: AccessibilityProfile) => update((current) => withProfile(current, profile)),
    [update],
  );

  const value = useMemo(() => ({ ready, prefs, setPref, applyProfile }), [ready, prefs, setPref, applyProfile]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used inside PreferencesProvider');
  }
  return context;
}
