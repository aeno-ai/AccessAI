"""Step 0 of the on-phone sign plan (HANDOFF.md §49): does the MediaPipe the
phone can run (Tasks HolisticLandmarker) give our sign models the same
points as the legacy Holistic they were trained on?

    cd ai
    .venv\\Scripts\\python scripts\\compare_holistic.py [--clips ..\\learn]

Reads the team's Learn recordings (learn/FSL, learn/ASL — 12 signs each,
all words the models know), runs BOTH graphs on every frame, packs both
exactly like app/sign/features.pack, cuts signs with the same AutoSegmenter
the app uses, and reads each with the same model. Prints, per graph:
how often a person / both shoulders / a hand were found, top-1 and top-5,
and how far the two graphs' points are apart. Nothing is written.
"""
import argparse
import sys
from pathlib import Path

sys.modules.setdefault("tensorflow", None)
AI = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AI))

import cv2  # noqa: E402
import numpy as np  # noqa: E402

from app.sign import registry  # noqa: E402
from app.sign.features import (  # noqa: E402
    FACE_IDX, IDX_LSHOULDER, IDX_RSHOULDER, N_HAND, N_POINTS, OFF_FACE, OFF_LHAND, OFF_POSE, OFF_RHAND,
    POSE_IDX, new_holistic, pack,
)
from app.sign.segmenter import AutoSegmenter  # noqa: E402

TASK_MODEL = AI / "models" / "mediapipe" / "holistic_landmarker.task"

# Learn file name → the model's label (frontend/src/learn/content.ts).
SIGNS = {
    "fsl": {
        "Don_t know": "DON'T KNOW", "Good Afternoon": "GOOD AFTERNOON", "Hello": "HELLO",
        "How are you": "HOW ARE YOU", "I_m fine": "IM FINE", "Know": "KNOW",
        "Nice to meet you": "NICE TO MEET YOU", "No": "NO", "See you tomorrow": "SEE YOU TOMORROW",
        "Thank you": "THANK YOU", "Yes": "YES", "You_re welcome": "YOURE WELCOME",
    },
    "asl": {
        "Again": "again", "Fine": "fine", "Help": "help", "How": "how", "Meet": "meet", "Name": "name",
        "No": "no", "Please": "please", "Sorry": "sorry", "Thank You": "thank you",
        "Understand": "understand", "Yes": "yes",
    },
}


def simplify(label):
    return label.upper().replace("’", "'").replace("'", "").strip()


def _patch_missing_hands():
    """MediaPipe's Python wrapper (0.10.14–0.10.21) reads every result packet
    without checking it's there, so the first frame without a hand (or face)
    crashes the whole process ("The packet is empty"). An empty landmark list
    stands in for a missing one — exactly what the Android wrapper returns."""
    from mediapipe.framework.formats import landmark_pb2
    from mediapipe.python import packet_creator
    from mediapipe.tasks.python.vision import holistic_landmarker as hl

    if getattr(hl, "_accessai_patched", False):
        return
    empty = {
        hl._FACE_LANDMARKS_STREAM_NAME: landmark_pb2.NormalizedLandmarkList,
        hl._POSE_LANDMARKS_STREAM_NAME: landmark_pb2.NormalizedLandmarkList,
        hl._LEFT_HAND_LANDMARKS_STREAM_NAME: landmark_pb2.NormalizedLandmarkList,
        hl._RIGHT_HAND_LANDMARKS_STREAM_NAME: landmark_pb2.NormalizedLandmarkList,
        hl._POSE_WORLD_LANDMARKS_STREAM_NAME: landmark_pb2.LandmarkList,
        hl._LEFT_HAND_WORLD_LANDMARKS_STREAM_NAME: landmark_pb2.LandmarkList,
        hl._RIGHT_HAND_WORLD_LANDMARKS_STREAM_NAME: landmark_pb2.LandmarkList,
    }
    build = hl._build_landmarker_result

    def safe_build(output_packets):
        packets = dict(output_packets)
        for name, kind in empty.items():
            if name in packets and packets[name].is_empty():
                packets[name] = packet_creator.create_proto(kind())
        return build(packets)

    hl._build_landmarker_result = safe_build
    hl._accessai_patched = True


def new_tasks():
    _patch_missing_hands()
    from mediapipe.tasks.python import BaseOptions
    from mediapipe.tasks.python.vision import HolisticLandmarker, HolisticLandmarkerOptions, RunningMode

    options = HolisticLandmarkerOptions(
        # As bytes: on Windows, MediaPipe mangles an absolute model path.
        base_options=BaseOptions(model_asset_buffer=TASK_MODEL.read_bytes()),
        running_mode=RunningMode.VIDEO,
    )
    return HolisticLandmarker.create_from_options(options)


def pack_tasks(result):
    """A Tasks HolisticLandmarkerResult → the same (69, 3) layout as features.pack."""
    out = np.zeros((N_POINTS, 3), dtype=np.float32)
    for points, offset in ((result.left_hand_landmarks, OFF_LHAND), (result.right_hand_landmarks, OFF_RHAND)):
        if points:
            for i, p in enumerate(points[:N_HAND]):
                out[offset + i] = (p.x, p.y, 1.0)
    if result.pose_landmarks:
        for i, index in enumerate(POSE_IDX):
            p = result.pose_landmarks[index]
            out[OFF_POSE + i] = (p.x, p.y, 1.0)
    if result.face_landmarks:
        for i, index in enumerate(FACE_IDX):
            p = result.face_landmarks[index]
            out[OFF_FACE + i] = (p.x, p.y, 1.0)
    return out


def extract(path):
    """Both graphs over every frame → (times, legacy frames, tasks frames, aspect)."""
    import mediapipe as mp

    # One graph at a time: both in one pass crashes the Tasks graph.
    def frames_of(read):
        cap = cv2.VideoCapture(str(path))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        out, times, aspect, index = [], [], 1.0, 0
        try:
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                t = index / fps
                index += 1
                aspect = frame.shape[1] / frame.shape[0]
                out.append(read(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB), t))
                times.append(t)
        finally:
            cap.release()
        return np.array(times), np.stack(out), aspect

    legacy = new_holistic()
    try:
        times, old, aspect = frames_of(lambda rgb, t: pack(legacy.process(rgb)))
    finally:
        legacy.close()
    tasks = new_tasks()
    try:
        _, new, _ = frames_of(
            lambda rgb, t: pack_tasks(tasks.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), int(t * 1000)))
        )
    finally:
        tasks.close()
    return times, old, new, aspect


def signs_in(times, frames, aspect, model):
    segmenter = AutoSegmenter()
    clips = []
    for t, packed in zip(times, frames):
        clip = segmenter.update(t, packed, aspect, model.fixed_seconds)
        if clip is not None:
            clips.append(clip)
    clips.extend(segmenter.flush())
    return clips


def found(frames):
    person = frames[:, :, 2].any(axis=1)
    shoulders = (frames[:, IDX_LSHOULDER, 2] > 0) & (frames[:, IDX_RSHOULDER, 2] > 0)
    hands = frames[:, OFF_LHAND:OFF_POSE, 2].any(axis=1)
    return person.mean(), shoulders.mean(), hands.mean()


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser()
    parser.add_argument("--clips", default=str(AI.parent / "learn"))
    args = parser.parse_args()
    if not TASK_MODEL.exists():
        sys.exit(f"Missing {TASK_MODEL} — download holistic_landmarker.task first.")

    models = registry.load_all()
    totals = {"legacy": [0, 0, 0, 0], "tasks": [0, 0, 0, 0]}  # clips with a sign read, top1, top5, signs cut
    seen = {"legacy": [], "tasks": []}
    diffs, same_side = [], []
    for language, signs in SIGNS.items():
        model = models[(language, "words")]
        if not model.available:
            print(f"{language.upper()} model not available: {model.problem}")
            continue
        names = {simplify(v): k for k, v in model.labels.items()}
        folder = Path(args.clips) / language.upper()
        print(f"\n{language.upper()} — {folder}")
        for stem, label in signs.items():
            path = folder / f"{language.upper()} - {stem}.mp4"
            if not path.exists():
                print(f"  (missing {path.name})")
                continue
            target = names.get(simplify(label))
            times, old, new, aspect = extract(path)
            both = (old[:, :, 2] > 0) & (new[:, :, 2] > 0)
            if both.any():
                diffs.append(float(np.abs(old[..., :2] - new[..., :2])[both].mean()))
            # Hands in the same slot: a hand in legacy's left slot is also in tasks' left slot.
            for side in (OFF_LHAND, OFF_RHAND):
                a, b = old[:, side, 2] > 0, new[:, side, 2] > 0
                other = OFF_RHAND if side == OFF_LHAND else OFF_LHAND
                swapped = a & ~b & (new[:, other, 2] > 0)
                same_side.extend([1] * int((a & b).sum()) + [0] * int(swapped.sum()))
            line = [f"  {label:<18}"]
            for name, frames in (("legacy", old), ("tasks", new)):
                seen[name].append(found(frames))
                clips = signs_in(times, frames, aspect, model)
                top1 = top5 = read = 0
                for clip in clips:
                    res = model.predict(clip, aspect)
                    if "top" not in res:
                        continue
                    read += 1
                    ids = [i for i, _ in res["top"]]
                    top1 += ids[0] == target
                    top5 += target in ids
                for i, n in enumerate((read > 0, top1, top5, len(clips))):
                    totals[name][i] += n
                best = "-"
                if clips:
                    res = model.predict(max(clips, key=len), aspect)
                    if "top" in res:
                        best = f"{model.labels[res['top'][0][0]]} {res['top'][0][1]:.2f}"
                line.append(f"{name}: {len(clips)} cut, {top1}/{read} right, best {best:<22}")
            print(" | ".join(line))

    print("\nSummary")
    for name in ("legacy", "tasks"):
        person, shoulders, hands = (np.mean([s[i] for s in seen[name]]) for i in range(3)) if seen[name] else (0, 0, 0)
        clips_read, top1, top5, cut = totals[name]
        print(f"  {name:<6}: person {person:.0%}, both shoulders {shoulders:.0%}, a hand {hands:.0%} of frames; "
              f"{cut} signs cut, top-1 {top1}, top-5 {top5}")
    if diffs:
        print(f"  mean point difference (image units): {np.mean(diffs):.4f}")
    if same_side:
        print(f"  hands in the same left/right slot: {np.mean(same_side):.1%} of frames where both found it")


if __name__ == "__main__":
    main()
