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
  quickRepliesAfterSwitch,
  suggestedQuickReplies,
  toProfile,
  type AccessibilityProfile,
} from '@/constants/profiles';
import { getAccessibilityPreference, LEGACY_PREFERENCES, preferencesKey } from '@/utils/onboardingStorage';
import { migrateSavedPreferences } from '@/utils/prefsMigration';

export type ThemeMode = 'system' | 'light' | 'dark';
export type TextScale = 1 | 1.15 | 1.3 | 1.5;
export type SpeechRate = 0.75 | 1 | 1.25 | 1.5;
export type OfflineSpeechLanguage = 'auto' | 'fil' | 'en';
export type ShakeSensitivity = 'light' | 'normal' | 'firm';
export type SosCountdown = 3 | 5 | 10;
/** 'auto' = the phone's normal voice. */
export type VoiceChoice = 'auto' | 'man' | 'woman';
/** Laya's own voice: a man's or woman's, or the same as the app's. */
export type LayaVoice = 'man' | 'woman' | 'app';
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
  // Laya, the voice assistant (on by default for Blind / low vision)
  layaEnabled: boolean;
  /** Listen for "Hey Laya" while AccessAI is open (development build). */
  layaWakeWord: boolean;
  /** Let the AccessAI server's AI understand commands the phone's rules can't (online). */
  layaSmart: boolean;
  layaVoice: LayaVoice;
  /** The spoken "I'm Laya…" introduction has played. */
  layaIntroDone: boolean;
  /** Someone who knew the assistant as Accel has heard that it's called Laya now. */
  layaRenameNoticeDone: boolean;
  // Sign language (in the message box's sign mode, and the Learn course)
  signLanguage: SignLanguage;
  /** The person picked a sign language themselves (signLanguage starts as FSL either way). Learn asks once until then. */
  signLanguageChosen: boolean;
  signUnit: SignUnit;
  signCamera: SignCamera;
  signConfidence: SignConfidence;
  /** Turn the signed words into a sentence (AI, online) when signing pauses. */
  signAutoSentence: boolean;
  /** Flip the video left↔right first — for phones that save front-camera video mirrored. */
  signFlip: boolean;
  /** Show the sign camera large (about half the screen) instead of normal. */
  signCameraLarge: boolean;
  /** Testing only (development builds): draw MediaPipe's points and the signing line on the camera. */
  signShowLandmarks: boolean;
  /** The "How to sign" help has been shown once (it opens by itself the first time the camera is on). */
  signHelpSeen: boolean;
  // First-time tutorial (HANDOFF.md §40)
  /** The pages whose tour has been seen (or skipped). Empty again with "Show the tutorial again". */
  tutorialSeen: string[];
  /** Where the Laya button was dragged to: which side, and how far down (0 = top, 1 = bottom). Null = its first spot. */
  layaButton: { side: 'left' | 'right'; y: number } | null;
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
  layaEnabled: false,
  layaWakeWord: false,
  layaSmart: true,
  layaVoice: 'man',
  layaIntroDone: false,
  layaRenameNoticeDone: true,
  signLanguage: 'fsl',
  signLanguageChosen: false,
  signUnit: 'words',
  signCamera: 'front',
  signConfidence: 0.5,
  signAutoSentence: true,
  signFlip: false,
  signCameraLarge: false,
  signShowLandmarks: false,
  signHelpSeen: false,
  tutorialSeen: [],
  layaButton: null,
};

// Each account's preferences are saved under its own key (preferencesKey),
// and the last ones used on this phone here too — so the login screen keeps
// the text size and colors of whoever used the phone last.
const LAST_KEY = 'preferences:v1:last';

/** The defaults with a profile's preset applied on top. */
function withProfile(base: Preferences, profile: AccessibilityProfile): Preferences {
  return {
    ...base,
    ...PROFILE_PRESETS[profile],
    profile,
    // The profile's own phrase swaps; the user's own replies stay.
    quickReplies: quickRepliesAfterSwitch(base.quickReplies, base.profile, profile),
  };
}

/** Saved preferences merged over the defaults, or null if there are none. */
function fromSaved(raw: string | null): Preferences | null {
  if (!raw) return null;
  try {
    // Merged over the defaults, so settings added in later versions get a
    // sensible value instead of `undefined`.
    // Old setting names (e.g. from when Laya was called Accel) moved over first.
    const saved = migrateSavedPreferences(JSON.parse(raw) as Record<string, unknown>) as Partial<Preferences>;
    const profile = toProfile(saved.profile);
    // Laya came later: someone who already chose Blind / low vision gets
    // it switched on, like a new user with that profile would.
    const laya =
      saved.layaEnabled === undefined && profile === 'blind-low-vision' ? { layaEnabled: true, layaWakeWord: true } : {};
    return { ...DEFAULT_PREFERENCES, ...saved, ...laya, profile };
  } catch {
    return null; // unreadable
  }
}

/** Before anyone is signed in: the last preferences used on this phone. */
async function loadLastPreferences(): Promise<Preferences> {
  try {
    const [last, legacy] = await Promise.all([AsyncStorage.getItem(LAST_KEY), AsyncStorage.getItem(LEGACY_PREFERENCES)]);
    return fromSaved(last) ?? fromSaved(legacy) ?? DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** An account's own preferences — or, the first time, the defaults for what it chose in onboarding. */
async function loadAccountPreferences(userId: string): Promise<Preferences> {
  try {
    const saved = fromSaved(await AsyncStorage.getItem(preferencesKey(userId)));
    if (saved) return saved;
  } catch {
    // Unreadable — fall through to first-run defaults.
  }
  let onboardingChoice: string | null = null;
  try {
    onboardingChoice = await getAccessibilityPreference(userId);
  } catch {
    // No choice recorded.
  }
  return withProfile(DEFAULT_PREFERENCES, toProfile(onboardingChoice));
}

async function savePreferences(prefs: Preferences, account: string | null): Promise<void> {
  try {
    const json = JSON.stringify(prefs);
    await AsyncStorage.multiSet(account ? [[preferencesKey(account), json], [LAST_KEY, json]] : [[LAST_KEY, json]]);
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
  /**
   * Switches to an account's own preferences (sign-in), or keeps the current
   * ones without an account (sign-out — they stay saved for next time).
   * Resolves once they're on screen.
   */
  loadAccount: (userId: string | null) => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  // Whose preferences these are (null = nobody signed in).
  const account = useRef<string | null>(null);
  // Only the newest load counts (the first one can finish after a sign-in's).
  const loads = useRef(0);
  // A change made before loading finished must not be overwritten by it.
  const changedEarly = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = ++loads.current;
    void loadLastPreferences().then((loaded) => {
      if (cancelled) {
        return;
      }
      if (load === loads.current && !changedEarly.current) {
        setPrefs(loaded);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadAccount = useCallback(async (userId: string | null) => {
    if (userId === null) {
      // Signed out: what's on screen stays (it's saved as the phone's last).
      account.current = null;
      return;
    }
    if (userId === account.current) return;
    const load = ++loads.current;
    const loaded = await loadAccountPreferences(userId);
    if (load !== loads.current) return;
    account.current = userId;
    changedEarly.current = false;
    setPrefs(loaded);
    void savePreferences(loaded, userId);
  }, []);

  const update = useCallback((change: (current: Preferences) => Preferences) => {
    changedEarly.current = true;
    setPrefs((current) => {
      const next = change(current);
      void savePreferences(next, account.current);
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

  const value = useMemo(
    () => ({ ready, prefs, setPref, applyProfile, loadAccount }),
    [ready, prefs, setPref, applyProfile, loadAccount],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used inside PreferencesProvider');
  }
  return context;
}
