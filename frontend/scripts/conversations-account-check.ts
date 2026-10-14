// Checks that in-person conversations stay per account on a shared phone
// (HANDOFF §20), running the real src/db/conversations.ts and src/db/sync.ts
// against Node's built-in SQLite in place of expo-sqlite, and a fake server.
//   npx tsx scripts/conversations-account-check.ts
/// <reference types="node" />
import Module from 'node:module';
import { DatabaseSync } from 'node:sqlite';

type Row = Record<string, unknown>;

// One in-memory database, shaped like expo-sqlite's async API.
const raw = new DatabaseSync(':memory:');
const db = {
  execAsync: async (sql: string) => void raw.exec(sql),
  getAllAsync: async (sql: string, params: unknown[] = []) => raw.prepare(sql).all(...(params as never[])) as Row[],
  getFirstAsync: async (sql: string, params: unknown[] = []) => (raw.prepare(sql).get(...(params as never[])) as Row) ?? null,
  runAsync: async (sql: string, params: unknown[] = []) => raw.prepare(sql).run(...(params as never[])),
  withTransactionAsync: async (work: () => Promise<void>) => {
    raw.exec('BEGIN');
    try {
      await work();
      raw.exec('COMMIT');
    } catch (error) {
      raw.exec('ROLLBACK');
      throw error;
    }
  },
};

// The fake server: records each request with the account signed in when it left.
const sent: { endpoint: string; account: string | null; body: { clientId?: string; messages?: unknown[] } | null }[] = [];
let onRequest: (() => void) | null = null;
let conversations: typeof import('../src/db/conversations');

const fakeApi = {
  apiFetch: async (endpoint: string, init: { body?: string } = {}) => {
    sent.push({ endpoint, account: conversations.currentConversationAccount(), body: init.body ? JSON.parse(init.body) : null });
    onRequest?.();
    return {};
  },
};

const mocks: Record<string, unknown> = {
  'expo-sqlite': { openDatabaseAsync: async () => db },
  '@/api/apiClient': fakeApi,
};
const ModuleWithLoad = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown };
const originalLoad = ModuleWithLoad._load;
ModuleWithLoad._load = function load(request: string, ...rest: unknown[]) {
  return request in mocks ? mocks[request] : originalLoad.call(this, request, ...rest);
};

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ''}`);
  }
}

async function main() {
  // A phone from before this change: the old tables, one conversation with
  // a message, and one deletion still waiting to be sent.
  raw.exec(`
    CREATE TABLE conversations (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, mode TEXT NOT NULL,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, synced_at INTEGER);
    CREATE TABLE messages (id TEXT PRIMARY KEY NOT NULL, conversation_id TEXT NOT NULL, sender TEXT NOT NULL,
      body TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE pending_deletions (conversation_id TEXT PRIMARY KEY NOT NULL, deleted_at INTEGER NOT NULL);
    INSERT INTO conversations VALUES ('conv_old', 'Old talk', 'combined', 1, 1, NULL);
    INSERT INTO messages VALUES ('msg_old', 'conv_old', 'me', 'hello from before', 1);
    INSERT INTO pending_deletions VALUES ('conv_gone', 2);
  `);

  conversations = await import('../src/db/conversations');
  const { syncConversations } = await import('../src/db/sync');
  const c = conversations;

  console.log('in-person conversations per account (HANDOFF §20)');

  await c.setConversationAccount(null);
  check('signed out: no conversations', (await c.listConversations()).length === 0);

  // Anna, an existing account, signs in first: she adopts the old rows.
  await c.setConversationAccount('anna', { adopt: true });
  let list = await c.listConversations();
  check('the first existing account adopts the older conversations', list.length === 1 && list[0].id === 'conv_old', list);
  check('…and their messages', (await c.getMessages('conv_old'))[0]?.body === 'hello from before');
  const annas = await c.createConversation('Anna at the clinic', 'combined');
  await c.addMessage(annas.id, 'me', 'Where is the doctor?');

  // Sign out, then Ben (a brand-new account) signs in on the same phone.
  await c.setConversationAccount(null);
  check('signed out: nothing shows', (await c.listConversations()).length === 0 && (await c.getMessages(annas.id)).length === 0);
  await c.setConversationAccount('ben', { adopt: false });
  check("Ben sees none of Anna's conversations", (await c.listConversations()).length === 0);
  check("…can't open one by its id", (await c.getConversation(annas.id)) === null);
  check("…can't read its messages", (await c.getMessages(annas.id)).length === 0);
  let threw = false;
  try {
    await c.addMessage(annas.id, 'me', 'sneaky');
  } catch {
    threw = true;
  }
  check("…can't add to it", threw);
  await c.renameConversation(annas.id, 'Renamed by Ben');
  await c.deleteConversation(annas.id);

  const bens = await c.createConversation('Ben at the bank', 'combined');
  await c.addMessage(bens.id, 'them', 'Next, please.');
  sent.length = 0;
  await syncConversations();
  check('Ben\'s backup sends only his conversation, with his login', sent.length === 1 && sent[0].body?.clientId === bens.id && sent[0].account === 'ben', sent.map((s) => [s.endpoint, s.body?.clientId, s.account]));
  check("…and none of Anna's queued deletions", !sent.some((s) => s.endpoint.includes('conv_gone')));

  // Anna again.
  await c.setConversationAccount(null);
  await c.setConversationAccount('anna', { adopt: true });
  list = await c.listConversations();
  check("Anna's conversations are all still there, untouched by Ben", list.length === 2 && list.some((x) => x.title === 'Anna at the clinic'), list.map((x) => x.title));
  check("…and Ben's isn't among them", !list.some((x) => x.id === bens.id));

  // Backup: only what's new, 200 messages at a time.
  for (let i = 0; i < 449; i += 1) await c.addMessage(annas.id, i % 2 ? 'me' : 'them', `line ${i}`);
  // Messages written in the very millisecond a backup starts are sent again
  // next time (harmless: the server saves each by its id). A person can't
  // type that fast; this loop can, so it pauses.
  await new Promise((resolve) => setTimeout(resolve, 5));
  sent.length = 0;
  await syncConversations();
  const deletes = sent.filter((s) => s.endpoint.startsWith('/conversations/conv_gone'));
  check("Anna's queued deletion (adopted) is sent with her login", deletes.length === 1 && deletes[0].account === 'anna', sent.map((s) => s.endpoint));
  const uploads = sent.filter((s) => s.body?.clientId === annas.id).map((s) => s.body?.messages?.length);
  check('450 messages go up as 200 + 200 + 50', JSON.stringify(uploads) === '[200,200,50]', uploads);

  await new Promise((resolve) => setTimeout(resolve, 5));
  await c.addMessage(annas.id, 'me', 'one more');
  sent.length = 0;
  await syncConversations();
  const again = sent.filter((s) => s.body?.clientId === annas.id).map((s) => s.body?.messages?.length);
  check('the next backup sends only the 1 new message', JSON.stringify(again) === '[1]', again);

  // Someone else signs in while a backup is under way: it stops.
  await c.renameConversation(annas.id, 'Anna at the hospital'); // re-sends everything (a new title)
  sent.length = 0;
  onRequest = () => {
    onRequest = null;
    void c.setConversationAccount('ben');
  };
  await syncConversations();
  check('a backup stops when the account changes mid-way (no upload with the next login)', sent.length === 1 && sent.every((s) => s.account === 'anna'), sent.map((s) => s.account));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

void main();
