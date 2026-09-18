import { apiFetch } from '@/api/apiClient';
import {
  getMessages,
  listConversations,
  markConversationSynced,
  type Conversation,
} from './conversations';

async function syncOne(conversation: Conversation): Promise<boolean> {
  const messages = await getMessages(conversation.id);
  try {
    await apiFetch('/conversations/sync', {
      method: 'POST',
      body: JSON.stringify({
        clientId: conversation.id,
        title: conversation.title,
        mode: conversation.mode,
        messages: messages.map((message) => ({
          clientId: message.id,
          sender: message.sender,
          body: message.body,
          createdAt: message.createdAt,
        })),
      }),
    });
    return true;
  } catch {
    // Offline, server unreachable, or some other transient failure — leave
    // this conversation's syncedAt untouched so the next sync attempt picks
    // it back up. Offline-first means a failed sync is never an error the
    // user needs to see.
    return false;
  }
}

/**
 * Pushes every local conversation that's new or has changed since its last
 * successful sync up to the backend. Best-effort and silent: nothing here
 * throws, nothing blocks the UI, and a conversation that fails to sync just
 * stays "Offline" in History until the next attempt.
 */
export async function syncConversations(): Promise<void> {
  const conversations = await listConversations();
  const pending = conversations.filter(
    (conversation) => conversation.syncedAt === null || conversation.syncedAt < conversation.updatedAt,
  );

  for (const conversation of pending) {
    const ok = await syncOne(conversation);
    if (ok) {
      await markConversationSynced(conversation.id, Date.now());
    }
  }
}
