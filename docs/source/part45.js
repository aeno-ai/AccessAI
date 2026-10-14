const { P, H1, H2, H3, LABEL, bullets, numbered, table, code, note } = require('./lib');

const part4 = () => [
  H1('Part 4 — Offline first, feature by feature'),
  P('The panel\'s favourite question is "what if there\'s no internet?". The short answer: everything a person needs in the moment works on the phone alone; what truly needs the internet says so plainly and fails gently.'),

  H2('4.1 The general pattern'),
  ...numbered([
    '**Local first.** Screens read the phone\'s own database (SQLite) or storage (AsyncStorage) and show it at once.',
    '**Show what\'s saved, refresh quietly** (`frontend/src/utils/cache.ts`). The server is asked in the background, at most once per short period per kind of data; live events keep things current in between. New data replaces old only when it is really different, so screens don\'t redraw for nothing.',
    '**Outboxes.** Anything written offline waits on the phone: chat messages (`direct_messages` with status `pending`), an SOS (`sos:outbox:v1:<id>`), Learn completions (`learn:v1:<id>`), conversation deletions (`pending_deletions`), and conversation messages (newer than the last backup).',
    '**Triggers to send them.** The live connection coming back (socket `connect`), the network coming back (NetInfo), opening the app, and opening the screen concerned.',
    '**Safe to repeat.** Every item carries an id made by the phone (`clientId`); the server saves each id once (unique index + upsert), so a retry after a dropped connection never duplicates anything. Cursors (`after=` a time) fetch only what is new.',
    '**Plain failure.** What needs the internet says so in one sentence ("Video needs the internet.", "Camera practice needs the internet."), never with technical words.',
  ]),

  H2('4.2 Every feature'),
  table(
    ['Feature', 'With no internet', 'Needs the internet for', 'How'],
    [
      ['Staying logged in', 'Yes', 'Confirming the token now and then', 'The app reads the token\'s expiry itself (`utils/jwt.ts`); a failed check that isn\'t a 401 doesn\'t sign out'],
      ['Settings and onboarding', 'Yes', '—', 'AsyncStorage per account'],
      ['Conversation mode', 'Yes (speech to text on the device where the phone supports it; reading aloud always)', 'The online recognizer on phones without offline speech', 'SQLite; `expo-speech`; Android\'s on-device recognizer or the Google app\'s offline English'],
      ['Chats (saved conversations)', 'Yes: read, rename, delete', 'The backup', 'SQLite + backup outbox + `pending_deletions`'],
      ['Friends and chat', 'Read the list and every chat; write messages (sent later)', 'Delivering messages, adding friends, "Seen"', 'SQLite `friends`, `direct_messages`, `dm_cursors`; outbox flushed on reconnect'],
      ['SOS', 'GPS position, text to emergency contacts (SMS), call 911, the SOS kept and sent later', 'Alerting friends, live location, the place name', 'GPS needs no internet; `expo-sms`; `sos:outbox:v1`, `occurredAt` (up to 2 h late)'],
      ['Friends\' SOS alerts', 'The last known alerts stay on the Home card; distance and direction work if both positions are known', 'New alerts', 'Cached in AsyncStorage; distance computed on the phone'],
      ['Emergency contacts', 'Read (for the SOS text)', 'Adding or editing', '`emergencyContacts:v1`'],
      ['Accel', 'Yes, with the phone\'s rules (all common commands, e.g. "take me to…")', 'Understanding unusual sentences (the AI); grammar fix', '`accel/rules.ts` first; the AI only when online'],
      ['"Hey Accel"', 'On phones with offline speech', 'Elsewhere it waits for the internet and starts again by itself', '`accel/wakeWord.ts`'],
      ['Sign language', 'No', 'Everything (the models run on the laptop)', 'Says so; typing still works'],
      ['Learn', 'Lessons, the sign clips (they come with the app), spoken steps, XP, hearts, streak, badges; completions sent later', 'Camera practice, the leaderboard', '`learn:v1:<id>` + outbox; exercises that need more are left out'],
      ['Push notifications', '—', 'Arriving', 'Expo push service → Firebase'],
      ['Admin website', '—', 'Everything', 'A web app'],
    ],
    [18, 30, 25, 27],
  ),
  note('What can never work offline, and why: friends can\'t be told anything without a network (an SOS still reaches emergency contacts by SMS); sign recognition and the AI need the laptop\'s models; push notifications are delivered by Google\'s and Apple\'s servers.'),
];

const part5 = () => [
  H1('Part 5 — Project map: every folder and how it fits the flow'),

  H2('5.1 The top level'),
  table(
    ['Path', 'What it is'],
    [
      ['`frontend/`', 'The phone app (Expo / React Native). Its own `package.json`, `app.json` (the app\'s name, permissions, plugins) and `eas.json` (the APK build profiles). `assets/images/` holds the AccessAI logo and the icons made from it (home screen, splash, notifications); `assets/signs/` holds Learn\'s clips.'],
      ['`backend/`', 'The API, the live connection and the timed jobs (Node.js / Express). Secrets in `backend/.env` (not in git).'],
      ['`ai/`', 'The Python AI service: Accel\'s understanding, sentence polishing, sign reading; and the models.'],
      ['`admin/`', 'The admin website (Vite / React).'],
      ['`learn/`', 'Learn\'s notes: how to edit the course (`README.md`), the clips to record (`RECORDING_CHECKLIST.md`), and research from the earlier YouTube plan.'],
      ['`docs/`', 'These reports.'],
      ['`HANDOFF.md`', 'The project\'s working notes: decisions, plans, test results, what to do next.'],
      ['`eas.json`, `package.json`, `package-lock.json` (root)', 'Leftovers from the project\'s first setup: a copy of the build profiles that live in `frontend/eas.json`, and an early `mongodb`/`nodemon` install. Not used by any part; safe to remove.'],
      ['`ihi`', 'An empty file from August, not used. Safe to remove.'],
    ],
    [30, 70],
  ),

  H2('5.2 Inside each part'),
  H3('frontend/src (the phone app)'),
  table(
    ['Folder', 'What\'s in it', 'Talks to'],
    [
      ['`app/`', 'The screens. Expo Router turns files into routes: `(auth)/` login, sign-up, codes; `onboarding/`; `(app)/(tabs)/` Home, Chats, Friends, Learn, Settings; `(app)/` Conversation, a chat, Edit profile, the Learn lesson and its screens.', 'components, hooks, db, api'],
      ['`components/`', 'Building blocks by feature: `auth`, `conversation` (message box, sign panel), `sos`, `friends`, `learn`, `settings`, `ui`…', 'hooks'],
      ['`hooks/`', 'Shared logic: preferences, login state (`use-bootstrap`), speech to text, sign recognition, alerts, online status, screen reader.', 'api, db, phone features'],
      ['`accel/`', 'Accel: rules, catalog, actions, wake word, its provider.', 'api (`/assistant`), audio'],
      ['`audio/`', 'The one owner of the microphone (`recognizer.ts`).', 'expo-speech-recognition'],
      ['`db/`', 'The phone\'s SQLite database: conversations and backup, friends, chats and their outbox.', 'expo-sqlite; api (backup, catch-up)'],
      ['`realtime/`', 'The live connection and friends\' data (`FriendsProvider.tsx`), SOS alert cache.', 'socket.io → backend `realtime/io.js`'],
      ['`notifications/`', 'Push registration and Android channels.', 'expo-notifications; api (`/push`)'],
      ['`learn/`', 'Learn\'s engine: content, lessons, progress maths, match rule, its provider.', 'api (`/learn`), sign recognition'],
      ['`api/`', '`apiClient.ts`: every HTTP request.', 'backend'],
      ['`utils/`', 'Helpers: SOS, emergency contacts, speech (Taglish), cache rules, tokens, navigation.', '—'],
      ['`constants/`', 'Palettes, profiles, theme sizes, texts.', '—'],
      ['`frontend/scripts/`', 'Checks run on the laptop: contrast, Accel catalog and rules, Learn, conversations per account; listing Learn\'s recorded clips.', '—'],
    ],
    [16, 58, 26],
  ),
  H3('backend/src (the server)'),
  P('A request flows **routes → validators → middleware → controllers → models**:'),
  table(
    ['Folder', 'What\'s in it'],
    [
      ['`routes/`', 'Which URL goes where, and in what order the checks run (login, rate limit, validators).'],
      ['`validators/`', 'express-validator rules for every request (types, lengths, shapes); one plain message when wrong.'],
      ['`middleware/`', '`authMiddleware` (login check), `adminAuthMiddleware` (admin session and permissions), `rateLimiter` + `tokenBucket`, `rejectOperatorKeys` (NoSQL injection), `validate`.'],
      ['`controllers/`', 'What each request does: auth, Google, friends, messages, SOS, contacts, conversations, push, Accel, sign, Learn, admin.'],
      ['`models/`', 'The Mongoose schemas (Part 3).'],
      ['`realtime/`', '`io.js`: the socket.io server (rooms per user, presence, events).'],
      ['`utils/`', 'Codes and the code gate, email, push, AI client, account deletion, tickets, sessions, friend codes.'],
      ['`constants/`', 'Admin roles and permissions; terms version and the 15-day grace period.'],
      ['`app.js`, `server.js`', 'The middleware order and routes; starting the server, the jobs and the clean shutdown.'],
      ['`backend/config/db.js`', 'The MongoDB connection.'],
      ['`backend/scripts/`', '`e2e/` (end-to-end checks against the running server), `sosDemo.js` (a demo friend "Andrew"), `testPush.js`, `createAdmin.js`, `startAi.js` (starts the AI service with the API), `syncIndexes.js`, `explainQueries.js`, `tokenBucketCheck.js`.'],
    ],
    [22, 78],
  ),
  H3('ai/'),
  table(
    ['Path', 'What\'s in it'],
    [
      ['`app/main.py`', 'The FastAPI app and its routes (`/interpret`, `/polish`, `/sign/…`, `/health`); loads models at start, waits for Ollama.'],
      ['`app/interpret.py`, `app/index.py`, `app/ollama.py`', 'Accel\'s understanding: vector search (ChromaDB) then the LLM; the Ollama client.'],
      ['`app/polish.py`', 'Grammar fixing and signed words → sentence.'],
      ['`app/sign/`', 'Sign reading: features (MediaPipe → numbers), segmenter, sessions, model registry, the NumPy model runner.'],
      ['`models/sign/`', 'The sign models (`model.keras` + `labels.json`) per language and unit.'],
      ['`intents.json`', 'Accel\'s 70 actions with example sentences (the vector index is built from it).'],
      ['`eval.jsonl`, `app/eval.py`, `app/sign_check.py`', 'Checks: Accel understanding test sentences; the sign pipeline.'],
    ],
    [34, 66],
  ),
  H3('admin/src'),
  P('`pages/` (Login, Users, User detail, Admins, password pages), `auth/` (session provider and route guards), `api/client.ts` (requests to `/api/admin` with the cookie), `components/` (dialogs, layout).'),

  H2('5.3 The flow of the whole project'),
  ...code([
    '  Phone app ──HTTPS + WebSocket──▶ Backend (Express + socket.io) ──▶ MongoDB Atlas',
    '  (Wi-Fi, or Tailscale Funnel)        │        │        │',
    '                                       │        │        └──▶ Gmail (codes)',
    '                                       │        └──▶ Expo push ──▶ Firebase ──▶ phones',
    '                                       └──127.0.0.1──▶ AI service ──▶ Ollama (qwen2.5:3b, bge-m3)',
    '                                                          ├──▶ ChromaDB (vector index)',
    '                                                          └──▶ sign models (MediaPipe + Conv1D)',
    '  Admin website ──HTTPS + cookie──▶ Backend /api/admin',
    '  Phone app ──▶ SMS app (emergency contacts), dialer (911), Google Maps',
  ]),

  H2('5.4 One feature across the folders: sending a chat message'),
  ...numbered([
    '`components/conversation/Composer.tsx` — the person types (or speaks, or signs) and taps Send.',
    '`app/(app)/chat/[friendId].tsx` → `db/directMessages.ts` `addPendingMessage` — saved in SQLite at once with status `pending` and a new `clientId`. It shows immediately, even offline.',
    '`flushOutbox` → `api/apiClient.ts` — `POST /api/messages/:friendId` with `{clientId, body, createdAt}` and the login token.',
    'Backend `routes/directMessageRoutes.js` → message rate limit → `protect` → `validators/messageValidators.js` → `controllers/directMessageController.js` `sendMessage`.',
    '`models/DirectMessage.js` — `findOneAndUpdate({senderId, clientId}, {$setOnInsert: …}, {upsert: true})`: saved once, even if sent twice.',
    '`realtime/io.js` `emitToUser(friend, "dm:new", …)` — the friend\'s phone gets it live; if their app isn\'t open, `utils/push.js` sends a notification on the Messages channel.',
    'The sender\'s phone gets the saved message back and marks it `sent` (`saveServerMessage`).',
    'The friend\'s `realtime/FriendsProvider.tsx` stores it in their SQLite, raises the unread count, and alerts them (vibrate / flash / read aloud). Opening the chat sends "read" → `dm:read` → the sender sees "Seen".',
  ]),
];

const appendix = () => [
  H1('Appendix A — Known gaps and honest limits'),
  P('Found in a full review of the code on 12 October 2026. Worth one line each in the defense, or a later fix.'),
  ...bullets([
    'Letters (fingerspelling) have no models yet; that code path has never run on a real model.',
    'Onboarding promises "Natural AI voices" (it\'s the phone\'s own voice) and "AI Assistant — get help and answers anytime" (Accel runs commands; it doesn\'t answer questions).',
    'Accel has no commands for Settings → Sign language or Quick replies.',
    'The emergency contact email field exists in the data but not in the app; the server\'s "silent SOS" option isn\'t used by the app.',
    'Not built: blocking users, a custom SOS sound, background "Hey Accel" or background location, a "terms updated" screen, downloading old conversations to a new phone.',
    'Platform limits: iPhone push needs a paid Apple account; "Hey Accel" and speech to text don\'t work in Expo Go; the app doesn\'t build for the web yet; the AI and sign reading depend on the laptop being on; `qwen2.5:3b`\'s license is for research use.',
    'Learn: 4 real levels per language for the defense (the rest shown locked); the team is recording the 24 clips, which need the next app build; the new 125-word ASL model\'s accuracy is not measured yet.',
    'The emergency number is fixed to 911 (`utils/sos.ts`).',
    '`constants/dashboard.ts` now holds only the SOS message text; the palettes still define an unused `banner` colour.',
  ]),
];

module.exports = { part4, part5, appendix };
