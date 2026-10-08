import { useEffect, useState } from 'react';
import { usePreferences } from '@/hooks/use-preferences';
import { setDefaultVoices } from '@/utils/speechHelper';
import { pickVoices, type PickedVoices, type VoicePreference } from '@/utils/voices';

/**
 * Applies Settings → Voice (Man / Woman / Automatic) to everything the app
 * reads aloud. Mounted once at the top of the app.
 */
export function useAppVoice() {
  const { prefs } = usePreferences();
  useEffect(() => {
    let cancelled = false;
    void pickVoices(prefs.appVoice).then((picked) => {
      if (!cancelled) setDefaultVoices({ en: picked.en, fil: picked.fil });
    });
    return () => {
      cancelled = true;
    };
  }, [prefs.appVoice]);
}

/** The voices for a choice, plus notes like "No man's voice for Filipino…". */
export function usePickedVoices(preference: VoicePreference): PickedVoices | null {
  const [picked, setPicked] = useState<PickedVoices | null>(null);
  useEffect(() => {
    let cancelled = false;
    void pickVoices(preference).then((result) => !cancelled && setPicked(result));
    return () => {
      cancelled = true;
    };
  }, [preference]);
  return picked;
}
