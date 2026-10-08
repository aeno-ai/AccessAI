/**
 * Small language tools Accel uses on the phone itself (no internet):
 * cleaning up what was heard, yes/no in English and Filipino, finding a
 * friend by a spoken name, and reading a friend code from spoken letters.
 */
import type { Friend } from '@/db/friends';

// ------------------------------------------------------------ cleaning up

// Polite or filler words that don't change the meaning.
const FILLERS = /\b(please|pls|plz|po|naman|nga|lang|ba|paki|uh+|um+|ah+|eh|hey|hi|ok(ay)?|uy|hoy|can you|could you|would you|i want you to|accel can you)\b/g;
// "Hey Accel" and what speech recognition makes of it.
export const WAKE_WORD = /\b(hey|hi|ok(ay)?|uy|hoy)?\s*(accel|axel|axle|excel|aksel|aksyel|acel|access ?a\.? ?i\.?|accessai)\b[,.!?]?/i;

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

/** What was said, without "Hey Accel" and filler words. */
export function stripFillers(text: string): string {
  return normalize(text.replace(WAKE_WORD, ' ')).replace(FILLERS, ' ').replace(/\s+/g, ' ').trim();
}

/** Whatever was said after "Hey Accel" (empty if just the wake word). */
export function afterWakeWord(text: string): string | null {
  const match = text.match(WAKE_WORD);
  if (!match || match.index === undefined) return null;
  return text.slice(match.index + match[0].length).trim();
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
