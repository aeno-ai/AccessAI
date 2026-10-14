# AccessAI — Handoff

_Last updated: 2026-10-14. Pick-up line for a new Claude session: **"Read HANDOFF.md — start with ★ Start here. §24–§29 are built (2026-10-14) and every laptop check is green, but nothing has been tried on a phone yet: the next step is the phone tests listed in ★ Start here. Each section's "Built" note says where the build differs from its plan. The owner commits."**_

Ground rules every change follows:

- **Offline first.** Anything a PWD needs in the moment works with no signal. Online-only extras fail gracefully.
- **iPhone and Android**, with TalkBack and VoiceOver.
- **Expo Go stays usable.** Native-only features work in the development build and degrade gently in Expo Go.
- **Lightweight.** Prefer what's already in the stack.
- **Plain words** in everything a user sees or hears (no server, model, Expo or sync wording).

---

## ★ Start here — for a new Claude session (written 2026-10-13)

The owner trimmed this file on 2026-10-13. The earlier sections (§1–§23: SOS, push, Accel, Learn, rate limits, reports…) are summarised below; the full text isn't in git (see "Not committed").

### Where things stand
- **Built and working on the laptop (2026-10-12/13), not yet tested on phones:**
  - Learn: real levels with local clips (`frontend/assets/signs/`, the clip list is made by `scripts/build-sign-clips.js` when Metro starts), locked placeholder levels, spoken step-by-step instructions for blind users;
  - the new logo (icons, splash, in-app), a 30-day login renewed when the app opens;
  - the new 125-word ASL model on the AI server;
  - admin roles: super admin and admin only;
  - Google accounts stay Google-only (no password can be made; Forgot password sends them nothing);
  - the Word reports in `docs/` (rebuilt 2026-10-13).
- **Built 2026-10-14, not yet tested on phones: §24–§29** (Learn 3 lessons + Review, "Start" needs a name, speech never piles up, switching My needs, Home's Recent SOS, Accel knows every screen and runs Conversation mode and Learn lessons by voice). The Word reports were rebuilt with them.
- **Checks green (2026-10-14):**
  - frontend: `tsc`, lint, `learn-check` 67/67, Accel rules 187/187, `speech-check` 16/16 (new), `profiles-check` 10/10 (new), `conversations-account-check` 16/16, `check-accel-catalog` (70 actions), `check-contrast`;
  - backend: e2e 142/142 with the AI service on (the SOS suite has 13 new Recent SOS checks), `rate-check` 15/15;
  - AI: `python -m app.eval` 50/58 (86%). Scored the same way, this morning's command list got 38/45 (84%) on the old sentences, so nothing got worse. The vector index rebuilt with 523 examples. `sign_check` wasn't re-run (sign language untouched).
- **Not committed:** nothing has been committed since 2026-10-08 (commit `271134a`). About 272 files are changed or new. The owner commits on GitHub; Claude makes no commits.
- **Next APK** (ask the owner before any EAS build): for the new icon/splash/notification icon and clip playback (`expo-video`). Before building: update `expo`, `expo-router`, `expo-splash-screen` together (owner's OK first), and switch `frontend/.env` back to the Tailscale line.

### Running it (works on any Wi-Fi)
- **The phone joins the laptop's Mobile hotspot.** The laptop is always `192.168.137.1` there. School/office Wi-Fi blocks devices from reaching each other, and it moves the laptop between addresses.
- `frontend/.env`: `EXPO_PUBLIC_API_URL=http://192.168.137.1:3000/api` (the Tailscale line is kept commented). A `.env` change needs a full Expo restart with `-c`.
- `cd backend` → `npm run dev` (API + AI service; Ollama must be running).
- `cd frontend` → `$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.137.1"; npx expo start -c` → in the development app, open `http://192.168.137.1:8081`.
- Google sign-in still needs Tailscale (its return address is `https://accessai.tail2a97db.ts.net`). If Tailscale shows "offline" after a network change: tray icon → Disconnect → Connect.
- Push test: `cd backend` → `npm run test-push -- --email <account>`.

### Next: phone tests for §24–§29 (reload the app; no new APK needed)
1. **§24 Learn:** FSL and ASL each show Lesson 1, 2, 3, then Review, then locked levels.
2. **§25 Naming:** with nothing typed, Start is dimmed and TalkBack says "disabled". A typed name starts a conversation with that name, and Skip starts one titled by its date.
3. **§29 Speech:**
   - tap Home's "Read last message" 5 times fast: it starts over each time and never piles up;
   - tap through the voice speeds quickly: only the last one speaks;
   - tap bubble A, then bubble B: A stops and its button goes back to "Read aloud";
   - a friend's SOS keeps speaking when a new message arrives.
4. **§26 My needs:**
   - Blind → Mute: the question mentions Accel, then Accel and "Hey Accel" are off, the text is normal, and "speak my messages" is on;
   - Mute → Blind: Accel is on;
   - with an edited quick-reply list, only the profile's own phrase swaps.
5. **§28 Recent SOS:** send a test SOS from a PWD account and end it with "I'm safe". The friend's Home shows it under "Recent SOS", with the place, "Test" and how it ended. It still shows offline, with its "Updated" time.
6. **§27 Accel** (TalkBack on and off):
   - "what can I do here" on every screen;
   - a whole conversation by voice: "start a conversation called Ate Lyka", "my turn", "their turn", "say …", "read what they said", "quick reply 2", "end the conversation";
   - one Learn lesson answered by voice: "the second one", "check", "continue", "hear the steps", "skip";
   - "open Facebook" → "I can only help inside AccessAI."

Nothing in §24–§29 needs a new APK: it's JavaScript, content and backend only. **The AI service must be restarted** (`npm run dev`) so it rebuilds its index with the new commands (it does that by itself, about a minute), and the backend must be restarted so it accepts the new command ids.

---

## 24. Plan (owner, 2026-10-13): Learn — Lessons 1–3 + Review

**Built 2026-10-14**, as planned. The 6 placeholders were 0 bytes and are deleted, and `clips.ts` was rebuilt. The reports were updated and rebuilt (24 clips, 4 real levels, 12 signs). The message for the classmate is in the chat of 2026-10-14.

**Why:** fewer clips for the classmate to record. Today each language has 5 real levels (4 lessons + review, 15 signs, 30 clips in all).

**Owner chose:** Lessons 1–3 + the automatic unit Review = **4 real levels per language, 12 signs each, 24 clips.** The level flow (`lessons.ts`: 4 signs per lesson + a unit review) and progress logic stay as they are. The course keeps its full length (FSL 40 levels, ASL 37), so one more level becomes locked in each language.

| | FSL | ASL |
|---|---|---|
| Lesson 1 | Hello, Good afternoon, How are you?, Nice to meet you | Help, Please, Thank you, Sorry |
| Lesson 2 | I'm fine, Thank you, You're welcome, See you tomorrow | Yes, No, Understand, Again |
| Lesson 3 | Yes, No, Know, Don't know | Name, Meet, How, Fine |
| Level 4 | Review (no new clips) | Review |

Removed (today's Lesson 4): FSL `UNDERSTAND`, `DON’T UNDERSTAND`, `DEAF`; ASL `eat`, `drink`, `water`.

**Build:**
- `frontend/src/learn/content.ts`:
  - delete those 6 signs;
  - `LOCKED`: FSL `locked('Describing', 2)` → `3` (35 → 36 locked), ASL `locked('Food and drink', 3)` → `4` (32 → 33 locked).
- Delete the 6 unused empty placeholder clips (check each is 0 bytes first):
  - `frontend/assets/signs/fsl/{understand,dont-understand,deaf}.mp4`;
  - `frontend/assets/signs/asl/{eat,drink,water}.mp4`.
  - Then run `node scripts/build-sign-clips.js`.
- `frontend/scripts/learn-check.ts`: 12 signs and 4 real levels (the 40/37 total check stays); "all 5 real levels done" → "all real levels done".
- `learn/RECORDING_CHECKLIST.md` (24 clips) and `learn/README.md` (4 real levels, 12 signs).
- Reports (`docs/source/`, then `npm run build` with Word closed):
  - `defense.js` §3.1 (level count and word list), §3.2 ("30 in all" → 24), §3.4, and the Q&A "Why only 5 Learn levels?";
  - `part2.js` 2.8 (what + limits);
  - `part45.js` known gaps.
- Give the owner the updated message for the classmate (24 clips).

**Checked in the code (2026-10-13):**
- `content.ts` matches the table above, Lesson 4 is L140–164 (FSL) and L285–309 (ASL). `LOCKED` is L325–346.
- All 30 files in `assets/signs/` are 0-byte placeholders, and `learn/clips.ts` lists no clips. Keep `asl/understand.mp4` because ASL Lesson 2 still uses it. Only the FSL `understand.mp4` goes.
- Lesson ids don't change (`<course>-first-signs-1…3`, `-review`), so saved progress still matches. An old `…-4` completion (test accounts only) keeps its XP but is no longer shown. Nothing to migrate.
- The review picks 6 of the unit's signs (`lessons.ts` L169). With 12 signs that still works.
- Where the old counts are written:
  - `learn-check.ts` L56 ("15 signs"), L70 ("5 real levels"), L172;
  - `learn/README.md` L3; `learn/RECORDING_CHECKLIST.md` title and the Lesson 4 rows;
  - `defense.js` L90, L100 (word list), L103–104 ("30 in all", "30 clips of 3 seconds"), L161;
  - `part2.js` L233, L253; `part45.js` L154.

**Checks:**
- `npx tsc --noEmit`, `npx expo lint`, `npx tsx scripts/learn-check.ts`;
- `grep` for the removed words and for "5 real levels" / "30 clips";
- phone (reload): Lesson 1, 2, 3, Review, then locked levels.

---

## 25. Plan (owner, 2026-10-13): Conversation — "Skip" and "Start" do the same thing with no name

**Built 2026-10-14**, as planned (`conversation.tsx`): a dimmed Start with `accessibilityState.disabled`, a hint line, and Done does nothing with no name.

**Today:** a new conversation first asks "Name this conversation" (`frontend/src/app/(app)/conversation.tsx` ~L376–401). **Skip** calls `confirmName('')` and **Start** calls `confirmName(nameInput)`. With nothing typed, both do the same thing (an unnamed conversation, titled by its date).

**Build:**
- **Start is disabled until a name is typed** (`nameInput.trim()`), dimmed, with `accessibilityState={{ disabled }}`.
- The keyboard's Done with no name does nothing.
- Under the field, a short hint: "Type a name, or tap Skip."
- Skip keeps today's behaviour.
- Labels: Skip → "Skip naming", Start → "Start the conversation named …".

**Checked in the code (2026-10-13):** the naming card is `conversation.tsx` L375–402. `confirmName` (L203) already falls back to the date title. Done is `onSubmitEditing` (L392), Skip is L395 and Start is L398. A Home shortcut skips naming (`skipNaming`, L214), and that stays as it is.

**Checks:**
- With nothing typed, Start can't be pressed and TalkBack says "disabled";
- a typed name starts a conversation with that name;
- Skip starts one titled by its date.

---

## 26. Plan (owner, 2026-10-13): switching "My needs" turns the old profile's settings off

**Built 2026-10-14**, as decided:
- every preset sets `accelEnabled` / `accelWakeWord`;
- the per-phrase swap is `quickRepliesAfterSwitch` in `constants/profiles.ts`, checked by the new `scripts/profiles-check.ts` (10/10);
- leaving Blind adds the Accel sentence to the existing question.
- Differs: "set my needs to mute" by voice offers to open Settings → My needs (`nav.settings_needs`, yes/no) instead of only saying where it is.

**Owner's example:** choose Blind → Accel and the other blind settings turn on. Switch to Mute in Settings → My needs → **Accel turns off.** Today it doesn't.

**Why it happens:** `frontend/src/constants/profiles.ts` `PROFILE_PRESETS`.
- Every preset sets text size, colours, bold, reading aloud, flash, vibration and shake-to-SOS, so those already switch.
- Only **Blind** sets `accelEnabled` / `accelWakeWord`; the others leave them alone, on purpose ("choosing another profile never takes it away").
- `applyProfile` in `hooks/use-preferences.tsx` (`withProfile`, ~L139) applies the preset on top of the current settings, so Accel stays on.

**Build:**
- **Every preset says what Accel does:** Blind `accelEnabled: true, accelWakeWord: true`; None, Deaf, Mute `accelEnabled: false, accelWakeWord: false`. Update the comment above `PROFILE_PRESETS` and the profile descriptions in `PROFILE_LABELS`.
- **The profile's own quick reply swaps (owner, 2026-10-13):** switching profiles removes the old profile's phrase ("Please read it to me"…) if it's still there unchanged, and adds the new profile's phrase at the top, **even when the user edited other replies**.
  - In `withProfile` (`use-preferences.tsx` L139–147). Today it is all or nothing: an untouched list follows the profile, and an edited list stays whole, old phrase included. An untouched list keeps today's behaviour.
  - Don't add the phrase twice. If the list is already at `MAX_QUICK_REPLIES` (20) after the removal, don't add it.
  - In the dialog, "Quick replies you've edited are kept." → "Your own quick replies are kept."
- **The dialog stays on every switch (owner, 2026-10-13):** My needs already asks "Apply suggested settings?" before any switch (`settings/needs.tsx` L18–36), and that stays.
  - **Leaving Blind / low vision**, the same dialog also says: "This turns off Accel, the voice assistant, and the large high-contrast text." (Cancel / Apply). The screen reader reads it, because it's an `Alert`.
  - _(Replaces the earlier "other switches apply at once".)_
- Settings → Accel still lets anyone turn Accel back on by hand. The profile only sets the starting point.
- **Accel voice command:** a profile change by voice ("set my needs to mute") isn't offered (account-level change); if asked, Accel says to use Settings → My needs.

**Checks:**
- Blind → Mute: Accel off, "Hey Accel" off, normal text, speak-my-messages on;
- Mute → Blind: Accel on;
- every switch asks, and only leaving Blind mentions Accel and the large text;
- an edited quick-reply list: Blind → Mute removes "Please read it to me" and adds "I can't speak, I'll type my answer" at the top, and the user's own replies stay;
- onboarding (which also calls `applyProfile`, `OnboardingPager.tsx` L58, no dialog) still works.
- Add the swap cases to a check script (`withProfile` is plain logic). Export it, or move it to `constants/profiles.ts`.

---

## 27. Plan (owner, 2026-10-13): Accel knows every screen, says what you can do, and runs Conversation mode

**Built 2026-10-14.** Where it differs from the plan below:
- **Which screens register:** Chats, Conversation mode and a Learn lesson use the registry (`useAccelScreen`). The pure part is in `accel/screenRegistry.ts`, so the rules check can load it in Node. Home, Friends, a chat, Learn, Settings and the rest are described live by `accel/screens.ts` (`describeLive`, `screenExamples`) from what Accel already knows.
- **"What can I do here"** is the existing `read.help`, made screen-aware. There's no `read.screen_actions`. "Where am I" and "what's on this screen" give the same live answer.
- **Work from anywhere:** "start the next lesson" (`learn.next_lesson`), "practise signs" (`learn.practice`) and "open my last conversation" (`nav.last_conversation`).
- **Yes/no:** conversation turns (my turn, their turn, sign mode, quick replies, reading aloud) act straight away. "say …", "quick reply 2", rename, end and start ask yes/no first. Learn answers act straight away, because "check" is their confirmation.
- **Emergency calls:** "call 911", "call an ambulance" and "call the police" start the SOS countdown. Any other call ("call mom") gets "I can only help inside AccessAI."
- **AI fields:** the AI's existing fields are reused, so the Python code didn't change. `friendName` carries a conversation's name too. The quick-reply number and sign mode on/off come from the phone's rules only.
- **The rest:** `ai/intents.json` has 70 actions. 13 new sentences are in `ai/eval.jsonl` (the AI scores 50/58). The rules check has 187 cases, including the commands of each screen and the registry. `ai/MODEL_INTEGRATION.md` explains how to add a screen command.

**Owner's ask:**
- Accel should work from almost everywhere and know which screen it's on.
- It should say what's on the screen (e.g. Home: "You're on Home. You have 3 conversations…") and answer "What can I do on this page?". It doesn't need to read out the speech-to-text box.
- It should navigate through Conversation mode and help a blind user hold a conversation.
- On every page it can navigate, describe the page and say what can be done there.
- **Accel has full access inside the app only, and none outside it.**

**Today:**
- `frontend/src/accel/` has 33 actions (`actions.ts`):
  - navigation (`nav.*`);
  - SOS (`sos.*`);
  - friend messages (`read.*`, `msg.*`);
  - friend requests (`friend.*`);
  - speech and text size;
  - `read.where_am_i`, `read.help`.
- "Where am I" reads a **fixed sentence** per screen (`accel/screens.ts`, `describeScreen`). It doesn't see what's on the screen.
- `AccelContext` (`actions.ts` ~L42) knows friends, friend requests, SOS and preferences, but **not** conversations, Learn, or what a screen is showing.
- **Nothing controls Conversation mode.** Its controls live inside `app/(app)/conversation.tsx`:
  - `chooseSpeaker` (Me / Them);
  - `composer.startListening`;
  - `composer.setSignMode`;
  - `handleSend` / `afterSend` (speaks messages);
  - `startNewConversation`, `confirmName`, `handleRename`.
  - Its data: `db/conversations.ts` (`listConversations`, `getMessages`).

**Design: a screen registry.** Screens tell Accel what they show and what they can do, so Accel never guesses.
- **New `frontend/src/accel/screenContext.ts`** with a hook, `useAccelScreen({ name, describe, commands })`, that a screen calls while it is in focus (`useFocusEffect`).
  - `describe()` returns a live, plain sentence or two ("You're on Home. You have 3 saved conversations; the newest is Ate Lyka, from today. Paul sent an SOS yesterday.").
  - `commands` maps an action id to a handler plus a spoken example ("start my turn").
  - The registry is a small module-level store that AccelProvider reads; a screen leaving focus removes its entry.
- **New intents** (in `catalog.ts`, `rules.ts`, `ai/intents.json`; keep `check-accel-catalog.mjs` and `accel-rules-check.ts` in sync; English and Filipino/Taglish examples):
  - `read.screen`: "what's on this screen", "describe this page", "ano'ng nandito". Speaks `describe()`, falling back to today's `screens.ts` sentence.
  - "what can I do here", "what can I say", "ano'ng pwede kong gawin dito" lists the screen's commands with their examples, then the commands that work everywhere ("go home", "send SOS", "read new messages"). _This is the existing `read.help`, not a new id (see "Checked in the code" below)._
  - `read.where_am_i` uses the live `describe()` when there is one.
  - Screen commands (below) are offered **only while that screen is open**. Asked elsewhere, Accel opens the screen first if that's safe ("start a conversation" → opens Conversation), or says where to go.
- **App only:**
  - Accel's action list is closed (the AI can only pick ids from the list, already enforced by the JSON schema and re-checked by the app).
  - New: anything about other apps, phone settings, calls (other than SOS) or the web gets one plain answer: "I can only help inside AccessAI."
  - SOS keeps its own text and call flow (part of the app).

**Decided (owner, 2026-10-13):**
- **"Full access" has limits.** Accel can go to, describe and use every screen. Sign out, delete account, unfriend, and change password or email stay blocked (`blocked.account`, "For your safety…"), and so does changing My needs by voice (§26).
- **Turn-taking:** after "my turn" / "their turn" and the message is sent, Accel stays quiet. The next command starts with "Hey Accel" or the Accel button. Accel doesn't open by itself, so it never picks up the other person's talk by mistake.
  - _(Replaces "Accel listens again after the message is sent" in Part B: "Hey Accel" simply resumes, as it does today.)_

**Checked in the code (2026-10-13):**
- **One command per opening.** `AccelProvider.handlePlan` → speak → `close()`. In `finish` (L238–251), `close()` runs before `outcome.after()`, so the mic is already free when `after` hands it to the Composer. Screen commands are ordinary `Plan`s, and the flow doesn't change.
- **"What can I say" already exists.** `read.help` catches "what can I say / what can I do / ano pwede" (`rules.ts` L65) and gives one fixed sentence (`actions.ts` L405).
  - Use **`read.help`** for "what can I do here": the screen's commands first, then the ones that work everywhere.
  - Don't add a `read.screen_actions` id: the old phrases keep working and the AI list stays smaller.
- **"Start a conversation" is already `nav.conversation`.** It's an example in `ai/intents.json`, and `rules.ts` L217 catches it. So the open screen's commands are matched **before** the global `RULES`, and on Conversation "start a conversation" starts a new one.
- **The AI already knows the screen.** `understand()` sends `describeScreen(pathname).name` (`AccelProvider` L319), and `interpret.py` L125 adds it to the prompt. Each screen intent's description in `intents.json` says which screen it belongs to, and the app re-checks it.
- **The Composer's controls are `ComposerHandle`** (`components/conversation/Composer.tsx` L32): `startListening`, `reset`, `setSignMode`, `showReplies`, `focusInput`.
  - "say quick reply 2" sends that reply through the same `handleSend`.
  - "say <text>" also goes through `handleSend` as Me, then is spoken (`speakMixed`) even when "speak my messages" is off.
- **Learn lesson:** `learn-lesson.tsx` has `selected` / `checked` / `next()` / `finish()`. The choices are `ChoiceGrid` (`onSelect`), and the camera step is `SignCheck` (`onSkip`).
  - With a screen reader or the Blind profile (`describe`), the lesson only has intro cards, "which sign do these steps make" questions and camera steps. Video picking and matching are left out (`lessons.ts` `canDo`).
  - So the voice commands only need: choose / check / continue / hear the steps / skip.
- **The Accel guide** (`accel-guide.tsx`) lists the catalog by category. Screen commands get one more category, "On this screen", with the screen's name next to each example.

**New intent ids (proposal; same ids in `catalog.ts` and `ai/intents.json`):**
- Everywhere:
  - `read.screen`;
  - `read.recent_sos` (§28);
  - `blocked.outside` → "I can only help inside AccessAI." Its rule comes after `sos.send`, so "call for help" is still an SOS.
- Home / Chats: `conv.open_last`, `chats.open` (slot: name), `chats.read_newest`.
- Conversation:
  - `conv.start` (slot: name), `conv.my_turn`, `conv.their_turn`;
  - `conv.say` (slot: text; must not catch "say that again" → `read.repeat`);
  - `conv.read_last`, `conv.read_all`;
  - `conv.quick_replies`, `conv.say_reply` (slot: number);
  - `conv.sign_mode` (slot: on/off), `conv.rename` (slot: name), `conv.end`.
- Learn:
  - `learn.next_lesson`, `learn.practice`;
  - `learn.choose` (slot: number or word), `learn.check`, `learn.continue`, `learn.hear_steps`, `learn.skip`.
- `catalog.ts` gets a `screen?: string` field. A screen intent is offered only while that screen has registered it.

**Part A — every page describes itself and lists what you can do.** Each screen registers `describe` and its main commands:

| Screen | Says (live) | Commands (examples) |
|---|---|---|
| Home | conversation count and newest; unread messages; friends' active/recent SOS (§28); shortcuts | "open my last conversation", "start a conversation", "open chats" |
| Chats | how many saved conversations, the 3 newest by name and date | "open Ate Lyka", "read the newest one" |
| Friends | friends online, unread chats, requests | "chat with Paul", "who's online" (exists) |
| A friend chat | the friend, unread count, last message time | "read their last message" (exists), "reply …" (exists) |
| Learn | course, level, next lesson and its signs, hearts, streak | "start the next lesson", "practise" |
| Learn lesson | the question and its choices, read out | "the first one" / "choose Thank you", "check", "continue", "hear the steps", "skip" |
| Settings pages | what this page changes and the current values | existing speech/text commands |
| Edit profile, Emergency contacts | the name / how many contacts | navigation only |

The Learn lesson commands let a blind learner answer quizzes by voice. They call the same handlers as the buttons.

**Part B — Conversation mode by voice.** Conversation registers these commands:
- "start a conversation" / "start a conversation called Ate Lyka";
- "my turn" (Me + start the mic);
- "their turn" (Them + start the mic);
- "say <text>" (sends as Me and speaks it aloud);
- "read what they said" (last Them message);
- "read the conversation" (last 5 messages, oldest first, "They said… / You said…");
- "quick replies" (lists them) / "say quick reply 2";
- "sign mode on/off" (for the other person);
- "rename it to …";
- "end the conversation" (saves and goes back).
- **The microphone has one owner at a time** (`audio/recognizer.ts`). "My turn" / "their turn" hand the mic from Accel to the Conversation composer. After the message is sent, Accel stays quiet until "Hey Accel" or the Accel button (owner, 2026-10-13). With "Always listening" on, "Hey Accel" can still interrupt.
- `describe()` for Conversation: the name, how many messages, who spoke last and when.

**Part C — the rest:** Add friend, Friend requests, Accel guide, Credits, Badges, Leaderboard, Practice get `describe` + navigation. Update `accel-guide.tsx` (the list of what Accel can do) from the catalog, as today.

**Offline:** Parts A–C run on the phone's own rules (`rules.ts`), so they work with no signal; the AI service only helps with unusual sentences, as today.

**Checks:**
- `accel-rules-check.ts`: new sentences for every new intent, English and Taglish, plus "open Facebook" / "call mom" → "I can only help inside AccessAI.";
- `check-accel-catalog.mjs`: app and AI lists match;
- a small registry check: a screen leaving focus removes its commands;
- phone, with TalkBack on and with it off:
  - "what can I do here" on every screen;
  - a full conversation using only voice;
  - one Learn lesson answered by voice.

---

## 28. Plan (owner, 2026-10-13): Home shows friends' recent SOS (last place and details)

**Built 2026-10-14**, as decided:
- `GET /api/sos/recent` (`listRecent`) and `components/sos/RecentSosCard.tsx` under the active SOS cards;
- saved per user in AsyncStorage (`sos:recent:v1:<id>`);
- refreshed when Home opens and when an SOS starts or ends;
- 13 new e2e checks in the `sos` suite.
- A friend's row also says who else answered ("On the way: Cara."). Only people who received that SOS see it.

**Owner's ask:** besides Friends, Home (the dashboard) should show the history of a PWD friend's last SOS: where they were and the SOS details, even after it ended.

**Today:**
- Home shows only **active** SOS cards (`components/sos/ActiveSosCards.tsx`, from `GET /api/sos/active`, `sosController.listActive` ~L333). They disappear when the SOS ends ("I'm safe", or after 24 h).
- Friends shows a friend's SOS only as the chat's last message ("Sent an SOS").
- **SOS records are kept** (`models/SOSEvent.js`; only an account deletion removes them). Each has:
  - `place`, `location`, `lastLocation`;
  - `status`, `resolvedAt`, `resolvedReason` (safe / expired / replaced);
  - `responses` (who answered, how, when);
  - `recipients` (the friends it was sent to);
  - `isTest`.
  - The index `{ recipients: 1, status: 1, createdAt: -1 }` already fits the query below.

**Build:**
- **Backend `GET /api/sos/recent`** (`protect`, in `routes/sosRoutes.js` + `sosController.js`):
  - **for friends:** for each friend who sent me an SOS (I'm in its `recipients`) in the **last 7 days**, their **latest** one, active or ended;
  - fields: name, when it happened (`occurredAt`/`createdAt`), `place`, last known location (+ accuracy), status, when and why it ended, who answered (names, "seen" / "on my way", when), `isTest`;
  - **for me:** my own latest SOS in the same window (when, where, who answered, how it ended), for PWD users;
  - **privacy:** only people who received that SOS **and are still friends** (an accepted `Friendship`); only the latest per friend; only 7 days. The location shown is the last one sent, never live tracking after the SOS ended. (Good for the panel's privacy criteria.)
- **Home: a "Recent SOS" card**, under the active SOS cards:
  - one row per friend: "Paul — SOS yesterday, 3:10 PM, near Dagupan City. Ended: said he's safe at 3:40 PM. You answered: On my way.";
  - "Show on map" (the same map link the SOS cards use) and "Open chat";
  - an active SOS stays in the big active card (not repeated here);
  - hidden when there's nothing in 7 days;
  - a test SOS is marked "Test".
- **Offline first:** the list is saved on the phone and shows its time ("Updated 10:42"). It follows the "show saved, refresh quietly" rule in `utils/cache.ts`. That file only has helpers and no storage, so save the last answer in AsyncStorage per user, like `saveSosOutbox` (`utils/sos.ts` L284), and use `keepIfSame` when it refreshes. It refreshes on Home focus and on the live SOS events FriendsProvider already receives (an SOS starting or ending).
- **Accel (§27):** Home's `describe()` mentions it; "who sent an SOS recently" reads the list.
- **Accessibility:** each row is one element with a full label; it's announced if an SOS arrives while Home is open (as today).

**Checks:**
- new e2e (`backend/scripts/e2e/run.js`, `sos` suite):
  - an ended SOS appears with its end reason;
  - only the latest per friend;
  - one older than 7 days is left out;
  - someone not in `recipients` never sees it;
  - an ex-friend's SOS (the friendship removed after it was sent) is left out;
  - my own last SOS appears for me only;
- phone: send a test SOS from a PWD account, end it with "I'm safe" → the friend's Home shows it with place and "safe".

**Decided (owner, 2026-10-13):**
- 7 days of history;
- PWD users also see their own last SOS;
- a test SOS is shown, marked "Test";
- only current friends: an ex-friend's SOS disappears from Home.

**Checked in the code (2026-10-13):**
- `routes/sosRoutes.js` has `protect` + `sosLimiter` on every route. `GET /recent` goes next to `GET /active` (any role, because friends can be non-PWD). The "my own" part is only filled for PWD (`req.user.role !== 'non_pwd'`).
- Build `listRecent` like `listActive` (`sosController.js` L333–388):
  - `namesById` for names, `newestLocation(event)` for the place;
  - query `{ recipients: me, createdAt: { $gte: 7 days ago } }`, newest first, then keep the first per `userId`;
  - drop senders who aren't friends now (`Friendship` `status: 'accepted'`, me as `requester` or `recipient`; both sides are indexed).
- A new SOS from the same friend ends the old one as `'replaced'`, so "latest per friend" never shows two.
- E2E: the "older than 7 days" case needs an event inserted with an old `createdAt` straight into the database (Mongoose `timestamps` would otherwise set it to now). Run it with `npm run e2e -- sos`.

---

## 29. Plan (owner, 2026-10-13): new speech cuts off the old one, so nothing piles up

**Built 2026-10-14**, as decided:
- in `utils/speechHelper.ts`: `speakMixed(text, { sos, owner, onEnd })` resolves true or false, and `stopMixed({ owner, sos })`;
- a stop also ends the clause that's playing, even on a phone that never reports the stop;
- the new `scripts/speech-check.ts` passes 16/16.
- Message bubbles keep their Stop button, flagged to the owner on 2026-10-13.

**Owner's ask:** when something starts speaking, whatever is already speaking stops. Tapping a read-aloud button many times must never pile up readings.

**Today (checked in the code, 2026-10-13):**
- All the app's own speech goes through `speakMixed` (`utils/speechHelper.ts` L216). **It doesn't stop what's already speaking.**
  - expo-speech queues every `Speech.speak`, so tapping "Read last message" 5 times reads it 5 times.
  - Each `speakMixed` speaks its message one clause at a time, so two readings can also mix together clause by clause.
- `stopMixed()` (L247) stops everything. Only a few places call it before speaking:
  - Learn feedback (`learn/useFeedback.ts` L25);
  - Accel when it opens (`AccelProvider` L177, L382, L405);
  - the Composer mic (`Composer.tsx` L183).
- Places that speak without stopping first:
  - Home "Read last message" (`(tabs)/index.tsx` L71);
  - the voice previews in Settings → Conversation and speech (`settings/speech.tsx` L41, L49) and in Settings → Accel (`settings/accel.tsx` L76);
  - "read it all" in the Accel guide (`accel-guide.tsx` L32);
  - Accel's own voice (`AccelProvider` L139) and its one-time intro (L459);
  - Conversation after a message is sent (`conversation.tsx` L280, L285);
  - message bubbles (`MessageBubble.tsx` L66);
  - alerts (`hooks/use-alerts.tsx` L91; kinds `message`, `sos`, `sos-update`);
  - SOS: `SosProvider` `tell` (L190), `SosFlow` `speakOrAnnounce` (L118), and the distance line in `SosAlertModal` (L69, which already waits for quiet).
- Some `stopMixed()` calls stop *whatever* is speaking, even speech that isn't theirs:
  - Accel's `close()` (L145) runs after Accel's last sentence, so it would cut off speech that started in the meantime;
  - a message bubble leaving the screen (L48).
- A bubble's `onDone` only runs when its reading finishes. If the reading is cut off, the bubble keeps showing "Stop".

**Decided (owner, 2026-10-13):**
- **The newest speech always wins**, including speech the user didn't ask for. For example, a new message read aloud as it arrives cuts off Accel or a bubble. The cut-off text is still on screen.
- **SOS speech can't be cut off.** It stops only when an SOS screen stops it (dismiss, I'm safe, cancel) or when newer SOS speech starts. Ordinary speech that starts during it is skipped, not queued.
- **Tapping the same button again restarts it:** the reading is cut off and starts from the beginning. Taps never pile up.

**Build (mostly `utils/speechHelper.ts`):**
- **`speakMixed` stops what's speaking first**, the way `stopMixed` does (bump `generation`, `Speech.stop()`), and then speaks.
  - Every caller gets "newest wins" and "the same button restarts it" without changes.
  - The old reading's clause loop already ends on the `generation` check.
- **SOS first:** `speakMixed(text, { sos: true })`.
  - While SOS speech is playing, ordinary `speakMixed` returns at once without speaking.
  - Callers that pass `sos: true`:
    - `SosProvider.tell`;
    - `SosFlow.speakOrAnnounce`;
    - the `SosAlertModal` distance line;
    - `use-alerts` for kinds `sos` / `sos-update`.
  - A plain `stopMixed()` doesn't stop SOS speech. The SOS screens' own stops do: `SosAlertModal.dismiss` L86 and `SosFlow` L235, with `stopMixed({ sos: true })`.
- **Stop only your own speech:** `speakMixed(text, { owner })`, and `stopMixed({ owner })` stops only if the current speech still belongs to that owner.
  - Accel's `close()` uses `owner: 'accel'`.
  - A message bubble uses its own key (a `useRef` id) for its Stop button and for leaving the screen.
- **Tell the caller when it was cut off:** `speakMixed` resolves `true` when finished and `false` when cut off or skipped, and `onEnd` runs either way.
  - Message bubbles use `onEnd`, so a cut-off bubble goes back to "Read aloud".
- **Accel cut off mid-question** (e.g. "Send to Ana: …?") **closes quietly** instead of waiting for an answer the person didn't hear. _(Default chosen; the owner can change it.)_
- **The message bubble's Stop stays.** While a bubble reads, its button turns into "Stop reading aloud" (`MessageBubble.tsx` L80, L102). That's an explicit Stop, so it still stops. Every other read-aloud button restarts when tapped again. _(Flagged for the owner: say if bubbles should restart too.)_
- **Conversation** (`afterSend`): if its speech is cut off, the turn still passes to the other person, in today's order.
- **Not in scope:** with TalkBack / VoiceOver on, most of these go to `announce()`, which is the screen reader's own voice. The app can't stop it, and the screen reader handles that itself.

**Checks:**
- A small check script, `scripts/speech-check.ts`, with a stand-in for `expo-speech`:
  - two `speakMixed` calls in a row → only the second is heard, and the first resolves `false`;
  - SOS speech, then ordinary speech → the ordinary one is skipped;
  - a plain `stopMixed()` doesn't stop SOS speech, and `stopMixed({ sos: true })` does;
  - `stopMixed({ owner: 'accel' })` doesn't stop someone else's speech.
- `npx tsc --noEmit`, `npx expo lint`.
- Phone, with TalkBack off:
  - tap Home "Read last message" 5 times fast → it restarts each time, and you hear it once in full at the end;
  - Settings → voice speed: tap through the speeds quickly → only the last one speaks;
  - two bubbles: tap A, then B → A stops (its icon goes back) and B reads;
  - Accel is answering when a friend's message arrives (read aloud on) → the message cuts Accel off, and Accel closes;
  - a friend's test SOS is being spoken when a new message arrives → the SOS keeps speaking, and the message isn't spoken (it's still shown and still vibrates).
