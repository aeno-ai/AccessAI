import { useCallback } from 'react';
import { usePreferences } from '@/hooks/use-preferences';
import { useScreenReader } from '@/hooks/use-screen-reader';
import { announce } from '@/utils/a11y';
import { speakMixed } from '@/utils/speechHelper';

/**
 * Says Learn's feedback ("That's right", hints, how a sign is made):
 *   - with TalkBack / VoiceOver on: through the screen reader;
 *   - otherwise, aloud with the phone's voice for Blind / low-vision users;
 *   - otherwise it's only on screen (a Deaf user wouldn't hear it, and
 *     others may be learning in a quiet place).
 * `always`: read it aloud anyway — the person asked ("Hear the steps").
 * Said aloud, it replaces whatever Learn was saying, so a new question's
 * steps never talk over the last ones.
 */
export function useFeedback() {
  const { prefs } = usePreferences();
  const screenReader = useScreenReader();
  return useCallback(
    (text: string, { always = false }: { always?: boolean } = {}) => {
      if (!text.trim()) return;
      if (screenReader) announce(text);
      else if (always || prefs.profile === 'blind-low-vision') void speakMixed(text, { rate: prefs.speechRate });
    },
    [screenReader, prefs.profile, prefs.speechRate],
  );
}

/**
 * Whether signs are told in words, not only shown: a screen reader is on, or
 * the person chose the Blind / low-vision profile. `aloud`: the app speaks
 * them by itself (no screen reader to read the screen).
 */
export function useDescribeSigns(): { describe: boolean; aloud: boolean } {
  const { prefs } = usePreferences();
  const screenReader = useScreenReader();
  const blind = prefs.profile === 'blind-low-vision';
  return { describe: screenReader || blind, aloud: blind && !screenReader };
}
