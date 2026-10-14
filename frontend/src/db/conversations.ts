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

/**
 * Conversations belong to the account that made them. Two people can use
 * one phone: each sees, reads aloud and backs up only their own. Signing out
 * keeps them on the phone (they're back on the next login) but hidden from
 * everyone else. Every read and write below goes through `account`.
 */
let account: string | null = null;

/** The account the queries below are for, or null when signed out. */
export function currentConversationAccount(): string | null {
  return account;
}

/**
 * Set by use-bootstrap on sign-in (and app start) and sign-out (null).
 * `adopt`: this account takes over conversations from before they were
 * kept per account (HANDOFF §20) — the same rule as the phone's old
 * settings (adoptLegacy): an existing account signing in, never a brand-new one.
 */
export async function setConversationAccount(userId: string | null, { adopt = false } = {}): Promise<void> {
  account = userId;
  if (userId && adopt) await adoptUnowned(userId).catch(() => undefined);
}

async function adoptUnowned(userId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE conversations SET account_id = ? WHERE account_id IS NULL', [userId]);
  await db.runAsync('UPDATE pending_deletions SET account_id = ? WHERE account_id IS NULL', [userId]);
}

function signedInAccount(): string {
  if (!account) throw new Error('Not signed in');
  return account;
}

export async function listConversations(): Promise<Conversation[]> {
  if (!account) return [];
  const db = await getDatabase();
  const rows = await db.getAllAsync<ConversationRow>(
    'SELECT * FROM conversations WHERE account_id = ? ORDER BY updated_at DESC',
    [account],
  );
  return rows.map(toConversation);
}

export async function getConversation(id: string): Promise<Conversation | null> {
  if (!account) return null;
  const db = await getDatabase();
  const row = await db.getFirstAsync<ConversationRow>(
    'SELECT * FROM conversations WHERE id = ? AND account_id = ?',
    [id, account],
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
  const owner = signedInAccount();
  const db = await getDatabase();
  if (!(await getConversation(id))) return; // not this account's
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM messages WHERE conversation_id = ?', [id]);
    await db.runAsync('DELETE FROM conversations WHERE id = ? AND account_id = ?', [id, owner]);
    await db.runAsync(
      'INSERT OR REPLACE INTO pending_deletions (conversation_id, deleted_at, account_id) VALUES (?, ?, ?)',
      [id, Date.now(), owner],
    );
  });
}

/** This account's deletions the server hasn't confirmed yet, oldest first. */
export async function listPendingDeletions(): Promise<string[]> {
  if (!account) return [];
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ conversation_id: string }>(
    'SELECT conversation_id FROM pending_deletions WHERE account_id = ? ORDER BY deleted_at ASC',
    [account],
  );
  return rows.map((row) => row.conversation_id);
}

export async function clearPendingDeletion(conversationId: string): Promise<void> {
  if (!account) return;
  const db = await getDatabase();
  await db.runAsync('DELETE FROM pending_deletions WHERE conversation_id = ? AND account_id = ?', [
    conversationId,
    account,
  ]);
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  if (!account) return [];
  const db = await getDatabase();
  const rows = await db.getAllAsync<MessageRow>(
    `SELECT m.* FROM messages m JOIN conversations c ON c.id = m.conversation_id
     WHERE m.conversation_id = ? AND c.account_id = ? ORDER BY m.created_at ASC`,
    [conversationId, account],
  );
  return rows.map(toMessage);
}

export async function createConversation(title: string, mode: string): Promise<Conversation> {
  const owner = signedInAccount();
  const db = await getDatabase();
  const now = Date.now();
  const id = makeId('conv');
  await db.runAsync(
    'INSERT INTO conversations (id, title, mode, created_at, updated_at, synced_at, account_id) VALUES (?, ?, ?, ?, ?, NULL, ?)',
    [id, title, mode, now, now, owner],
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
  const owner = signedInAccount();
  const db = await getDatabase();
  await db.runAsync('UPDATE conversations SET title = ?, synced_at = NULL WHERE id = ? AND account_id = ?', [
    title,
    id,
    owner,
  ]);
}

export async function markConversationSynced(conversationId: string, syncedAt: number): Promise<void> {
  if (!account) return;
  const db = await getDatabase();
  await db.runAsync('UPDATE conversations SET synced_at = ? WHERE id = ? AND account_id = ?', [
    syncedAt,
    conversationId,
    account,
  ]);
}

export async function addMessage(
  conversationId: string,
  sender: MessageSender,
  body: string,
): Promise<void> {
  if (!(await getConversation(conversationId))) throw new Error('Conversation not found');
  const db = await getDatabase();
  const now = Date.now();
  const id = makeId('msg');
  await db.runAsync(
    'INSERT INTO messages (id, conversation_id, sender, body, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, conversationId, sender, body, now],
  );
  await db.runAsync('UPDATE conversations SET updated_at = ? WHERE id = ?', [now, conversationId]);
}

