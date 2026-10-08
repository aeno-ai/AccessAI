# AccessAI — Handoff

_Last updated: 2026-10-08. Pick-up line for a new Claude session: **"Read HANDOFF.md — start with §0, then help me test what's in §1."**_

Ground rules every change follows:

- **Offline first.** Anything a PWD needs in the moment works with no signal. Online-only extras fail gracefully.
- **iPhone and Android**, with TalkBack and VoiceOver.
- **Expo Go stays usable.** Native-only features work in the development build and degrade gently in Expo Go.
- **Lightweight.** Prefer what's already in the stack.

---

## 0. Where we left off (2026-10-08)

Setup for phone testing is mid-way. Open items, in order:

1. **Google sign-in: `redirect_uri_mismatch`.**
   - **Our side is correct.** `backend/.env` has `BACKEND_PUBLIC_URL` = just the tunnel address, the tunnel is up, and the backend sends Google exactly `https://<tunnel>/api/auth/google/callback`.
   - **Google rejects it for the client in `.env`** (`GOOGLE_CLIENT_ID` starting `1026239993930-9baf0pev…`), so the URI was saved on a **different OAuth client**, or not saved yet.
   - **Fix:** open the client whose ID matches `.env` and add the URI there, or copy the other client's ID and secret into `.env` and restart.
   - **How to check without a phone:** see §2.5.
2. **Gmail (forgot-password / sign-up codes) is broken.** Gmail rejects the App Password in `backend/.env` (`535 Username and Password not accepted`). It was probably revoked when the Google account was reset.
   - **Fix:** make a new App Password and put it in `SMTP_PASS` (§2.6). Until then, no codes are emailed.
3. **Push notifications.**
   - **Done so far:** the FCM V1 key upload (`eas credentials`) was being done, and the new dev APK with `expo-notifications` is installed. Its first run showed the "Custom sound 'default' not found" error.
   - **Fixed on 2026-10-08:** the channels now have new ids (`sos_alerts`, `sos_updates`, `chat_messages`) and the normal sound; the old broken ones are deleted automatically. No rebuild is needed, just reload the app.
   - **Next:** `npm run test-push -- --email <account>` (§2.4).
4. **`backend/.env.example` is missing** (deleted?). The real `.env` is fine. Restore the template if wanted.
5. The current tunnel address is temporary (`*.trycloudflare.com`); every restart means updating `.env` and Google. A fixed address is an option (§2.3).
6. **Security scan before pushing (2026-10-08).** The GitHub repo is **public**.
   - Old commits contain `backend/.env` and `frontend/.env`: the MongoDB login and an old `JWT_SECRET`. **Both were changed since.** The leaked database login was tested and is rejected, so they're harmless, and the history wasn't rewritten.
   - `.gitignore` now blocks every `.env`, Firebase keys and `google-services.json`, keystores and EAS `credentials.json`.
   - Before the next EAS build, add the `GOOGLE_SERVICES_JSON` file variable (§2.4).

---

## 1. Built on 2026-10-07 — needs testing on real phones

All uncommitted, on top of the earlier uncommitted work. **Commit in logical pieces once tested.**

### How to run everything now

```
1. Ollama:     open the Ollama app (or `ollama serve`)          ← the only new step
2. backend/:   npm run dev      → starts the API AND the AI service (ai/ folder)
3. frontend/:  $env:REACT_NATIVE_PACKAGER_HOSTNAME="<laptop IP>"; npx expo start -c
```

- `npm run dev` now uses `concurrently`: lines starting `[api]` are the backend, `[ai]` the Python AI service.
- **First run:** the AI service makes `ai/.venv` (Python 3.12) and installs its packages (a few minutes), and Ollama downloads `qwen2.5:3b` + `bge-m3` (~3 GB) by itself. Both are already done on this laptop.
- Without Ollama the backend still works: sign language works, and Accel uses only the phone's own rules.
- `AI_DISABLED=1` in `backend/.env` turns the AI service off.

### What was built

| # | Feature | Main files |
|---|---|---|
| 1 | **Simple errors.** Every failure is one short JSON sentence. No HTML, no field lists or database text. The app never shows a raw server or proxy page. `$`-keys, dotted keys and arrays where a value belongs are refused (NoSQL injection). | backend `middleware/{validate,rejectOperatorKeys,rateLimiter}.js`, `validators/common.js`, `app.js` error handler; frontend `api/apiClient.ts` |
| 2 | **SOS bug fixed.** With 2+ circle friends, SOS used to fail at the 2nd friend (duplicate message id). Now every friend gets it. | `controllers/sosController.js` |
| 3 | **SOS made helpful.** "Friends who get my SOS" checklist in Settings → Emergency SOS. The text to emergency contacts opens after **every** real SOS. Live GPS to friends every 30 s for 30 min while the app is open (screen kept on). "I'm on my way" / "I've seen it" are spoken to the sender. **I'm safe** ends it for everyone. An "Active SOS" card on Home for friends who missed it, plus the full-screen alert once on opening the app. A readable place name. Auto-expires after 24 h (tests after 15 min). Test SOS wording fixed. | `components/sos/{SosFlow,SosProvider,SosAlertModal,ActiveSosCards}.tsx`, `utils/sos.ts`, `realtime/FriendsProvider.tsx`, `realtime/sosCache.ts`, `settings/sos.tsx`; backend `models/SOSEvent.js`, `routes/sosRoutes.js` |
| 4 | **Push notifications (Android).** Friends' SOS (loudest channel) and messages arrive when AccessAI is closed. Taps open the chat or Home. Off quietly in Expo Go. | `notifications/{push.ts,use-push-notifications.ts}`, `app.config.js`; backend `utils/push.js`, `routes/pushRoutes.js` |
| 5 | **AI service (Python).** FastAPI + Ollama + ChromaDB vector DB + MediaPipe. **Read `ai/README.md`**, which explains embeddings, cosine similarity, thresholds and guardrails using this code. | `ai/`, `backend/scripts/startAi.js`, backend `routes/{assistant,sign}Routes.js`, `utils/aiClient.js` |
| 6 | **Accel, the voice assistant.** On by default for Blind / low vision (existing users too), with a one-time spoken intro. Accel button on every screen, Magic Tap (iPhone), **"Hey Accel"** (on-device, app open). It understands → says it back ("You want me to take you to Conversation mode?") → only **yes** acts. 42 actions: go anywhere, SOS, I'm safe, read new messages / a friend's last message / who's online / where am I / friend code / requests, send a message by voice (grammar fixed, read back), add a friend by code, accept/decline requests, SOS circle, slower/faster, bigger/smaller text, voice. Never by voice: delete account, sign out, unfriend. Offline rules first; AI only when unsure. Guide screen + Settings → Accel. | `accel/*`, `app/(app)/accel-guide.tsx`, `settings/accel.tsx`, `ai/intents.json` |
| 7 | **Voices.** Settings → Conversation & speech → Voice: Man / Woman / Automatic. Accel is a man by default. Also fixed: Android was reading Filipino in the default voice (`Locale("fil-PH")` bug). | `utils/voices.ts`, `hooks/use-app-voice.ts`, `utils/speechHelper.ts` |
| 8 | **Mic fix.** Speech-to-text used to send results to every screen's listener (Conversation and friend chats picked up each other's words). Now one owner at a time. | `audio/recognizer.ts`, `hooks/use-speech-to-text.ts` |
| 9 | **Sign language, wired.** Sign mode in the message box: camera, FSL/ASL, Words/Letters (Letters greyed out until a model exists), front/back camera, "Mirror". Hands-free: ~2 s video pieces → the server finds each sign (your tester's AUTO mode) → the word lands in the box. Unsure → top-5 chips. When signing pauses, the AI turns the words into a sentence (Undo sentence). **You tap Send** (Speak my messages reads it aloud). Models swap by replacing files (`ai/models/sign/README.md`). | `components/conversation/{SignPanel,Composer}.tsx`, `hooks/use-sign-recognition.ts`, `ai/app/sign/*` |
| 10 | **Me/Them** pills: the ✓ is gone. | `conversation.tsx` |
| 11 | **Privacy notice** updated (Accel, sign video, live SOS location, push), `TERMS_VERSION` → `2026-10-07` in both `legal` files. | `constants/legal.ts`, backend `constants/legal.js` |
| 12 | _(2026-10-08)_ **Push test script** `npm run test-push` (one phone is enough). **Channel fix:** Android channel `sound` means a custom file, so `'default'` broke them; they are now `sos_alerts` / `sos_updates` / `chat_messages` with the normal sound. Channels can never change once created, hence the new ids. | backend `scripts/testPush.js`; frontend `notifications/push.ts`; backend `sosController.js`, `directMessageController.js` |

### Already verified (on this laptop)

- **Backend end-to-end: 50/50** (`cd backend; npm run e2e`, against the running server, throwaway accounts erased after). Covers errors and injection; SOS to 2 friends, live location, answers, I'm safe, replace, test; push tokens including a real Expo call that drops a dead token; Accel through the backend; sign session with a real video upload.
- **Accel offline rules: 79/79** (`cd frontend; npx tsx scripts/accel-rules-check.ts`).
- **AI on unseen sentences: 35/35** (`cd ai; .venv\Scripts\python -m app.eval`). ~0.7 s when the vector search is sure, 2.5–7 s when the LLM is needed (CPU).
- **Sign pipeline = tester: 227/227** of the tester's recordings give the same word (`python -m app.sign_check`).
- `tsc`, `expo lint`, contrast check, `check-accel-catalog.mjs` all clean. The Android bundle builds.

### Push notifications

See §2.4 for the setup steps, the one-phone test and troubleshooting. iPhone push needs a paid Apple Developer account; the code is ready, but iPhones get no push until then.

### Test on phones (the checklist)

- [ ] **Errors:** turn off wifi on the laptop → login says "Can't reach AccessAI…" (no HTML, ever).
- [ ] **SOS, 3 phones:** add 2 friends to the SOS circle (Settings → Emergency SOS) → send an SOS. Both get the alert. The SMS composer opens on the sender's phone. Walk around → the friends' map updates. A friend taps "I'm on my way" → the sender hears it. "I'm safe" → the friends' alert turns blue "safe now".
- [ ] **Missed SOS:** friend's app closed → push arrives (after the APK rebuild). Open the app → full-screen alert once, then the Home card.
- [ ] **Accel (Blind profile):** intro plays. The button is on every screen. "Take me to conversation mode" → "You want me to…?" → "yes" / "oo" → it goes. "No" cancels. Silence cancels.
- [ ] **Accel offline (airplane mode):** "open friends", "SOS", "any new messages", "tell Ana I'm on my way" (queued, then sent once online) still work.
- [ ] **"Hey Accel"** (dev build, Android 13+ / iPhone): works with the app open. Never wakes from its own voice. Pauses while the Conversation mic is on. Settings → Accel shows the status ("needs English speech" has a Download button).
- [ ] **TalkBack/VoiceOver + Accel:** nothing is spoken twice, and focus lands on Yes. Magic Tap opens Accel (iPhone).
- [ ] **Voices:** Man / Woman / Automatic in Settings. Accel sounds like a man. Filipino is read in a Filipino voice (note if "No man's voice for Filipino" appears).
- [ ] **Sign mode:** FSL words appear hands-free. "Not sure" chips. A pause makes a sentence, and Undo sentence works. Letters is greyed out. Back camera pointed at a signer works. If words look wrong on iPhone's front camera, try "Mirror".
- [ ] **Two Composers:** speaking in Conversation no longer types into a friend chat.

### Limits to know

- **The AI runs on this laptop.** The phone must reach it (same Wi-Fi/hotspot, or the tunnel). Away from it, Accel uses its phone rules and sign language says the server isn't reachable.
- **CPU speed:** the LLM takes 2.5–7 s here. Common commands never wait (phone rules / vector search).
- **Live GPS** only while AccessAI is open (phones forbid background location without extra review). The screen stays on meanwhile.
- **"Hey Accel"** costs some battery. It pauses after 10 min without a touch and when the app is closed.
- **Sign models have no "not a sign" class**, so the confidence threshold (Loose/Normal/Strict) matters. Accuracy is what your tester measured.
- **qwen2.5:3b** has a research-only license. That's fine for the thesis; switch `AI_CHAT_MODEL` for real users.
- **SMS** still needs the sender to tap Send (phones never allow silent texts).

---

## 2. Running, connecting and outside services

### 2.1 Checklist before testing on a phone

1. **Network.**
   - The phone and laptop are on the same Wi-Fi or hotspot.
   - `ipconfig` gives the laptop's Wi-Fi IPv4. Not `192.168.56.1`: that's VirtualBox, unreachable from the phone. The IP changes with every network; the hotspot is `192.168.137.1`.
   - `frontend/.env`: `EXPO_PUBLIC_API_URL=http://<laptop IP>:3000/api`, or `https://<tunnel>/api` for a phone off the network.
2. **Ollama** is running: the Ollama app in the tray, or `ollama serve`. Without it, Accel's AI and "signed words → sentence" are off; everything else works.
3. **Backend:** `cd backend` → `npm run dev`. Wait for `MongoDB connected`, `Server running on port…` and `[ai] Accel's AI is ready`.
4. **Tunnel** (only for Google login or a phone off the network): see §2.2.
5. **Frontend:** `cd frontend` → `$env:REACT_NATIVE_PACKAGER_HOSTNAME="<laptop IP>"; npx expo start -c`.
   - Use `-c` after any `.env` change.
   - In the dev APK, connect to `http://<laptop IP>:8081`.
6. **Admin web** (only if testing admin): `cd admin` → `npm run dev` → http://localhost:5173. Vite proxies the API to the backend, so there's nothing to configure.
7. **Phone:**
   - The **new dev APK** is installed (the one with notifications).
   - Sign in and allow notifications, location, mic and camera.
   - For "Hey Accel": Settings → Accel → download English speech if asked.
8. **Test data:**
   - A **PWD** account on the phone (only PWD accounts can send SOS), set to Blind / low vision for Accel.
   - A second account as the friend; `npx expo start --web` works as phone #2.
   - Make them friends, put the friend in the SOS circle, and add an emergency contact.
9. **Quick checks**, in the phone's browser:
   - `http://<laptop IP>:3000/health` → `{"status":"ok"}`
   - `http://<laptop IP>:8081/status` → `packager-status:running`
   - If tunnelling: `https://<tunnel>/health` → ok
   - Then on the laptop: `npm run test-push -- --email <phone account>` → a notification appears.

```
ollama:    the Ollama app (or `ollama serve`)
backend:   npm run dev                (API + AI service)
frontend:  npx expo start             (development build)  |  npx expo start --go  (Expo Go)
admin:     npm run dev                (http://localhost:5173)
tunnel:    cloudflared tunnel --protocol http2 --url http://localhost:3000
checks:    backend: npm run e2e · npm run test-push -- --email <x>
           ai: .venv\Scripts\python -m app.eval / app.explain / app.sign_check
           frontend: npx tsx scripts/accel-rules-check.ts · node scripts/check-accel-catalog.mjs
```

### 2.2 Cloudflare quick tunnel (a temporary public https address)

Why: Google only redirects back to a public https address (never a LAN IP). It also lets a phone off the network reach the backend.

```powershell
cloudflared tunnel --protocol http2 --url http://localhost:3000
```

- **Keep that terminal open.** Closing it ends the tunnel, and the address is gone.
- It prints `https://<random-words>.trycloudflare.com`. **Each start gives new words.** Every time:
  1. `backend/.env` → `BACKEND_PUBLIC_URL=https://<words>.trycloudflare.com`. **Only the address**: no `/api`, no path, no trailing slash. The backend appends `/api/auth/google/...` itself; putting a path here caused "That isn't available" (a 404).
  2. Restart the backend (Ctrl+C → `npm run dev`). It reads `.env` only at start, and nodemon doesn't watch `.env`. **Never "touch" `backend/server.js` to restart:** that file must not exist (an empty one once broke `npm run dev`).
  3. Add the redirect URI in Google (§2.5).
  4. Check `https://<words>.trycloudflare.com/health`.
- **Errors:**

  | What you see | Meaning |
  |---|---|
  | `DNS_PROBE_FINISHED_NXDOMAIN` | The tunnel stopped; that address no longer exists |
  | Cloudflare error **1033** | No cloudflared is connected for that address |
  | Cloudflare **502** / log `Unable to reach the origin service… localhost:3000 refused` | The tunnel is fine, but the backend isn't running (e.g. mid-restart) |
  | Log `Failed to refresh DNS local resolver… i/o timeout` | A harmless network hiccup |
  | `Cannot determine default origin certificate path… cert.pem` | A **named-tunnel** command (`cloudflared tunnel run …`/`create`) was run without `cloudflared tunnel login`. Use the quick-tunnel command above. |

### 2.3 A fixed address (so the steps in §2.2 aren't needed every time)

| Option | Cost | Address | Catch |
|---|---|---|---|
| **Tailscale Funnel** (recommended) | Free | `https://<laptop>.<tailnet>.ts.net` | Install Tailscale on the laptop once; the phone needs nothing. `tailscale funnel --bg 3000` (runs in the background, survives reboots; `tailscale funnel reset` to stop). |
| ngrok | Free | one static `*.ngrok-free.app` | A browser warning page (bad for Google login), 20,000 requests a month (sign language alone uses ~1,800 an hour) |
| Cloudflare **named** tunnel | Domain only (~₱100–700 a year) | `https://api.yourdomain.com` | Domain on Cloudflare. Once: `cloudflared tunnel login` → `cloudflared tunnel create accessai` → `cloudflared tunnel route dns accessai api.yourdomain.com`. Then: `cloudflared tunnel run --url http://localhost:3000 accessai`. |

With a fixed address, set `BACKEND_PUBLIC_URL` and the Google redirect URI once. `EXPO_PUBLIC_API_URL` can also point to it, so the phone works from any network (Metro still needs the same Wi-Fi). The laptop and backend must still be running.

### 2.4 Push notifications (Firebase FCM, Android)

- **`google-services.json` is kept out of git**, because the GitHub repo is **public** and the file holds a Firebase API key that scanners flag. It stays in `frontend/` on this laptop for local runs. **EAS builds can't see git-ignored files**, so before the next APK build, give it to EAS once as a file variable:
  - **Website:** expo.dev → project → **Environment variables** → Add → name `GOOGLE_SERVICES_JSON`, type **File**, upload `frontend/google-services.json`, tick all environments, visibility Secret.
  - **Or the CLI:** `npx eas-cli env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment development --environment preview --environment production --visibility secret`.

  `frontend/app.config.js` uses that variable when it exists. (The APK already built includes the file, so nothing needs redoing now.)
- **Setup (once).** `frontend/google-services.json` (Firebase project `accessai-5bb61`) is in place on this laptop.
  1. Firebase console → ⚙ Project settings → **Service accounts** → **Generate new private key**. This JSON is **secret**: keep it outside the repo (e.g. `Documents\keys\`) and never commit it. It's the file whose JSON contains `"type": "service_account"`; it is *not* `google-services.json`.
  2. `cd frontend` → `npx eas-cli credentials`, then pick: Android → `development` → Google Service Account → Manage your Google Service Account Key for Push Notifications (FCM V1) → Set up → Upload a new service account key. At the prompt `Path to Google Service Account file: » api-000….json` (just an example name), type the **full path** to that key file. In File Explorer, Shift + right-click → Copy as path gets it for you. The website works too: expo.dev → project → Credentials → Android → `com.aeno.frontend` → FCM V1 service account key.
  3. Rebuild the dev APK: `npx eas-cli build --profile development --platform android`. Install it, sign in, and allow notifications.
  4. Xiaomi / Oppo / Vivo / Realme: set AccessAI to "No battery restrictions / Autostart".
- **Test with one phone:** close the app on the phone, then `cd backend` → `npm run test-push -- --email you@example.com`. Add `--channel chat_messages` for the message style. **No `< >` around the email**: PowerShell treats `<` as an operator. The backend doesn't need to be running for this.
- **Real flow with one phone:** run `npx expo start --web` and use a 2nd account in the browser as the friend, which sends messages or SOS to the phone.

  | test-push says | Fix |
  |---|---|
  | "No phone is registered…" | Old APK or Expo Go, or notifications weren't allowed |
  | `InvalidCredentials` | The FCM key wasn't uploaded to EAS |
  | `MismatchSenderId` | The key and `google-services.json` are from different Firebase projects |
  | ✓ but nothing shows | Phone notification settings, or battery saver |

- **Channels** (the server's `channelId` must match `notifications/push.ts`): `sos_alerts` (loudest), `sos_updates`, `chat_messages`. Android never lets a channel change after it's created (deleting and re-creating it restores the old settings), so any change to a channel's sound or importance needs a **new id** on both sides.

### 2.5 Google sign-in (OAuth)

- **`backend/.env`:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BACKEND_PUBLIC_URL` (the address only).
- **Google Cloud Console** → APIs & Services → **Credentials** (or Google Auth Platform → Clients) → the **Web application** client whose Client ID **equals** `GOOGLE_CLIENT_ID` in `.env` → **Authorized redirect URIs** → add:
  ```
  https://<tunnel address>/api/auth/google/callback
  ```
  Save, then wait 5–10 minutes. Leave JavaScript origins empty. Remove dead tunnel URIs.
- **If the client was deleted:** Create credentials → OAuth client ID → Web application, add the URI, then copy the new ID and secret into `.env` and restart.

  | Address | What goes there |
  |---|---|
  | `BACKEND_PUBLIC_URL` | `https://xxxx.trycloudflare.com` |
  | Google redirect URI | `https://xxxx.trycloudflare.com/api/auth/google/callback` |

- **Checking without a phone** (what was done on 2026-10-08):
  1. `curl` `http://localhost:3000/api/auth/google/start?redirect=frontend%3A%2F%2Fgoogle-auth` and follow its redirect to `/authorize` on the tunnel. That redirect leads to `accounts.google.com/...` and shows the exact `redirect_uri` and `client_id` the backend sends.
  2. Request that Google URL. A redirect to `signin/oauth/error?authError=…` (base64; it decodes to `redirect_uri_mismatch`) means Google doesn't have that URI **on that client**.
  3. Google's error page on the phone also has "error details" showing both values.

### 2.6 Email (sign-up codes, forgot password)

- **`backend/src/utils/mailer.js` uses Gmail SMTP:** `SMTP_USER=<gmail>` and `SMTP_PASS=<App Password>` in `backend/.env`. `SMTP_HOST`, `SMTP_PORT` and `MAIL_FROM` are optional. Without SMTP settings, dev prints the email in the backend terminal instead.
- **App Password:**
  1. The Google account needs 2-Step Verification on.
  2. Go to https://myaccount.google.com/apppasswords → name it "AccessAI" → Create.
  3. Copy the 16-letter code into `SMTP_PASS` and restart the backend.
  4. Google **revokes all App Passwords when the account password is changed or reset**, which is the current problem in §0.
- **Check the login without sending anything:** a nodemailer `transporter.verify()` with the `.env` values. `EAUTH 535` means the App Password is wrong or revoked.
- **Limits:** one code per account per minute, and 5 code requests per 15 minutes per IP (`emailCodeLimiter`). Check Spam the first time.

---

## 3. What's next (after testing)

1. **Letters (fingerspelling) models**, when trained: drop them in `ai/models/sign/<fsl|asl>/letters/` (see the README there). If the model's input isn't the 32-frame Holistic one, `ai/app/sign/registry.py` needs a feature builder for it.
2. **Better sign accuracy:** collect clips of your signers (the tester already saves `.npz` recordings) and retrain. Optional later: "Was this right?" in the app to collect corrections (needs consent).
3. **iPhone push** once there's an Apple Developer account.
4. **Hosting the AI** for real users (a small server with Ollama), or a lighter on-phone fallback.
5. **Small:** a friend detail page (remove friend, SOS circle). Blocking users isn't built (unfriend only).

## 4. Decisions (change any)

1. **Preferences are saved per phone**, offline-first, not synced.
2. **Profiles are presets only.** Blind / low vision also switches **Accel and "Hey Accel" on**. Other profiles leave Accel as it is.
3. **Accel always asks yes/no** before acting, except reading things aloud. SOS goes straight to the countdown (which can be cancelled). Never by voice: delete account, sign out, unfriend.
4. **What Accel says is fixed sentences**, never AI-written text. The AI only picks an action from the list.
5. **No auto-send** anywhere (no blind↔deaf auto loop). Sign language and Accel's messages wait for the user's tap or "yes".
6. **Test SOS alerts friends as TEST** (so the setup can be checked), but never texts.
7. **SOS = live alert + push + chat message + SMS composer + live GPS for 30 min.**
8. **Friends are added by code or QR only** (and by spoken code via Accel).
9. **Unfriending deletes the chat** for both people. **Sign-out clears** cached contacts, friends, chats and SOS alerts from the phone, and removes the push address.

## 5. Open questions

1. Where will the AI run for real users (and which chat model, given the license)?
2. Should "Hey Accel" stay on by default for Blind / low vision (battery vs convenience)?
3. A custom SOS sound for the notification channel? (Needs an APK rebuild; Android channels can't change once created.)
4. Existing users won't see the new privacy notice unless there's a "terms updated" screen. Add one?

## 6. When the project is finished — learning prompt

Paste this into a fresh Claude session:

> Read HANDOFF.md, ai/README.md and the code. Teach me AccessAI from the ground up — I vibe-coded it and need to truly understand and defend it. (1) Draw the big picture: the Expo app, Express + MongoDB + socket.io backend, the Python AI service (Ollama, ChromaDB, MediaPipe sign model) and the admin web, and how one request travels between them. (2) Walk me through these real flows end to end with file links: sign-up/login, in-person Conversation (speech → text → speech), friend chat offline → online, SOS (trigger → friends, push, SMS, live GPS, I'm safe), an Accel voice command, and sign language → sentence. (3) Explain each AI idea using our own code: embeddings, vector database, cosine similarity, top-k, thresholds, LLM JSON-schema output and guardrails, MediaPipe landmarks, normalization, the Conv1D model and confidence. (4) Explain security (auth, JWT, validation, injection, rate limits) and offline-first design. (5) After each section, quiz me with one question at a time and wait for my answer before moving on. (6) End with a cheat sheet of commands and a list of likely thesis-defense questions with good answers.
