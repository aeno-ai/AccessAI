import { Ionicons } from '@expo/vector-icons';

export type IconName = keyof typeof Ionicons.glyphMap;

export interface OnboardingFeature {
  id: string;
  icon: IconName;
  title: string;
  description: string;
}

export const FEATURES: OnboardingFeature[] = [
  {
    id: 'speech-to-text',
    icon: 'mic-outline',
    title: 'Speech to Text',
    description: 'Convert spoken words into text instantly.',
  },
  {
    id: 'text-to-speech',
    icon: 'volume-high-outline',
    title: 'Text to Speech',
    description: 'Listen to text in natural AI voices.',
  },
  {
    id: 'sign-language',
    icon: 'hand-left-outline',
    title: 'Sign Language Recognition',
    description: 'Detect and translate sign language.',
  },
  {
    id: 'ai-assistant',
    icon: 'chatbubble-ellipses-outline',
    title: 'AI Assistant',
    description: 'Get help and answers anytime.',
  },
];

export interface AccessibilityOption {
  id: string;
  icon: IconName;
  title: string;
  description: string;
}

export const ACCESSIBILITY_OPTIONS: AccessibilityOption[] = [
  {
    id: 'deaf-hoh',
    icon: 'ear-outline',
    title: 'Deaf / Hard of Hearing',
    description: 'Can see, cannot hear well or at all',
  },
  {
    id: 'mute-speech',
    icon: 'mic-off-outline',
    title: 'Mute / Speech-Impaired',
    description: 'Can see and hear, difficulty speaking',
  },
  {
    id: 'blind-low-vision',
    icon: 'eye-off-outline',
    title: 'Blind / Low Vision',
    description: 'Cannot see well or at all',
  },
  {
    id: 'deaf-blind',
    icon: 'accessibility-outline',
    title: 'Deaf-Blind',
    description: 'Both vision and hearing affected',
  },
];
