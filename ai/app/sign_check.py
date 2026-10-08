"""Checks the sign-language setup without a phone:

    cd ai
    .venv\\Scripts\\python -m app.sign_check [path\\to\\AccessAI-tester]

1. Lists which models are installed (and why one isn't).
2. Replays the tester's saved recordings (recordings/<fsl|asl>/<signer>/*.npz:
   the raw landmarks + what the tester predicted) through this service's
   copy of the pipeline. The top word must match — proof the app and the
   tester see signs the same way.
3. Sends a 2-second blank video through a real session, end to end
   (decode → MediaPipe → segmenter), which should answer with a hint.
"""
import sys
import tempfile
from pathlib import Path

sys.modules.setdefault("tensorflow", None)

import numpy as np  # noqa: E402

from .sign import registry  # noqa: E402
from .sign.session import SessionStore, process_bytes  # noqa: E402

DEFAULT_TESTER = Path.home() / "Downloads" / "AccessAI-tester"


def main():
    tester = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_TESTER
    models = registry.load_all()
    print("Installed sign models:")
    for model in models.values():
        state = f"{len(model.labels)} signs" if model.available else model.problem
        print(f"  {model.language.upper()} {model.unit:<8} {state}")

    print(f"\nReplaying the tester's recordings from {tester / 'recordings'}:")
    same = total = 0
    for language in registry.LANGUAGES:
        model = models[(language, "words")]
        if not model.available:
            continue
        for path in sorted((tester / "recordings" / language).glob("*/*.npz")):
            saved = np.load(path, allow_pickle=False)
            if saved["probs"].size == 0:
                continue
            res = model.predict(saved["raw_frames"])
            if "top" not in res:
                print(f"  {path.name}: {res['error']}")
                continue
            ours, theirs = res["top"][0][0], int(np.argmax(saved["probs"]))
            total += 1
            same += ours == theirs
            mark = "✓" if ours == theirs else "✗"
            print(f"  {mark} {language.upper()} {path.parent.name}/{path.name}: "
                  f"{model.labels[ours]} ({res['top'][0][1]:.0%}) — tester said {model.labels[theirs]}")
    print(f"  {same}/{total} match the tester." if total else "  (no recordings found)")

    print("\nEnd to end with a blank 2-second video:")
    import cv2

    available = next((m for m in models.values() if m.available), None)
    if available is None:
        print("  skipped — no model installed")
        return
    with tempfile.TemporaryDirectory() as folder:
        video = Path(folder) / "blank.mp4"
        writer = cv2.VideoWriter(str(video), cv2.VideoWriter_fourcc(*"mp4v"), 30, (640, 480))
        for _ in range(60):
            writer.write(np.full((480, 640, 3), 90, np.uint8))
        writer.release()
        store = SessionStore()
        session = store.create("self-check", available, available.min_confidence)
        result = process_bytes(session, video.read_bytes(), 1_700_000_000_000)
        store.delete(session.id, "self-check")
    print(f"  read {result['frames']} frames, phase {result['phase']}, events: {result['events']}")
    ok = result["frames"] > 0 and any(e["type"] == "hint" for e in result["events"])
    print("  ✓ the video path works" if ok else "  ✗ something is off")


if __name__ == "__main__":
    main()
