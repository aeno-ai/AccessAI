import { AccessibilityInfo } from 'react-native';

/**
 * Has TalkBack / VoiceOver say `text` right now, without moving focus. Use it
 * for things that happen on their own — a message arriving, the mic starting,
 * an error appearing. Android's `accessibilityLiveRegion` has no iPhone
 * equivalent, so this is what makes those moments audible on both.
 * Does nothing when no screen reader is running.
 */
export function announce(text: string): void {
  if (text.trim()) {
    AccessibilityInfo.announceForAccessibility(text);
  }
}
