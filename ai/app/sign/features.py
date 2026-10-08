"""Turning camera frames into the numbers the sign models were trained on.

Copied EXACTLY from AccessAI-tester/tester.py (which matches the Kaggle
extraction notebooks). If the notebooks change the landmark layout or the
normalization, change it here too — otherwise the model is fed numbers it
has never seen and its answers become nonsense.

    frame -> MediaPipe Holistic -> 69 points (x, y, present)
    32 evenly spaced frames -> centre on the shoulders, scale by shoulder
    width -> (32, 207) -> model
"""
import sys
import warnings

# MediaPipe peeks at TensorFlow while loading; we don't use TensorFlow at all,
# so hide it to avoid the protobuf conflict (same fix as the tester).
sys.modules.setdefault("tensorflow", None)

import numpy as np  # noqa: E402

# ---------------------------------------------------------------------------
# Landmark layout -- copied exactly from the extraction notebooks
# ---------------------------------------------------------------------------
POSE_IDX = [0, 11, 12, 13, 14, 15, 16]
FACE_IDX = [61, 291, 0, 17, 13, 14, 78, 308, 82, 312, 87, 317,
            70, 105, 107, 336, 334, 300, 33, 263]
N_HAND, N_POSE, N_FACE = 21, len(POSE_IDX), len(FACE_IDX)
N_POINTS = N_HAND * 2 + N_POSE + N_FACE            # 69
OFF_LHAND, OFF_RHAND = 0, N_HAND
OFF_POSE = N_HAND * 2
OFF_FACE = OFF_POSE + N_POSE
IDX_LSHOULDER, IDX_RSHOULDER = OFF_POSE + 1, OFF_POSE + 2
T_FRAMES = 32
MIN_HAND_FRACTION = 0.25        # same rule the extraction used to drop clips


def pack(results):
    """One MediaPipe Holistic result -> (69, 3) array of (x, y, present)."""
    out = np.zeros((N_POINTS, 3), dtype=np.float32)
    for lms, off in ((results.left_hand_landmarks, OFF_LHAND),
                     (results.right_hand_landmarks, OFF_RHAND)):
        if lms is not None:
            for i, lm in enumerate(lms.landmark):
                out[off + i] = (lm.x, lm.y, 1.0)
    if results.pose_landmarks is not None:
        pl = results.pose_landmarks.landmark
        for i, p in enumerate(POSE_IDX):
            out[OFF_POSE + i] = (pl[p].x, pl[p].y, 1.0)
    if results.face_landmarks is not None:
        fl = results.face_landmarks.landmark
        for i, p in enumerate(FACE_IDX):
            out[OFF_FACE + i] = (fl[p].x, fl[p].y, 1.0)
    return out


def sample_frame_indices(n_total, n_want, start=0, end=None):
    end = n_total if end is None else int(min(end, n_total))
    start = int(max(0, min(start, max(0, end - 1))))
    span = max(1, end - start)
    return (start + np.linspace(0, span - 1, n_want)).round().astype(int)


def normalize(X):
    """(N,T,P,3) -> centred on the shoulders, scaled by shoulder width.
    Identical to the training notebook."""
    xy = X[..., :2].astype(np.float32).copy()
    present = X[..., 2:3].astype(np.float32)
    ls, rs = xy[:, :, IDX_LSHOULDER, :], xy[:, :, IDX_RSHOULDER, :]
    ok = (X[:, :, IDX_LSHOULDER, 2] > 0) & (X[:, :, IDX_RSHOULDER, 2] > 0)
    centre = (ls + rs) / 2.0
    width = np.linalg.norm(ls - rs, axis=-1)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        med = np.nanmedian(np.where(ok, width, np.nan), axis=1, keepdims=True)
        cmed = np.nanmedian(np.where(ok[..., None], centre, np.nan), axis=1, keepdims=True)
    med = np.nan_to_num(med, nan=0.25)
    med[med < 1e-6] = 0.25
    cmed = np.nan_to_num(cmed, nan=0.5)
    centre = np.where(ok[..., None], centre, cmed)[:, :, None, :]
    scale = np.where(ok, width, np.broadcast_to(med, width.shape))
    scale = np.maximum(scale, 1e-6)[:, :, None, None]
    xy = (xy - centre) / scale
    xy = xy * present
    return np.concatenate([xy, present], axis=-1).astype(np.float32)


def new_holistic():
    """MediaPipe Holistic with the exact settings the training data used."""
    import mediapipe as mp  # imported here: it's slow, and only sign language needs it

    return mp.solutions.holistic.Holistic(
        static_image_mode=False, model_complexity=1, smooth_landmarks=True,
        refine_face_landmarks=False, min_detection_confidence=0.5,
        min_tracking_confidence=0.5)
