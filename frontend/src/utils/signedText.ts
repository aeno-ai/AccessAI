import { apiFetch } from '@/api/apiClient';
import type { SignLanguage } from '@/hooks/use-preferences';
import { signedWordsInFilipino } from '@/sign/glossary';

export type TranslateTo = 'en' | 'fil';
export const TRANSLATE_NAMES: Record<TranslateTo, string> = { en: 'English', fil: 'Filipino' };

/**
 * Signed text in English or Filipino (HANDOFF.md §52 E).
 * - Into Filipino: always the built-in list of the 205 sign words, sign by
 *   sign (owner, 2026-10-21): the small AI on the laptop wrote wrong Tagalog
 *   ("I need help" → "Mahal kita"), and a wrong translation is worse than a
 *   plain one. Instant, and works offline.
 * - Into English: the AI on the server translates the whole text; offline
 *   (or if it can't help), the signed words themselves (they're English).
 * Null when there's nothing to go on; `basic` marks the sign-by-sign answer.
 */
export async function translateSigned(
  text: string,
  to: TranslateTo,
  signedWords: string[],
): Promise<{ text: string; basic: boolean } | null> {
  if (to === 'fil') return signedWords.length ? { text: signedWordsInFilipino(signedWords), basic: true } : null;
  try {
    const result = await apiFetch<{ text: string }>('/assistant/polish', {
      method: 'POST',
      timeoutMs: 16000,
      body: JSON.stringify({ text, kind: 'translate', language: to }),
    });
    const translated = result.text?.trim();
    if (translated) return { text: translated, basic: false };
  } catch {
    // offline or the AI is busy: the signed words themselves
  }
  return signedWords.length ? { text: signedWords.join(' '), basic: true } : null;
}

/**
 * Asks the AI on the server to tidy signed text: `gloss` turns sign words
 * ("ME GO STORE TOMORROW") into a sentence; `spell` fixes a fingerspelled
 * word. Null if it can't (offline): the text stays as signed. Used by the
 * message box's sign mode and the sign camera.
 */
export async function polishSigned(text: string, kind: 'gloss' | 'spell', language: SignLanguage): Promise<string | null> {
  try {
    const result = await apiFetch<{ text: string }>('/assistant/polish', {
      method: 'POST',
      timeoutMs: 16000,
      body: JSON.stringify({ text: text.toUpperCase(), kind, language }),
    });
    return result.text?.trim() || null;
  } catch {
    return null;
  }
}
