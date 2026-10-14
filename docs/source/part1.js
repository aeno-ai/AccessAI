const { P, H1, H2, LABEL, bullets, numbered, table, note } = require('./lib');

module.exports = () => [
  H1('Part 1 — Architecture'),
  P('AccessAI is four programs that work together: the **phone app**, the **backend server**, the **AI service** and the **admin website**. People only ever use the phone app. The app keeps its own copy of what a person needs in the moment (offline first) and talks to the backend whenever it can. The backend is the only part that reads or writes the database. The AI service runs next to the backend on the same laptop and can never be reached from the internet.'),

  H2('1.1 The pieces'),
  table(
    ['Piece', 'Its job', 'Built with', 'Runs on'],
    [
      ['**Phone app**\n`frontend/`', 'Every screen. Keeps data on the phone, works offline. Uses the microphone, speaker, camera, GPS, SMS and notifications.', 'Expo SDK 57, React Native 0.86, TypeScript, Expo Router (screens from files), expo-sqlite, AsyncStorage, SecureStore, socket.io-client', 'Android and iPhone: the development build (APK), or Expo Go'],
      ['**Backend**\n`backend/`', 'Accounts, friends, chats, SOS, push notifications, Learn progress. Holds the live connection. Runs timed jobs.', 'Node.js, Express 5, Mongoose 9, socket.io 4, jsonwebtoken (JWT), bcrypt, express-validator, helmet, nodemailer', 'The team laptop, port 3000; public at `https://accessai.tail2a97db.ts.net` through Tailscale Funnel'],
      ['**Database**', 'Everything the server keeps.', 'MongoDB Atlas (a cloud database; a 3-node replica set)', 'Atlas'],
      ['**AI service**\n`ai/`', 'Understands Accel commands it can\'t match on the phone, turns signed words into sentences, reads signs from video.', 'Python 3.12, FastAPI, Ollama (`qwen2.5:3b` chat model, `bge-m3` embeddings), ChromaDB, MediaPipe Holistic, OpenCV, NumPy', 'The same laptop, `127.0.0.1:8001` only'],
      ['**Admin website**\n`admin/`', 'Staff look up users, deactivate accounts and manage admins.', 'Vite, React 19, React Router', 'A web browser; talks to `/api/admin`'],
      ['**Outside services**', 'A public https address, push notifications, code emails, Google sign-in.', 'Tailscale Funnel; Expo push service → Firebase Cloud Messaging; Gmail SMTP; Google OAuth', '—'],
    ],
    [16, 34, 32, 18],
  ),

  H2('1.2 How the pieces talk to each other'),
  ...bullets([
    '**Phone ⇄ backend:** HTTPS requests (REST, JSON) through one helper, `frontend/src/api/apiClient.ts`, plus **one live WebSocket** (socket.io) for things that must arrive instantly: new messages, "seen", who is online, SOS alerts. On the laptop\'s Wi-Fi the phone uses the laptop\'s address; anywhere else it uses the Tailscale Funnel address.',
    '**Backend ⇄ MongoDB Atlas:** Mongoose over an encrypted connection, at most 20 connections at once (`backend/config/db.js`).',
    '**Backend → AI service:** plain HTTP to `127.0.0.1:8001` (`backend/src/utils/aiClient.js`) with a time limit on every call. Only the backend can reach it, and only after it has checked the login.',
    '**AI service →** Ollama on the same laptop (the language models), ChromaDB on disk (`ai/.chroma`, the vector index), and the sign models in `ai/models/sign`.',
    '**Backend → Expo push service → Firebase → phone:** notifications when AccessAI is closed.',
    '**Backend → Gmail:** the 6-digit codes for sign-up, password reset, email change and account deletion.',
    '**Admin website → backend:** `/api/admin/…` with a session cookie.',
    '**Phone → the phone\'s own apps:** the SMS app (texts to emergency contacts), the dialer (911), and Google Maps links.',
  ]),

  H2('1.3 One request, end to end'),
  P('Every request from the app passes the same steps, in this order (`backend/src/app.js`). Knowing this order answers most "what if someone sends…" questions.'),
  ...numbered([
    '**The app** (`apiFetch`) adds the login token (`Authorization: Bearer …`) and gives up after 15 seconds. No answer at all is treated as "offline", never as an error to show.',
    '**helmet** adds secure HTTP headers.',
    '**cors** lets only allowed websites call the API from a browser (phones send no Origin, so this is about the admin site and the web).',
    '**compression** makes answers smaller (gzip) — not for sign-language uploads.',
    '**The general rate limit** (a token bucket, see 2.11) — per account, or per network address when signed out.',
    '**The JSON reader**, limited to 256 kb (2 MB for conversation backups). Broken JSON → "That request wasn\'t valid."',
    '**The NoSQL-injection guard** (`middleware/rejectOperatorKeys.js`) refuses any body or URL part with keys like `$gt`, `a.b` or `__proto__`.',
    '**The route:** `protect()` checks the login → the route\'s own rate limit → the validators (types, lengths, shapes) → `validate` (stops the request with one plain sentence) → the controller.',
    '**The controller** reads or writes MongoDB through a Mongoose model, may push a live event to friends (socket.io) and a notification (Expo push), and answers JSON.',
    '**Anything that goes wrong** lands in one error handler: the person gets one short sentence; the server log gets a one-line reason (4xx) or the full error (5xx). Stack traces never leave the server.',
  ]),

  H2('1.4 Logging in and staying logged in'),
  LABEL('Passwords.', 'Stored only as bcrypt hashes (cost 10). Every failed login gets the same answer, so nobody can find out which emails have accounts; the real reason goes to the server log.'),
  LABEL('The login token.', 'A JWT signed by the server (HS256), valid 30 days, holding `userId`, `role` (PWD or not) and `firstName`. The app keeps it in SecureStore (the phone\'s Keychain / Keystore), so the person stays logged in when the app is closed and opened again: on start it reads the token, checks its date on the phone (this works offline), confirms it with `GET /auth/me` when the server answers, and opens the dashboard. That same call hands back a fresh 30-day token once the current one is a day old, so anyone who uses the app at least once a month never has to log in again. Uninstalling the app wipes SecureStore.'),
  LABEL('Every request', 'goes through `verifyUserToken` (`utils/verifyUserToken.js`): a valid signature that hasn\'t expired, AND an account that is still active, not waiting to be deleted, and whose password wasn\'t changed after the token was made. So deactivating an account, asking to delete it, or resetting the password signs it out everywhere at its next request — not when the token runs out. The live socket uses the same check.'),
  LABEL('Offline.', 'The app reads the token\'s own expiry date (`utils/jwt.ts`), so a person with no signal stays signed in. When online it confirms with `GET /auth/me`, and it signs out only on a 401 for the token it still holds (a password change hands the phone a new one).'),
  LABEL('Google sign-in.', 'Run by the server, not a native library, so it works in Expo Go: the app opens a browser → Google → the server\'s callback → back into the app with a 5-minute one-time ticket (never a token in a link) → the app trades it for a login token, or finishes sign-up (PWD or not, terms) for a new person.'),
  LABEL('Admins', 'are a separate world: their own collection (`Admin`), their own secret and token audience, an httpOnly, SameSite=Strict cookie sent only to `/api/admin`, 2-hour sessions, 5 wrong passwords → locked 15 minutes, a forced change of the temporary password, two roles given permissions (admin, super admin), and an audit log of every login attempt and change. A phone token can never open the admin API, and the other way round.'),

  H2('1.5 Offline first, in one paragraph'),
  P('A person relying on AccessAI may have no signal exactly when they need it. So every screen shows what is saved on the phone first and asks the server quietly in the background; anything written offline (a chat message, an SOS, a finished lesson, a deleted conversation) waits in an **outbox** on the phone and is sent when the connection is back; each item carries an id made by the phone (`clientId`), so sending it twice never saves it twice. Part 4 goes through every feature.'),

  H2('1.6 Security layers'),
  table(
    ['Layer', 'What it stops', 'Where'],
    [
      ['Validation on every route', 'Wrong types, missing fields, too-long text, arrays or objects where text is expected. One plain message back.', '`backend/src/validators/`, `middleware/validate.js`'],
      ['NoSQL-injection guard', '`{"email": {"$ne": ""}}`-style tricks, dotted keys, prototype tampering', '`middleware/rejectOperatorKeys.js`'],
      ['Rate limits', 'Spamming and password guessing. A token bucket overall; tighter windows for login, codes, friend requests; per-account limits for chat, SOS, Accel, sign language, push.', '`middleware/rateLimiter.js`, `middleware/tokenBucket.js`'],
      ['No email probing', 'Finding out which emails have accounts: login, "Forgot password", the code wait and "did my code go out?" answer the same for unknown emails; the code counter stores only a hash of the address.', '`authController.js`, `utils/codeGate.js`'],
      ['Codes', '6 digits from a secure random source, stored hashed, 10 minutes, 5 wrong tries, 1 a minute and 5 a day per address', '`utils/emailCodes.js`, `utils/codeGate.js`'],
      ['Login checks', 'A stolen or old token after deactivation, deletion or a password reset', '`utils/verifyUserToken.js`'],
      ['helmet, CORS', 'Unsafe browser behaviour; other websites calling the API', '`app.js`'],
      ['Error handler', 'Leaking file paths, queries or stack traces', '`app.js`'],
      ['Body limits and time limits', 'Huge requests; requests that never finish (60 s); slow outside services (every outgoing call has a timeout)', '`app.js`, `server.js`'],
      ['AI guardrails', 'The AI doing something it shouldn\'t: it can only pick from a fixed list, and account changes are refused by voice', '`ai/app/interpret.py`, `frontend/src/accel/`'],
    ],
    [22, 50, 28],
  ),
  note('The repository is public, so no password, key or `.env` value appears in it or in this report. Secrets live only in `backend/.env` on the laptop.'),
];
