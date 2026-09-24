import { getDatabase } from './client';

export type MessageSender = 'me' | 'them';

export type Conversation = {
  id: string;
  title: string;
  mode: string;
  createdAt: number;
  updatedAt: number;
  syncedAt: number | null;
};

export type Message = {
  id: string;
  conversationId: string;
  sender: MessageSender;
  body: string;
  createdAt: number;
};

type ConversationRow = {
  id: string;
  title: string;
  mode: string;
  created_at: number;
  updated_at: number;
  synced_at: number | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender: string;
  body: string;
  created_at: number;
};

function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    mode: row.mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncedAt: row.synced_at,
  };
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    sender: row.sender === 'me' ? 'me' : 'them',
    body: row.body,
    createdAt: row.created_at,
  };
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function listConversations(): Promise<Conversation[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ConversationRow>(
    'SELECT * FROM conversations ORDER BY updated_at DESC',
  );
  return rows.map(toConversation);
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ConversationRow>(
    'SELECT * FROM conversations WHERE id = ?',
    [id],
  );
  return row ? toConversation(row) : null;
}

/**
 * Deletes a conversation and its messages, and queues the deletion of its
 * cloud copy (sent by `syncConversations` whenever the device is online).
 * Messages are deleted explicitly, first, rather than relying solely on the
 * table's `ON DELETE CASCADE` — SQLite only enforces foreign keys when a
 * session has turned that on (see `PRAGMA foreign_keys = ON` in client.ts),
 * so this stays correct even if that pragma isn't honored for some reason.
 *
 * The cloud deletion is queued even if this conversation never synced: a
 * sync could be mid-upload right now, and the server treats deleting
 * something it doesn't have as a no-op anyway.
 */
export async function deleteConversation(id: string): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM messages WHERE conversation_id = ?', [id]);
    await db.runAsync('DELETE FROM conversations WHERE id = ?', [id]);
    await db.runAsync(
      'INSERT OR REPLACE INTO pending_deletions (conversation_id, deleted_at) VALUES (?, ?)',
      [id, Date.now()],
    );
  });
}

export async function listPendingDeletions(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ conversation_id: string }>(
    'SELECT conversation_id FROM pending_deletions ORDER BY deleted_at ASC',
  );
  return rows.map((row) => row.conversation_id);
}

export async function clearPendingDeletion(conversationId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM pending_deletions WHERE conversation_id = ?', [conversationId]);
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<MessageRow>(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
    [conversationId],
  );
  return rows.map(toMessage);
}

export async function createConversation(title: string, mode: string): Promise<Conversation> {
  const db = await getDatabase();
  const now = Date.now();
  const id = makeId('conv');
  await db.runAsync(
    'INSERT INTO conversations (id, title, mode, created_at, updated_at, synced_at) VALUES (?, ?, ?, ?, ?, NULL)',
    [id, title, mode, now, now],
  );
  return { id, title, mode, createdAt: now, updatedAt: now, syncedAt: null };
}

/**
 * Renames a conversation. `updated_at` is deliberately left alone — History
 * is ordered by last activity, and a rename shouldn't make a conversation
 * jump to the top. Clearing `synced_at` instead is what makes the next sync
 * upload the new title (see the pending filter in sync.ts).
 */
export async function renameConversation(id: string, title: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE conversations SET title = ?, synced_at = NULL WHERE id = ?', [title, id]);
}

export async function markConversationSynced(conversationId: string, syncedAt: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE conversations SET synced_at = ? WHERE id = ?', [syncedAt, conversationId]);
}

export async function addMessage(
  conversationId: string,
  sender: MessageSender,
  body: string,
): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  const id = makeId('msg');
  await db.runAsync(
    'INSERT INTO messages (id, conversation_id, sender, body, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, conversationId, sender, body, now],
  );
  await db.runAsync('UPDATE conversations SET updated_at = ? WHERE id = ?', [now, conversationId]);
}

/**
 * Inserts a couple of realistic sample conversations the first time the app
 * runs, so History has something real — locally persisted, fully offline —
 * to show while the live conversation screen itself is still a placeholder.
 * This is what proves the offline-first storage pattern end-to-end for now.
 */
export async function seedDummyDataIfEmpty(): Promise<void> {
  const existing = await listConversations();
  if (existing.length > 0) {
    return;
  }

  const withMom = await createConversation('Chat with Mom', 'combined');
  await addMessage(withMom.id, 'them', 'Hi! Did you eat lunch yet?');
  await addMessage(withMom.id, 'me', 'Yes, just finished. Heading out now.');

  const practice = await createConversation('Practice session', 'sign');
  await addMessage(practice.id, 'me', 'Practiced greetings and numbers today.');
}
