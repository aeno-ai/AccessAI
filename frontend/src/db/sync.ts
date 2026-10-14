import { apiFetch } from '@/api/apiClient';
import {
  clearPendingDeletion,
  currentConversationAccount,
  getConversation,
  getMessages,
  listConversations,
  listPendingDeletions,
  markConversationSynced,
  type Conversation,
} from './conversations';

// Messages per upload. 200 of the longest (2000 characters) fit well inside
// the server's 2 MB limit for this route.
const CHUNK = 200;

/**
 * Uploads what's new in one conversation: its title, and only the messages
 * written since its last successful sync (`since`), in chunks — not the
 * whole conversation every time. Messages never change once written, and
 * the server saves each by its id, so re-sending one is harmless.
 */
async function syncOne(conversation: Conversation, since: number | null, owner: string): Promise<boolean> {
  const messages = (await getMessages(conversation.id)).filter(
    (message) => since === null || message.createdAt >= since,
  );
  // It may have been deleted since the list was read. Uploading it now
  // would re-create a cloud copy of a conversation the user just deleted.
  if (!(await getConversation(conversation.id))) {
    return false;
  }
  try {
    // At least one request, so a new title (with no new messages) is sent too.
    for (let start = 0; start === 0 || start < messages.length; start += CHUNK) {
      // Someone else signed in meanwhile: never upload with their login.
      if (currentConversationAccount() !== owner) return false;
      await apiFetch('/conversations/sync', {
        method: 'POST',
        body: JSON.stringify({
          clientId: conversation.id,
          title: conversation.title,
          mode: conversation.mode,
          messages: messages.slice(start, start + CHUNK).map((message) => ({
            clientId: message.id,
            sender: message.sender,
            body: message.body,
            createdAt: message.createdAt,
          })),
        }),
      });
    }
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
  const owner = currentConversationAccount();
  for (const conversationId of await listPendingDeletions()) {
    if (currentConversationAccount() !== owner) return;
    try {
      await apiFetch(`/conversations/${encodeURIComponent(conversationId)}`, { method: 'DELETE' });
      await clearPendingDeletion(conversationId);
    } catch {
      return; // most likely offline — no point trying the rest right now
    }
  }
}

// Only the signed-in account's conversations and deletions are sent (with
// its own login) — see conversations.ts.
async function runSync(): Promise<void> {
  const owner = currentConversationAccount();
  if (!owner) return;
  await syncDeletions();

  const conversations = await listConversations();
  const pending = conversations.filter(
    (conversation) => conversation.syncedAt === null || conversation.syncedAt < conversation.updatedAt,
  );

  for (const conversation of pending) {
    // Taken BEFORE reading the messages: one written while this upload is
    // under way is newer than it, so the next sync sends it.
    const startedAt = Date.now();
    const ok = await syncOne(conversation, conversation.syncedAt, owner);
    if (ok) {
      await markConversationSynced(conversation.id, startedAt);
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
