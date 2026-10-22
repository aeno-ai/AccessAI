# AccessAI — Handoff

_Last updated: 2026-10-21. Pick-up line for a new Claude session: **"Read HANDOFF.md — start with §54 'Where things stand (2026-10-21)': what's finished, what the owner still has to do, and the open decision (hybrid deployment). Details: §52 (new sign models, admin dashboard + Suspicious Activities, scalability through MongoDB + Spark, How-to-sign help, sign translator), §53 (Oracle Always Free deployment kit in deploy/oracle/), §51 (landing page). Older context: ★ Start here, §49 (on-phone sign reading), §50 (Test Buddy still has an ACTIVE SOS to the owner). The owner commits."**_

Ground rules every change follows:

- **Offline first.** Anything a PWD needs in the moment works with no signal. Online-only extras fail gracefully.
- **iPhone and Android**, with TalkBack and VoiceOver.
- **Expo Go stays usable.** Native-only features work in the development build and degrade gently in Expo Go.
- **Lightweight.** Prefer what's already in the stack.
- **Plain words** in everything a user sees or hears (no server, model, Expo or sync wording).

---

## ★ Start here — for a new Claude session (written 2026-10-13)

### ▶ Resume here (2026-10-17, night)

**Everything planned on 2026-10-17 is built and checked on the laptop (not on a phone): §30–§44.** Each section's "Built" note says what differs from its plan. §41–§44 were finished in the evening session (they had been half-built).

**Checks green (2026-10-17, night):**
- Frontend: `npx tsc --noEmit` clean, `npx expo lint` clean, `laya-rules-check` 222/222, `profiles-check` 16/16, `learn-check` 56/56, `speech-check` 16/16, `conversations-account-check` 16/16, `check-laya-catalog` OK (73 actions), `check-contrast` OK.
- Backend: full `npm run e2e` **215/215 with the AI service on** (new `admin` suite, new auth checks for activity records / logout / Terms, one `limit.hit` in `ratelimit`); `npm run rate-check` 15/15.
- AI: `python -m app.eval` **58/66 (88%)** — the bar was 50/58 (86%). The index rebuilt with 550 examples (73 intents). Misses (LLM only; the phone's rules catch several of these first): "balik tayo sa umpisa" → nav.back (wanted nav.home); "where can i see old talks" → read.older_messages (nav.chats); "read me what ana and i said to each other" → read.my_last_message (read.chat_with); "what was the last thing i told ben" → read.last_message_from (read.my_last_message); "ano yung sinend ko kay ana kanina" → msg.send (read.my_last_message); "open google maps for me" → nav.chats (blocked.outside); "pakitawagan ang tatay ko" → msg.send (blocked.outside); "put it in big letters so she can read: where is the comfort room" → nav.big_text (text.show_big). On Windows, run it as `$env:PYTHONIOENCODING="utf-8"; .venv\Scripts\python -m app.eval` (the ✓ marks crash the cp1252 console otherwise).
- Admin website: `npm run build` and `npm run lint` clean.
- The Word reports in `docs/` are rebuilt (17 October): §30–§44 written in (admin panel, activity log, Terms, Learn without XP, Home cards, Laya in Filipino, the tutorial, the compressed clips), plus a new `useractivities` collection in Part 3 and every new file in Appendix B. **Open each in Word → table of contents → Update Field → Update entire table, and save.**

**When you pick up:**
- **The server on port 3000 was still running the OLD backend code** (the new routes answered 404 there), so the e2e ran on a second copy at port 3100 (`$env:PORT=3100; node src/server.js`, then `$env:E2E_BASE_URL="http://localhost:3100"; npm run e2e`). **Restart `npm run dev`** before testing on a phone.
- The new e2e checks send a made-up address (`X-Forwarded-For: 198.18.x.x`, one per run) for their logins, so running the suite several times in a row no longer trips the login limit. The older auth checks still use the laptop's own address: after many runs within 15 minutes they hit 429 — restart the test server, as the suite says.

**Waiting for the owner (questions, not built):**
1. **Support contact.** Refusal messages say "Contact support if you think this is a mistake" and the Terms say "contact us", but there is no support email or page anywhere. What address should they show?
2. **SOS while suspended.** A suspended (or admin-deleted) account is signed out, so a suspended PWD has no in-app SOS (button, shake, or the offline SMS to emergency contacts) until it ends. Keep it that way, or let a suspended PWD account still send SOS?

**Phone tests still to do:** §46 (and §24–§29 above). No new native packages; clips need the next APK (expo-video) in the development build. `frontend/app.json` is now version **1.1.0** (sent to the server as `X-App-Version`).

The owner trimmed this file on 2026-10-13. The earlier sections (§1–§23: SOS, push, Accel, Learn, rate limits, reports…) are summarised below; the full text isn't in git (see "Not committed").

### Where things stand
- **Built and working on the laptop (2026-10-12/13), not yet tested on phones:**
  - Learn: real levels with local clips (`frontend/assets/signs/`, the clip list is made by `scripts/build-sign-clips.js` when Metro starts), locked placeholder levels, spoken step-by-step instructions for blind users;
  - the new logo (icons, splash, in-app), a 30-day login renewed when the app opens;
  - the new 125-word ASL model on the AI server;
  - admin roles: super admin and admin only;
  - Google accounts stay Google-only (no password can be made; Forgot password sends them nothing);
  - the Word reports in `docs/` (rebuilt 2026-10-13).
- **2026-10-17: §30–§44 built** — see "▶ Resume here" above and "Plans of 2026-10-17" at the end.
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

---

# Plans of 2026-10-17 (§30–§46)

The owner asked for all of these on 2026-10-17 and answered the open questions the same day. Build them in this order; each section can be built and checked on its own, except §42–§45 (admin log, suspend/delete, SOS records, Terms), which go to users together because the Terms describe the logging. No new native packages: gesture-handler 2.32 and reanimated 4.5 are already in the APK.

---

## 30. Plan (owner, 2026-10-17): Learn clips — compress the 24 recordings

**Built 2026-10-17.** The originals are 1920×1080, 28 fps, about 20 Mbps, 12–20 s. All 24 came out at CRF 26 between 0.75 and 1.41 MB (about 25 MB in all, from about 900 MB), 1280×720 at the original 28 fps (kept, not raised to 30), no sound. Frames checked by eye, also mid-movement: face, hands and fingers stay clear. `clips.ts` lists FSL 12, ASL 12. The script is reusable for new clips: same settings, see this section.

**Owner's ask:** the 24 recorded clips (`learn/ASL/*.mp4`, `learn/FSL/*.mp4`, 25–50 MB each) go into Learn, each under 10 MB, without getting too pixelated: the person and what they do must stay clear.

**Today:**
- `frontend/assets/signs/{asl,fsl}/*.mp4` are 0-byte placeholders with the right names (12 + 12).
- `scripts/build-sign-clips.js` lists every file over 1 KB into `src/learn/clips.ts`; Metro runs it on start. So replacing the placeholders is all Learn needs.
- `SignClip.tsx` plays clips muted, looped, `contentFit="contain"`.

**Build:**
- ffmpeg from winget (`winget install Gyan.FFmpeg`, owner's OK 2026-10-17).
- Each clip: short side 720 px (portrait or landscape), 30 fps, H.264 High, `yuv420p`, CRF 26, `-preset slow`, **no audio**, `+faststart`. Anything over 10 MB is redone at CRF 28.
- Names: "ASL - Thank You.mp4" → `asl/thank-you.mp4`, "FSL - Don_t know.mp4" → `fsl/dont-know.mp4`, "I_m fine" → `im-fine`, "You_re welcome" → `youre-welcome`, the rest lowercased with dashes.
- `learn/ASL/` and `learn/FSL/` go in `.gitignore` (about 900 MB; only the small copies are committed).

**Checks:** every clip ≤ 10 MB; `clips.ts` lists 12 FSL + 12 ASL; a few clips checked by eye. Playback in the development build needs the next APK (already planned for `expo-video`).

---

## 31. Plan (owner, 2026-10-17): the push token loop (`[api] [400] PUT /api/push/token: request.aborted`)

**Built 2026-10-17**, as planned. `registerForPush(userId, device?)` runs one at a time and remembers the device→Expo token pair (`push:device:v1`); the listener ignores an event carrying the token it already has. e2e push 7/7 (2 new: the same token twice, and 5 saves at once, each leave one entry). Still to see on a phone: no `request.aborted` after reloads.

**Owner's ask:** why does that line show after running the app?

**Found (2026-10-17):**
- `notifications/use-push-notifications.ts` L39–40 runs `registerForPush`, and runs it again on every "push token" event.
- In expo-notifications on Android, every token request also fires that event (`PushTokenModule.kt` L68–69: `promise.resolve(token); onNewToken(token)`). So registration loops for as long as someone is logged in, calling Expo's server each round.
- Until the first save succeeds, rounds overlap, each with its own `PUT /push/token`. A reload in development cancels one halfway through its body; the backend's body reader reports `request.aborted` (400), logged by `app.js` L176.
- The line itself is harmless (nothing is saved). The loop isn't: battery, data, and possible duplicate tokens → duplicate notifications (`pushController.registerToken` does three updates then a `$push`, not atomic; `utils/push.js` sends to every entry).

**Build:**
- `push.ts`: one registration at a time; get the device token once and pass it to `getExpoPushTokenAsync({ projectId, devicePushToken })`; remember the device→Expo token pair so the same device token never calls Expo again; export the last known device token.
- The listener re-registers only when the event's token is new.
- `registerToken`: one atomic pipeline update (`{ updatePipeline: true }` on Mongoose 9), at most `MAX_PHONES`.
- `tokensOf`: no duplicate tokens.
- `app.js`: `request.aborted` isn't logged.

**Checks:** e2e push: the same token twice, and 5 PUTs at once, leave one entry. Phone: reload a few times → no `request.aborted`.

---

## 32. Plan (owner, 2026-10-17): Accel is now Laya

**Built 2026-10-17**, as planned. `git mv` of the folder/files; a script replaced Accel → Laya in every tracked text file except `HANDOFF.md` (older sections are history), `hooks/use-shake.ts` (accelerometer) and the "accell" spelling. Saved settings move over in `src/utils/prefsMigration.ts` (called by `fromSaved`), with new `layaRenameNoticeDone` (people who heard Accel's intro hear once "I'm Laya. I used to be called Accel…"). `LAYA_AI_TIMEOUT_MS` (old name still read), error code `LAYA_OFFLINE`. `docs/source/*.js` text changed; the Word files were rebuilt on 2026-10-17 (night).

**Owner's ask:** the voice assistant's name becomes **Laya** everywhere ("Hey Laya").

**Decided (owner, 2026-10-17):** rename everything — code, folders, routes, command ids, AI service, docs — and move saved settings over so nobody loses theirs.

**Build:**
- `frontend/src/accel/` → `frontend/src/laya/`; `AccelProvider`, `useAccel`, `useAccelScreen`, `AccelContext`, `AccelVoice`, `callAccel`, `spellAccel`, `keepAccel` → `Laya…`; the speech/mic owner tag `'accel'` → `'laya'` (also `scripts/speech-check.ts`).
- Routes `/settings/accel` → `/settings/laya`, `/accel-guide` → `/laya-guide`.
- Command ids `nav.settings_accel` / `nav.accel_guide` → `nav.settings_laya` / `nav.laya_guide` (catalog, rules, `ai/intents.json`; the backend reads that file).
- Scripts `accel-rules-check.ts` → `laya-rules-check.ts`, `check-accel-catalog.mjs` → `check-laya-catalog.mjs`.
- Saved settings: `accelEnabled/WakeWord/Smart/Voice/IntroDone` → `laya…`, copied over in `fromSaved` (new `utils/prefsMigration.ts`). The Blind rule only fires when neither name exists. People who had heard Accel's intro hear once: "I'm Laya — I used to be called Accel."
- Backend: `LAYA_AI_TIMEOUT_MS` (the old name still works), `LAYA_OFFLINE`, the limiter and validator messages.
- Text: permission prompts (`app.json`), every on-screen and spoken line, the AI service's docs and logs, `docs/source/` (Word files rebuilt).
- **Left alone:** `hooks/use-shake.ts` (that's the accelerometer).

**Checks:** all frontend checks; `profiles-check` gets settings-migration cases; backend e2e.

---

## 33. Plan (owner, 2026-10-17): "Hey Laya" (wake word)

**Built 2026-10-17**, as planned (`laya/language.ts` `findWakeWord`: greeting required; `WakeMatch.greeting` 'en'/'fil'; loose names skip friends' first names; `removeWakeWord` also strips a bare leading "Laya,"; the old `strict` option is gone because a greeting is always required). `wakeWord.ts` passes the greeting to `onWake(remainder, greeting)`. Still listens with the English recognizer — test "Uy Laya" on a phone.

**Owner's ask:** "Hey Accel" becomes "Hey Laya", and Filipino speakers can call her the same way.

**Decided (owner, 2026-10-17):** a greeting is **required** — "laya" is an everyday Filipino word (malaya, kalayaan).

**Build (`laya/language.ts`, `wakeWord.ts`):**
- Greeting: hey, hi, hello, ok/okay, uy/ui/huy, hoy/oy/oi, yo (and "we", how an English recogniser often writes "uy").
- Name: laya, layah, laia, leya, liya, "la ya", "hilaya". Looser sound-alikes (leia, layla, lyla, lea…) count only when they aren't a friend's first name, so "Hi Layla" in a chat isn't swallowed.
- The match says which greeting was used, so "Uy Laya" alone gets a Filipino "Ano 'yon?".
- Name hints: "Hey Laya", "Laya", "Uy Laya", "Hoy Laya".

**Checks (`laya-rules-check.ts`):** wakes on "hey laya", "uy Laya", "hilaya", "okay Leia"; never on "laya", "malaya", "kalayaan", or "hi Layla" with a friend called Layla.

---

## 34. Plan (owner, 2026-10-17): Laya speaks Filipino

**Built 2026-10-17.** Every spoken line is in `laya/phrases.ts` (`P`, `inLang`, `listOf`); `commandLanguage(text, greeting)` in `language.ts`; the Filipino word list moved to the pure `utils/clauses.ts` (speechHelper re-exports it; a few markers added: si/ni/kay/sina/bagong/usapan…). `LayaContext.lang`; screen registry entries now take `lang` (`describe(lang)`, `examples(lang)`, `commands[id](slots, lang)`); screen tips moved to the pure `laya/screenTips.ts`; `utils/dates.ts whenTextIn(lang, ms)`. The sheet's Yes/No say Oo/Hindi. Guide: a "Subukan" button for each Filipino example and "Basahin sa Filipino". Every catalog entry has a Filipino guide example and the rules check proves the phone understands each one offline (new rule words: tanggihan, paliitin, mag-practice ng signs, "settings ng alerts", "sino ang makakatanggap", "basahin ang pinakabago", "pangalawang quick reply"; the guide's Filipino for "show me what you can do" is "Ipakita ang lahat ng kaya mo"). **Left in English (on purpose):** the speech-to-text error messages (written for the screen) and `friendRecentText` in "who sent an SOS recently". The intro is English plus "Puwede mo rin akong kausapin sa Filipino."

**Owner's ask:** Laya can be talked to in Tagalog, and Filipino speakers use her just like English speakers.

**Today:** commands already work in Filipino/Taglish (phone rules and the AI), but every line Laya says is English. There's no language setting.

**Decided (owner, 2026-10-17):** she answers in the language of the command — Tagalog/Taglish → Filipino, English → English. No setting.

**Build:**
- `laya/phrases.ts`: every spoken line as `{ en, fil }`.
- `commandLanguage(text)` decides per command; a bare "Uy/Hoy Laya" sets Filipino; a tap on the button keeps the last language; yes/no answers keep the question's language. Yes/No buttons say "Oo" / "Hindi".
- Covered: `actions.ts`, `screens.ts`, the screen registry, the commands of Conversation, Chats and a Learn lesson, the speech messages. The intro adds "Puwede mo rin akong kausapin sa Filipino."
- The guide gets a Filipino example for every command; `ai/intents.json` and `eval.jsonl` get more Filipino sentences.

**Checks:** every Filipino line reads as Filipino to `speakMixed`; "buksan ang settings" → Filipino answer; "open settings" → English; `python -m app.eval`.

---

## 35. Plan (owner, 2026-10-17): drag the Laya button anywhere

**Built 2026-10-17** (`laya/LayaButton.tsx`, uses Reanimated `.get()/.set()` for the React Compiler lint). Differs from the plan: instead of configuring the drawer's gesture, the button snaps 36 px in from the left edge (the drawer's swipe strip is 32 px), so a drag never opens the menu. Keeps above the tab bar (`hooks/use-tab-bar-height.ts`, measured by the tabs layout) and at least 150 px above the bottom. Saved in `prefs.layaButton`.

**Build (`laya/LayaButton.tsx`):**
- A drag (gesture-handler `Pan`) around the same button, so tap and TalkBack double-tap still open Laya.
- On release it snaps to the nearest side, inside the safe area, above the tab bar and message boxes. No spring with reduce motion on.
- The position is remembered on the phone (`prefs.layaButton`). Default: today's spot.
- Screen readers get "Move to the left side / right side / up / down" actions.
- The drawer swipes open from the left edge; the button's drag wins there.

**Checks:** phone, TalkBack on and off, gesture navigation on: drag, restart, it's where you left it.

---

## 36. Plan (owner, 2026-10-17): the same header on all 5 tabs

**Built 2026-10-17** (`components/ui/TabHeader.tsx` on Home, Chats, Friends, Learn, Settings; Home's profile button removed).

**Owner's ask:** remove the profile button at the top right (the menu already has "Edit profile"), and should the header be on every page?

**Checked (2026-10-17):** the top-right button and the menu's "Edit profile" both open `/profile`, no params. Only Home has the ☰ button; elsewhere the menu only opens with a left-edge swipe, which TalkBack takes over.

**Decided:** ☰ "Open menu" on Home, Chats, Friends, Learn and Settings, first in reading order, with the page title as a heading (best for TalkBack). Inner pages keep their back arrow. The profile button goes.

**Build:** `components/ui/TabHeader.tsx` (menu, title, right-side action or a spacer); Home keeps the logo and wordmark.

---

## 37. Plan (owner, 2026-10-17): Home cards, each one different

**Built 2026-10-17.** `constants/profiles.ts` (`STANDARD_SHORTCUTS` big-text / sign-camera / quick-replies / learn; Blind adds read-last after them; `ConversationAction` is now only 'listen' | 'replies'); `components/conversation/BigTextHost.tsx` (`useBigText().show(text?)`); `app/(app)/sign-camera.tsx` (reuses `SignPanel size="full"`, `utils/signedText.ts polishSigned` now shared with the Composer; after speaking it offers "Say it again" and "Big text"). New intents `nav.big_text`, `text.show_big`, `nav.sign_camera` in `catalog.ts`, `rules.ts`, `actions.ts`, `ai/intents.json` (73 intents) and `eval.jsonl` (+8 lines).

**Owner's ask:** the four Home cards (Live captions, Type to speak, Sign language, Quick replies) mostly open the same Conversation page. Every card should be unique.

**Decided (owner, 2026-10-17) — the cards for everyone:**
1. **Big text** — today's "Show on screen" (until now only for Deaf and Mute), renamed and for everyone. Laya opens it, with words too: "show big text I need to pee" / "ipakita nang malaki: kailangan kong mag-CR".
2. **Sign language** — a new camera screen, not Conversation: it reads signs one after another and shows them big. After a 2.5 s pause the AI fixes the grammar (the same tidy-up as sign mode: `gloss`, or `spell` for letters) and the sentence is **spoken by itself**. If the AI can't help, the plain words are spoken. Needs internet; nothing is saved.
3. **Quick replies** — as today.
4. **Learn signs** — opens Learn.
- Live captions and Type to speak are removed. Blind / low vision keeps one extra: "Read last message". "Talk", Deaf's "Live captions" and "Sign mode", and Mute's extras go.
- "Show on screen" is called "Big text" everywhere (also when you press and hold a message).

**Build:**
- `BigTextHost` in `(app)/_layout` with `useBigText().show(text?)`.
- `(app)/sign-camera.tsx`, sharing the signed-words code with the Composer (`hooks/use-signed-text.ts`).
- Laya: `nav.big_text`, `text.show_big` (with the words, no yes/no), `nav.sign_camera`; "learn signs" joins `nav.learn`. Big-text rules come first, so "show big text help me" isn't an SOS; a plain "ipakita …" is matched late so "ipakita ang mga kaibigan ko" still opens Friends.

**Checks:** `profiles-check` (cards), `laya-rules-check` (big text cases), `check-laya-catalog`, `app.eval`.

---

## 38. Plan (owner, 2026-10-17): Learn, cut down

**Built 2026-10-17**, as planned (`learn/progress.ts` now only `courseProgress`; LearnProvider drops hearts/goal and ignores them in old saves; `learn-badges.tsx` deleted; LessonComplete shows only "done" lines). Backend leaderboard counts distinct `course:lessonId` this week and still returns `xp` for old apps. e2e learn 12/12.

**Owner's ask:** fewer numbers in Learn. Remove XP and streaks, the badges; keep the leaderboard. Remove "You learn the signs AccessAI can read…".

**Decided (owner, 2026-10-17):**
- Also removed: levels, the daily goal (both are XP) and **hearts** (no penalty, lessons never locked).
- The leaderboard ranks by **different lessons finished this week** (replaying one doesn't count twice).
- Practice and Credits stay.

**Build:**
- App: `learn/progress.ts`, `LearnProvider.tsx`, `learn.tsx`, `learn-lesson.tsx`, `LessonComplete.tsx`, `learn-leaderboard.tsx`; `learn-badges.tsx` deleted; Laya's Learn sentence no longer mentions hearts or streak.
- Backend: `getLeaderboard` counts distinct `lessonId`s; `xp` becomes optional in the model and validator (old app versions still send it and still see XP).

**Checks:** `learn-check`; e2e learn (ranking by lessons, a completion without xp is saved).

---

## 39. Plan (owner, 2026-10-17): onboarding applies Blind right away

**Built 2026-10-17** (`OnboardingPager.selectOption` applies the profile and asks for the mic when Blind is picked; `finishOnboarding` only saves the choice).

**Owner's ask:** choosing Blind in onboarding should apply its settings straight away.

**Today:** they're applied, but only on the final "Get started" (`OnboardingPager.finishOnboarding`).

**Build:** apply the profile as soon as an option is picked (picking another applies that one), and ask for the microphone when Blind is picked — so the rest of onboarding is already big, high-contrast, with Laya on.

---

## 40. Plan (owner, 2026-10-17): a first-time tutorial

**Built 2026-10-17.** `src/tutorial/`: `targets.ts` (`useTourTarget(id)`, `setTourTarget`, `measureTarget`), `tours.ts` (the steps, pure), `TutorialProvider.tsx` (`useTour(page, ready)`, waits for SOS / Big text / Laya sheet, blocks the mic with 'tutorial', saves `prefs.tutorialSeen`), `TutorialHost.tsx` (4 dim rectangles + ring + card; off-screen targets get the card alone). Targets wired on Home (menu, greeting, cards, SOS, tab bar, recent), Laya button, Conversation (Me/Them + Composer `tourTargets`), Friends (Add), Add a friend (code, share, input, scan), Learn, Settings rows; Settings → Help → "Show the tutorial again". Laya's own intro now waits until Home's tour is done. **Differs from the plan:** with the Blind profile Laya speaks each step and a tap anywhere goes on, but "Hey Laya, next / skip" was NOT built ("Hey Laya" is paused during a tour). The tour also waits for the Terms screen (added with §44).

**Owner's ask:** after the first login or sign-up, a tutorial: everything dimmed, one control lit up, a short plain explanation, "tap to continue", on each main page. With Blind chosen, Laya is the tutorial: she speaks what's lit up.

**Decided (owner, 2026-10-17):**
- On the first visit of each page, for new **and** existing accounts (once). Every step can be skipped. Settings: "Show the tutorial again".
- Home: menu (your account options), greeting card, the cards, the Laya button, the SOS button (PWD only), the bottom tabs, Recent conversations.
- Conversation: Me/Them (who's talking, and why), Sign, Quick replies, the mic, "a message can be read aloud", and "conversations are saved so you can go back to them".
- Friends: you chat with friends online; Add friend → the Add a friend page: your QR and code, "Share my code", adding someone's code or scanning theirs.
- Learn: everything on it. Settings: My needs, Laya (an assistant to help you use the app by voice), Display & text, Conversation & speech, Sign language, Quick replies.

**Build (`src/tutorial/`):**
- A spotlight from four dim rectangles around the measured control (no SVG), in a transparent Modal; a card with "2 of 6", Next / Got it, Skip.
- Screen readers: the step is announced and focused. Blind profile: Laya speaks each step instead (not both); a tap anywhere is Next; "Hey Laya, next / skip" works.
- Waits for SOS alerts, Laya, Big text and the Terms screen; "Hey Laya" pauses during a tour; Laya's own intro waits until Home's tour is done.
- Saved per account on the phone (`prefs.tutorialSeen`).
- _Default chosen: no Chats tour (not asked for)._

**Checks:** phone with TalkBack, with VoiceOver, and with the Blind profile without a screen reader.

---

## 41. Plan (owner, 2026-10-17): admin activity log (part 1 of the admin work)

**Built 2026-10-17 (§41–§44 together).**
- Backend: `models/UserActivity.js` (90-day TTL), `utils/activityLog.js` (never waits, never throws; one limit hit per person per limit per minute), records in `authController.js` and `googleAuthController.js` (login success / failed with the reason / refused with the code, signup, email verified, password reset / changed, email changed, deletion asked / cancelled) and in every limiter (`rateLimiter.js` `limited(name, …)`, the token bucket's `onRefuse`). A failed `/auth/restore` counts as a failed login. `POST /api/auth/logout` (optional `deviceId` → that push address goes; `pushController.removePushDevice`).
- App: `api/apiClient.ts` sends `X-App-Platform` and `X-App-Version` (`app.json` 1.1.0). `use-bootstrap.tsx`: the menu's Sign out calls `/auth/logout` (3 s, offline still signs out) then `endSession()`; a 401 calls `endSession()` only (no logout call, no loop). `notifications/push.ts`: `unregisterPush` is local only now, `pushDeviceId()` feeds the logout call.
- _Defaults chosen:_ the server's 401 / socket close are shown, not guessed — see §42.

**Owner's ask:** admins can see when people log in and out, and who to block if they spam or act suspiciously.

**Decided (owner, 2026-10-17):** logged — logins (and failed ones, with the reason), logouts, sign-up, email verified, password/email changed, password reset, deletion asked/cancelled, and limit hits (too many messages, friend requests, codes, SOS, Laya commands). Each with phone type, app version and IP address. _(Default: kept 90 days, erased with the account.)_

**Build:**
- `models/UserActivity.js` (90-day TTL), `utils/activityLog.js` (never throws; at most one limit-hit record per person per limit per minute).
- Recorded in the auth and Google controllers and the rate limiters.
- New `POST /api/auth/logout` (the app calls it when signing out, when online; it also removes the phone's push address).
- The app sends `X-App-Platform` and `X-App-Version`; `app.json` version 1.1.0.

---

## 42. Plan (owner, 2026-10-17): suspend, and delete in 30 days (part 2)

**Built 2026-10-17.**
- `utils/accountState.js` (`usableFilter`, `refusalFor`) is the one rule, used by `verifyUserToken` (REST + socket), friends, Learn, chats, the SOS circle and push. Login, verify email, forgot / reset password, restore, Google exchange and Google restore all use `refusalFor`, and erase a deletion that's due **before** refusing. An admin deletion never gets a `restoreTicket`, and `/restore` + `/google/restore` refuse it (`ACCOUNT_DELETION_BY_ADMIN`). The person's own deletion now stores `deletionBy: 'user'`; restoring clears it.
- Admin API (`routes/adminUserRoutes.js`, `controllers/adminUserController.js`): `POST/DELETE /users/:id/suspend` (`days` 1 | 7 | 30, `reason` required ≤ 300; permission `users:suspend`, both roles), `POST/DELETE /users/:id/deletion` (`reason` required; `users:delete`, super admin only; erased by the usual hourly job after 30 days), `PATCH /:id/status` only reactivates now (`isActive: false` → 400 "use Suspend or Delete in 30 days"). Each lock calls `realtime/io.js disconnectUser` and `notifyFriendsChanged` (friends and pending requests reload); lift / cancel / reactivate tell friends too. Every action goes to `AdminAuditLog` (`user.suspend`, `user.suspend.lift`, `user.delete.schedule`, `user.delete.cancel`, `user.reactivate`). `toAdminView` has `status` ('active' | 'suspended' | 'deleting' | 'deactivated'), the suspension and deletion dates and reasons; the user list filters by those statuses (`inactive` still means deactivated).
- App: a 401 with `ACCOUNT_SUSPENDED` / `ACCOUNT_DELETION_BY_ADMIN` signs out and the login screen shows the message in a box (`useBootstrap().signOutNotice`, cleared at the next login). When the server closes the live connection (`io server disconnect`), `FriendsProvider` asks `/auth/me` at once, so the person sees why within a second instead of at their next tap. Login and Google show the 403 message (the deletion prompt only opens for `ACCOUNT_PENDING_DELETION`). `apiClient` shows server messages up to 500 characters (was 300) so a long reason isn't swapped for "Something went wrong".
- Admin website: user page with status badge and notes, Suspend (1 / 7 / 30 days + reason), Lift, Delete in 30 days / Cancel deletion (super admin), Reactivate (old deactivated only); the Users list shows the status and filters by it (Deactivate is gone from the row). `UserStatusDialog` was replaced by `UserActionDialog`, `SuspendDialog`, `DeleteDialog`.
- _Defaults chosen:_ (1) "Cancel deletion" only undoes an admin's deletion; a deletion the person asked for is theirs to cancel (400 with that message). (2) An admin's "delete in 30 days" replaces a deletion the person had asked for. (3) A deactivated or admin-deleting account can't be suspended (409); the panel offers Suspend only when not suspended (lift first to change it — the API itself replaces an existing suspension). (4) The admin-deletion message shows the date, not the reason (the dialog says so); a suspension shows both. (5) A right reset code on a refused account shows the refusal instead of "wrong code".
- **Suspend** for 1, 7 or 30 days, with a reason. **Delete in 30 days** replaces Deactivate: the account is locked at once ("This account will be deleted on <date>. Contact support."), only an admin can undo it, and after 30 days it's erased like a user's own deletion. Friends stop seeing them right away.
- Both admin roles can suspend; only a super admin can delete or undo a deletion.
- Old deactivated accounts stay blocked and show as "Deactivated (old)", with Reactivate.
- _Default: the suspended person sees the end date and the reason._

**Build:**
- One "usable account" rule (`utils/accountState.js`) used by the token check (HTTP and the live connection), friends, Learn, the SOS circle and push. Open connections are closed when an admin acts.
- Login and restore refuse an admin deletion (only "Keep my account" cancels a user's own deletion, never an admin's).
- The app shows why it was signed out.

---

## 43. Plan (owner, 2026-10-17): SOS records and "Needs a look" (part 3)

**Built 2026-10-17.** `controllers/adminRecordsController.js` + `routes/adminRecordsRoutes.js` (mounted at `/api/admin`, checks on each route): `GET /activity?type=&ip=`, `GET /sos?kind=real|test&unanswered=true`, `GET /review`, and per person `GET /users/:id/activity`, `GET /users/:id/sos` (with real / test counts). SOS records are read with a fixed `select` (`SOS_FIELDS`) that never loads `location`, `lastLocation`, `place` or `message`, and sent as a fixed shape (sender, sent at, test or real, friends alerted, answers by name with kind and time, `noOneAnswered`, ended how and when); the e2e walks every key of the answer. "Needs a look" uses the plan's default thresholds (`REVIEW_SIGNS`); limit hits are counted in different minutes. Opening someone's activity or SOS is recorded (`user.activity.view`, `user.sos.view`). Admin website pages: Needs a look, Activity (filter by type, click an address to see everything from it), SOS (real / test, only unanswered); menu links by permission (`activity:read`, `sos:read`, both roles).
- _Defaults chosen:_ the first page of the everyone-lists (Activity, SOS) is recorded too (`activity.list.view`, `sos.list.view`), not only a person's own records.
- Admins see each SOS: who sent it, when, test or real, how many friends were alerted, who answered and when, when it was marked safe or ran out, and the ones **no one answered**. Also per account: how many SOS they sent. **Never the place, location or message.**
- A "Needs a look" list flags accounts with warning signs; nothing is blocked by itself, an admin decides. _(Default flags, per 24 h: 10+ failed logins on an account or 20+ from one IP; limits hit in 5+ different minutes; 3+ real SOS; 20+ friend requests.)_
- Admins opening someone's logs or SOS is itself recorded.

**Build:** admin routes for activity, SOS and the review list; admin pages Activity, SOS, Needs a look; the person's page gets their SOS, their activity, Suspend / Lift, Delete in 30 days / Cancel deletion.

---

## 44. Plan (owner, 2026-10-17): the Terms, updated (part 4)

**Built 2026-10-17.** `frontend/src/constants/legal.ts` rewritten in the team's voice (8 sections: new "Use AccessAI fairly" rule, login and activity records, Learn, what admins can and can't see, "If someone misuses AccessAI", 90 days, and "Hey Laya" described like the microphone: on the phone when it can, else the phone's speech service, audio never kept). `TERMS_VERSION` = '2026-10-17' in both `legal.ts` and `backend/src/constants/legal.js` (`ADMIN_DELETION_DAYS`, `ACTIVITY_RETENTION_DAYS` added to `legal.ts` too). Backend: `GET /auth/me` returns `needsTerms` and `termsVersion`; `POST /auth/terms {version}` (409 `TERMS_OUTDATED` for another version). App: `components/legal/TermsUpdateHost.tsx` inside `(app)/_layout` (under Laya, over the tour): "We updated our Terms" with 4 plain lines on what changed, "Read the full Terms" (expands in place), I agree / Sign out. `TutorialProvider` waits while it checks or shows (`useTermsUpdate().pending`); Laya's intro already waits for Home's tour.
- _Defaults chosen:_ (1) It only shows when the app's own Terms version is the one the server asks for (an older app can't show the new wording, so it doesn't ask). (2) If "I agree" can't reach the server, it steps aside and asks again when the app next comes to the front — it never blocks the app offline. (3) "Hey Laya" rests while it's up, and with the Blind / low vision profile and no screen reader, it's read aloud ("tap I agree at the bottom…"). (4) New sign-ups never see it (they agree to the current version at sign-up).
- Written as AccessAI ("we"), casual and plain.
- People with an account **agree once** on their next app open ("We updated our Terms", "I agree").
- Changes: we collect login and activity records (IP, phone type, app version, limit hits); we use them to keep AccessAI safe and spot spam or misuse; admins can see those records and the SOS records — never the place, location or message; records are kept 90 days; misuse can mean a suspension or deletion in 30 days. "Hey Laya" is described truthfully (on the phone where it can, otherwise the phone's speech service; audio is never kept).

**Build:** `TERMS_VERSION` bumped on both sides; `/auth/me` says `needsTerms`; `POST /auth/terms`; the "We updated our Terms" screen sits inside the app (so shake-to-SOS still works) and never shows offline.

---

## 45. Plan (owner, 2026-10-17): checks for §30–§44

**Done 2026-10-17 (night), all green** — results in ★ Start here → "▶ Resume here". The new e2e checks are in `backend/scripts/e2e/run.js`: `auth` (activity records with phone type / version / address, logout and its push address, `needsTerms`, `/auth/terms`, deletion asked and cancelled, erasing an account erases its records) and the new `admin` suite (permissions, validation, suspend → socket closed, friend told, 401 with the reason, reconnect refused, friend list hides them, login refused and recorded; lift; delete in 30 days → login and "Keep my account" refused, admin can't cancel, super admin can; SOS records with no place / location / message anywhere; per-person records and their audit entries; "Needs a look" at 10 vs 9 failed logins and 20 vs 19 per address; an admin deletion erased by `purgeExpiredAccounts` when due; an admin can't cancel a person's own deletion). `helpers.js` gained `makeAdmin`, `adminApi`, `runAddress`, and `api(…, headers)`.

- Frontend: `npx tsc --noEmit`, `npx expo lint`, `learn-check`, `laya-rules-check`, `speech-check`, `profiles-check`, `conversations-account-check`, `check-laya-catalog`, `check-contrast`.
- Backend: `npm run e2e` (AI service on) — push duplicates, activity records, logout, Terms, Learn ranking, limit hits, and a new `admin` suite (suspend and lift, delete in 30 days blocks login and restore and is erased when due, SOS records never include place/location/message, the review list, permissions); `rate-check`.
- AI: `python -m app.eval` (no worse than 50/58). Admin: `npm run build`, `npm run lint`.

## 46. Phone tests for §30–§44 (TalkBack on and off)
- "Hey Laya" and "Uy Laya"; a Filipino command gets a Filipino answer; "malaya" in a conversation doesn't wake her.
- Drag the Laya button; restart; it's still there.
- The four Home cards each go somewhere different; "Hey Laya, show big text I need to pee".
- The sign camera speaks a fixed-up sentence.
- Learn: no XP, hearts or streak; the leaderboard counts lessons; clips play.
- ☰ on every tab; the tutorial on each page; the Blind version led by Laya.
- No `request.aborted` after reloading.
- The Terms screen appears once for an existing account (not for a new sign-up), with TalkBack and with the Blind profile (read aloud); offline, it doesn't appear; shake-to-SOS still works while it's up; the tour starts only after "I agree".
- Sign out from the menu → the admin panel's Activity shows "Logged out" with the phone and app version 1.1.0.
- Admin panel: suspend an account while its app is open → the phone signs out within a few seconds and the login screen says until when and why; its friend's list drops it. Lift it, then delete in 30 days (login says the date, no "Keep my account"), then cancel it.
- Admin panel: the SOS page shows a test SOS from the phone with who answered, and never the place.

---

# Plans of 2026-10-18 (§47–§48)

## 47. Plan (owner, 2026-10-18): hide or show every network address in the admin panel

**Built 2026-10-18.** One "Show addresses" / "Hide addresses" button (`admin/src/components/AddressToggle.tsx`, `aria-pressed`) on Activity, a person's Activity section and "Needs a look"; all three share one switch (`components/AddressVisibilityProvider.tsx` in `Layout`, `hooks/useAddressVisibility.ts`). Hidden addresses show as `•••••••` (screen readers: "Address hidden") through `components/Address.tsx`; the Activity search box shows dots while hidden. Only the screen changes — the server still sends the addresses.
- **Decided (owner):** hidden by default each visit; remembered for the browser tab (`sessionStorage`), hidden again when the tab closes or at Log out.
- _Default chosen:_ "Needs a look" keeps a "See its failed logins" link on an address entry, so it can still be opened while hidden.
- **Checks:** admin `npm run build` and lint clean. To see on the laptop: hidden at first on all three pages; one click shows every row everywhere; a refresh keeps it; Log out (or a new tab) hides them again.

## 48. Learn clips: "Videos can't play in this version of the app yet." (owner, 2026-10-18)

**Found:** not a file-path problem. The 24 clips are in `frontend/assets/signs/{fsl,asl}/` (0.75–1.41 MB), `src/learn/clips.ts` lists all 24 with the right paths, and `lessons.ts` matches them by `sign.clip`. That message appears only when the installed app has no video player (`SignClip.tsx`: `requireOptionalNativeModule('ExpoVideo')` is null). `expo-video` (~57.0.5) was added after the last development APK (it isn't in `frontend/package.json` at commit `271134a`), so the APK on the phone doesn't have it.

**Fix: the next development APK** (owner's OK before any EAS build):
1. Before building (as planned in ★ Start here → "Next APK"): update `expo`, `expo-router`, `expo-splash-screen` together (owner's OK first), and switch `frontend/.env` back to the Tailscale line.
2. `cd frontend` → `eas build --profile development --platform android`, install it.
3. Until then, clips can be checked in **Expo Go** (it already has the video player).

**Checks:** a Learn lesson plays its clip muted and looping, with Replay and 0.5×; with no internet too.

## 49. Plan (owner, 2026-10-18): sign language on the phone (live landmarks + on-phone model, Android first)

**Why:** in sign mode the owner "can't even get detected". The models are fine in the laptop tester (live webcam, MediaPipe on every frame); the app recorded 2-second 480p pieces and uploaded them (blurry hands, gaps between pieces, upload delay, online only). **Decided (owner):** MediaPipe and the model run **on the phone**; Android first; the old upload path is **removed** (Expo Go / iPhone say "not available yet"); a testing-only landmark view; letters later (FSL + ASL) recorded in the app and trained in a notebook. Plan file: `~/.claude/plans/what-to-do-now-starry-heron.md`.

**Step 0 — done (go).** `ai/scripts/compare_holistic.py` on the 24 team clips (`learn/FSL`, `learn/ASL`): the phone's MediaPipe (Tasks HolisticLandmarker) vs the legacy Holistic the models were trained on — top-1 30 vs 29 of ~61 cut signs, mean point difference 0.0024, hands in the same left/right slot 98%, person / shoulders / hands found equally often. Run it with a MediaPipe 0.10.21 venv (the AI service's 0.10.14 crashes in the Tasks API; the script also patches a Python-wrapper bug where a frame without a hand crashes). **Second finding:** even with perfect landmarks the models get only **29/61** of the team's signs right — FSL fails most (often "SON"); ASL ~70%. The FSL 98% was on the dataset's own test clips. → model work later: train on the team's own recordings + augmentation.

**Built so far (laptop checks green, nothing on a phone yet):**
- `frontend/src/sign/features.ts`, `segmenter.ts` — line-by-line ports of `ai/app/sign/features.py` / `segmenter.py`; `net.ts` — the NumPy runner's math in TypeScript (no TFLite: ~31M multiply-adds per sign); `models.ts` (bundled models, loaded once); `reader.ts` (`SignReader`: frames → segmenter → model → events, camera tips, idle pause, the flip fix in landmark space, testing view data).
- `ai/scripts/export_sign_model.py` → `frontend/assets/sign-models/{fsl,asl}/words/` (model.json, model.bin ~4.5 MB each, labels.json, meta.json). `metro.config.js` bundles `.bin`.
- `ai/scripts/export_sign_fixtures.py` → `frontend/scripts/fixtures/sign-fixtures.json`; `frontend/scripts/sign-check.ts` **41/41**: same sampled frames, normalized clips, model input (1e-4), same sign/letter cuts, same top 5 as NumPy.
- Native module `frontend/modules/react-native-sign-landmarks/` (local package, `file:` dependency): a Nitro / VisionCamera v5 **camera output** in Kotlin (`HybridSignLandmarkerOutput.kt`: CameraX ImageAnalysis 720p → upright bitmap → MediaPipe `tasks-vision:0.10.35` HolisticLandmarker VIDEO mode → the 69×3 `pack()` layout + brightness → JS). Bindings generated by `nitrogen` (committed under `nitrogen/generated`). The 13 MB `holistic_landmarker.task` is downloaded by gradle at build time. Modeled on VisionCamera's own barcode-scanner plugin.
- App: `components/sign/SignCamera.tsx` (VisionCamera `<Camera>` + our output, low-light boost, testing landmark overlay), `hooks/use-sign-recognition.ts` rewritten (same events and names, now on the phone; `useSignModels` / `signReady` are local), `SignPanel.tsx` and `learn/SignCheck.tsx` switched over; Learn's camera exercise no longer needs the internet. New pref `signShowLandmarks` (dev builds only; the Settings switch isn't added yet).
- Packages (owner's OK): `react-native-vision-camera` 5.2.3, `react-native-nitro-modules` 0.37.1, `react-native-nitro-image` 0.15.2 (VisionCamera needs it), `nitrogen` 0.37.1 (dev). `react-native-fast-tflite` was installed then **removed** (not needed with `net.ts`). `frontend/android/` was generated by `expo prebuild` for local builds (gitignored).
- Laptop tools for local Android builds (owner's OK): JDK 17 portable at `%LOCALAPPDATA%\Java\jdk-17.0.20.1+1`, Android SDK at `%LOCALAPPDATA%\Android\Sdk` (cmdline-tools, NDK 27.1.12297006, CMake 3.22.1; platform 36 / build-tools 36 / platform-tools were re-downloading — the first build-tools zip was corrupt).

**Status 2026-10-18 (evening)** (history; the blocker below is fixed, resume at "2026-10-19"):
- **The local development APK builds and installs** (`BUILD SUCCESSFUL`, arm64 only). Installed on the owner's phone with `adb` after `adb uninstall com.aeno.frontend` (an EAS-signed app can't be replaced by a debug-signed one: `INSTALL_FAILED_UPDATE_INCOMPATIBLE`).
- An **EAS development build** was also started (same code, before the JS fixes below — fine, those come from Metro): https://expo.dev/accounts/aeno/projects/frontend/builds/97b2af7c-81a0-4b32-8711-feeedd7ce0ed. It's EAS-signed, so installing it on the owner's phone means uninstalling the debug one again.
- JS fixes since (no rebuild needed): `SignCamera.tsx` asks for low-light boost only when `device.supportsLowLightBoost` (it stopped the camera with "low light boost is not supported"); Settings → Sign language → **"Show landmarks (testing)"** (`__DEV__` only); the testing label shows `PHASE · frames N · points/no points · model ready/loading` and the last error (`SignReader.debug.frames / modelReady / error`); errors are logged as `[sign] …` in the Metro terminal.
- **⛔ BLOCKER (current):** label = `frames 0 · no points · model ready`; the error is `java.lang.NoSuchMethodError: No virtual method build()Lcom/google/protobuf/Any; in class Lcom/google/protobuf/Any$Builder; or its superclasses` — thrown inside MediaPipe on every frame, so no landmarks reach JS. Found so far: the app's runtime classpath has only `com.google.protobuf:protobuf-javalite:4.26.1` (asked for by MediaPipe `tasks-core:0.10.35` itself) and AndroidX `datastore-preferences-external-protobuf:1.1.7` (relocated to `androidx.datastore.preferences.protobuf`, so NOT the clash). So MediaPipe's own classes look compiled against a different protobuf than the 4.26.1 they declare.
  **Try next, in this order** (each = edit `frontend/modules/react-native-sign-landmarks/android/build.gradle`, rebuild, reinstall):
  1. Confirm with `javap -cp <gradle cache>/protobuf-javalite-4.26.1.jar 'com.google.protobuf.Any$Builder'` whether its `build()` returns `Any`; check no other jar in `~/.gradle/caches/9.3.1/transforms` contains `com/google/protobuf/Any.class` (a full scan took >5 min — narrow it).
  2. Change the MediaPipe version: `tasks-vision` **1.1.1** (latest; pulls `tasks-core 1.1.1` + `litertlm-android`) or **0.10.21** (the version the laptop comparison used). Check each pom's protobuf version first.
  3. Force one protobuf at the app level: `configurations.all { resolutionStrategy.force 'com.google.protobuf:protobuf-javalite:<the version MediaPipe was built with>' }` (in `android/build.gradle` `allprojects`, or through an Expo config plugin so prebuild keeps it).
  **Found + fixed (2026-10-18, late):** a MediaPipe build bug, not a version clash. In `tasks-vision` **0.10.26–0.10.35**, `HolisticLandmarker.HolisticLandmarkerOptions.convertToAnyProto()` was compiled against the full `protobuf-java` (its last call is `Any$Builder.build()` returning `Any`); every other MediaPipe proto call uses javalite. `protobuf-javalite` 4.26.1's `Any$Builder` has no such method (checked with `javap`). 0.10.21 and 1.1.1 are compiled correctly. Fix without changing versions: `android/src/main/java/com/google/mediapipe/tasks/vision/holisticlandmarker/JavaliteHolisticLandmarkerOptions.java` wraps the real options and rebuilds the same proto (steps copied from MediaPipe's bytecode), compiled against javalite. It sits in MediaPipe's package because the option getters are package-private. `HybridSignLandmarkerOutput.kt` passes `JavaliteHolisticLandmarkerOptions(options)` to `createFromOptions`. If MediaPipe is ever moved to 1.1.1+, the wrapper can be deleted (it's harmless there). **The debug APK with the fix is built and installed** (owner, 16:11). On the phone, logcat showed `Successfully loaded: holistic_landmarker.task`, then MediaPipe's normal `landmark_projection_calculator` warning (frames going through the graph), and **no NoSuchMethodError**. The USB cable kept dropping, so the testing label (`frames` / `points`) and the steps below weren't confirmed yet. Tip: over USB, `adb reverse tcp:8081 tcp:8081`, then open `exp+frontend://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081` (force-stop the app first if it's stuck).
- After the fix the testing label should show `frames` climbing and `points`; then test SIGN on raising a hand, words read offline, and Learn's camera check.

**2026-10-19: points work on the phone, signs read wrong → shape fix + retraining plan (▶ resume here for §49):**
- The owner confirmed the phone now finds points (the protobuf fix works), but the words it reads are wrong.
- **Found a real bug, the picture shape:** training videos are landscape, the phone's picture is portrait (CameraX 1280×720 turned upright = 720×1280). MediaPipe's x is a share of the width, y of the height, and `normalize()` divides both by the shoulder width (x units), so on the phone every up-down distance reached the model ~3.2× too small (and hand shapes flattened). **Fixed in JS (no APK):** `features.ts` `shapeForModel()` stretches x before reading. Old models: × (W/H) ÷ (16/9) (= `LEGACY_TRAINING_ASPECT`). Models with `aspectCorrected` (new notebooks): × W/H. `readSign(model, clip, minConfidence, aspect)` applies it; the segmenter already handled the aspect itself.
- **Checked on the laptop:** the 24 team clips cut to a 9:16 middle strip (like the phone), current models, legacy Holistic (signs right / signs cut): **ASL** landscape 20/34, portrait without the fix 5/35, **with the fix 18/35**; **FSL** 9/27, 7/30, **11/30**. So the shape bug was most of ASL's failure on the phone; FSL is weak even on landscape (a model problem → retraining). Still wrong every way: FSL HELLO, NO, YES, NICE TO MEET YOU; ASL help, no, fine. (Scratchpad script `portrait_check.py`, not committed.)
- **Testing label** now shows frames per second: `frames N (F/s)` (`SignReader.debug.fps`). The new notebooks assume 8–15 fps on a slow phone; note the real number.
- **Runner upgrades for the retrained models** (no APK): `net.ts` + `numpy_model.py` + `export_sign_model.py` support `Conv1D` `dilation_rate`, layers without a bias, and **letters** (export loops over words + letters; `readSign` reads a letters model with `buildHand21` → 1 × 42). Checked against JAX's own dilated convolution: NumPy runner 1.2e-6, `net.ts` 7e-7 (scratchpad test, not committed). Re-export of the current models is byte-identical; `meta.json` gained `"aspectCorrected": false`. `tsc`, lint clean, `sign-check` 41/41.
- **Retraining (owner, on Kaggle with Claude web chat):** the full prompt is saved in **`ai/notebooks/TRAINING_PROMPT.txt`** (paste it whole). It covers words (keep all 105 / 125 labels exactly, the 12 Learn words per language as priority words, split by signer, phone-style sign cuts, aspect-corrected input, `hand`/`velocity` features tried for both, dilated Conv1D model within the runner's layers, low-fps augmentation) and letters (`hand-21`: one hand, one frame, 42 numbers; hold-to-read). Outputs: `model.keras`, `labels.json`, `features.json` (`aspect_corrected: true`), `meta.json`; letters also give their `normalize_hand`. The owner will **not** record new training data.
- **When the new files arrive** (put in `ai/models/sign/<fsl|asl>/<words|letters>/`): run `scripts/export_sign_model.py`; for letters, add its `BUNDLED` lines in `frontend/src/sign/models.ts`, and copy the notebook's `normalize_hand` into `features.ts normalizeHand` + `registry.py normalize_hand` (with the x × W/H); give `registry.py` (laptop tools) the same aspect correction for `aspect_corrected` models; compare old vs new on the 24 team clips; phone test.

**Laptop setup for local Android builds (done 2026-10-18, owner's OK):**
- JDK 17 portable: `%LOCALAPPDATA%\Java\jdk-17.0.20.1+1` (no installer; winget needed admin and was cancelled).
- Android SDK: `%LOCALAPPDATA%\Android\Sdk` (cmdline-tools, platform-tools, platforms;android-36, build-tools;36.0.0, ndk;27.1.12297006, cmake;3.22.1). **Use it through the junction `C:\Android\Sdk`**: the NDK can't link C++ when its path has a space ("Ron Arjie") — that gave hundreds of `ld.lld: undefined symbol: operator new / std::…` in `react-native-nitro-modules`. `frontend/android/local.properties` = `sdk.dir=C:/Android/Sdk`.
- `frontend/android/gradle/wrapper/gradle-wrapper.properties`: `networkTimeout=120000` (the 10 s default timed out on the slow connection). `frontend/android/` is made by `expo prebuild` and gitignored: a new prebuild resets these two files — set them again.
- Build commands (PowerShell, one window):
  ```
  $env:JAVA_HOME = "$env:LOCALAPPDATA\Java\jdk-17.0.20.1+1"
  $env:ANDROID_HOME = "C:\Android\Sdk"
  $env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
  cd "C:\Users\Ron Arjie\Documents\AccessAI\frontend\android"
  .\gradlew.bat assembleDebug -PreactNativeArchitectures=arm64-v8a
  adb install -r app\build\outputs\apk\debug\app-debug.apk
  ```
  First build ~30+ min (downloads); later builds a few minutes. App errors: `adb logcat | findstr /i "NoSuchMethod mediapipe signlandmarks ReactNativeJS"` (`*:E` alone is mostly system noise).
- To undo later: delete `%LOCALAPPDATA%\Java`, `%LOCALAPPDATA%\Android`, `C:\Android`. The owner may go EAS-only once sign reading works (EAS builds on Linux, so the space-in-path problem never happens there).

**Next, in order (updated 2026-10-19):**
1. ~~Fix the protobuf `NoSuchMethodError`~~ **done**, and the phone finds points.
2. **Phone test of the shape fix** (reload; no APK): sign the 12 Learn words in each language with "Show landmarks" on. ASL should be clearly better than before; FSL only a little. Write down the `(F/s)` number on the label (frames per second).
3. **Owner: retrain on Kaggle** (words for FSL + ASL, and letters for FSL + ASL) with the 2026-10-19 prompt, then put the files in `ai/models/sign/<fsl|asl>/<words|letters>/`.
4. **Claude: bring the new models in**: export; for letters add `BUNDLED` lines in `models.ts` and copy the notebook's `normalize_hand` (with x × W/H) into `features.ts` and `registry.py`; give `registry.py` the aspect correction for `aspect_corrected` models; extend `sign-check` fixtures if the feature layout changed; compare old vs new on the 24 team clips (like `portrait_check.py`); then a phone test (words, letters, Learn's camera check).
5. Step 5: remove the old upload path (backend `/api/sign/session*`, AI service session endpoints, `expo-file-system` upload code is already gone from the hook), update the e2e `ai` suite, the Terms ("read on your phone; nothing is sent"), Laya text and `docs/source/`.
6. An EAS development build (uninstall the debug one first), so the app works without the laptop's debug setup.
- Dropped: recording the team for training data (the owner won't record; the team clips stay a test set only). The letters "Record letters" screen idea is replaced by public alphabet datasets in the notebook.

## 50. 2026-10-19 small changes, checks and the dummy test account

**Built (laptop checks green, owner checked the Learn buttons on the phone):**
- **Learn tab buttons** (Leaderboard / Practice / Credits, `app/(app)/(tabs)/learn.tsx` `LinkButton`): icon above the word, icon 22 → 20, text 16 → 14, one line with a slight auto-shrink (to 80%) instead of wrapping; with a big app text size (`t.font(10) >= 13`) they go two to a row. The owner said it looks good.
- **Laya and world questions:** "who is Jose Rizal", "sino si…", "ano ang…", "tell me about…", "why is the sky blue" now get *"I can only help with things in AccessAI, so I can't answer questions like that. Say 'what can I say' to hear what I can do."* (Filipino too, `P.cantAnswerQuestions`). Only when nothing matched (`intent === 'none'`) and `looksLikeQuestion(text)` (`laya/rules.ts`) is true; noise, "hello", a stray name still get "I didn't catch that". `laya-rules-check` 224/224 (2 new checks), `check-laya-catalog` OK, `tsc` + lint clean.

**Checked, nothing to change:**
- **PWD friends with PWD** works like non-PWD with PWD: chat, "Seen", receiving an SOS (alert, Home cards, Recent SOS, map) and responding never look at the role. Role checks only stop non-PWD accounts from sending an SOS / having an SOS circle / emergency contacts. Proven live: the owner's PWD account got Test Buddy's SOS and answered "On my way".

**The dummy test account "Test Buddy" (still in the real database):**
- `test-buddy@example.test`, no password (can't log in), now **role `pwd`** (switched so it can send SOS), friends with the owner's account `ronarjierabaya@gmail.com` (RonArjie Rabaya), with the owner in its SOS circle. Made with a scratchpad script (`User.create` + `Friendship.create` like `backend/scripts/e2e/helpers.js`; the API calls use `signUserToken(user)` — make the token AFTER changing the role, the role is inside it).
- Sent the owner a message ("Hi! This is a test message from Test Buddy."), read the owner's "hello" (marked seen), and sent a **real (not test) SOS**: id `6ad5abbcfee896964d8e25f9`, place "Rizal Park, Manila", **still ACTIVE** (ends by itself 2026-10-20 05:33 UTC). The owner responded "On my way".
- **To do:** end it when the owner says (`PATCH /api/sos/6ad5abbcfee896964d8e25f9/resolve` as Test Buddy, the server must be running), and delete Test Buddy when testing is over (`purgeUser(id)` from `utils/accountDeletion.js`, as the e2e cleanup does).

**Explained to the owner (no code):** ChromaDB holds only the ~550 example sentences of `ai/intents.json` as meaning-points; it never grows by itself or from what people say (nothing is stored); it changes only when someone edits `intents.json` (rebuilt at the next AI service start). Laya's order: phone rules → (online) ChromaDB → LLM picks from a shortlist. Guardrails: `ai/MODEL_INTEGRATION.md` "Guardrails that must stay".

**Offered, not built (owner to decide):**
- A "vector only" mode without the chat LLM (e.g. `AI_CHAT_MODEL=none`: unsure commands → "I didn't catch that" instead of an error). Ollama still needed for bge-m3.
- Learning from use: keep the sentences Laya didn't understand for review (needs a Terms/privacy note).

**State at the end of 2026-10-19:** the backend on port 3000 was stopped; no Claude task left running.

## 51. Plan (owner, 2026-10-19): a landing page (website), hosted on Vercel

**Why:** a public page that explains AccessAI, offers the download, and hosts the Terms & Privacy at a real URL (Google Play needs one later). The app is Android-first.

**Decided (owner, 2026-10-19):**
- Hosting: **Vercel** (owner links the GitHub repo; project root `landing/`).
- Download: **dummy for now**. Two equal buttons, "Download for Android" and "Download for iPhone" (both `#`), + requirements; the owner wires the real links later. **No "coming later / coming soon / still in testing" wording anywhere** (owner, 2026-10-19).
- Pages: **Home** (who it's for, features with screenshots, works offline, download + requirements + install steps), **Terms & Privacy**, **About / Team**. No account-deletion page yet.

**Build:**
- `landing/`: Vite (no framework), 3 pages: `index.html`, `terms.html`, `about.html`; one stylesheet; no tracking, no cookies.
- Terms & Privacy are rendered **at build time from `frontend/src/constants/legal.ts`** (`TERMS_INTRO`, `TERMS_SECTIONS`, `PWD_DECLARATION`, `TERMS_VERSION`), so the site and the app never disagree. Vercel needs "Include files outside the root directory" on (the default).
- Download links live in one place, `landing/site.config.ts` (`androidApkUrl`, `iosUrl`; empty = "coming soon").
- Accessibility first (the audience): Atkinson Hyperlegible font, large text, skip link, landmarks, visible focus, alt text, reduced motion, dark mode, contrast checked.
- Screenshots from the 2026-10-19 manuscript, only those without a real address or a face (the SOS review screens show a real road; the sign camera shows a person) — the sign camera can be added if the owner agrees.
- Plain-language rule applies (no server/model/Expo wording). Facts only from the app: Android 7.0+ (minSdk 24), FSL 105 / ASL 125 words, 72 Laya actions, Learn 12 + 12 signs, SOS hold/shake/voice, 30-minute live location, 911.

**Checks:** `npm run build` in `landing/`; open the built pages; phone-width layout; links; contrast.

**Built 2026-10-19.** `landing/` (Vite 8, no framework): `index.html`, `about.html`, `terms.html`, `src/styles.css`, `vite.config.ts` (a small plugin fills `<!--HEADER-->`, `<!--FOOTER-->`, `<!--ANDROID-->`, `<!--IOS-->`, `<!--TERMS-->`, `<!--TERMS_UPDATED-->`, `<!--VERSION-->`), `site.config.ts` (download links, both empty = dummy), `vercel.json` (clean URLs, basic security headers), `public/` (logo mark, favicon, 7 screenshots). Checked: build green; all placeholders filled; Terms "Last updated October 17, 2026" from `legal.ts`; light + dark; 390 px wide (one hero phone, no sideways scroll); every text colour pair ≥ 4.5:1. Vite warns once that `frontend/` isn't `"type": "module"` (harmless; only for a future Vite default).
- **Deploy (owner):** commit + push → vercel.com → Add New → Project → import `aeno-ai/AccessAI` → **Root Directory `landing`** (keep "Include files outside the root directory" on) → Deploy. Later pushes redeploy by themselves.
- **Wire the download:** put the links in `landing/site.config.ts` (`androidApkUrl`, `iosUrl`) → push.
- **View without a server:** `npm run build`, then double-click `landing/dist/index.html` (`base: './'`, all links relative; the plugin runs `order: 'pre'` so the header/footer images get rewritten too).
- **Not on the site on purpose:** the SOS review screenshots (a real road address) and the sign-camera ones (a person's face). Fingerspelling says "Soon" until the letters models are in the app.

## 52. Plan (owner, 2026-10-21): new sign models, a professional admin side, a scalable setup, and "How to sign" help

Full plan file: `~/.claude/plans/twinkling-weaving-brooks.md`. **No new APK** for any of it. Everything new for scaling is **off by default** (`npm run dev` stays one process; Spark only runs by hand).

**Decided (owner, 2026-10-21):**
- **Models:** install all four new ones from `~/Downloads` (`words-asl`, `words-fsl` (arrived 2026-10-21), `letters-asl`, `letters-fsl`); the new word models stay even if the team-clip comparison is worse. Old files backed up to `~/Documents/AccessAI-model-backups/2026-10-21/`.
- **Admin:** a dashboard of all logs with graphs over time (Manila time); "Needs a look" → **"Suspicious Activities"** with descriptions of what was captured, a new **"5+ failed logins in a row"** rule and a severity per flag; extras: **admin action log page** (super admin only), **act on flags in one click**, **CSV export**, **date-range filters**.
- **Scalability:** several backend copies sharing live connections, rate limits and timed jobs **through MongoDB Atlas** (no Redis/Docker on this laptop), plus an **on-demand PySpark log-analytics job** (own venv, Java 17 already here). Written up in `docs/SCALABILITY.md` for the defense.
- **App:** a **"How to sign"** help sheet (words and letters, quoting the real on-screen labels), opened from a pill under the sign camera, a "?" on the sign camera screen, Learn's camera check and Settings → Sign language; shown once automatically.

**Defaults chosen:** admin log page super-admin only; dashboard message counts are totals only (never bodies or per person); CSV capped at 10,000 rows with a formula guard; `CLUSTER_WORKERS` default 2; new packages: Recharts (admin), `@socket.io/mongo-adapter` + `mongodb` + `autocannon` (backend), pyspark (own venv).
- **E. Sign translator (owner, 2026-10-21):** the output of signing (FSL or ASL) can be translated **English ↔ Filipino**, on the **sign camera result** ("Said out loud" card) and in the **message box after signing** (Conversation Mode and chats). **Online:** the AI (same service as the sentence step). **Offline:** a basic word-by-word mode for the signed words, from a built-in list of the sign words in Filipino.

**Built and checked 2026-10-21 (all of §52):**
- **Models (A):** all four installed (`ai/models/sign/*/*`), exported to `frontend/assets/sign-models/*/*`, letters added to `BUNDLED` (`frontend/src/sign/models.ts`). The AI service now applies `aspect_corrected` too (`registry.py shape_for_model`, `session.py` passes the real aspect). `sign-check` **49/49** (new: both letters models' top 5, the picture-shape stretch, a velocity case, and a check that every sign word has a Filipino entry), `learn-check` 56/56. Old word models backed up in `~/Documents/AccessAI-model-backups/2026-10-21/`. **Team clips (24 Learn videos), first guess:** ASL landscape 20→**26**/34, ASL portrait 18→**22**/35, FSL landscape 9→10/27, FSL portrait 10→10/30 (FSL NO and YES still missed).
- **Help + translator (D, E):** `components/sign/SignHelpSheet.tsx` (+ `signText.ts` shared labels) opens from a "How to sign" pill under every sign camera (and once by itself, pref `signHelpSeen`), a "?" on the sign camera screen (`ScreenHeader` got a `right` slot), Learn's camera check and Settings → Sign language. The sign camera no longer blocks offline. Translator: `components/sign/TranslateButtons.tsx` on the sign camera's result card and in the message box after signing; `utils/signedText.ts translateSigned`. **Owner (2026-10-21): into Filipino always uses the built-in word list** (`src/sign/glossary.ts`, all 205 sign words) — qwen2.5 3B/7B wrote wrong Tagalog ("I need help" → "Mahal kita"); into English uses the AI (`kind: 'translate'` in `ai/app/polish.py`, with the direction + one example in the prompt), offline = the signed words. `tsc`, lint, `laya-rules-check` 224/224.
- **Admin (B):** backend `controllers/adminDashboardController.js` (`GET /api/admin/dashboard?range=24h|7d|30d|90d`, Manila buckets), `adminRecordsController.js` rewritten (Suspicious Activities with 6 rules incl. `failed_logins_streak` 5+ in a row, evidence, severity; `/audit` super-admin-only via new `audit:read`; `from`/`to` date filters; CSV exports with a formula guard, `utils/csv.js`, `utils/dateRange.js`), date indexes on 5 models. Admin site: `DashboardPage` (Recharts, lazy-loaded; KPIs, 7 time charts, busiest-hours heatmap, 7 breakdowns, every chart with "Show as table"), `ReviewPage` = Suspicious Activities (severity, rule legend, sentences from `utils/format.ts describeFlag`, View account / Suspend… in one click), `AuditLogPage`, date range + Export CSV on Activity and SOS. Screenshot-checked. `npm run build` + `lint` clean.
- **Scalability (C):** `realtime/io.js` asks socket.io rooms (never a local map) — `SOCKET_ADAPTER=mongo` shares them through `@socket.io/mongo-adapter`; `middleware/sharedRateStores.js` (`RATE_LIMIT_STORE=mongo`: the token bucket as one atomic update + an express-rate-limit store); `utils/jobLease.js` (each timed job on one copy); `src/cluster.js` + `npm run start:cluster`; `TRUST_PROXY`; `/api/health` 503 "draining" on shutdown; `PORT` default 3000. **`npm run scale-check` 5/5** (two real copies). **`npm run load-test`:** 1 copy 39 req/s, 2 copies 34 req/s (p50 ~1.1 s) — the bottleneck is the free Atlas tier (ping ~100 ms, 40 at once 1.6 s), not the servers. **Spark:** `backend npm run export-logs` (people as salted hashes, no names/emails/addresses/locations) → `analytics/spark_job.py` (own venv, pyspark 4.0.4, Java 17): 97 records 14.5 s, 9,700 16.5 s, 970,000 20.4 s on 10 cores. Defense write-up: **`docs/SCALABILITY.md`**.
- **Backend e2e 241/241** (normal mode, AI on), `rate-check` 15/15.
- **Next (owner):** phone test over Metro (letters, How to sign, translate, sign camera offline); then commit. ASL demo words for the defense are in the 2026-10-21 chat summary (from `per_word_test.csv`).
- **Low-light boost error (fixed 2026-10-21):** VisionCamera (Android) calls CameraX `enableLowLightBoostAsync` whenever `enableLowLightBoost` is set — even `false` — and CameraX can refuse it even on cameras that report `supportsLowLightBoost` (e.g. with the sign reader's frame output bound). The refusal went to VisionCamera's default `onError` (`console.error` → red screen in dev). `SignCamera.tsx` now sends `true` only where supported (otherwise nothing), and its `onError` drops the boost quietly when it's refused; other camera errors are `console.warn` (`[sign] camera: …`). JS only — reload over Metro.
- **Dashboard (owner, 2026-10-21):** the "Phones used to log in" breakdown was removed (card, `breakdowns.platforms` in `adminDashboardController.js`, its type and e2e check).

## 53. Plan (owner, 2026-10-21): deploy everything on Oracle Cloud "Always Free"

**Decided (owner):** prepare an Oracle Always Free deployment (files + step-by-step guide in `deploy/oracle/`); the owner creates the accounts and runs it. Claude deploys nothing.

**Design:**
- One ARM VM (Ubuntu 24.04, Ampere A1, up to 4 cores / 24 GB on Always Free) runs: the backend as several copies (`npm run start:cluster`, `CLUSTER_WORKERS` = cores, shared through Atlas), the AI service (uvicorn, 127.0.0.1:8001) and Ollama (qwen2.5:3b + bge-m3) as systemd services; **Caddy** in front for HTTPS (free DuckDNS subdomain, automatic Let's Encrypt).
- **One address for the API and the admin site:** Caddy sends `/api/*` and `/socket.io/*` to the backend and serves the built admin site for everything else. Reason: the admin session cookie is `SameSite=Strict`, so the admin site must be on the same site as the API (a Vercel admin on another domain could not log in). The landing page stays on Vercel. MongoDB stays on Atlas M0.
- Server AI packages without MediaPipe/OpenCV (`ai/requirements-server.txt`): sign reading runs on the phones; the AI service's sign sessions aren't used by the app, and MediaPipe 0.10.14 may have no ARM Linux wheel.
- Changes outside the server: Google OAuth redirect URI, Atlas network access, `EXPO_PUBLIC_API_URL` + a new APK, Gmail app password on the server (port 587).

**Built 2026-10-21:** `deploy/oracle/` — `README.md` (the step-by-step guide: Oracle VM, VCN ports, DuckDNS, Atlas IP, Google redirect URI, clone with a token, `backend/.env`, setup, checks, APK, updates), `setup.sh` (Node 24, Caddy, Ollama, iptables 80/443, backend `npm ci --omit=dev`, admin build → `/var/www/accessai-admin`, AI venv from `ai/requirements-server.txt`, model pulls, systemd units, Caddyfile), `update.sh`, `Caddyfile`, `accessai-backend.service` (`node src/cluster.js`), `accessai-ai.service` (uvicorn on 127.0.0.1:8001), `backend.env.example`; `deploy/.gitattributes` keeps LF endings. Scripts pass `bash -n`; not run on a real VM yet. **The server clones from GitHub: commit and push first.**

## 54. Where things stand (2026-10-21) — ▶ start here

**Finished and checked (nothing deployed, nothing committed — the owner commits):**
- **Sign models (§52 A):** all four new models (FSL/ASL words + letters) installed, on the phone and in the AI service; letters turn on in the app by themselves. `sign-check` 49/49, `learn-check` 56/56. ASL words clearly better on the team's own clips (26/34 vs 20/34); FSL about the same.
- **App (§52 D, E):** "How to sign" help (pill under every sign camera, "?" on the sign camera screen, Learn's camera check, Settings); sign translator (English via the AI, Filipino via the built-in word list); sign camera works offline; low-light boost error fixed (`SignCamera.tsx`). `tsc`, lint, `laya-rules-check` 224/224. **No new APK needed** (reload over Metro).
- **Admin (§52 B):** dashboard (graphs over time, KPIs, heatmap, breakdowns; "Phones used to log in" removed on request), Suspicious Activities (6 rules incl. 5+ failed logins in a row, severity, plain-English evidence, one-click Suspend), Admin log (super admins), date filters and CSV export. Build + lint clean, screenshot-checked.
- **Scalability (§52 C):** several backend copies sharing through MongoDB Atlas (`npm run start:cluster`, off by default), `npm run scale-check` 5/5, `npm run load-test` (bottleneck = the free Atlas tier), Spark log analytics (`analytics/`, 970,000 records in ~20 s). Defense write-up: `docs/SCALABILITY.md`; a study prompt for it was given to the owner in chat.
- **Backend e2e 241/241**, `rate-check` 15/15.
- **Landing page (§51):** built, dummy download buttons, mentions letters + translation.
- **Deployment kit (§53):** `deploy/oracle/` (guide, setup/update scripts, Caddy, systemd, env template) — not run on a real server yet.

**The owner still has to:**
1. **Phone test** over Metro: Letters (FSL/ASL), "How to sign", Translate (sign camera + message box), the sign camera with Wi-Fi off, no red low-light error.
2. **Admin site:** open it against the real backend (dashboard, Suspicious Activities, Admin log as a super admin, CSV downloads).
3. **Commit and push** everything (the Oracle server clones from GitHub). New folders: `analytics/` (its `.venv`, `data/`, `out/` are gitignored), `deploy/`, `landing/`, `docs/SCALABILITY.md`.
4. **Decide the deployment** (below), then follow `deploy/oracle/README.md` — ideally a few days before the defense; the laptop + Tailscale setup stays the fallback.
5. **New APK** only once the backend has its public server address (`EXPO_PUBLIC_API_URL`).
6. Old open items: the Test Buddy account still has an ACTIVE SOS to the owner (§50); two questions from earlier wait (support contact; SOS while suspended).

**Open decision — hybrid deployment (owner, 2026-10-21: "plan this later"):** any mix works because every backend copy shares its state through Atlas.
- **A. Backend in the cloud, AI on the laptop:** Oracle runs the backend (chat, SOS, admin always online); Laya's AI runs on the laptop, reached privately over Tailscale (`AI_SERVICE_URL`). Laptop off → the app's existing fallbacks (Laya's phone rules, signed words as signed, Filipino word list). Needs: an `AI_HOST` setting so the AI service can listen on the Tailscale address (today `startAi.js` binds 127.0.0.1), `AI_SERVICE_URL` on the server, and a setup option to skip the AI install there.
- **B. The laptop joins the cluster:** Caddy on Oracle load-balances between the server's copies and the laptop's copies (over Tailscale) with health checks (`/api/health`), skipping the laptop when it's off — the two-machine scalability demo. Needs: a second Caddyfile with the laptop as an extra upstream + `health_uri`, and the laptop running `npm run start:cluster` with the same secrets.
- **A + B together**, or **full Oracle** (§53 as built). Claude's suggestion: A + B.

**Defense notes the owner asked for (2026-10-21):** ASL demo sentences from words the new model never mixed up — MOTHER WORK DOCTOR · COUSIN DEAF · SON PLAY COMPUTER · FAMILY THANKSGIVING EAT · SORRY, PLEASE WATER · YES, TOMORROW THURSDAY. Avoid HELP (0% on its test clips, read as BOOK), DRINK, WANT, RIGHT, TELL, WAIT, and the "magnet" words BOOK, WHO, WHY, NAME. Letters: a short name, no J/Z.

**Background processes:** none left running by Claude (its test copies on 3100/3201/3202/3301 and its admin dev server are stopped). At the end of 2026-10-21 the owner's own `npm run dev` (port 3000 + AI on 8001) and admin `vite` (5173) were running; Ollama was not, so Laya's AI waits until `ollama serve` is started.
