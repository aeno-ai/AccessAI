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
