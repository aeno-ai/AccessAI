import NetInfo from '@react-native-community/netinfo';
import { apiFetch } from '@/api/apiClient';
import { isIntentId, type Slots } from '@/accel/catalog';
import { matchRules, type Understood } from '@/accel/rules';

export type Understanding = Understood & { source: 'phone' | 'ai' };

// The phone's rules are trusted on their own at or above this.
const SURE = 0.85;

async function online(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

function cleanSlots(slots: unknown): Slots {
  const result: Slots = {};
  if (!slots || typeof slots !== 'object') return result;
  const raw = slots as Record<string, unknown>;
  if (typeof raw.friendName === 'string') result.friendName = raw.friendName.slice(0, 40);
  if (typeof raw.messageText === 'string') result.messageText = raw.messageText.slice(0, 300);
  if (typeof raw.friendCode === 'string' && /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(raw.friendCode)) result.friendCode = raw.friendCode;
  if (raw.value === 'man' || raw.value === 'woman' || raw.value === 'auto') result.value = raw.value;
  return result;
}

/**
 * What did the person mean? 1) the phone's own rules (instant, offline);
 * 2) if those aren't sure and "Smarter understanding" is on and there's
 * internet, the AI on the AccessAI server. Whatever happens, the answer is
 * one of the ids in catalog.ts — anything else counts as "didn't catch that".
 */
export async function understand(text: string, options: { smart: boolean; screen: string }): Promise<Understanding> {
  const local = matchRules(text);
  if (local.confidence >= SURE || !options.smart) return { ...local, source: 'phone' };
  try {
    if (!(await online())) throw new Error('offline');
    const ai = await apiFetch<{ intent: string; slots: unknown; confidence: number }>('/assistant/interpret', {
      method: 'POST',
      timeoutMs: 16000,
      body: JSON.stringify({ text: text.slice(0, 300), screen: options.screen.slice(0, 100) }),
    });
    if (isIntentId(ai.intent) && ai.intent !== 'none') {
      return { intent: ai.intent, slots: cleanSlots(ai.slots), confidence: Number(ai.confidence) || 0.6, source: 'ai' };
    }
    return local.confidence >= 0.6 ? { ...local, source: 'phone' } : { intent: 'none', slots: {}, confidence: 0, source: 'ai' };
  } catch {
    // Offline or the AI is busy: the phone's best guess, if it has one.
    return local.confidence >= 0.5 ? { ...local, source: 'phone' } : { intent: 'none', slots: {}, confidence: 0, source: 'phone' };
  }
}

/**
 * Grammar help for a message about to be sent by voice (online only; the
 * original is kept if anything goes wrong). Accel reads the result back
 * before sending, so the person always hears what will be sent.
 */
export async function polishMessage(text: string, smart: boolean): Promise<string> {
  if (!smart || !(await online().catch(() => false))) return text;
  try {
    const result = await apiFetch<{ text: string }>('/assistant/polish', {
      method: 'POST',
      timeoutMs: 16000,
      body: JSON.stringify({ text, kind: 'message' }),
    });
    return typeof result.text === 'string' && result.text.trim() ? result.text.trim() : text;
  } catch {
    return text;
  }
}

export { online as isOnlineNow };
