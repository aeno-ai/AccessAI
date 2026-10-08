import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

/**
 * Choosing a man's or a woman's voice for reading aloud.
 *
 * Phones don't say which voices are male or female — expo-speech only gives
 * an id, a name and a language. So voices are sorted using known names:
 * Apple's (Aaron, Samantha…) and the codes in Google's and Samsung's voice
 * ids. A phone may have no man's voice for Filipino at all; then the
 * phone's normal voice is used and Settings says so.
 *
 * To check a phone's voices: Settings → Conversation & speech → Voice →
 * "Voices on this phone" lists them, and unknown ones can be added below.
 */
export type VoiceGender = 'man' | 'woman';
export type VoicePreference = 'auto' | VoiceGender;
export type VoiceLanguage = 'en' | 'fil';

export type PickedVoices = {
  en: string | null;
  fil: string | null;
  /** Things to tell the person, e.g. "No man's voice for Filipino on this phone." */
  notes: string[];
};

// Apple voice names (iPhone).
const APPLE_MEN = ['aaron', 'arthur', 'daniel', 'evan', 'fred', 'gordon', 'nathan', 'oliver', 'rishi', 'tom', 'eddy', 'reed', 'rocko', 'grandpa', 'albert', 'ralph', 'junior', 'alex'];
const APPLE_WOMEN = ['samantha', 'ava', 'allison', 'susan', 'nicky', 'zoe', 'karen', 'moira', 'tessa', 'fiona', 'kate', 'serena', 'martha', 'flo', 'sandy', 'shelley', 'grandma', 'victoria', 'kathy', 'veena'];

// Google speech services voice codes (Android ids look like "en-us-x-iom-local").
const GOOGLE_MEN = ['iol', 'iom', 'tpd', 'rjs', 'gbd', 'gbg'];
const GOOGLE_WOMEN = ['iob', 'iog', 'sfg', 'tpc', 'tpf', 'gba', 'gbc'];
// Filipino Google voices — best known so far; check on a real phone.
const GOOGLE_FIL_MEN = ['fid'];
const GOOGLE_FIL_WOMEN = ['fie', 'fic', 'cfc'];

export function classifyVoice(voice: Speech.Voice): VoiceGender | null {
  const id = voice.identifier.toLowerCase();
  const name = voice.name.toLowerCase();
  if (/\bfemale\b|_female|-female/.test(id) || /female/.test(name)) return 'woman';
  if (/\bmale\b|_male|-male/.test(id) || /\bmale\b/.test(name)) return 'man';
  // Samsung: SMTm00 = man, SMTf00 = woman.
  if (/smtm\d/.test(id)) return 'man';
  if (/smtf\d/.test(id)) return 'woman';
  const google = id.match(/-x-([a-z]{3})(-|$)/)?.[1];
  if (google) {
    if ([...GOOGLE_MEN, ...GOOGLE_FIL_MEN].includes(google)) return 'man';
    if ([...GOOGLE_WOMEN, ...GOOGLE_FIL_WOMEN].includes(google)) return 'woman';
  }
  const firstWord = name.split(/[\s(]/)[0];
  if (APPLE_MEN.includes(firstWord)) return 'man';
  if (APPLE_WOMEN.includes(firstWord)) return 'woman';
  return null;
}

function languageOf(voice: Speech.Voice): VoiceLanguage | null {
  const code = voice.language.toLowerCase().replace('_', '-');
  if (code.startsWith('en')) return 'en';
  if (code.startsWith('fil') || code.startsWith('tl')) return 'fil';
  return null;
}

// Voices that work without internet first, and US/PH accents first.
function score(voice: Speech.Voice, language: VoiceLanguage): number {
  const id = voice.identifier.toLowerCase();
  const code = voice.language.toLowerCase().replace('_', '-');
  let points = 0;
  if (id.includes('network')) points -= 10;
  if (id.includes('local')) points += 3;
  if (voice.quality === Speech.VoiceQuality.Enhanced) points += 2;
  if (language === 'en' && code === 'en-us') points += 2;
  if (language === 'fil' && (code === 'fil-ph' || code === 'tl-ph')) points += 2;
  return points;
}

let cached: Speech.Voice[] | null = null;

/** The phone's voices (Android's list can be empty for a moment at startup). */
export async function getVoices(): Promise<Speech.Voice[]> {
  if (cached?.length) return cached;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      if (voices.length) {
        cached = voices;
        return voices;
      }
    } catch {
      // Try again below.
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  return [];
}

const LANGUAGE_NAME: Record<VoiceLanguage, string> = { en: 'English', fil: 'Filipino' };

/** The best voice per language for a preference ('auto' = the phone's normal voice). */
export async function pickVoices(preference: VoicePreference): Promise<PickedVoices> {
  if (preference === 'auto') return { en: null, fil: null, notes: [] };
  const voices = await getVoices();
  const picked: PickedVoices = { en: null, fil: null, notes: [] };
  for (const language of ['en', 'fil'] as const) {
    const matches = voices
      .filter((voice) => languageOf(voice) === language && classifyVoice(voice) === preference)
      .sort((a, b) => score(b, language) - score(a, language));
    picked[language] = matches[0]?.identifier ?? null;
    if (!matches.length) {
      picked.notes.push(
        `No ${preference === 'man' ? "man's" : "woman's"} voice for ${LANGUAGE_NAME[language]} on this phone, so its normal ${LANGUAGE_NAME[language]} voice is used.`,
      );
    }
  }
  return picked;
}

/** For the "Voices on this phone" list in Settings. */
export async function describeVoices(): Promise<{ id: string; label: string }[]> {
  const voices = await getVoices();
  return voices
    .filter((voice) => languageOf(voice))
    .map((voice) => {
      const gender = classifyVoice(voice);
      return {
        id: voice.identifier,
        label: `${voice.name} · ${voice.language} · ${gender === 'man' ? 'man' : gender === 'woman' ? 'woman' : 'unknown'}${
          Platform.OS === 'android' && voice.identifier.includes('network') ? ' · needs internet' : ''
        }`,
      };
    });
}
