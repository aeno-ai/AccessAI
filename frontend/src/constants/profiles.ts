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
 * The settings each profile turns on or off when it's applied. Every profile
 * says what Accel (the voice assistant) does: on for Blind / low vision, off
 * for the others — so switching away from Blind turns it off. It's only the
 * starting point: Settings → Accel turns it back on for anyone.
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
    accelEnabled: false,
    accelWakeWord: false,
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
    accelEnabled: false,
    accelWakeWord: false,
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
    accelEnabled: false,
    accelWakeWord: false,
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

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((item, index) => item === b[index]);

/**
 * The quick replies after switching profiles. A list never changed simply
 * becomes the new profile's. An edited list keeps the user's own replies:
 * only the old profile's phrase goes (if it's still there, unchanged), and
 * the new profile's phrase comes first — if there's room.
 */
export function quickRepliesAfterSwitch(replies: string[], from: AccessibilityProfile, to: AccessibilityProfile): string[] {
  if (from === to) return replies;
  if (sameList(replies, suggestedQuickReplies(from))) return suggestedQuickReplies(to);
  const kept = replies.filter((reply) => !PROFILE_QUICK_REPLIES[from].includes(reply));
  const added = PROFILE_QUICK_REPLIES[to].filter((reply) => !kept.includes(reply));
  return [...added.slice(0, Math.max(0, MAX_QUICK_REPLIES - kept.length)), ...kept];
}

/**
 * What the Conversation screen does as soon as a shortcut opens it:
 * listen = mic on as Me; captions = speaker Them, mic on; sign = sign
 * language mode; type = cursor in the message box; replies = the quick
 * replies shown.
 */
export type ConversationAction = 'listen' | 'captions' | 'sign' | 'type' | 'replies';

/** What a Home "Start with…" tile does when tapped. */
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
 * The shortcuts each profile needs most — shown first on Home's "Start
 * with…" grid, before the standard ones (homeShortcuts below).
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

/** The tiles everyone gets on Home: each opens Conversation ready for one thing. */
const STANDARD_SHORTCUTS: HomeShortcut[] = [
  { action: 'captions', icon: 'text-outline', title: 'Live captions', description: 'See what others say as text.' },
  { action: 'type-to-speak', icon: 'volume-high-outline', title: 'Type to speak', description: 'The phone says what you type.' },
  { action: 'sign', icon: 'hand-left-outline', title: 'Sign language', description: 'Sign, and it becomes text.' },
  { action: 'quick-replies', icon: 'flash-outline', title: 'Quick replies', description: 'Say a saved reply in one tap.' },
];

/** Home's "Start with…" tiles: the profile's own first, then the standard ones (no repeats). */
export function homeShortcuts(profile: AccessibilityProfile): HomeShortcut[] {
  const own = PROFILE_SHORTCUTS[profile];
  const taken = new Set(own.map((shortcut) => shortcut.action));
  return [...own, ...STANDARD_SHORTCUTS.filter((shortcut) => !taken.has(shortcut.action))];
}
