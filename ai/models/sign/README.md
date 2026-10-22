# Sign language models

> **Full guide:** [`ai/MODEL_INTEGRATION.md`](../../MODEL_INTEGRATION.md). It covers retrained models, letters models (with each possible input format), Laya's AI models and moving sign recognition onto the phone.

One folder per language and unit. The AI service loads whatever is here
when it starts (`npm run dev` in `backend/`), and the app shows only what's
available — e.g. Letters says "Coming soon" until a letters model is in
place. Each folder has a `PUT_MODEL_FILES_HERE.txt` saying what goes there.

```
ai/models/sign/                    (all four retrained 2026-10-19/21, HANDOFF.md §52)
  fsl/words/     model.keras + labels.json + meta.json + features.json
                 FSL-105, 105 words, hand + velocity features      ✓  test 79.3% / top-5 94.9%
  asl/words/     model.keras + labels.json + meta.json + features.json
                 WLASL, 125 words, hand features                    ✓  test 61.2% / top-5 76.8%
  fsl/letters/   model.keras + labels.json + meta.json (hand-21)   ✓  test 96.1% / top-5 98.7%
  asl/letters/   model.keras + labels.json + meta.json (hand-21)   ✓  test 94.7% / top-5 98.0%
```

All four are trained on real picture proportions (`aspect_corrected: true` in
features.json or meta.json): the AI service and the phone stretch x by the
picture's width ÷ height before reading (registry.py `shape_for_model`,
features.ts `shapeForModel`). The previous word models are backed up in
`~/Documents/AccessAI-model-backups/2026-10-21/`. After a swap, export for
the phone: `.venv\Scripts\python scripts\export_sign_model.py`, then
`export_sign_fixtures.py` and `npx tsx scripts/sign-check.ts` in frontend/.

## Swapping in a better model

1. Copy `model.keras` **and** `labels.json` from the **same** Kaggle run
   into the folder (replace the old ones). `model.tflite` also works if
   `ai-edge-litert` is installed, but `model.keras` needs nothing extra.
2. Restart `npm run dev`. The log says e.g. `Sign model FSL words: 105 signs`,
   or why it couldn't load (for example "the model has 120 outputs but
   labels.json has 105 entries — files from different training runs?").
3. Check it against your tester recordings:
   `cd ai` then `.venv\Scripts\python -m app.sign_check`.

The `.keras` files are not in git (they're 13 MB each). On a new computer,
copy them from `AccessAI-tester/models/` like this:

| From the tester           | To here                         |
|---------------------------|---------------------------------|
| `models/fsl/model.keras`  | `ai/models/sign/fsl/words/`     |
| `models/fsl/labels.json`  | `ai/models/sign/fsl/words/`     |
| `models/asl/model.keras`  | `ai/models/sign/asl/words/`     |
| `models/asl/labels.json`  | `ai/models/sign/asl/words/`     |

## What a model must accept (all current models)

- Input `(1, 32, 207)` float32: 32 frames × 69 MediaPipe Holistic points ×
  (x, y, present), centred on the shoulders and scaled by shoulder width —
  exactly the tester's `pack()` + `normalize()` (copied in
  `ai/app/sign/features.py`).
- A model trained with extra numbers per frame says so in a `features.json`
  from the same run: `{"hand": true}` adds 42 + 42 hand-shape numbers (291 in
  all, the ASL model), `"velocity": true` adds 138 more. `make_features()` in
  `features.py` builds them, exactly like the tester. A model whose input
  width doesn't match is shown as not ready instead of crashing.
- Output: softmax over the classes in `labels.json`.

## Optional `meta.json`

```json
{
  "input": "holistic-32",
  "fixed_seconds": 4.0,
  "min_confidence": 0.5
}
```

- `fixed_seconds`: how long the training clips were. FSL-105 clips are 4 s
  with resting hands around the sign, so each sign is centred in a ~4 s
  window; leave it out (`null`) for clips trimmed to the sign (WLASL).
- `min_confidence`: the default "how sure before adding a word" (the app's
  Loose / Normal / Strict overrides it).
- `input`: `holistic-32` (the default, all word models) or `hand-21` (one
  frame of one hand, for a typical letters model, with `"segmentation":
  "hold"`). See `letters/meta.hand21.example.json` and MODEL_INTEGRATION.md
  section C: a `hand-21` model also needs the notebook's normalization in
  `normalize_hand()` (`ai/app/sign/registry.py`).
