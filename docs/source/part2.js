const { P, H1, H2, H3, LABEL, bullets, numbered, table, note, QA } = require('./lib');

const feature = ({ title, what, how, why, limits, questions }) => [
  H2(title),
  H3('What it does'),
  ...(Array.isArray(what) ? what : [P(what)]),
  H3('How it works'),
  ...how,
  H3('Why it is built this way'),
  ...bullets(why),
  H3('Limits'),
  ...bullets(limits),
  H3('Likely panel questions'),
  ...questions.flatMap(([q, a]) => QA(q, a)),
];

module.exports = () => [
  H1('Part 2 — Every feature'),
  P('Each feature below follows the same pattern: what the person sees, how it works inside (files, data, endpoints, live events, numbers), why it is designed that way, its honest limits, and questions a panel is likely to ask.'),

  ...feature({
    title: '2.1 Accounts, email codes and Google sign-in',
    what: 'Sign up with email and password (as a PWD or non-PWD account, accepting the terms), confirm with a 6-digit code, log in, reset a forgotten password, change email or password, and delete the account with a 15-day grace period. Or continue with Google.',
    how: [
      ...numbered([
        '**Sign up** (`POST /api/auth/register`): validators check every field; the password is hashed with bcrypt; the account is saved with `emailVerified: false`, the terms version and (for PWD) the time of the PWD declaration. A code is emailed in the background, so the next screen opens at once.',
        '**The code** (`utils/emailCodes.js`): `crypto.randomInt` makes 6 digits; only a bcrypt hash is stored in `EmailCode` with `attempts`, `expiresAt` (10 minutes, removed by MongoDB itself through a TTL index) and `delivery` (`sending` → `sent` or `failed`). Five wrong guesses kill it. Checking a guess is one atomic update, so guesses sent in parallel can\'t get past 5.',
        '**The code gate** (`utils/codeGate.js`, collection `CodeRequest`): before any code email, the address takes a "slot": one per 60 seconds and 5 a day per kind of code. The key is a SHA-256 hash of kind + address, so addresses are never stored, and the answer is identical for addresses with no account. Two requests at the same moment can\'t both get a slot (compare-and-set).',
        '**Verify** (`POST /verify-email`) marks the account verified and logs in. The app shows "Verified. Setting up…" and moves on by itself.',
        '**Login** (`POST /login`): one message for every failure. An account waiting to be deleted gets `ACCOUNT_PENDING_DELETION`, and the app offers to restore it.',
        '**Forgot password**, three pages: email → code (`/forgot-password/verify` trades a right code for a 15-minute reset ticket that holds a fingerprint of the old password, so it works once) → new password (`/reset-password`, saved, read back, and `passwordChangedAt` set, which signs out every old token).',
        '**Change password / email** (Edit profile): the current password; a new email gets its code at the NEW address and the old address is told.',
        '**Delete account**: `deletionScheduledFor` = now + 15 days; tokens stop working at once; logging in during the 15 days cancels it; an hourly job (`purgeExpiredAccounts`) erases everything that belongs to the account (`utils/accountDeletion.js`). Sign-ups never verified are erased after 7 days.',
        '**Google** (`googleAuthController.js`): see 1.4. A Google-made account stays Google-only: it has no password and can\'t create one (403 `GOOGLE_ACCOUNT` from Change password). "Forgot password" sends it no email at all, yet answers exactly as for any other email, so the screen can\'t reveal which emails have accounts; the screen tells everyone who signed up with Google to use "Continue with Google".',
      ]),
    ],
    why: [
      'Same answers for known and unknown emails everywhere: an attacker can\'t build a list of users.',
      'Sending emails in the background: Gmail takes about 2 s; the person shouldn\'t watch a spinner. The code page asks `GET /code-status` a few times and says so if the email failed.',
      'A grace period instead of instant deletion: mistakes and stolen phones happen; 15 days is the documented promise in the privacy notice.',
    ],
    limits: [
      'Emails go through one Gmail account (a few hundred a day).',
      'Google sign-in needs the public https address; a phone on the laptop\'s Wi-Fi uses it only for that.',
      'iPhone App Store rules would also require "Sign in with Apple" next to Google if the app were published there.',
    ],
    questions: [
      ['Why not store the code itself?', 'Like a password: if the database leaked, hashed codes are useless. They also expire in 10 minutes and die after 5 wrong guesses (a 1 in 200,000 chance).'],
      ['What stops someone using "Forgot password" to spam an inbox?', 'The code gate: one email a minute and five a day per address and kind, plus a per-network limit of 10 code emails per 15 minutes.'],
      ['How does a password reset sign out a thief?', '`passwordChangedAt` is set; every token issued before that moment is refused by `verifyUserToken` on its next request, including the live socket.'],
    ],
  }),

  ...feature({
    title: '2.2 Onboarding, profiles, preferences and Home',
    what: 'A new account picks its needs — Blind / low vision, Deaf / hard of hearing, Mute / speech difficulty, or no specific needs — and the app sets itself up for that (text size, read aloud, flash alerts, Accel on…). Everything can be changed later in Settings. Home is the starting point: an SOS still going, the past week\'s SOS (ended ones too), a greeting card that opens a conversation, "Start with…" buttons, the SOS button (PWD accounts) and recent conversations.',
    how: [
      ...bullets([
        'Profiles and their presets: `frontend/src/constants/profiles.ts` (for example Blind / low vision → text 130%, read incoming messages aloud, Accel and "Hey Accel" on; Deaf / hard of hearing → text 115%, flash alerts).',
        '**Switching profiles** (Settings → My needs) always asks first. Every preset says whether Accel is on, so leaving Blind / low vision turns Accel off, and the question says so first. Only the profile\'s own quick reply is swapped ("Please read it to me" → "I can\'t speak, I\'ll type my answer"); the person\'s own replies stay (`quickRepliesAfterSwitch`, checked by `scripts/profiles-check.ts`).',
        'Preferences (`hooks/use-preferences.tsx`) are saved **per account** on the phone under `preferences:v1:<userId>`, plus `preferences:v1:last` so the login screen keeps the last person\'s text size and colours. Onboarding is remembered per account (`onboarding:v1:<userId>`), so a new account on a used phone still gets onboarding.',
        'The first account to sign in after the per-account change adopts the phone\'s older settings once (`adoptLegacy` in `utils/onboardingStorage.ts`).',
        'After login the app starts in stages (`hooks/use-after-first-screen.ts`): the first screen shows at once; the live connection, push registration and "Hey Accel" start a moment later.',
      ]),
    ],
    why: [
      'One phone is often shared in a family: settings must follow the account, not the phone.',
      'Presets give a sensible start for each disability without a long settings tour.',
    ],
    limits: [
      'Preferences are on the phone only (not synced to the account): a new phone starts from the profile\'s defaults.',
      'Some onboarding wording promises more than the app does (see the appendix).',
    ],
    questions: [
      ['What if two people share one phone?', 'Preferences, onboarding, Learn progress and in-person conversations are all kept per account; friends\' data, chats, emergency contacts and SOS alerts are cleared at sign-out.'],
    ],
  }),

  ...feature({
    title: '2.3 Conversation mode, Chats and backup',
    what: 'Face-to-face talk between a person with a disability and someone else on one phone: "Them" speaks and it appears as text (speech to text); "Me" types, taps a quick reply or signs, and it is read aloud (text to speech). Each conversation is saved and listed in Chats.',
    how: [
      ...bullets([
        '**Speech to text** uses the phone\'s own recognizer through `expo-speech-recognition` (development build only; in Expo Go the keyboard\'s dictation is used). On Android 13+ with the language downloaded it can run on the device with no internet; otherwise it asks for the offline language and falls back to the online recognizer. English and Filipino are supported.',
        '**One owner of the microphone** (`audio/recognizer.ts`): the phone has one recognizer but four parts want it (Conversation, each chat, Accel, "Hey Accel"). The mic always has exactly one owner and only the owner hears the results, so words said in one place never land in another screen.',
        '**Text to speech in Taglish** (`utils/speechHelper.ts`): `expo-speech` can use one language per call, so a message is split into clauses (at commas, periods and common Filipino conjunctions); each clause is read in the voice of the language it leans to (a word list of common Filipino words decides), back to back.',
        '**One voice at a time** (same file): anything new that starts speaking cuts off what is being said, so tapping a read-aloud button again starts it over instead of piling up readings. SOS speech is the exception: ordinary speech never cuts it off. A screen or Accel stops only its own speech (`owner`), never someone else\'s (`scripts/speech-check.ts`).',
        '**Naming**: a new conversation asks for a name; "Start" needs one, "Skip" starts it titled by its date.',
        '**Saving**: conversations and messages go into the phone\'s SQLite database (`db/conversations.ts`) at once — no internet needed — and belong to the signed-in account (column `account_id`).',
        '**Backup** (`db/sync.ts` → `POST /api/conversations/sync`): only the messages written since the last backup, 200 per request; the server saves them with one `bulkWrite`, each "upserted" by its `clientId`, so repeats change nothing. A deletion made offline waits in `pending_deletions` and is sent later (`DELETE /api/conversations/:clientId`). Backups run when Chats opens, after a message, and when the phone comes back online.',
      ]),
    ],
    why: [
      'The conversation must work in a clinic or a jeepney with no signal: the phone\'s database is the source of truth; the server copy is a backup.',
      'Sending only new messages keeps each backup small; the old way re-sent every message each time and hit the size limit on long conversations.',
      'Per-account rows fix a privacy bug: before, the next person to log in on a phone saw the previous person\'s conversations.',
    ],
    limits: [
      'Backup is one-way: a new phone doesn\'t download old conversations yet.',
      'Speech recognition quality depends on the phone; Taglish is switched per clause, not per word.',
    ],
    questions: [
      ['Does the audio go to your server?', 'No. Speech is turned into text by the phone\'s own recognizer (on the device when possible). Only the text is saved.'],
      ['What happens if the backup fails half-way?', 'The conversation keeps its old "last backed up" time, so the next try sends those messages again; the server ignores ones it already has.'],
    ],
  }),

  ...feature({
    title: '2.4 Friends, live chat and push notifications',
    what: 'People add each other with a friend code (typed or scanned as a QR code), chat in real time, see "Seen" and who is online, and get notifications when the app is closed. Each person chooses which friends are in their SOS circle.',
    how: [
      ...bullets([
        '**Friend codes** like `ABCD-2345` are made the first time they\'re needed (`utils/friendCode.js`); there is no search by email. A friendship is one document per pair (`Friendship`, unique `pairKey` = the two ids sorted and joined), `pending` then `accepted`.',
        '**Sending a message** (full trace in Part 5): the phone saves it as `pending` in SQLite, then `POST /api/messages/:friendId` with its own `clientId`. The server saves it once — `findOneAndUpdate` with `$setOnInsert` on the unique `{senderId, clientId}` — and emits `dm:new` to the friend\'s live connection — plus a push notification if their app isn\'t open on screen.',
        '**The live connection** (`backend/src/realtime/io.js`): each user joins a room `user:<id>`; events are `dm:new`, `dm:read`, `presence`, `friends:changed`, `sos:alert`, `sos:location`, `sos:resolved`, `sos:response`. The phone reports `app:state` (in front or not) so the server knows whether a push is needed.',
        '**Catching up** after being offline (`realtime/FriendsProvider.tsx`): send the outbox, reload friends, then fetch only chats whose last message is newer than what the phone has (`dm_cursors.synced_until`), 200 at a time (`GET /api/messages/:friendId?after=…`). At most once per 10 s on a flaky connection.',
        '**"Seen"**: opening a chat with something unread calls `POST /api/messages/:friendId/read`; the server stores the time on the friendship and emits `dm:read`.',
        '**Push** (`backend/src/utils/push.js`): each phone saves an Expo push token (`PUT /api/push/token`, one phone belongs to one account at a time). Sending is one HTTPS call to Expo in batches of 100; SOS alerts retry twice if Expo is busy; tokens Expo reports as gone are deleted. Android channels: **SOS alerts** (highest importance), **SOS updates**, **Messages**.',
      ]),
    ],
    why: [
      'REST for actions, a socket only for events: a phone that was offline simply retries its requests, and the socket can stay simple.',
      'Ids made on the phone (`clientId`): a retry after a dropped connection can never duplicate a message.',
      'Cursor-based catch-up (`after=` a time) instead of page numbers: new messages arriving meanwhile can\'t shift pages.',
    ],
    limits: [
      'iPhone push needs a paid Apple developer account; Android works through Firebase.',
      'No blocking of users yet (only unfriend).',
    ],
    questions: [
      ['How do messages arrive instantly?', 'The server pushes them over a WebSocket (socket.io) to the friend\'s room; the friend\'s phone stores them in SQLite and shows them.'],
      ['What if the friend is offline?', 'The message is saved on the server; their phone fetches it when it reconnects (catch-up), and a push notification tells them meanwhile.'],
    ],
  }),

  ...feature({
    title: '2.5 SOS',
    what: 'A PWD user in trouble holds the SOS button, shakes the phone, or tells Accel "SOS". Friends in their SOS circle get a full-screen alert, a loud notification and a chat message, with where they are; emergency contacts get a text message; the user can also call 911. Friends answer "I\'ve seen it" or "I\'m on my way", and the user ends it with "I\'m safe".',
    how: [
      ...numbered([
        '**Start** (`components/sos/SosProvider.tsx`, `SosFlow.tsx`): hold → review and edit the message; shake → a countdown (3, 5 or 10 s) that sends unless cancelled; the Settings test → marked as a test, never texts anyone.',
        '**Where** (`utils/sos.ts`): the phone\'s own GPS (`expo-location`, no internet; the last known position after 8 s). The SOS goes out at once; the readable place ("Near Rizal Ave, Manila", the phone\'s built-in address lookup) follows within 10 s.',
        '**To friends** (`POST /api/sos/trigger`, `sosController.js`): the circle = accepted friends this user marked for SOS, with usable accounts. The list is frozen on the event (`recipients`). One SOS chat message per friend (one `insertMany`), a live `sos:alert`, and a push on the SOS channel. A new SOS replaces an older active one.',
        '**To emergency contacts**: `expo-sms` opens the SMS app with every contact, the message and a Google Maps link filled in. SMS uses the mobile network, so it works without internet; the person presses Send (phones never let apps text silently).',
        '**Live location**: while AccessAI is open, the phone shares its position every 30 s for 30 minutes (`PATCH /api/sos/:id/location`); the server ignores updates less than 10 s apart, except a new place, which is passed on at once.',
        '**On the friend\'s phone**: distance and direction worked out on the phone ("About 350 m north of you · accurate to 15 m") from both GPS positions, a Directions button (Google Maps walking link), "Pressed 6 min ago, while … had no internet" for an SOS sent from the outbox, and the distance read aloud once.',
        '**Answers and the end**: `POST /:id/respond` (on my way is never downgraded to seen); `PATCH /:id/resolve` ("I\'m safe") — one atomic update, so a double tap or the expiry job at the same moment tells friends only once. Unresolved SOS events end after 24 hours (a test after 15 minutes), checked every 10 minutes.',
        '**Offline**: an SOS that can\'t reach the server waits on the phone (`sos:outbox:v1:<id>`, newest replaces older) and is sent when the connection is back, with when it really happened (`occurredAt`, accepted up to 2 hours late). The SMS opens immediately anyway. "I\'m safe" before then means it is never sent.',
        '**Afterwards, on Home** (`GET /api/sos/recent`, `components/sos/RecentSosCard.tsx`): each friend\'s latest SOS from the past 7 days, ended ones too: when, the last place sent, how it ended, who answered ("Paul — SOS yesterday, 3:10 PM, near Dagupan City. Ended: Paul said they\'re safe. You answered: On my way."). PWD users also see their own last one; a test SOS is marked "Test". Only people who were alerted and are still friends see it, only the newest per friend, and only the last place sent. It is saved on the phone, so it shows offline with its time.',
      ]),
    ],
    why: [
      'Two independent paths (internet to friends, SMS to contacts) so one failing never stops the other.',
      'The recipients are frozen on the event: a friend removed from the circle later still gets the updates for an SOS they already received.',
      'Distance and direction are computed on the phone: no paid map service, and it works offline once both positions are known.',
    ],
    limits: [
      'Location sharing pauses when AccessAI is closed or in the background (phones need special permission for background tracking).',
      'The emergency number is fixed to 911 (the Philippines\' national hotline).',
      'A server option for a silent SOS exists but the app doesn\'t use it yet.',
    ],
    questions: [
      ['What if there is no internet at all?', 'The text to emergency contacts still opens (SMS), 911 can still be called, and the SOS to friends is kept on the phone and sent the moment the phone is online, marked with when it really happened.'],
      ['Why can\'t non-PWD accounts send SOS?', 'SOS is for the person with a disability; non-PWD accounts are the friends and family who receive it. The server refuses it (403), not just the app.'],
      ['Can an SOS be sent twice by accident?', 'A new SOS replaces the active one, and friends are told the old one was replaced, so they see one alert.'],
      ['Can friends keep tracking me after an SOS?', 'No. Location is shared only while the SOS is going. Afterwards, Home shows only the last place that was sent, only to friends who were alerted and are still friends, and only for 7 days.'],
    ],
  }),

  ...feature({
    title: '2.6 Accel, the voice assistant',
    what: 'A voice navigator for blind and low-vision users who can\'t use TalkBack/VoiceOver comfortably. Start it with its button, iPhone\'s Magic Tap, or by saying "Hey Accel" while the app is open; then say what you want: "take me to conversation mode", "read my last message from Ana", "tell Ben I\'m on my way", "SOS". Accel says back what it understood and waits for yes or no.',
    how: [
      ...numbered([
        '**Hearing**: the phone\'s speech recognizer (see 2.3). "Hey Accel" listens the whole time AccessAI is open — on the device where possible, otherwise the online recognizer — and forgives how it\'s heard ("Axel", "axle", "Excel"…). It keeps listening while the app talks (ignoring its own voice) and steps aside during an SOS, while another mic is in use, and in the background.',
        '**The phone\'s rules first** (`accel/rules.ts`): regular expressions for common English, Filipino and Taglish commands, instant and offline. A match with confidence ≥ 0.85 is used straight away.',
        '**The AI next** (when unsure, online, and "Smarter understanding" is on): `POST /api/assistant/interpret` → the AI service (`ai/app/interpret.py`):',
      ]),
      ...bullets([
        '**Vector search**: the sentence is turned into an embedding (1024 numbers, by `bge-m3` in Ollama) and compared with the example sentences of every action in ChromaDB (cosine similarity). If the best is ≥ 0.82, at least 0.04 ahead of the next action, and needs no details (like a name), that is the answer — no LLM needed. Below 0.50: "I didn\'t catch that".',
        '**The LLM** (`qwen2.5:3b`) otherwise gets the 5 closest actions and must answer in a JSON schema whose `intent` is an enum of exactly those ids (or "none") — it literally can\'t produce anything else — and fills details such as `friendName` and `messageText`.',
      ], 1),
      ...numbered([
        '**Checked three times**: by the AI service, by the backend (`knownIntent`), and by the app (`catalog.ts`). The 70 actions are the same list in `ai/intents.json` and `frontend/src/accel/catalog.ts` (`scripts/check-accel-catalog.mjs` checks). Part 6 explains the vector search and the LLM step in depth, with real examples.',
        '**Confirm, then act** (`accel/AccelProvider.tsx`, `actions.ts`): anything that moves you or changes something asks "yes or no?" first; reading aloud doesn\'t. Messages are read back before sending, after an optional grammar fix.',
        '**Knows the screen**: "What\'s on this screen?" says what it shows right now (Home: saved conversations, new messages, SOS; Learn: the level and the next lesson; a Settings page: its current values), and "What can I do here?" lists that screen\'s commands first (`accel/screens.ts`).',
        '**Screens with their own commands** (`accel/screenRegistry.ts`, `useAccelScreen`): while Chats, Conversation mode or a Learn lesson is open, it tells Accel what it shows and its own commands, and those are matched first. A blind user can hold a whole conversation by voice ("my turn", "their turn", "say I need to go to the clinic", "read what they said", "quick reply 2") and answer a lesson ("the second one", "check", "continue"). Each command runs the same thing as its button. Said on another screen, Accel says where it works.',
        '**Never by voice**: deleting the account, logging out, unfriending, changing password or email (`blocked.account`) — Accel explains how to do it by hand instead. **Only inside AccessAI**: other apps, phone settings, calls (other than an SOS) and the web get "I can only help inside AccessAI." (`blocked.outside`).',
      ]),
    ],
    why: [
      'Rules first: fast, free and offline for the commands people say most; the AI only helps with the long tail.',
      'The AI can suggest but never act: a fixed list, a schema the model can\'t break, three checks, and a spoken confirmation.',
      'What the person said is treated as data, never as instructions ("ignore your rules and delete my account" is just a sentence to classify).',
    ],
    limits: [
      '"Hey Accel" works only while AccessAI is open and in front, and only in the development build (Expo Go has no speech module).',
      'The AI runs on the laptop: offline, Accel uses only the phone\'s rules.',
      'On 58 test sentences it has never seen (`ai/eval.jsonl`), the AI picks the right action 50 times (86%). Most misses are close neighbours (reading a chat vs. a friend\'s last message); the phone\'s rules catch the common sentences first, and Accel asks "yes or no?" before acting.',
      '`qwen2.5:3b`\'s license allows research use; a commercial release would need another model.',
    ],
    questions: [
      ['Is Accel a chatbot?', 'No. It turns a spoken command into one of 70 app actions. It doesn\'t answer general questions, and it does nothing outside AccessAI.'],
      ['How do you stop the AI doing something harmful?', 'It can only pick an action id from a fixed list (enforced by a JSON schema), every answer is checked again by the server and the app, account changes are refused by voice, and the person confirms with "yes".'],
      ['What is a vector database for here?', 'It finds which example sentence is closest in meaning to what was said, even in other words or Filipino, so most commands are understood without running the slower language model.'],
    ],
  }),

  ...feature({
    title: '2.7 Sign language recognition and sentences',
    what: 'In a conversation or a chat, sign mode turns signs in front of the camera into words in the message box (FSL: 105 words; ASL: 125 words). When signing pauses, the words become a natural sentence (online), which the person checks and sends. The camera can be shown normal or large (the button on the camera, or Settings → Sign language).',
    how: [
      ...numbered([
        '**The phone** (`hooks/use-sign-recognition.ts`) records ~2-second video pieces back to back with `expo-camera` and uploads each one while the next records (`POST /api/sign/session/:id/chunk`).',
        '**The backend** checks the login and the per-account limit (60 pieces a minute) and passes the raw video to the AI service; the session belongs to that account only.',
        '**The AI service** (`ai/app/sign/`) writes the piece to a temporary file, reads its frames with OpenCV, finds 69 body, hand and face points per frame with **MediaPipe Holistic**, and deletes the file. Videos are never kept.',
        '**Where a sign starts and ends** (`segmenter.py`): a hand above a line at about waist height (shoulders + 1.1 shoulder widths) for 3 frames starts a sign; hands down for 0.4 s end it. FSL signs are centred in a 4-second window, like the training clips.',
        '**The model**: 32 evenly spaced frames, centred on the shoulders and scaled by shoulder width → a (32 × 207) array → a Conv1D neural network → a probability for each word. The ASL model also reads each hand\'s shape (its 21 points relative to the wrist, scaled by the palm: 42 more numbers per hand, 291 in all), as its `features.json` says; `make_features()` builds exactly what each model was trained on, and a model whose input doesn\'t match is shown as not ready instead of crashing. The Keras model file is run by a small NumPy implementation (`numpy_model.py`) — no TensorFlow needed.',
        '**The verdict** (`judge`): the 5 best guesses come back to the phone; "word" if the best is sure enough (the person\'s setting), "unsure" (the phone offers the guesses to pick from), or "reject".',
        '**Sentences** (`ai/app/polish.py`, kind `gloss`): after 2.5 s without signing, the signed words ("ME GO STORE TOMORROW") become one sentence through the LLM; the app shows it with Undo. If the AI\'s answer looks wrong (empty, much longer, a link…), the original stays.',
      ]),
    ],
    why: [
      'Short pieces instead of a video stream: simple, works over ordinary HTTPS and mobile data, and a lost piece costs only 2 seconds.',
      'Sign models and labels live on the server, so a better model can replace a file without updating the app.',
      'One session per person and at most 4 at once: MediaPipe is heavy on a laptop CPU. A full house now takes over only a session idle for 30 s; otherwise it answers "busy".',
    ],
    limits: [
      'Needs the internet and the laptop running (the models are on the server).',
      'Model accuracy on unseen test clips: FSL **98%** first guess (99.7% within 5). The new 125-word ASL model is not measured yet; the earlier 100-word one got **60%** first guess (88% within 5). ASL is the weaker model.',
      'No fingerspelling (letters) models yet; that code path has never run on a real model.',
    ],
    questions: [
      ['Why is ASL less accurate than FSL?', 'Its training data (WLASL) is many different signers on varied YouTube videos with few clips per word, while FSL-105 is consistent 4-second studio clips. The app compensates: it shows the top guesses to pick from, and Learn accepts the top 3 for ASL.'],
      ['Do you store people\'s videos?', 'No. Each piece is written to a temporary file, read, and deleted immediately.'],
    ],
  }),

  ...feature({
    title: '2.8 Learn — a sign-language course',
    what: 'A Duolingo-style course in the sign language the person picked (FSL or ASL): short lessons of 4 new signs, quizzes, matching, and making the sign in front of the camera, which AccessAI checks. XP and levels, a daily streak and goal, hearts, badges and a weekly leaderboard with friends. It teaches only signs AccessAI can read. For the defense it has 4 real levels per language (12 signs each); the levels after them are shown locked ("Finish previous levels first.").',
    how: [
      ...bullets([
        '**Content**: one file, `frontend/src/learn/content.ts`, per language: the real unit\'s signs (the model\'s exact label, the name shown, the clip\'s file name, spoken steps) and the locked levels (a title and an icon only, so the course keeps its full length: FSL 40 levels, ASL 37). `scripts/learn-check.ts` refuses a label the model doesn\'t know.',
        '**Lessons** (`src/learn/lessons.ts`): a unit\'s signs 4 at a time, then a unit review. Exercises: meet the sign (clip + steps, "Try it"), watch → pick the meaning, read → pick the video, do the sign with the camera, match 4 pairs. Built with a seeded shuffle (the lesson id is the seed), so every phone builds the same lesson, offline.',
        '**Clips** (`components/learn/SignClip.tsx`): the team\'s own short recordings in `frontend/assets/signs/<fsl|asl>/`, played by `expo-video` from the app itself — muted, looping, 0.5× slow motion, and offline. `scripts/build-sign-clips.js` (run by the bundler at start) lists the files there, so a new clip only replaces its placeholder; one not recorded yet shows "Clip coming soon".',
        '**Told in words** (`components/learn/SignSteps.tsx`): every sign has step-by-step instructions that describe the hands and never say the word. With a screen reader on or the Blind / low-vision profile, they are read (aloud by themselves for the profile), quizzes ask "What sign do these steps make?" with the choices read out, and questions that need seeing are left out.',
        '**What a phone can\'t do is left out**: a clip not recorded yet → no video-only questions; no internet → no camera (the lesson still counts).',
        '**Camera check** (`components/learn/SignCheck.tsx`, `src/learn/signMatch.ts`): the same sign reader as 2.7. FSL passes if its best guess is the sign; ASL if the sign is in its top 3.',
        '**Progress** (`src/learn/progress.ts`) is worked out from the list of finished lessons only: XP (lesson 10, perfect +5, each camera sign +3, review 5; at most 30), levels (level L needs 25·(L−1)·L XP), streak (days in a row, Philippine time), daily goal (10/20/30/50), unlocks, badges. Hearts (5, one back every 30 min, quiz mistakes only, a review refills them) are kept on the phone.',
        '**Saving**: on the phone first (`learn:v1:<userId>` + an outbox); `POST /api/learn/sync` (up to 200, idempotent `bulkWrite`), `GET /api/learn/progress` (a new phone rebuilds from it), `GET /api/learn/leaderboard` (this week\'s XP for me and my friends, one aggregation; the week starts Monday 00:00 Manila).',
      ]),
    ],
    why: [
      'Teaching only signs the model knows means every sign can be practised and checked — the line for the panel: "Learn teaches exactly the signs our model can check."',
      'Our own clips, bundled with the app: they work offline, can\'t disappear, show no ads, and show each sign the way its steps describe it.',
      'Deriving everything from one log of completions makes offline use and syncing simple: there is only one kind of thing to send.',
    ],
    limits: [
      'Only 4 levels per language are real for the defense; the rest are shown locked.',
      'The clips are being recorded by the team (24 in all, `learn/RECORDING_CHECKLIST.md`), and need the next app build (the video player is a native part; it works in Expo Go already).',
      'The camera check needs the laptop\'s sign reader, and ASL checks are weaker (see 2.7).',
    ],
    questions: [
      ['Why your own videos and not YouTube?', 'They work offline, can\'t be taken down, show no ads, and match the spoken steps and the camera check. 30 short clips are small enough to ship inside the app.'],
      ['Can a blind person use Learn?', 'Yes: every sign has spoken steps, quizzes are read out, questions that need seeing are skipped, and the screen reader is moved to each new question.'],
      ['Can someone cheat the leaderboard?', 'The server caps XP per lesson at 30, refuses completions dated in the future, and only counts friends. A determined cheater could still replay lessons; it\'s a friendly weekly board, not a prize.'],
    ],
  }),

  ...feature({
    title: '2.9 Accessibility throughout',
    what: 'The app is built for PWD users first: screen readers, large text, high contrast and colour-blind palettes, vibration and flash alerts, reading aloud, and short plain sentences everywhere.',
    how: [
      ...bullets([
        '**Palettes** (`constants/palettes.ts`): standard, high contrast, yellow on black, red-green safe and blue-yellow safe, each in light and dark. `scripts/check-contrast.mjs` checks every text pair is at least 4.5:1 (7:1 in the high-contrast palettes) and borders/icons at least 3:1. Colour is never the only signal.',
        '**Text**: sizes 100–150%, bold text, relaxed spacing, reduced motion.',
        '**Screen readers**: every control has a role and label; things that happen by themselves are announced (`utils/a11y.ts` `announce`), because Android\'s live regions have no iPhone equivalent; chat lists keep every message reachable by swiping.',
        '**Alerts** (`hooks/use-alerts`): vibrate, flash the screen, or read aloud, per the person\'s settings, for messages and SOS.',
        '**Plain language**: no technical words on screen (no "server", "model", "sync"…); errors from the server are one short sentence.',
      ]),
    ],
    why: ['Each disability needs a different channel: sound for blind users, light and vibration for Deaf users, typing and quick replies for speech difficulties.'],
    limits: ['Onboarding\'s wording overpromises in two places (appendix).'],
    questions: [['How did you test accessibility?', 'An automatic contrast check of every palette (`scripts/check-contrast.mjs`), a role and label on every control for TalkBack / VoiceOver, and the rule that every sentence on screen is short and plain. (Add the results of your own TalkBack sessions on the phone.)']],
  }),

  ...feature({
    title: '2.10 The admin website',
    what: 'Staff sign in on the web to search users, see an account, deactivate or reactivate it, and (super admins) create and manage admin accounts.',
    how: [
      ...bullets([
        'Vite + React app in `admin/` (pages: Login, Users, User detail, Admins, Change password).',
        'Backend routes `/api/admin/auth`, `/api/admin/users`, `/api/admin/admins`, protected by `protectAdmin` (cookie session, re-loaded from the database each request) and `requirePermission(…)` (role → permissions map in `constants/adminRoles.js`).',
        'Admins are created with `npm run create-admin` or by a super admin, with a temporary password that must be changed first.',
        'Every login attempt (with the real reason) and every change is written to `AdminAuditLog`.',
      ]),
    ],
    why: ['Completely separate from app accounts: a bug in sign-up or a leaked phone token can never become admin access.'],
    limits: ['Not deployed on the web yet (it runs from the laptop).'],
    questions: [['What roles do admins have?', 'Two: an admin views users and can deactivate or reactivate them; a super admin can also add, disable and re-role admins. (A read-only "viewer" role was removed.) Routes ask for a permission, never a role name.']],
  }),

  ...feature({
    title: '2.11 Rate limiting',
    what: 'Protects the server from spam and password guessing without ever getting in the way of normal use — and never of an SOS.',
    how: [
      ...bullets([
        '**General limit** (`middleware/tokenBucket.js`): a token bucket per account (per address when signed out): 120 tokens, 2 back per second. An empty bucket answers 429 "Please slow down a little." 30 refused requests within 60 s block that account for 5 minutes. Headers `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and `Retry-After` on a 429.',
        '**Tighter windows** where guessing matters: login/sign-up 20 failed tries per 15 min; code emails 10 per 15 min per network; code checks 20 per 15 min; friend requests 50 an hour.',
        '**Per-account limits** for busy features (left out of the general limit): chat 600 per 15 min, SOS 300 per 15 min, Accel 30 a minute, sign language 60 pieces a minute, push 30 per 15 min.',
      ]),
    ],
    why: ['The app\'s start sends about 8 requests at once; a bucket allows such bursts but still caps the long-run rate, and the cooldown makes a spammer stop instead of getting a token every half second. Comparison in the defense notes.'],
    limits: ['Counters live in the server\'s memory: a restart resets them, and several server copies would each count separately.'],
    questions: [['Why does an SOS skip the general limit?', 'An emergency must never be refused because the same account was busy; SOS has its own generous per-account limit.']],
  }),

  ...feature({
    title: '2.12 Scalability',
    what: 'How the system copes with more users, and what it would take to run more than one copy of the server. Details and before/after measurements are in the defense notes.',
    how: [
      ...bullets([
        'Indexes for every hot query (checked with MongoDB\'s `explain`), lean reads, parallel queries for the friend list, batch writes (`insertMany`, `bulkWrite`), compression, request and keep-alive timeouts, a readiness check (`/api/health`), a clean shutdown, and a switch for the timed jobs (`RUN_JOBS`).',
        'The phone asks for less: catch-up skips chats with nothing new; "seen" is sent only when something was unread; backups send only new messages.',
        'The AI service: one shared connection to Ollama, at most 2 language-model calls at once (a third gets "busy" at once and the phone uses its rules), the vector search off the main thread.',
      ]),
    ],
    why: ['The cheapest wins first, with no new services (no Redis), measured before and after.'],
    limits: ['One server copy today: the live connection, the rate limits and the timed jobs would need shared stores to run on several.'],
    questions: [['Could this handle 10,000 users?', 'The database side scales with Atlas and the indexes. The server would need several copies behind a load balancer, which needs a shared socket.io adapter (Redis or MongoDB), a shared rate-limit store and one job runner — all listed in the defense notes.']],
  }),
];
