/**
 * Small language tools Laya uses on the phone itself (no internet):
 * cleaning up what was heard, yes/no in English and Filipino, finding a
 * friend by a spoken name, and reading a friend code from spoken letters.
 */
import type { Friend } from '@/db/friends';
import type { Lang } from '@/laya/phrases';
import { isFilipinoWord } from '@/utils/clauses';

// ------------------------------------------------------------ cleaning up

// Polite or filler words that don't change the meaning.
const FILLERS = /\b(please|pls|plz|po|naman|nga|lang|ba|paki|uh+|um+|ah+|eh|hey|hi|ok(ay)?|uy|hoy|can you|could you|would you|i want you to|laya can you)\b/g;

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // accents (é → e), after splitting them off with NFD
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}' -]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ------------------------------------------------------------ "Hey Laya"
//
// "Laya" is an everyday Filipino word too ("malaya", "kalayaan", "laya ng
// bansa"), so the name alone never wakes her: a greeting must come right
// before it — "Hey Laya", "Okay Laya", "Uy Laya", "Hoy Laya" (owner,
// 2026-10-17). Speech recognition doesn't always spell her name "Laya":
// close spellings count too, and names like "Layla" or "Leia" only when no
// friend is called that ("Hi Layla" in a chat with Layla stays a sentence).

/** The greetings, and which language each one is: "Uy Laya" gets a Filipino answer. */
const GREETING_EN = /^(hey|hi|hello|ok|okay|yo|hay)$/;
// An English recognizer often writes "uy" as "we" or "oi".
const GREETING_FIL = /^(uy|ui|huy|hoy|oy|oi|we|wey)$/;

/** Her name, as speech recognition writes it. */
const NAME = /^(laya|layah|laia|laiya|layya|lya|leya|liya|lieya)$/;
/** Real names that sound like hers — only when no friend has that name. */
const LOOSE_NAME = /^(leia|leah|lea|layla|laila|leila|lyla|lila|lia|layer|liar)$/;
/** Greeting and name written as one word: "hilaya", "heylaya", "uylaya". */
const FUSED = /^(hi|hey|ok|okay|uy|huy|hoy|oy)(laya|layah|laia|leya)$/;

export type WakeGreeting = 'en' | 'fil';

export type WakeMatch = {
  /** Where the match starts (the greeting). */
  start: number;
  /** Where the name itself starts ("Laya" in "hey Laya"; the whole word in "hilaya"). */
  nameStart: number;
  /** Just after the name and any comma or full stop after it. */
  end: number;
  /** The greeting's language: "uy / hoy Laya" → 'fil'. */
  greeting: WakeGreeting;
};

export type WakeOptions = {
  /** The user's friends' first names: a name like "Layla" is then a friend, not Laya. */
  friendNames?: readonly string[];
};

function greetingOf(word: string): WakeGreeting | null {
  const lower = word.toLowerCase();
  return GREETING_EN.test(lower) ? 'en' : GREETING_FIL.test(lower) ? 'fil' : null;
}

/** Finds "Hey Laya" (greeting + name, in any of the ways speech recognition writes it) in `text`. */
export function findWakeWord(text: string, options: WakeOptions = {}): WakeMatch | null {
  const words = [...text.matchAll(/[\p{L}\p{N}']+/gu)].map((m) => ({
    word: m[0].toLowerCase().replace(/'s$/, ''),
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
  }));
  const friends = new Set((options.friendNames ?? []).map((name) => normalize(name)));
  const ending = (index: number) => {
    const after = text.slice(words[index].end).match(/^\s*[,.!?]+/);
    return words[index].end + (after ? after[0].length : 0);
  };
  for (let i = 0; i < words.length; i += 1) {
    const fused = words[i].word.match(FUSED);
    if (fused) {
      return { start: words[i].start, nameStart: words[i].start, end: ending(i), greeting: greetingOf(fused[1]) ?? 'en' };
    }
    if (i === 0) continue;
    const greeting = greetingOf(words[i - 1].word);
    if (!greeting) continue;
    const word = words[i].word;
    // One word ("Laya"), or two run together ("la ya", "lay a").
    if (NAME.test(word) || (LOOSE_NAME.test(word) && !friends.has(word))) {
      return { start: words[i - 1].start, nameStart: words[i].start, end: ending(i), greeting };
    }
    if (i + 1 < words.length && NAME.test(word + words[i + 1].word)) {
      return { start: words[i - 1].start, nameStart: words[i].start, end: ending(i + 1), greeting };
    }
  }
  return null;
}

/** Whatever was said after "Hey Laya" (empty if just the wake word), or null if it wasn't said. */
export function afterWakeWord(text: string, options: WakeOptions = {}): string | null {
  const match = findWakeWord(text, options);
  return match ? text.slice(match.end).trim() : null;
}

/**
 * Takes "Hey Laya" — or just "Laya," — off the START of a command ("Laya,
 * open friends" typed into her box → "open friends"). Elsewhere it's left
 * alone: "tell Laya I'm here" can be a friend's name.
 */
export function removeWakeWord(text: string): string {
  const match = findWakeWord(text);
  if (match && /^[\s,.!?]*$/.test(text.slice(0, match.start))) {
    return `${text.slice(0, match.start)} ${text.slice(match.end)}`.trim();
  }
  const bare = text.match(/^[\s,.!?]*([\p{L}']+)[\s,.!?]+/u);
  if (bare && NAME.test(bare[1].toLowerCase())) return text.slice(bare[0].length).trim();
  return text;
}

/** The sentence with every spelling of her name written "laya" ("open leya settings" → "open laya settings"). */
export function spellLaya(text: string): string {
  return text.replace(/[\p{L}']+/gu, (word) => (NAME.test(word.toLowerCase()) ? 'laya' : word));
}

// ------------------------------------------------------------ which language

// Filipino words that are also everyday English, or are said in English
// sentences too ("tell Kuya Ben…"): on their own they don't make a command
// Filipino.
const ALSO_ENGLISH = new Set(['at', 'may', 'o', 'ay', 'di', 'ate', 'eh', 'char', 'kay', 'pare', 'bes', 'kuya', 'tita', 'tito', 'lola', 'lolo', 'nanay', 'tatay', 'anak']);
// Command words that aren't in the general Filipino word list.
const FILIPINO_COMMANDS = new Set([
  'buksan', 'pakibuksan', 'ipakita', 'pakita', 'pakitingnan', 'basahin', 'pakibasa', 'sabihin', 'pakisabi', 'pasabi',
  'padalhan', 'ipadala', 'palakihin', 'paliitin', 'liitan', 'bagalan', 'bilisan', 'tanggalin', 'alisin', 'isama',
  'simulan', 'magsimula', 'tapusin', 'isara', 'ulitin', 'pakiulit', 'sagutin', 'tanggapin', 'tanggihan', 'laktawan',
  'tuloy', 'ituloy', 'susunod', 'sunod', 'pangalawa', 'ikalawa', 'pangatlo', 'una', 'nasaan', 'saklolo', 'tulungan',
  'ligtas', 'makipag-usap', 'magdagdag', 'matuto', 'mag-aral', 'bumalik', 'atras', 'dalhin', 'palitan', 'gamitin',
  'babae', 'lalaki', 'boses', 'sulat', 'malaki', 'maliit', 'dahan-dahan', 'paano', 'nandito', "ano'ng", 'anong',
]);

/**
 * The language a command was said in, so Laya answers in it: Tagalog or
 * Taglish → 'fil', English → 'en'. One clearly Filipino word is enough
 * ("open settings po" is Taglish). `greeting`: a Filipino greeting ("Uy
 * Laya") counts too.
 */
export function commandLanguage(text: string, greeting?: Lang): Lang {
  if (greeting === 'fil') return 'fil';
  const words = normalize(text).split(' ');
  const filipino = words.some((word) => {
    const bare = word.replace(/'.*$/, '');
    if (FILIPINO_COMMANDS.has(word)) return true;
    if (ALSO_ENGLISH.has(bare)) return false;
    // "i-message", "mag-SOS", "pakiulit": Filipino ways of using any word.
    return isFilipinoWord(word) || isFilipinoWord(bare) || /^(i|mag|nag|maka|pa|paki)-\p{L}/u.test(word);
  });
  return filipino ? 'fil' : 'en';
}

/** What was said, without "Hey Laya" and filler words. */
export function stripFillers(text: string): string {
  return normalize(removeWakeWord(text)).replace(FILLERS, ' ').replace(/\s+/g, ' ').trim();
}

// ------------------------------------------------------------ yes / no

const YES = /^(yes|yeah|yep|yup|ya|sure|ok|okay|go|go ahead|do it|correct|right|confirm|send|send it|oo|opo|oho|sige|sige po|tama|ayos|g|game|okay lang|yes please)\b/;
const NO = /^(no|nope|nah|don't|do not|stop|cancel|never mind|nevermind|wait|hindi|huwag|wag|ayaw|ayoko|mali|teka|hindi po|huwag na)\b/;

export function parseYesNo(text: string): 'yes' | 'no' | null {
  const said = normalize(text);
  if (NO.test(said)) return 'no';
  if (YES.test(said)) return 'yes';
  return null;
}

// ------------------------------------------------------------ friend names

const HONORIFICS = /\b(ate|kuya|tita|tito|lola|lolo|sir|maam|ma'am|miss|mister|mr|mrs|ms|tatay|nanay|ninang|ninong)\b/g;

function cleanName(name: string): string {
  return normalize(name).replace(HONORIFICS, ' ').replace(/\s+/g, ' ').trim();
}

// How alike two words are, 0–1 (1 = the same), allowing a few mistakes
// from speech recognition ("Anna" / "Ana", "Jhon" / "John").
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (__, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return 1 - d[a.length][b.length] / Math.max(a.length, b.length);
}

export type FriendMatch = { friend: Friend } | { choices: Friend[] } | null;

/**
 * Finds a friend from a spoken name — only among the user's OWN friends.
 * Two similar names → asks which; nothing close → null.
 */
export function matchFriend(spoken: string, friends: Friend[]): FriendMatch {
  const wanted = cleanName(spoken);
  if (!wanted) return null;
  const scored = friends
    .map((friend) => {
      const first = cleanName(friend.firstName || friend.name.split(' ')[0]);
      const full = cleanName(friend.name);
      const best = Math.max(
        similarity(wanted, first),
        similarity(wanted, full),
        full.split(' ').some((part) => part === wanted) ? 0.95 : 0,
      );
      return { friend, score: best };
    })
    .filter((entry) => entry.score >= 0.75)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  const close = scored.filter((entry) => scored[0].score - entry.score < 0.05);
  return close.length === 1 ? { friend: close[0].friend } : { choices: close.map((entry) => entry.friend) };
}

// ------------------------------------------------------------ friend codes

const FRIEND_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const SPOKEN: Record<string, string> = {
  ay: 'A', ei: 'A', bee: 'B', bi: 'B', be: 'B', see: 'C', sea: 'C', si: 'C', dee: 'D', di: 'D', ee: 'E', ef: 'F', eff: 'F',
  gee: 'G', ji: 'G', aitch: 'H', eych: 'H', eitch: 'H', jay: 'J', jey: 'J', kay: 'K', key: 'K', kei: 'K', em: 'M', en: 'N',
  pee: 'P', pi: 'P', queue: 'Q', cue: 'Q', kyu: 'Q', ar: 'R', are: 'R', es: 'S', ess: 'S', tee: 'T', tea: 'T', ti: 'T',
  you: 'U', yu: 'U', vee: 'V', vi: 'V', ex: 'X', eks: 'X', why: 'Y', way: 'Y', zee: 'Z', zed: 'Z', zi: 'Z',
  two: '2', to: '2', too: '2', three: '3', four: '4', for: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  dalawa: '2', tatlo: '3', apat: '4', lima: '5', anim: '6', pito: '7', walo: '8', siyam: '9',
};

/**
 * "A B C D two three four five", "abcd 2345", "double-u x y z…" → "ABCD-2345".
 * Null if it isn't 8 characters from the friend-code alphabet (which
 * leaves out 0, O, 1, I and L because they're easy to confuse).
 */
export function parseFriendCode(spoken: string): string | null {
  const words = normalize(spoken.replace(/double[ -]?(u|you)/gi, ' W ')).split(/[\s-]+/);
  let letters = '';
  for (const word of words) {
    if (!word || ['code', 'friend', 'add', 'the', 'is', 'ang', 'dash'].includes(word)) continue;
    if (SPOKEN[word]) letters += SPOKEN[word];
    else if (/^[a-z0-9]+$/.test(word) && word.length <= 8) letters += word.toUpperCase();
  }
  const filtered = [...letters].filter((char) => FRIEND_CODE_CHARS.includes(char)).join('');
  return filtered.length === 8 ? `${filtered.slice(0, 4)}-${filtered.slice(4)}` : null;
}

/** "ABCD-2345" → "A, B, C, D, dash, 2, 3, 4, 5" — slow enough to write down. */
export function spellCode(code: string): string {
  return [...code].map((char) => (char === '-' ? 'dash' : char)).join(', ');
}
