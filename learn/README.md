# Learn — course content

Learn is the app's sign-language course (Settings → Sign language picks FSL or ASL). For the defense it has **4 real levels per language** (one unit: 3 lessons and a review, 12 signs each), using only words the sign models learned. After them come locked levels, a title and an icon each, so the course keeps its full length (FSL 40 levels, ASL 37).

## Where things are

| What | Where |
|---|---|
| The course: signs, their spoken steps, clip names, the locked levels | `frontend/src/learn/content.ts` — **the one file to edit** |
| The sign clips | `frontend/assets/signs/fsl/` and `frontend/assets/signs/asl/` |
| What to record | `RECORDING_CHECKLIST.md` (this folder) |
| The check | `cd frontend` → `npx tsx scripts/learn-check.ts` |

## Adding a recorded clip

1. Save the video over the empty placeholder with the **same name** (e.g. `frontend/assets/signs/fsl/good-afternoon.mp4`).
2. Restart the app's bundler: `npx expo start -c`. It finds the clips by itself; nothing in the code changes.

A clip that isn't recorded yet shows "Clip coming soon" in the app (empty placeholders are skipped). The clips come with the app, so they also play offline.

## Changing a sign

In `content.ts`, a sign is:

```ts
{ label: 'GOOD AFTERNOON', display: 'Good afternoon', easy: true, clip: 'good-afternoon', steps: ['…', '…'] }
```

- `label`: the model's exact label (`ai/models/sign/<fsl|asl>/words/labels.json`). Don't change it; the camera check compares against it.
- `steps`: how to make the sign, one short step each. Blind and low-vision learners hear them. Describe the hands only and never say the word (a quiz reads them out).
- `clip`: the file name in the clips folder, without `.mp4`.

Every 4 signs make a lesson, and the unit ends with a review.

## Older research (not used by the app)

`asl-youtube.csv`, `fsl-youtube-candidates.csv` and `tools/` are from the earlier YouTube-clip plan (HANDOFF §21), kept for reference.
