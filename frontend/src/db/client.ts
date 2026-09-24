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
