# Model integration guide

How to plug models into AccessAI later — and what to check each time.

| Section | When you need it |
|---|---|
| [A. The four sign model slots](#a-the-four-sign-model-slots) | Any time you drop in a sign model |
| [B. Retrained word models](#b-retrained--improved-word-models) | A better FSL-105 / WLASL run, or more signs |
| [C. Letters (fingerspelling) models](#c-letters-fingerspelling-models) | When the letters models are trained |
| [D. Laya's AI models and commands](#d-layas-ai-models-and-commands) | Changing the LLM / embeddings, adding a voice command |
| [E. Sign recognition on the phone](#e-moving-sign-recognition-onto-the-phone-offline) | Making sign language work without the laptop |
| [F. Quick reference](#f-quick-reference) | Every command in one table |

Background on how the pieces work: [`ai/README.md`](README.md).

---

## A. The four sign model slots

```
ai/models/sign/
  asl/words/     WLASL     (125 signs)   ✓ retrained 2026-10-19 (hand features; test 61.2% / top-5 76.8%)
  fsl/words/     FSL-105   (105 signs)   ✓ retrained 2026-10-21 (hand + velocity; test 79.3% / top-5 94.9%)
  asl/letters/   ASL A–Z   (hand-21)     ✓ 2026-10-19 (test 94.7% / top-5 98.0%; J, Z unmeasured)
  fsl/letters/   FSL A–Z   (hand-21)     ✓ 2026-10-19 (test 96.1% / top-5 98.7%; Z weak, no Ñ/NG)
  All four: aspect_corrected (trained on real picture proportions) — HANDOFF.md §52.
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

- `input`: what the model expects. `holistic-32` (32 frames × 69 points, the default) or `hand-21` (one frame of one hand, for letters; section C). Any other value leaves the model "not available" until its code is added.
- `segmentation`: how a sign is cut out of the video. `auto` (hands up, then down; the default) or `hold` (a handshape held still; the default for `hand-21`).
- `fixed_seconds`: the length of the training clips. FSL-105 clips are 4 s with resting hands around the sign, so 4.0; WLASL is trimmed to the sign, so `null`. It controls how much padding the segmenter puts around a detected sign (`segmenter.py`).
- `min_confidence`: the default "how sure before adding a word". The app's Loose / Normal / Strict (0.35 / 0.5 / 0.7) is sent per session and overrides it.

**The app needs no change when a model appears.** It asks `GET /api/sign/models`. Letters stops saying "Coming soon" by itself, both in the camera's sheet and in Settings → Sign language, which also lists all four slots as "Ready" or "Coming soon" (`frontend/src/components/sign/SignChoices.tsx`, `signReady`). Removing the files turns it back to "Coming soon".

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
| Model input | `(1, 32, 207)` float32, plus the extra numbers its `features.json` asks for (ASL: 291) | `make_features()`, `registry.py` → `predict()` |

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

**Installed 2026-10-21 (HANDOFF.md §52):** both letters models are `hand-21` (one hand, one frame, 42 numbers), read with `HoldSegmenter`. Their notebooks' `normalize_hand` (wrist-relative, ÷ largest wrist distance, after x × width ÷ height) is exactly `registry.normalize_hand` and `features.ts normalizeHand` once `shape_for_model` has stretched x; `sign-check` compares both letters models' top 5 with NumPy.

Drop the files into `ai/models/sign/<fsl|asl>/letters/` (the `PUT_MODEL_FILES_HERE.txt` there says the same). Labels look like `{"0": "A", "1": "B", …}`. Then pick the `meta.json` that matches the model:

| The model takes | Copy to `meta.json` | Also do |
|---|---|---|
| 32 frames × 69 Holistic points (like the word models) | `meta.example.json` | nothing |
| ONE frame of one hand (21 points), the usual fingerspelling model | `meta.hand21.example.json` | paste the notebook's normalization into `normalize_hand()` |
| N frames of one hand (letters with motion, like J and Z) | (not built) | a builder like `build_hand21` over `sample_frame_indices(n, N)` frames |

### Input 1: same as the word models (`holistic-32`)
- **Server:** nothing to change.
- **Segmenting:** the same AUTO rule as words (hand above the waist line → a "sign"), so each letter must be signed as a separate movement. That's fine for slow spelling, but continuous fingerspelling will merge letters, so watch for that in testing.

### Input 2: one hand, one frame (`hand-21`): built
- **Features**, `registry.py`:
  - `build_hand21()` takes the frame nearest the middle of the hold, the right hand if present, else the left. It returns `(1, 42)` = 21 × (x, y).
  - **`normalize_hand()` is a placeholder.** It is wrist-relative and scaled to hand size 1. **Replace its body with the letters notebook's exact normalization** (and use the same in the tester), or the model gets numbers it never saw.
- **Segmenting**, `segmenter.py` → `HoldSegmenter`:
  - A letter = the handshape held still for `HOLD_SECONDS` (0.4 s), read once.
  - The next letter needs the shape to change (`HOLD_SHAPE`) or the hand to move (`HOLD_MOVE`). A double letter ("LL") = move a little and hold again.
  - Tune the three numbers while testing.
- **Choosing it**, `session.py`: `meta.json` `"segmentation": "hold"`. That is the default for `hand-21`.
- **Checked** with synthetic frames on 2026-10-08:
  - one read per hold, no repeats while holding;
  - a new shape is a new letter, and moving and holding again is a double letter;
  - a fake hand-21 model predicts end to end;
  - the word models still match the tester 227/227.

### What the app already does with letters
- **Letters join into words.** `Composer.tsx` → `addSigned(sign, unit)`: "H","E","L","L","O" → `hello`, and a pause (2.5 s) ends the word. "Undo last letter" removes one letter.
- **Spelling fix** (online, if "Make signed words into a sentence" is on). On a pause, the spelled word goes to `/assistant/polish` with `kind: "spell"` (`ai/app/polish.py`, `SPELL_PROMPT`).
  - The answer is only used if it is one word at most 2 letters different (`_looks_safe`). Otherwise the letters stay as spelled, so names are safe.
  - The app shows "Spelling fixed: …" with **Undo**.
- **"Did you mean" chips** work as they are (top 5 letters).

### Checks for a letters model
1. The log line, then `GET /sign/models` shows `letters: available: true` (and its `input`). Letters turns on in the app.
2. On the phone: spell a known word slowly. Check that each letter appears once, double letters work, and the word ends on a pause.
3. Add letters recordings to the tester, then a `sign_check` comparison.

---

## D. Laya's AI models and commands

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

### Adding a new Laya command (checklist)
1. **`ai/intents.json`**: a new entry with `id` (e.g. `nav.learn_lesson`), a clear `description`, `slots` (from `friendName`, `messageText`, `friendCode`, `value`), and **10+ examples** in English, Filipino and Taglish.
2. **`frontend/src/laya/catalog.ts`**: the same id with `label`, `category`, `confirm`, and a `guide` example (it shows on the "What Laya can do" screen).
3. **`frontend/src/laya/actions.ts`**: what it does, inside `planFor()`. Use `confirm` (a yes/no question) for anything that changes something or moves the user; `say` for read-aloud only. **Laya only speaks fixed sentences from here**, never AI text.
4. **`frontend/src/laya/rules.ts`** (optional but good): a pattern so it works **offline and instantly**. Put it *before* more general rules.
5. Checks:
   ```powershell
   cd frontend
   node scripts/check-laya-catalog.mjs          # same ids in the app and the AI service
   npx tsx scripts/laya-rules-check.ts          # add a few cases for the new rule first
   cd ..\ai
   .venv\Scripts\python -m app.eval              # add 2–3 NEW sentences to eval.jsonl first (never copy them into intents.json)
   ```
6. If a new slot or new screen is needed: also `ai/app/interpret.py` (the slot schema and checks), `backend/src/controllers/assistantController.js` (the slot whitelist), and `frontend/src/laya/screens.ts` ("where am I", "what's on this screen", "what can I do here").
7. **A command for one screen only** (like "my turn" in Conversation mode): give it `screen: '<the screen's name>'` in `catalog.ts`, put its rule in `SCREEN_RULES` in `rules.ts` (tried first, but only while that screen is open; `hereOnly` if it means nothing elsewhere, like "continue"), and its handler in that screen's `useLayaScreen({ commands })` (`frontend/src/laya/screenContext.ts`), next to the button it does the same as. Don't add it to `planFor()`: asked on another screen, Laya says where it works.

### Guardrails that must stay
- The LLM's `intent` is an **enum of the shortlist** (Ollama JSON schema), and is re-checked in Python, Node and the app.
- The sentence is passed as data in `<command>` tags; account actions exist only as `blocked.account`, which is refused by voice.
- `messageText` must be made of words actually said.
- Laya confirms with **yes/no** before acting, and speaks only fixed sentences.
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
| Laya accuracy on held-out sentences | `.venv\Scripts\python -m app.eval` | `ai/` |
| See one Laya decision step by step | `.venv\Scripts\python -m app.explain "sentence"` | `ai/` |
| App ↔ AI action ids match | `node scripts/check-laya-catalog.mjs` | `frontend/` |
| Laya offline rules | `npx tsx scripts/laya-rules-check.ts` | `frontend/` |
| Everything through the backend (incl. a sign session) | `npm run e2e` (or `npm run e2e -- ai`) | `backend/` |

| Integration | Files you touch |
|---|---|
| New/retrained word model | `ai/models/sign/<lang>/words/{model.keras,labels.json,meta.json}` |
| Letters model, same input as words | `ai/models/sign/<lang>/letters/{model.keras,labels.json}` (+ `meta.example.json` → `meta.json` if needed) |
| Letters model, one hand one frame | the above with `meta.hand21.example.json` → `meta.json`, plus the notebook's normalization in `normalize_hand()` (`registry.py`) |
| Different chat / embedding model | `backend/.env` (`AI_CHAT_MODEL`, `AI_EMBED_MODEL`), maybe thresholds |
| New Laya command | `ai/intents.json`, `laya/catalog.ts`, `laya/actions.ts`, `laya/rules.ts`, `ai/eval.jsonl` |
| On-phone sign | new `frontend/src/sign/*`, a new hook beside `use-sign-recognition.ts`, `prefs.signEngine`, native libraries + rebuild |
