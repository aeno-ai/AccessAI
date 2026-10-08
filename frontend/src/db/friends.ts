import { getDatabase } from './client';

/** A friend as the Friends tab shows them. */
export type Friend = {
  userId: string;
  name: string;
  firstName: string;
  /** What they chose to tell friends, e.g. "I'm Deaf, please type". */
  note: string;
  /** You put them in your SOS circle (they're alerted when you send an SOS). */
  inMySosCircle: boolean;
  /** They put you in theirs. */
  inTheirSosCircle: boolean;
  online: boolean;
  unread: number;
  lastMessage: { body: string; kind: string; fromMe: boolean; createdAt: number } | null;
  /** When they last read your chat (for "Seen"). Only from the server, not saved on the phone. */
  theirReadAt?: number | null;
};

type FriendRow = {
  user_id: string;
  name: string;
  first_name: string;
  note: string;
  in_my_sos: number;
  in_their_sos: number;
  online: number;
  unread: number;
  last_body: string | null;
  last_kind: string | null;
  last_from_me: number | null;
  last_at: number | null;
};

function toFriend(row: FriendRow): Friend {
  return {
    userId: row.user_id,
    name: row.name,
    firstName: row.first_name,
    note: row.note,
    inMySosCircle: row.in_my_sos === 1,
    inTheirSosCircle: row.in_their_sos === 1,
    online: row.online === 1,
    unread: row.unread,
    lastMessage:
      row.last_body !== null && row.last_at !== null
        ? { body: row.last_body, kind: row.last_kind ?? 'text', fromMe: row.last_from_me === 1, createdAt: row.last_at }
        : null,
  };
}

/** The friends saved on this phone, most recent conversation first. */
export async function listCachedFriends(): Promise<Friend[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<FriendRow>(
    'SELECT * FROM friends ORDER BY COALESCE(last_at, 0) DESC, name COLLATE NOCASE ASC',
  );
  return rows.map(toFriend);
}

/** Replaces the saved list with the server's. */
export async function replaceCachedFriends(friends: Friend[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM friends');
    for (const f of friends) {
      await db.runAsync(
        `INSERT INTO friends (user_id, name, first_name, note, in_my_sos, in_their_sos, online, unread, last_body, last_kind, last_from_me, last_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          f.userId,
          f.name,
          f.firstName,
          f.note,
          f.inMySosCircle ? 1 : 0,
          f.inTheirSosCircle ? 1 : 0,
          f.online ? 1 : 0,
          f.unread,
          f.lastMessage?.body ?? null,
          f.lastMessage?.kind ?? null,
          f.lastMessage ? (f.lastMessage.fromMe ? 1 : 0) : null,
          f.lastMessage?.createdAt ?? null,
        ],
      );
    }
  });
}

/** Signing out forgets every friend and chat, so the next person on this phone never sees them. */
export async function clearFriendData(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('DELETE FROM friends; DELETE FROM direct_messages; DELETE FROM dm_cursors;');
}
