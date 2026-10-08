import type { IconName } from '@/constants/onboarding';
import type { Preferences } from '@/hooks/use-preferences';

/**
 * The accessibility needs a user can pick (in onboarding, or later in
 * Settings → My needs). A profile only changes *defaults* — every feature
 * stays available to everyone, and every setting can still be changed.
 *
 * The ids match the options saved by onboarding (constants/onboarding.ts).
 */
export type AccessibilityProfile = 'none' | 'blind-low-vision' | 'deaf-hoh' | 'mute-speech';

export const PROFILE_IDS: readonly AccessibilityProfile[] = [
  'none',
  'blind-low-vision',
  'deaf-hoh',
  'mute-speech',
];

/** Anything else (an old "deaf-blind" choice, a missing value) means no preset. */
export function toProfile(value: string | null | undefined): AccessibilityProfile {
  return PROFILE_IDS.includes(value as AccessibilityProfile) ? (value as AccessibilityProfile) : 'none';
}

export const PROFILE_LABELS: Record<AccessibilityProfile, { title: string; description: string }> = {
  none: { title: 'No specific needs', description: 'Standard settings.' },
  'blind-low-vision': {
    title: 'Blind / Low vision',
    description: 'Accel, the voice assistant, is on. Larger, high-contrast text. New messages are read aloud. Shake to send SOS.',
  },
  'deaf-hoh': {
    title: 'Deaf / Hard of hearing',
    description: "Live captions on the other person's turn. The screen flashes for alerts.",
  },
  'mute-speech': {
    title: 'Mute / Speech-impaired',
    description: 'Your messages are spoken aloud for you. Quick replies up front.',
  },
};

/**
 * The settings each profile turns on or off when it's applied. Accel (the
 * voice assistant) is switched ON by Blind / low vision and left as it is by
 * the others — choosing another profile never takes it away.
 */
export const PROFILE_PRESETS: Record<AccessibilityProfile, Partial<Preferences>> = {
  none: {
    textScale: 1,
    palette: 'standard',
    boldText: false,
    readIncomingAloud: false,
    speakMyMessages: false,
    autoListenForThem: false,
    flashAlerts: false,
    vibrateAlerts: true,
    shakeToSos: false,
  },
  'blind-low-vision': {
    textScale: 1.3,
    palette: 'high-contrast',
    boldText: true,
    readIncomingAloud: true,
    speakMyMessages: false,
    autoListenForThem: false,
    flashAlerts: false,
    vibrateAlerts: true,
    shakeToSos: true,
    accelEnabled: true,
    accelWakeWord: true,
  },
  'deaf-hoh': {
    textScale: 1.15,
    palette: 'standard',
    boldText: false,
    readIncomingAloud: false,
    speakMyMessages: false,
    autoListenForThem: true,
    flashAlerts: true,
    vibrateAlerts: true,
    shakeToSos: false,
  },
  'mute-speech': {
    textScale: 1,
    palette: 'standard',
    boldText: false,
    readIncomingAloud: false,
    speakMyMessages: true,
    autoListenForThem: false,
    flashAlerts: false,
    vibrateAlerts: true,
    shakeToSos: false,
  },
};

export const MAX_QUICK_REPLIES = 20;
export const MAX_QUICK_REPLY_LENGTH = 120;

const COMMON_QUICK_REPLIES = [
  'Thank you',
  'Salamat po',
  'Please wait a moment',
  'Can you say that again?',
  'Please type it here',
  'Yes',
  'No',
];

const PROFILE_QUICK_REPLIES: Record<AccessibilityProfile, string[]> = {
  none: [],
  'blind-low-vision': ['Please read it to me'],
  'deaf-hoh': ["I'm Deaf, please type or speak into the phone"],
  'mute-speech': ["I can't speak, I'll type my answer"],
};

/** The quick replies suggested for a profile — its own phrase first. */
export function suggestedQuickReplies(profile: AccessibilityProfile): string[] {
  return [...PROFILE_QUICK_REPLIES[profile], ...COMMON_QUICK_REPLIES];
}

/**
 * What the Conversation screen does as soon as a shortcut opens it:
 * listen = mic on as Me; captions = speaker Them, mic on; sign = sign
 * language mode; type = cursor in the message box.
 */
export type ConversationAction = 'listen' | 'captions' | 'sign' | 'type';

/** What a Home "For you" shortcut does when tapped. */
export type ShortcutAction =
  | 'talk' // Conversation with the mic open
  | 'read-last' // read the latest message aloud
  | 'captions' // Conversation, speaker Them, mic open
  | 'sign' // Conversation in sign language mode
  | 'show' // "Show on screen" big text
  | 'quick-replies' // Conversation, quick replies up front
  | 'type-to-speak'; // Conversation, messages spoken aloud

export type HomeShortcut = {
  action: ShortcutAction;
  icon: IconName;
  title: string;
  description: string;
};

/**
 * Two or three big shortcuts at the top of Home, picked for each profile.
 * Everything they open is also reachable the usual way.
 */
export const PROFILE_SHORTCUTS: Record<AccessibilityProfile, HomeShortcut[]> = {
  none: [],
  'blind-low-vision': [
    { action: 'talk', icon: 'mic-outline', title: 'Talk', description: 'Start a conversation with the mic on.' },
    {
      action: 'read-last',
      icon: 'volume-high-outline',
      title: 'Read last message',
      description: 'Hear the newest message again.',
    },
  ],
  'deaf-hoh': [
    {
      action: 'captions',
      icon: 'text-outline',
      title: 'Live captions',
      description: 'See what the other person says as text.',
    },
    { action: 'sign', icon: 'hand-left-outline', title: 'Sign mode', description: 'Start in sign language mode.' },
    { action: 'show', icon: 'expand-outline', title: 'Show on screen', description: 'Big text for someone to read.' },
  ],
  'mute-speech': [
    {
      action: 'quick-replies',
      icon: 'flash-outline',
      title: 'Quick replies',
      description: 'Tap a saved reply to say it.',
    },
    {
      action: 'type-to-speak',
      icon: 'volume-high-outline',
      title: 'Type to speak',
      description: 'The phone says what you type.',
    },
    { action: 'show', icon: 'expand-outline', title: 'Show on screen', description: 'Big text for someone to read.' },
  ],
};
