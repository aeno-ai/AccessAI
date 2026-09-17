import type { IconName } from '@/constants/onboarding';

/**
 * Every mode shown on the dashboard routes into the same single conversation
 * screen (`src/app/(app)/conversation.tsx`) — these are discoverable doors
 * into that one screen, not separate isolated features. `undefined` (no
 * mode) means the full combined experience, reached via the flagship
 * "AI Conversation Mode" banner rather than a specific tile.
 */
export type ConversationMode = 'stt' | 'sign' | 'tts' | 'quick-phrases';

export type DashboardFeature = {
  id: ConversationMode;
  icon: IconName;
  title: string;
  description: string;
};

export const DASHBOARD_FEATURES: DashboardFeature[] = [
  {
    id: 'stt',
    icon: 'mic-outline',
    title: 'Speech to Text',
    description: 'Read what the other person is saying, instantly.',
  },
  {
    id: 'sign',
    icon: 'hand-left-outline',
    title: 'Sign Language Recognition',
    description: 'Translate hand signs into text or audio.',
  },
  {
    id: 'tts',
    icon: 'volume-high-outline',
    title: 'Text to Speech',
    description: 'Type what you want to say, the app speaks it.',
  },
  {
    id: 'quick-phrases',
    icon: 'chatbubble-ellipses-outline',
    title: 'Quick Phrases',
    description: 'Saved replies for fast, common exchanges.',
  },
];

/** The exact default SOS message text the user specified, edited before sending. */
export const DEFAULT_SOS_MESSAGE = "I need help, I'm at {location}. Please come ASAP";
