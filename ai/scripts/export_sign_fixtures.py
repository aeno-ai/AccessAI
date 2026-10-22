"""Writes the numbers the phone's copy of the sign pipeline must reproduce
(frontend/src/sign/), for frontend/scripts/sign-check.ts:

    cd ai
    .venv\\Scripts\\python scripts\\export_sign_fixtures.py [path\\to\\AccessAI-tester]

From a few of the tester's saved recordings (raw landmarks), per case:
  * the 32 sampled frame indices, the normalized clip and the model's input
    features (app/sign/features.py), and the model's top 5 (to check the
    on-phone model file against later);
  * a "stream": rest frames, the sign, rest frames, at 30 fps, and where
    AutoSegmenter cuts it.
And a few held handshapes for HoldSegmenter / build_hand21.

Output: frontend/scripts/fixtures/sign-fixtures.json (numbers rounded to 6
places; the check allows 1e-4).
"""
import json
import sys
from pathlib import Path

sys.modules.setdefault("tensorflow", None)
AI = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AI))

import numpy as np  # noqa: E402

from app.sign import registry  # noqa: E402
from app.sign.features import OFF_LHAND, OFF_POSE, T_FRAMES, make_features, normalize, sample_frame_indices  # noqa: E402
from app.sign.segmenter import AutoSegmenter, HoldSegmenter  # noqa: E402

TESTER = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Downloads" / "AccessAI-tester"
OUT = AI.parent / "frontend" / "scripts" / "fixtures" / "sign-fixtures.json"
CASES_PER_LANGUAGE = 3
FPS = 30.0
PHONE_ASPECT = 720 / 1280  # CameraX 1280x720 turned upright


def unstretched(model):
    """The aspect at which registry.shape_for_model leaves x as it is."""
    return 1.0 if model.aspect_corrected else registry.LEGACY_TRAINING_ASPECT


def r(a):
    return np.round(np.asarray(a, dtype=np.float64), 6).tolist()


def rest_frame(frame):
    """The same person with hands out of view (a sign hasn't started)."""
    out = frame.copy()
    out[OFF_LHAND:OFF_POSE] = 0
    return out


def stream_case(frames, fixed_seconds):
    rest = [rest_frame(frames[0])] * 20 + list(frames) + [rest_frame(frames[-1])] * 30
    seg = AutoSegmenter()
    cuts = []
    times = [i / FPS for i in range(len(rest))]
    for t, f in zip(times, rest):
        clip = seg.update(t, f, 16 / 9, fixed_seconds)
        if clip is not None:
            cuts.append(len(clip))
    cuts += [len(c) for c in seg.flush()]
    return {"aspect": 16 / 9, "fps": FPS, "frames": r(np.stack(rest).reshape(len(rest), -1)), "cuts": cuts}


def main():
    models = registry.load_all()
    cases = []
    for language in registry.LANGUAGES:
        model = models[(language, "words")]
        if not model.available:
            print(f"skip {language}: {model.problem}")
            continue
        files = sorted((TESTER / "recordings" / language).glob("*/*.npz"))
        picked = 0
        for path in files:
            saved = np.load(path, allow_pickle=False)
            raw = saved["raw_frames"]
            if len(raw) < 16:
                continue
            idx = sample_frame_indices(len(raw), T_FRAMES)
            seq = raw[idx]
            hand_frames = int((seq[:, OFF_LHAND:OFF_POSE, 2].max(axis=1) > 0).sum())
            if hand_frames < T_FRAMES * 0.25:
                continue
            norm = normalize(seq[None])[0]
            feats = make_features(norm[None], **model.features)[0]
            # An aspect that stretches nothing: this case checks the pipeline
            # on the raw numbers (the stretch has its own case, "shapes").
            res = model.predict(raw, unstretched(model))
            cases.append({
                "name": f"{language}/{path.parent.name}/{path.stem}",
                "language": language,
                "features": model.features,
                "fixedSeconds": model.fixed_seconds,
                "raw": r(raw.reshape(len(raw), -1)),
                "indices": idx.tolist(),
                "normalized": r(norm.reshape(T_FRAMES, -1)),
                "input": r(feats),
                "top5": [[int(i), round(float(p), 6)] for i, p in res["top"]],
                "stream": stream_case(raw, model.fixed_seconds),
            })
            picked += 1
            if picked >= CASES_PER_LANGUAGE:
                break

    # Held handshapes: one recording's frame repeated (with a tiny jitter) for 1 s.
    holds = []
    rng = np.random.default_rng(7)
    for case in cases[:2]:
        raw = np.asarray(case["raw"], dtype=np.float32).reshape(-1, 69, 3)
        frame = next((f for f in raw if f[21:42, 2].all() or f[0:21, 2].all()), None)
        if frame is None:
            continue
        frames = []
        for _ in range(int(FPS)):
            f = frame.copy()
            f[:, :2] += rng.normal(0, 0.0005, size=f[:, :2].shape).astype(np.float32) * (f[:, 2:3] > 0)
            frames.append(f)
        seg = HoldSegmenter()
        cuts = []
        for i, f in enumerate(frames):
            clip = seg.update(i / FPS, f, 16 / 9, None)
            if clip is not None:
                cuts.append(len(clip))
        hand = registry.build_hand21(np.stack(frames))
        # Each installed letters model's top 5 on these 42 numbers.
        letters = {}
        for language in registry.LANGUAGES:
            letter_model = models[(language, "letters")]
            if hand is not None and letter_model.available:
                res = letter_model.predict(np.stack(frames), unstretched(letter_model))
                letters[language] = [[int(i), round(float(p), 6)] for i, p in res["top"]]
        holds.append({
            "frames": r(np.stack(frames).reshape(len(frames), -1)),
            "cuts": cuts,
            "hand21": r(hand[0]) if hand is not None else None,
            "letters": letters,
        })

    # The picture-shape stretch (registry.shape_for_model) on a portrait
    # phone picture, for a model trained both ways.
    sample = np.asarray(cases[0]["raw"], dtype=np.float32).reshape(-1, 69, 3)[:4] if cases else None
    shapes = []
    if sample is not None:
        for corrected in (False, True):
            shaped = registry.shape_for_model(sample, PHONE_ASPECT, corrected)
            shapes.append({"aspect": PHONE_ASPECT, "corrected": corrected,
                           "raw": r(sample.reshape(len(sample), -1)), "shaped": r(shaped.reshape(len(shaped), -1))})

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"cases": cases, "holds": holds, "shapes": shapes}), encoding="utf-8")
    print(f"{len(cases)} cases, {len(holds)} holds, {len(shapes)} shapes → {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
