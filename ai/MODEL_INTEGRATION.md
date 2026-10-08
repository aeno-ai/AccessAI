# Model integration guide

How to plug models into AccessAI later — and what to check each time.

| Section | When you need it |
|---|---|
| [A. The four sign model slots](#a-the-four-sign-model-slots) | Any time you drop in a sign model |
| [B. Retrained word models](#b-retrained--improved-word-models) | A better FSL-105 / WLASL100 run, or more signs |
| [C. Letters (fingerspelling) models](#c-letters-fingerspelling-models) | When the letters models are trained |
| [D. Accel's AI models and commands](#d-accels-ai-models-and-commands) | Changing the LLM / embeddings, adding a voice command |
| [E. Sign recognition on the phone](#e-moving-sign-recognition-onto-the-phone-offline) | Making sign language work without the laptop |
| [F. Quick reference](#f-quick-reference) | Every command in one table |

Background on how the pieces work: [`ai/README.md`](README.md).

---

## A. The four sign model slots

```
ai/models/sign/
  asl/words/     WLASL100  (100 signs)   ✓ installed
  fsl/words/     FSL-105   (105 signs)   ✓ installed
  asl/letters/   ASL fingerspelling      — not trained yet
  fsl/letters/   FSL fingerspelling      — not trained yet
```

Each folder takes:

| File | Required | Notes |
|---|---|---|
| `model.keras` | one of these two | Runs with plain NumPy (`ai/app/sign/numpy_model.py`), so **no TensorFlow**. The recommended choice, especially on Windows. |
| `model.tflite` | one of these two | Runs only if `ai-edge-litert` is installed: add it to `ai/requirements.txt`, and `npm run dev` installs it. Used only when there's no `model.keras`. |
| `labels.json` | yes | Output index → name, e.g. `{"0": "APRIL", "1": "AUGUST"}`. Must come **from the same training run** as the model. |
| `meta.json` | no | Settings; see below. Without it, the defaults in `registry.py` (`DEFAULTS`) apply. |

`meta.json` fields (`ai/app/sign/registry.py` → `_load`):

```json
{
  "input": "holistic-32",
  "fixed_seconds": 4.0,
  "min_confidence": 0.5
}
```

- `input`: what the model expects. Only `holistic-32` exists today (32 frames × 69 points). Any other value leaves the model "not available" until its code is added (section C).
- `fixed_seconds`: the length of the training clips. FSL-105 clips are 4 s with resting hands around the sign, so 4.0; WLASL is trimmed to the sign, so `null`. It controls how much padding the segmenter puts around a detected sign (`segmenter.py`).
- `min_confidence`: the default "how sure before adding a word". The app's Loose / Normal / Strict (0.35 / 0.5 / 0.7) is sent per session and overrides it.

**The app needs no change when a model appears.** It asks `GET /api/sign/models`, and the Letters chip un-greys by itself (`frontend/src/components/conversation/SignPanel.tsx`, `lettersReady`). Removing the files greys it out again.

### Check after every model swap

1. **Restart** `npm run dev` in `backend/`. Models load only at start. The log says what happened:
   ```
   [ai] Sign model FSL words: 105 signs
   [ai] Sign model FSL letters: not installed yet
   [ai] Sign model ASL words: could not load: …            ← broken file
   [ai] Sign model ASL words: the model has 120 outputs but labels.json has 100 entries — files from different training runs?
   ```
2. **Check what the service sees:** `curl http://127.0.0.1:8001/sign/models`
3. **Replay the tester's recordings** (words models; letters once the tester supports them):
   ```powershell
   cd ai
   .venv\Scripts\python -m app.sign_check            # uses ~\Downloads\AccessAI-tester
   .venv\Scripts\python -m app.sign_check D:\path\to\AccessAI-tester
   ```
   For the same model it should say `N/N match the tester`. For a **new** model, mismatches are expected. What matters is whether it now gets more signs *right*: the tester's TEST-mode recordings store the word that was being signed in `target` (AUTO-mode ones store "auto"), so count how often the new top-1 equals `target`. That's a small addition to `sign_check.py`.
4. **Through the backend:** `npm run e2e -- ai` in `backend/` (starts a session and sends a real video).
5. **Live on the phone:** sign mode → the right language/unit → sign a few known words.

---

## B. Retrained / improved word models

### The steps
1. From the Kaggle notebook's output, take **both** `model.keras` and `labels.json` from the same run (`fsl105_model/` or `wlasl100_model/`).
2. Copy them into `ai/models/sign/fsl/words/` or `ai/models/sign/asl/words/`, replacing the old files. Keep a copy of the old pair in case the new one is worse.
3. Restart `npm run dev`, then go through the checks in section A.
4. Also copy them into `AccessAI-tester/models/<fsl|asl>/` so the tester and the app stay the same model.

### The contract (the app's pipeline = the training pipeline)

The server feeds the model exactly what the notebooks trained on, using code copied from the tester (`ai/app/sign/features.py`):

| Step | Value | Where |
|---|---|---|
| Landmarks | MediaPipe **0.10.14 legacy Holistic**, `model_complexity=1`, `smooth_landmarks=True`, `refine_face_landmarks=False`, detection/tracking 0.5 | `new_holistic()` |
| Points per frame | 69 = 21 left hand + 21 right hand + 7 pose `[0,11,12,13,14,15,16]` + 20 face | `pack()`, `POSE_IDX`, `FACE_IDX` |
| Values per point | x, y, present (a missing group = all zeros) | `pack()` |
| Frames | 32, evenly spaced: `round(linspace(0, n-1, 32))` | `sample_frame_indices()` |
| Normalization | Centre on the shoulders' midpoint, divide by shoulder width; the clip median if a frame has no shoulders, else 0.5 / 0.25 | `normalize()` |
| Video | **Not mirrored** (the app's "Mirror" chip undoes phones that save mirrored video) | `session.py` |
| Model input | `(1, 32, 207)` float32 | `registry.py` → `predict()` |

**If a notebook changes any of these**, change `features.py` the same way, and the tester too. Otherwise the model gets numbers it has never seen, and its accuracy drops with no error message.

### Other changes
- **More signs (or different signs):** just a new model + `labels.json`; nothing in the app or server changes. `registry.py` refuses a pair whose output count ≠ label count.
- **A new architecture** (e.g. the GRU variant): `numpy_model.py` only supports Dense, BatchNormalization, Conv1D, Dropout, Activation and GlobalAveragePooling1D. Either ship `model.tflite` (install `ai-edge-litert`; the runner, `TfliteRunner`, already exists in `registry.py`), or add the new layer's maths to `numpy_model.py` and check it against TensorFlow's predictions, as was done for Conv1D.
- **Different clip timing** (e.g. FSL clips trimmed like WLASL): set `fixed_seconds` in `meta.json`.
- **Accuracy:** the models have **no "not a sign" class**; they always pick something. That's why there's a confidence threshold and the "Did you mean" top-5 chips. Good ways to improve:
  - record your own signers with the tester (it saves `.npz` recordings) and add them to training;
  - train a "no sign / resting" class. Then the server could drop those instead of relying on the threshold: one `if` in `SignSession._event_for` (`session.py`).

---

## C. Letters (fingerspelling) models

The letters models aren't trained yet, and their input isn't decided. Here's what each choice means for the code. Where to drop the files: `ai/models/sign/<fsl|asl>/letters/` (see the `PUT_MODEL_FILES_HERE.txt` there). Labels look like `{"0": "A", "1": "B", …}`.

### Option 1 — same input as the word models (32 frames × 69 Holistic points)
- **Server:** nothing to change. Drop in `model.keras` + `labels.json`. Add `meta.json` only if the clips' timing differs.
- **Segmenting:** the same AUTO rule as words (hand above the waist line → a "sign"), so each letter must be signed as a separate movement. That's fine for slow spelling, but continuous fingerspelling will merge letters, so watch for that in testing.
- **App:** the change described under "App changes" below.

### Option 2 — one hand, one frame (21 hand landmarks, a still handshape)
Most fingerspelling models look like this. Three server pieces:

1. **Features**, in `registry.py`. Allow the new input name where `holistic-32` is checked, and add a builder. The hand points are already in `pack()`'s output: slots 0–20 left hand, 21–41 right.
   ```python
   # e.g. meta.json: { "input": "hand-21", "segmentation": "hold" }
   def build_hand21(frames):          # frames: (n, 69, 3) from pack()
       frame = frames[-1]             # the steadiest frame (see segmenter)
       hand = frame[21:42] if frame[21:42, 2].any() else frame[0:21]   # right hand, else left
       # normalize EXACTLY like the letters notebook does (often: relative to the wrist, scaled by hand size)
       return hand[:, :2].reshape(1, -1)
   ```
   Then make `SignModel.predict()` call the builder for that input instead of the 32-frame path.
2. **Segmenting**, in `segmenter.py`. Add a `HoldSegmenter` next to `AutoSegmenter`:
   - a letter = the hand **held still** for ~0.3–0.5 s (wrist and fingertips barely move between frames) → read once;
   - don't repeat it until the hand moves or changes shape (debounce);
   - two different letters in a row are fine; a double letter ("LL") needs the hand to move away and back.

   `SignSession` (`session.py`) picks the segmenter from `meta.json` `"segmentation": "hold"` (default `"auto"`).
3. **Training/inference match:** copy the letters notebook's normalization exactly, the same way `features.py` copies the words notebook. Add the letters case to `sign_check.py`, so recordings can be replayed against it.

### Option 3 — a short hand sequence (letters with motion, like J and Z)
- Like option 2, but the builder takes N frames of the hand (use `sample_frame_indices(n, N)` from `features.py`).
- Segmenting can stay "hold", with the clip being the frames since the last read letter; or use AUTO if each letter is a distinct movement.

### App changes (needed for any letters model)
Today the app treats every recognized sign as a **word**: `Composer.tsx` → `addSignedWord()` joins them with spaces, and when signing pauses, `signWordsToSentence()` sends them to `/assistant/polish` with `kind: "gloss"`. Letters need:

1. **No spaces between letters.** When the session's unit is `letters`, `addSignedWord()` appends to the current word ("H", "E", "L", "L", "O" → `hello`), and a pause ends the word (adds a space). `SignPanel` already knows the unit; pass it to `onWord`.
2. **Spelling fix (optional, online).** Add `kind: "spell"`:
   - `ai/app/polish.py`: a short prompt like "these letters were fingerspelled, possibly with mistakes; return the most likely word or name; never invent; keep it if unsure", with a tight length check.
   - `ai/app/main.py`: `PolishRequest.kind` pattern `^(message|gloss|spell)$`.
   - `backend/src/validators/assistantValidators.js`: allow `spell`.
   - Show it with Undo, like "Undo sentence" today, because names must stay as spelled.
3. **The "Did you mean" chips** work as they are (top 5 letters).

### Checks for a letters model
1. The log line, then `GET /sign/models` shows `letters: available: true`. The app's Letters chip turns on.
2. On the phone: spell a known word slowly. Check each letter appears once (debounce), double letters work, and the word ends on a pause.
3. Add letters recordings to the tester, then a `sign_check` comparison.

---

## D. Accel's AI models and commands

### Swapping the models
In `backend/.env` (the AI service reads them through `npm run dev`):
```
AI_CHAT_MODEL=qwen2.5:3b     # the "understander" (picks an action, pulls out details, fixes grammar)
AI_EMBED_MODEL=bge-m3        # sentences → numbers for the vector search
```
- Restart `npm run dev`. **Ollama downloads a new model by itself** the first time (watch the `[ai]` lines).
- **Changing the embedding model rebuilds the vector index automatically.** The index's stored hash includes the model name (`index.py`).
- **Choosing a chat model:** small and fast on a CPU, good at following JSON schemas, and some Filipino.
  - `qwen2.5:3b` is the current one. Its licence is **research-only**, which is fine for the thesis but not for real users.
  - `llama3.2:3b` allows commercial use under Meta's licence.
  - `qwen2.5:1.5b` is faster but less accurate.

  Measured on this laptop: ~0.7 s when the vector search decides alone, 2.5–7 s when the LLM is needed.
- **Choosing an embedding model:** it must handle **Tagalog/Taglish**. `bge-m3` does (multilingual training); `paraphrase-multilingual` doesn't list Tagalog.

### After a swap: measure
```powershell
cd ai
.venv\Scripts\python -m app.eval                                  # accuracy on held-out sentences (was 35/35)
.venv\Scripts\python -m app.explain "i need to speak with a deaf friend"
```
If accuracy drops, tune the thresholds (`ai/app/config.py`, or in `backend/.env`):

| Setting | Default | Meaning |
|---|---|---|
| `AI_HIGH` | 0.82 | At least this similarity **and** a clear lead → answer without the LLM |
| `AI_MARGIN` | 0.04 | The "clear lead" over the next action |
| `AI_LOW` | 0.50 | Below this → "I didn't catch that" |
| `AI_TOPK` | 12 | How many nearest examples to look at |

Different embedding models give different similarity ranges, so re-tune after changing `AI_EMBED_MODEL`. `explain` shows the scores.

### Adding a new Accel command (checklist)
1. **`ai/intents.json`**: a new entry with `id` (e.g. `nav.learn_lesson`), a clear `description`, `slots` (from `friendName`, `messageText`, `friendCode`, `value`), and **10+ examples** in English, Filipino and Taglish.
2. **`frontend/src/accel/catalog.ts`**: the same id with `label`, `category`, `confirm`, and a `guide` example (it shows on the "What Accel can do" screen).
3. **`frontend/src/accel/actions.ts`**: what it does, inside `planFor()`. Use `confirm` (a yes/no question) for anything that changes something or moves the user; `say` for read-aloud only. **Accel only speaks fixed sentences from here**, never AI text.
4. **`frontend/src/accel/rules.ts`** (optional but good): a pattern so it works **offline and instantly**. Put it *before* more general rules.
5. Checks:
   ```powershell
   cd frontend
   node scripts/check-accel-catalog.mjs          # same ids in the app and the AI service
   npx tsx scripts/accel-rules-check.ts          # add a few cases for the new rule first
   cd ..\ai
   .venv\Scripts\python -m app.eval              # add 2–3 NEW sentences to eval.jsonl first (never copy them into intents.json)
   ```
6. If a new slot or new screen is needed: also `ai/app/interpret.py` (the slot schema and checks), `backend/src/controllers/assistantController.js` (the slot whitelist), and `frontend/src/accel/screens.ts` ("where am I").

### Guardrails that must stay
- The LLM's `intent` is an **enum of the shortlist** (Ollama JSON schema), and is re-checked in Python, Node and the app.
- The sentence is passed as data in `<command>` tags; account actions exist only as `blocked.account`, which is refused by voice.
- `messageText` must be made of words actually said.
- Accel confirms with **yes/no** before acting, and speaks only fixed sentences.
- No transcripts are stored; the AI service listens only on 127.0.0.1.

### Hosting the AI for real users (later)
Today it runs on the laptop. For real users, run the same `ai/` service plus Ollama on a server (a small CPU VM works for the 3B model, though slowly; a GPU VM is fast). Set `AI_SERVICE_URL` in the backend's environment (`backend/src/utils/aiClient.js`). The phone never talks to it directly, so nothing in the app changes.

---

## E. Moving sign recognition onto the phone (offline)

**Why:** sign language would then work with no laptop and no internet, which fits the app's offline-first rule. Keep the server version as a fallback; both can exist.

**What exists already:**
- `.tflite` files from Kaggle: `AccessAI-tester/fsl-zip/fsl105_model/model.tflite` and `AccessAI-tester/wsl-zip/wlasl100_model/model.tflite` (float16).
- The pipeline is small, pure maths, easy to port to TypeScript: `pack`, `sample_frame_indices`, `normalize` (`features.py`) and `AutoSegmenter` (`segmenter.py`).

**The building blocks (all need the development build, not Expo Go):**

| Need | Likely library |
|---|---|
| Camera frames in real time | `react-native-vision-camera` (frame processors) |
| Landmarks on the phone | MediaPipe on device (a vision-camera frame-processor plugin around MediaPipe's pose/hand/face landmarkers, or a community MediaPipe package) |
| Running the model | `react-native-fast-tflite` with `model.tflite` |

**The plan, when you're ready:**
1. **Landmarks first, and the biggest risk.** The models were trained on **legacy Holistic (MediaPipe 0.10.14)**. Phone MediaPipe must give the *same* 69 points: the same pose/face indices, normalized x/y, and the same handedness (left/right; watch mirroring). Prove it by running the same videos through both and comparing the top-1 word. Build that comparison like `sign_check.py`. If the points differ, retrain on phone-extracted landmarks.
2. Port `features.py` + `segmenter.py` to TypeScript (e.g. `frontend/src/sign/`). Copy the numbers exactly.
3. Run the `.tflite` with `react-native-fast-tflite` on the `(1, 32, 207)` input.
4. **Keep the app the same:** add `prefs.signEngine: 'phone' | 'server'`, and have an on-phone hook emit the **same `SignEvent` shape** as `frontend/src/hooks/use-sign-recognition.ts`. Then `SignPanel` and `Composer` don't change.
5. Measure on a mid-range Android phone: frames per second, battery and heat. The server version stays the fallback.

**Costs:**
- These are custom native modules: no Expo Go, a dev-APK rebuild, and the owner's go-ahead.
- iOS needs each library's iOS support checked.
- Sentence-making (gloss → sentence) still needs the AI server; offline, the words stay as signed.

---

## F. Quick reference

| Do | Command | Where |
|---|---|---|
| See which sign models loaded | the `[ai] Sign model …` lines of `npm run dev`, or `curl http://127.0.0.1:8001/sign/models` | `backend/` |
| Check the sign pipeline against the tester | `.venv\Scripts\python -m app.sign_check [tester path]` | `ai/` |
| Accel accuracy on held-out sentences | `.venv\Scripts\python -m app.eval` | `ai/` |
| See one Accel decision step by step | `.venv\Scripts\python -m app.explain "sentence"` | `ai/` |
| App ↔ AI action ids match | `node scripts/check-accel-catalog.mjs` | `frontend/` |
| Accel offline rules | `npx tsx scripts/accel-rules-check.ts` | `frontend/` |
| Everything through the backend (incl. a sign session) | `npm run e2e` (or `npm run e2e -- ai`) | `backend/` |

| Integration | Files you touch |
|---|---|
| New/retrained word model | `ai/models/sign/<lang>/words/{model.keras,labels.json,meta.json}` |
| Letters model, same input | `ai/models/sign/<lang>/letters/*` + `Composer.tsx` (letters join) + optional `polish.py` `spell` |
| Letters model, new input | the above + `registry.py` (feature builder) + `segmenter.py` (hold segmenter) + `session.py` (pick it) |
| Different chat / embedding model | `backend/.env` (`AI_CHAT_MODEL`, `AI_EMBED_MODEL`), maybe thresholds |
| New Accel command | `ai/intents.json`, `accel/catalog.ts`, `accel/actions.ts`, `accel/rules.ts`, `ai/eval.jsonl` |
| On-phone sign | new `frontend/src/sign/*`, a new hook beside `use-sign-recognition.ts`, `prefs.signEngine`, native libraries + rebuild |
