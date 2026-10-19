import { apiFetch } from '@/api/apiClient';
import type { SignLanguage } from '@/hooks/use-preferences';

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
