import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether TalkBack (Android) or VoiceOver (iPhone) is on right now, kept up
 * to date if the user turns it on or off while the app is open. Features use
 * this to avoid talking over the screen reader — e.g. announce a new message
 * instead of also reading it aloud with text-to-speech.
 */
export function useScreenReader(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isScreenReaderEnabled().then((value) => {
      if (!cancelled) setEnabled(value);
    });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setEnabled);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return enabled;
}
