import { apiFetch } from '@/api/apiClient';
import {
  clearPendingDeletion,
  getConversation,
  getMessages,
  listConversations,
  listPendingDeletions,
  markConversationSynced,
  type Conversation,
} from './conversations';

async function syncOne(conversation: Conversation): Promise<boolean> {
  const messages = await getMessages(conversation.id);
  // It may have been deleted since the list was read. Uploading it now
  // would re-create a cloud copy of a conversation the user just deleted.
  if (!(await getConversation(conversation.id))) {
    return false;
  }
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

// Sends every deletion made on this device that the server hasn't confirmed
// yet. A failed one (e.g. offline) just stays queued for the next sync.
async function syncDeletions(): Promise<void> {
  for (const conversationId of await listPendingDeletions()) {
    try {
      await apiFetch(`/conversations/${encodeURIComponent(conversationId)}`, { method: 'DELETE' });
      await clearPendingDeletion(conversationId);
    } catch {
      return; // most likely offline — no point trying the rest right now
    }
  }
}

async function runSync(): Promise<void> {
  await syncDeletions();

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

let inFlight: Promise<void> | null = null;
let runAgain = false;

/**
 * Sends local deletions to the backend, then pushes every local
 * conversation that's new or has changed since its last successful sync.
 * Best-effort and silent: nothing here throws, nothing blocks the UI, and a
 * conversation that fails to sync just stays "Offline" in History until the
 * next attempt.
 *
 * Only one sync runs at a time. A call made while one is running schedules
 * exactly one more pass after it — so a conversation deleted mid-sync has
 * its deletion sent *after* any upload of it that was already under way,
 * and no stray copy is left in the cloud.
 */
export function syncConversations(): Promise<void> {
  if (inFlight) {
    runAgain = true;
    return inFlight;
  }

  inFlight = (async () => {
    try {
      do {
        runAgain = false;
        await runSync();
      } while (runAgain);
    } catch {
      // Local database hiccup — the next sync trigger will try again.
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
