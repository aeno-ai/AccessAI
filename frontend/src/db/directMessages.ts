import { apiFetch, isApiError } from '@/api/apiClient';
import { getDatabase } from './client';

/** One message in an online chat with a friend, as stored on this phone. */
export type DirectMessage = {
  localId: string;
  serverId: string | null;
  friendId: string;
  fromMe: boolean;
  body: string;
  kind: 'text' | 'sos';
  sos: { latitude: number | null; longitude: number | null; isTest: boolean } | null;
  /** When it was written (this phone's clock for our own). */
  createdAt: number;
  /** When the server saved it — null while it's still waiting to be sent. */
  serverAt: number | null;
  /** pending = not sent yet (offline); failed = the server refused it. */
  status: 'pending' | 'sent' | 'failed';
};

/** A message as the API returns it (backend directMessageController.toClient). */
export type ServerMessage = {
  id: string;
  clientId: string;
  fromMe: boolean;
  body: string;
  kind: 'text' | 'sos';
  sos?: { latitude?: number; longitude?: number; isTest?: boolean };
  createdAt: number;
  clientCreatedAt: number;
};

type MessageRow = {
  local_id: string;
  client_id: string;
  server_id: string | null;
  friend_id: string;
  from_me: number;
  body: string;
  kind: string;
  sos_lat: number | null;
  sos_lng: number | null;
  sos_test: number | null;
  created_at: number;
  server_at: number | null;
  status: string;
};

function toMessage(row: MessageRow): DirectMessage {
  return {
    localId: row.local_id,
    serverId: row.server_id,
    friendId: row.friend_id,
    fromMe: row.from_me === 1,
    body: row.body,
    kind: row.kind === 'sos' ? 'sos' : 'text',
    sos: row.kind === 'sos' ? { latitude: row.sos_lat, longitude: row.sos_lng, isTest: row.sos_test === 1 } : null,
    createdAt: row.created_at,
    serverAt: row.server_at,
    status: row.status === 'pending' ? 'pending' : row.status === 'failed' ? 'failed' : 'sent',
  };
}

// Our own messages are keyed by the id this phone made; a friend's by theirs,
// prefixed with who sent it, so the two can never clash.
const localIdOf = (friendId: string, fromMe: boolean, clientId: string) => (fromMe ? `me:${clientId}` : `${friendId}:${clientId}`);

function makeClientId(): string {
  return `dm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function getDirectMessages(friendId: string): Promise<DirectMessage[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<MessageRow>(
    'SELECT * FROM direct_messages WHERE friend_id = ? ORDER BY COALESCE(server_at, created_at) ASC',
    [friendId],
  );
  return rows.map(toMessage);
}

/** Saves a message the user just wrote. It's sent by flushOutbox(), now or when back online. */
export async function addPendingMessage(friendId: string, body: string): Promise<void> {
  const db = await getDatabase();
  const clientId = makeClientId();
  await db.runAsync(
    `INSERT INTO direct_messages (local_id, client_id, friend_id, from_me, body, kind, created_at, status)
     VALUES (?, ?, ?, 1, ?, 'text', ?, 'pending')`,
    [localIdOf(friendId, true, clientId), clientId, friendId, body, Date.now()],
  );
}

/** Stores a message from the server (new, or our own confirmed). Safe to call twice. */
export async function saveServerMessage(friendId: string, message: ServerMessage): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO direct_messages (local_id, client_id, server_id, friend_id, from_me, body, kind, sos_lat, sos_lng, sos_test, created_at, server_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent')
     ON CONFLICT(local_id) DO UPDATE SET server_id = excluded.server_id, server_at = excluded.server_at, status = 'sent'`,
    [
      localIdOf(friendId, message.fromMe, message.clientId),
      message.clientId,
      message.id,
      friendId,
      message.fromMe ? 1 : 0,
      message.body,
      message.kind,
      message.sos?.latitude ?? null,
      message.sos?.longitude ?? null,
      message.sos?.isTest ? 1 : 0,
      message.clientCreatedAt,
      message.createdAt,
    ],
  );
}

let flushing: Promise<void> | null = null;

/**
 * Sends every message written while offline, oldest first. Stops at the
 * first network failure (still offline) and leaves the rest for next time;
 * a message the server refuses (e.g. no longer friends) is marked failed so
 * it doesn't block the others. Only one run at a time.
 */
export function flushOutbox(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    try {
      const db = await getDatabase();
      const pending = await db.getAllAsync<MessageRow>(
        "SELECT * FROM direct_messages WHERE status = 'pending' ORDER BY created_at ASC",
      );
      for (const row of pending) {
        try {
          const saved = await apiFetch<ServerMessage>(`/messages/${row.friend_id}`, {
            method: 'POST',
            body: JSON.stringify({ clientId: row.client_id, body: row.body, createdAt: row.created_at }),
          });
          await saveServerMessage(row.friend_id, saved);
        } catch (error) {
          if (isApiError(error) && error.status >= 400 && error.status < 500 && error.status !== 429) {
            await db.runAsync("UPDATE direct_messages SET status = 'failed' WHERE local_id = ?", [row.local_id]);
            continue;
          }
          return; // offline or server trouble — try again later
        }
      }
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

const BACKFILL_PAGE = 200;

/**
 * Fetches everything in this chat the phone hasn't caught up on yet (pages
 * through if there's a lot). Messages already here are skipped. Throws if
 * offline.
 */
export async function backfill(friendId: string): Promise<number> {
  const db = await getDatabase();
  const cursor = await db.getFirstAsync<{ synced_until: number }>(
    'SELECT synced_until FROM dm_cursors WHERE friend_id = ?',
    [friendId],
  );
  let after = cursor?.synced_until ?? 0;
  let total = 0;
  for (;;) {
    const messages = await apiFetch<ServerMessage[]>(`/messages/${friendId}?after=${after}&limit=${BACKFILL_PAGE}`);
    for (const message of messages) {
      await saveServerMessage(friendId, message);
      after = Math.max(after, message.createdAt);
    }
    total += messages.length;
    await db.runAsync(
      'INSERT INTO dm_cursors (friend_id, synced_until) VALUES (?, ?) ON CONFLICT(friend_id) DO UPDATE SET synced_until = excluded.synced_until',
      [friendId, after],
    );
    if (messages.length < BACKFILL_PAGE) return total;
  }
}

/** Tells the server (and so the friend) that this chat has been read. */
export async function markChatRead(friendId: string): Promise<void> {
  await apiFetch(`/messages/${friendId}/read`, { method: 'POST' });
  const db = await getDatabase();
  await db.runAsync('UPDATE friends SET unread = 0 WHERE user_id = ?', [friendId]);
}

/** Forgets the whole chat with someone (after unfriending them). */
export async function deleteChat(friendId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM direct_messages WHERE friend_id = ?', [friendId]);
  await db.runAsync('DELETE FROM dm_cursors WHERE friend_id = ?', [friendId]);
}

/** Drops a message that couldn't be sent. */
export async function deleteFailedMessage(localId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM direct_messages WHERE local_id = ? AND status = 'failed'", [localId]);
}
