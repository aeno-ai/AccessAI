# Sign language models

> **Full guide:** [`ai/MODEL_INTEGRATION.md`](../../MODEL_INTEGRATION.md). It covers retrained models, letters models (with each possible input format), Accel's AI models and moving sign recognition onto the phone.

One folder per language and unit. The AI service loads whatever is here
when it starts (`npm run dev` in `backend/`), and the app shows only what's
available — e.g. "Letters (soon)" stays greyed out until a letters model is
in place.

```
ai/models/sign/
  fsl/words/     model.keras + labels.json   FSL-105 (105 words)    ✓
  asl/words/     model.keras + labels.json   WLASL100 (100 words)   ✓
  fsl/letters/   (empty — fingerspelling model not trained yet)
  asl/letters/   (empty — fingerspelling model not trained yet)
```

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
- `input`: keep `holistic-32`. A letters model trained on something else
  (say, one hand in one frame) needs its own feature code in
  `ai/app/sign/registry.py` first — the folder will say so until then.
