import * as Speech from 'expo-speech';

/**
 * Handles "Taglish" messages — English and Filipino mixed in the same
 * sentence (e.g. "I'm gonna kain na, sobrang gutom ko") — by reading each
 * clause aloud in whichever language it's actually written in, instead of
 * reading the whole message in one language.
 *
 * `expo-speech` can only set one `language` per call to `Speech.speak()` —
 * there's no way to switch language mid-utterance. So the practical unit
 * of "switching" is a clause, not a single word: this file splits a
 * message into clauses at natural boundaries (commas, periods, and a
 * handful of Filipino conjunctions), decides each clause's language from
 * whether it contains recognizably-Filipino words, then speaks the clauses
 * one after another, back to back, swapping the voice language between
 * them. A clause that itself mixes languages (e.g. "I'm gonna kain na,")
 * is read as whichever language it leans toward as a whole — true
 * word-by-word switching isn't possible with a single TTS engine call.
 */

const FILIPINO_LOCALE = 'fil-PH';
const ENGLISH_LOCALE = 'en-US';

// Clause boundaries: split after a comma/period, and before any of these
// conjunctions (so the conjunction itself starts the new clause, since it's
// usually what signals the language/topic shift in a Taglish sentence).
const CLAUSE_CONJUNCTIONS = ['kasi', 'pero', 'kaya', 'tapos', 'at saka'];

// Word list used to decide whether a clause is Filipino. Not exhaustive —
// Filipino/Tagalog has far more words than any list could hold — but these
// are the short, extremely common function words and everyday vocabulary
// that show up constantly in casual Taglish text messages, which is what
// this is for. Add more here any time a real message gets misclassified.
const FILIPINO_MARKERS = new Set([
  // Pronouns, particles, connectors
  'ang', 'mga', 'ng', 'nang', 'sa', 'ko', 'mo', 'niya', 'namin', 'natin',
  'nila', 'kayo', 'sila', 'tayo', 'kami', 'hindi', 'wala', 'meron',
  'mayroon', 'oo', 'opo', 'po', 'ba', 'raw', 'daw', 'naman', 'lang',
  'kasi', 'kung', 'dahil', 'paano', 'saan', 'kailan', 'sino', 'ano',
  'bakit', 'pero', 'pati', 'siguro', 'baka', 'dapat', 'di', 'para',
  'kapag', 'pag', 'doon',
  // More pronouns
  'ako', 'ka', 'ikaw', 'siya', 'akin', 'iyo', 'kanya', 'amin', 'inyo',
  'kanila', 'atin',

  // Greetings & everyday expressions
  'kumusta', 'musta', 'salamat', 'pasensya', 'paalam', 'ingat', 'sige',
  'oks', 'grabe', 'sobra', 'sobrang', 'talaga', 'jusko', 'naku', 'sayang',
  'char', 'weh', 'keri', 'lodi', 'petmalu', 'astig',
  // More expressions
  'walang', 'anuman', 'mabuhay', 'diyan', 'dyan', 'eh', 'ay', 'diba',

  // Everyday verbs (roots + common conjugations)
  'kain', 'kumain', 'kumakain', 'inom', 'uminom', 'tulog', 'natutulog',
  'gising', 'gumising', 'punta', 'pumunta', 'alis', 'umalis', 'uwi',
  'umuwi', 'bili', 'bumili', 'binili', 'tingin', 'tumingin', 'sabi',
  'sinabi', 'gawa', 'ginawa', 'ginagawa', 'trabaho', 'nagtatrabaho',
  'aral', 'nag-aaral', 'laro', 'naglalaro', 'tawag', 'tumawag', 'tanong',
  'nagtanong', 'sagot', 'sumagot', 'tulong', 'tumulong', 'gusto', 'ayaw',
  'mahal',
  // More verbs
  'balik', 'bumalik', 'hintay', 'maghintay', 'dala', 'magdala', 'bigay',
  'magbigay', 'kuha', 'kumuha', 'ibig', 'nais', 'akala', 'alam',
  'nakalimutan', 'kalimutan', 'intindi', 'naiintindihan',

  // Everyday adjectives
  'maganda', 'magandang', 'mabuti', 'masaya', 'malungkot', 'galit',
  'pagod', 'gutom', 'uhaw', 'mainit', 'malamig', 'malaki', 'maliit',
  'mabilis', 'mabagal', 'pangit', 'mabait', 'masama',
  // More adjectives
  'tama', 'mali', 'bago', 'luma', 'mura', 'malapit', 'malayo',

  // Time words
  'araw', 'umaga', 'hapon', 'gabi', 'kahapon', 'ngayon', 'bukas',
  'mamaya', 'kanina', 'tanghali',

  // Numbers
  'isa', 'dalawa', 'tatlo', 'apat', 'lima', 'anim', 'pito', 'walo',
  'siyam', 'sampu',

  // Family & people
  'nanay', 'tatay', 'lolo', 'lola', 'anak', 'asawa', 'kaibigan', 'kuya',
  'ate', 'pare', 'bes', 'kapatid',

  // Demonstratives & modals
  'ito', 'iyon', 'dito', 'doon', 'yun', 'yung', 'yan', 'ganito', 'ganyan',
  'ganun', 'pwede', 'puwede',
  // More connectors/modals
  'at', 'o', 'may', 'lahat', 'ilan', 'marami', 'konti', 'kaunti', 'tapos',
  // Short particles — very common, easy to miss, but carry a lot of the
  // "this sentence is Filipino" signal on their own (e.g. "kain na", "sige pa")
  'na', 'pa', 'nga', 'muna', 'yata', 'ulit', 'uli', 'lamang', 'medyo',
  'nalang', 'sana', 'kahit', 'halos', 'parang',
]);

export type ClauseLanguage = 'fil' | 'en';

export type SpeechClause = {
  text: string;
  language: ClauseLanguage;
};

function buildConjunctionPattern(): RegExp {
  const alternatives = CLAUSE_CONJUNCTIONS.map((conjunction) => conjunction.replace(/\s+/g, '\\s+'));
  return new RegExp(`\\s+(?=(?:${alternatives.join('|')})\\b)`, 'gi');
}

const CONJUNCTION_SPLIT_PATTERN = buildConjunctionPattern();

/**
 * Splits a message into clauses at commas, periods, and the conjunctions
 * listed in `CLAUSE_CONJUNCTIONS`. Punctuation stays attached to the
 * clause it follows; a conjunction starts the clause that follows it.
 */
export function splitIntoClauses(message: string): string[] {
  // Split right after a comma/period (consuming any following whitespace),
  // so the punctuation itself stays with the clause before it.
  const afterPunctuation = message.split(/(?<=[,.])\s*/);

  const clauses: string[] = [];
  for (const piece of afterPunctuation) {
    const subPieces = piece.split(CONJUNCTION_SPLIT_PATTERN);
    for (const sub of subPieces) {
      const trimmed = sub.trim();
      if (trimmed) {
        clauses.push(trimmed);
      }
    }
  }
  return clauses;
}

// Every clause conjunction is unambiguously Filipino, so it should count as
// a marker word too — folded in here (rather than duplicated by hand into
// FILIPINO_MARKERS above) so the two lists can't quietly drift out of sync.
const CLASSIFICATION_MARKERS = new Set([
  ...FILIPINO_MARKERS,
  ...CLAUSE_CONJUNCTIONS.flatMap((conjunction) => conjunction.split(/\s+/)),
]);

/**
 * Decides a single clause's language: Filipino if it contains at least one
 * recognizably-Filipino word, English otherwise. A clause that mixes both
 * (e.g. "I'm gonna kain na") is treated as Filipino as a whole, since
 * that's the closer-sounding read for a sentence built on Filipino grammar
 * with a few English words dropped in — the reverse (an English sentence
 * with one Filipino word) is rarer in practice and can be special-cased
 * later if it turns out to matter.
 */
export function classifyClause(clause: string): ClauseLanguage {
  const words = clause.toLowerCase().match(/[a-zà-ÿñ']+/g) ?? [];
  const hasFilipinoWord = words.some((word) => CLASSIFICATION_MARKERS.has(word));
  return hasFilipinoWord ? 'fil' : 'en';
}

/** Splits a message into clauses and classifies each one's language. */
export function analyzeSpeechClauses(message: string): SpeechClause[] {
  return splitIntoClauses(message).map((text) => ({ text, language: classifyClause(text) }));
}

function localeFor(language: ClauseLanguage): string {
  return language === 'fil' ? FILIPINO_LOCALE : ENGLISH_LOCALE;
}

function speakClause(clause: SpeechClause): Promise<void> {
  return new Promise((resolve) => {
    Speech.speak(clause.text, {
      language: localeFor(clause.language),
      onDone: resolve,
      onStopped: resolve,
      onError: () => resolve(),
    });
  });
}

// Tracks whether the in-flight speakMixed() call has been cancelled, so its
// clause-by-clause loop stops instead of continuing to speak after
// stopMixed() is called. expo-speech only ever speaks one utterance at a
// time globally, so a single module-level flag is enough here — there's
// never more than one "session" actually playing at once.
let cancelled = false;

/**
 * Speaks a full message clause by clause, switching between the Filipino
 * and English voice as needed. Callbacks mirror `Speech.speak`'s shape so
 * callers (e.g. MessageBubble) can swap this in as a drop-in replacement.
 */
export async function speakMixed(
  message: string,
  callbacks?: { onDone?: () => void; onError?: (error: unknown) => void },
): Promise<void> {
  cancelled = false;
  try {
    const clauses = analyzeSpeechClauses(message);
    for (const clause of clauses) {
      if (cancelled) {
        return;
      }
      await speakClause(clause);
    }
    if (!cancelled) {
      callbacks?.onDone?.();
    }
  } catch (error) {
    callbacks?.onError?.(error);
  }
}

/** Stops whatever `speakMixed` is currently speaking, mid-message if needed. */
export function stopMixed(): void {
  cancelled = true;
  void Speech.stop();
}
