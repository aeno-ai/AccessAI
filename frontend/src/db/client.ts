import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

const DATABASE_NAME = 'accessai.db';

let dbPromise: Promise<SQLiteDatabase> | null = null;

async function migrate(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      mode TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      synced_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY NOT NULL,
      conversation_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
    );

    -- Conversations deleted on this device whose cloud copy still needs
    -- deleting. Kept until the server confirms, so a delete made offline is
    -- sent on the next sync (see sync.ts).
    CREATE TABLE IF NOT EXISTS pending_deletions (
      conversation_id TEXT PRIMARY KEY NOT NULL,
      deleted_at INTEGER NOT NULL
    );

    -- The signed-in account's friends, as last seen from the server, so the
    -- Friends tab works offline (see friends.ts). Cleared on sign-out.
    CREATE TABLE IF NOT EXISTS friends (
      user_id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      first_name TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      in_my_sos INTEGER NOT NULL DEFAULT 0,
      in_their_sos INTEGER NOT NULL DEFAULT 0,
      online INTEGER NOT NULL DEFAULT 0,
      unread INTEGER NOT NULL DEFAULT 0,
      last_body TEXT,
      last_kind TEXT,
      last_from_me INTEGER,
      last_at INTEGER
    );

    -- Online chats with friends (see directMessages.ts). Messages written
    -- offline wait here as 'pending' until they're sent. Cleared on sign-out.
    CREATE TABLE IF NOT EXISTS direct_messages (
      local_id TEXT PRIMARY KEY NOT NULL,
      client_id TEXT NOT NULL,
      server_id TEXT UNIQUE,
      friend_id TEXT NOT NULL,
      from_me INTEGER NOT NULL,
      body TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'text',
      sos_lat REAL,
      sos_lng REAL,
      sos_test INTEGER,
      created_at INTEGER NOT NULL,
      server_at INTEGER,
      status TEXT NOT NULL DEFAULT 'sent'
    );
    CREATE INDEX IF NOT EXISTS idx_direct_messages_friend ON direct_messages (friend_id, created_at);

    -- How far each chat has been caught up from the server. Only backfill()
    -- moves it — messages pushed live don't, so one arriving live can never
    -- make an earlier missed one get skipped.
    CREATE TABLE IF NOT EXISTS dm_cursors (
      friend_id TEXT PRIMARY KEY NOT NULL,
      synced_until INTEGER NOT NULL
    );
  `);
}

/**
 * Opens (or returns the already-open) local SQLite database, running the
 * table-creation migration on first open. This is the on-device store behind
 * offline-first conversation history — everything here is local to the
 * device; see `sync.ts` for the (currently stubbed) path to the backend.
 */
export async function getDatabase(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}
