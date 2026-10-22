"""Which sign models are installed, and running them.

Models live in ai/models/sign/<language>/<unit>/:

    ai/models/sign/fsl/words/    model.keras + labels.json + meta.json + features.json
                                 (FSL-105, 105 words; hand + velocity)
    ai/models/sign/asl/words/    model.keras + labels.json + meta.json + features.json
                                 (WLASL, 125 words; hand)
    ai/models/sign/fsl/letters/  model.keras + labels.json + meta.json (hand-21, A-Z)
    ai/models/sign/asl/letters/  model.keras + labels.json + meta.json (hand-21, A-Z)
    (all four retrained 2026-10-19/21 on real picture proportions: aspect_corrected)

To swap or add a model: put model.keras (or model.tflite) and labels.json
from the SAME training run in the folder, then restart the AI service. An
optional meta.json changes the settings below (see meta.example.json).
Nothing else in the app needs to change.

A features.json from the same training run says which extra numbers the
model reads besides the 207 base ones, e.g. {"hand": true, "velocity": false}
(see make_features in features.py). No file = the base 207 only. A model
whose input width doesn't match is marked "not ready" instead of crashing.

Two kinds of input are supported (meta.json "input"):
  holistic-32  32 frames x 69 Holistic points — the word models (default)
  hand-21      ONE frame of one hand's 21 points — a typical fingerspelling
               model. Pair it with "segmentation": "hold" (a letter = the
               hand held still), and copy the letters notebook's
               normalization into normalize_hand() below.
"""
import json
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from .features import (
    MIN_HAND_FRACTION, N_HAND, OFF_LHAND, OFF_POSE, OFF_RHAND, T_FRAMES,
    feature_width, make_features, normalize, sample_frame_indices,
)
from .numpy_model import NumpyModel

MODELS_DIR = Path(__file__).resolve().parents[2] / "models" / "sign"
LANGUAGES = ("fsl", "asl")
UNITS = ("words", "letters")
INPUTS = ("holistic-32", "hand-21")
SEGMENTATIONS = ("auto", "hold")

# Per-language defaults (meta.json can override them).
DEFAULTS = {
    # FSL-105 training clips are exactly 4 s with resting hands before and
    # after, so each sign is centred in a ~4 s window.
    "fsl": {"fixed_seconds": 4.0, "min_confidence": 0.5},
    # WLASL clips are trimmed to the sign itself.
    "asl": {"fixed_seconds": None, "min_confidence": 0.5},
}


# The picture shape the older models were trained on (landscape videos).
# MediaPipe's x is a share of the picture's width and y of its height, so
# the same body comes out stretched differently on a portrait phone picture
# (HANDOFF.md §49). Same rule as frontend/src/sign/features.ts shapeForModel.
LEGACY_TRAINING_ASPECT = 16 / 9


def shape_for_model(frames, aspect, aspect_corrected):
    """(n, 69, 3) raw frames -> x stretched to the proportions the model was
    trained with: real proportions (x * width / height) for models trained
    that way (`aspect_corrected`), else those of a 16:9 training video.
    `aspect` = the picture's width / height."""
    factor = aspect if aspect_corrected else aspect / LEGACY_TRAINING_ASPECT
    if factor == 1:
        return frames
    shaped = np.array(frames, dtype=np.float32, copy=True)
    shaped[..., 0] *= factor
    return shaped


def normalize_hand(hand):
    """(21, 2) hand points -> the numbers a hand-21 letters model reads.

    The letters notebooks' normalize_hand (2026-10-19): relative to the wrist,
    divided by the largest wrist distance. Their x * width / height step is
    shape_for_model's job (done before this), so the two match exactly.
    """
    relative = hand - hand[0]
    size = float(np.max(np.linalg.norm(relative, axis=1)))
    return relative / size if size > 1e-6 else relative


def build_hand21(frames):
    """(n, 69, 3) frames of a held handshape -> (1, 42), or None if no hand.
    Uses the frame nearest the middle of the hold (the steadiest), and the
    right hand if it's there, else the left."""
    middle = len(frames) // 2
    for i in sorted(range(len(frames)), key=lambda index: abs(index - middle)):
        for offset in (OFF_RHAND, OFF_LHAND):
            hand = frames[i][offset:offset + N_HAND]
            if hand[:, 2].all():
                return normalize_hand(hand[:, :2]).reshape(1, -1).astype(np.float32)
    return None


class TfliteRunner:
    """Runs model.tflite — only if LiteRT is installed (`pip install ai-edge-litert`).
    The default is model.keras through NumpyModel, which needs nothing extra."""

    def __init__(self, path):
        try:
            from ai_edge_litert.interpreter import Interpreter
        except ImportError as error:
            raise RuntimeError("model.tflite needs `pip install ai-edge-litert` (or use model.keras)") from error
        self.interpreter = Interpreter(model_path=str(path))
        self.interpreter.allocate_tensors()
        self.input = self.interpreter.get_input_details()[0]
        self.output = self.interpreter.get_output_details()[0]
        self.n_outputs = int(self.output["shape"][-1])

    def predict(self, x):
        self.interpreter.set_tensor(self.input["index"], np.asarray(x, np.float32)[None])
        self.interpreter.invoke()
        return self.interpreter.get_tensor(self.output["index"])[0]


@dataclass
class SignModel:
    language: str
    unit: str
    folder: Path
    runner: object = None
    labels: dict = field(default_factory=dict)
    fixed_seconds: float | None = None
    min_confidence: float = 0.5
    input: str = "holistic-32"
    segmentation: str = "auto"
    # Extra numbers per frame besides the base 207 (features.json).
    features: dict = field(default_factory=lambda: {"hand": False, "velocity": False})
    # Trained on real picture proportions (features.json or meta.json
    # "aspect_corrected"); older models on 16:9 videos.
    aspect_corrected: bool = False
    problem: str | None = None

    @property
    def available(self):
        return self.runner is not None

    def predict(self, frames, aspect=LEGACY_TRAINING_ASPECT):
        """frames: (n, 69, 3) raw landmarks -> dict with the top 5, or an error.
        `aspect` = the picture's width / height (the default leaves older
        models' input unchanged). Same checks as the tester's Lang.predict."""
        frames = shape_for_model(frames, aspect, self.aspect_corrected)
        if self.input == "hand-21":
            x = build_hand21(frames)
            if x is None:
                return dict(error="Your hand wasn't clear enough. Hold it still where the camera can see it.")
        else:
            n = len(frames)
            if n < 8:
                return dict(error="That was too short. Sign a little slower.")
            seq = frames[sample_frame_indices(n, T_FRAMES)]
            hand_frames = int((seq[:, OFF_LHAND:OFF_POSE, 2].max(axis=1) > 0).sum())
            if hand_frames < T_FRAMES * MIN_HAND_FRACTION:
                return dict(error="Your hands weren't clear enough. Check the light and keep your hands in view.")
            x = make_features(normalize(seq[None]), **self.features)[0]
        probs = np.asarray(self.runner.predict(x)).reshape(-1)
        order = np.argsort(probs)[::-1]
        return dict(top=[(int(i), float(probs[i])) for i in order[:5]])

    def describe(self):
        return {
            "language": self.language,
            "unit": self.unit,
            "available": self.available,
            "signs": len(self.labels),
            "input": self.input,
            "problem": self.problem,
        }


def _load(language, unit):
    folder = MODELS_DIR / language / unit
    model = SignModel(language, unit, folder, **DEFAULTS[language])
    meta_path = folder / "meta.json"
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            # The inputs this file knows how to build (INPUTS). Anything else
            # needs its own feature code here first.
            model.input = meta.get("input", "holistic-32")
            if model.input not in INPUTS:
                model.problem = f"input '{model.input}' needs code in ai/app/sign/registry.py"
                return model
            model.segmentation = meta.get("segmentation", "hold" if model.input == "hand-21" else "auto")
            if model.segmentation not in SEGMENTATIONS:
                model.problem = f"segmentation '{model.segmentation}' isn't one of {', '.join(SEGMENTATIONS)}"
                return model
            if "fixed_seconds" in meta:
                model.fixed_seconds = meta["fixed_seconds"]
            if "min_confidence" in meta:
                model.min_confidence = float(meta["min_confidence"])
            model.aspect_corrected = bool(meta.get("aspect_corrected", False))
        except (ValueError, TypeError) as error:
            model.problem = f"meta.json is not valid: {error}"
            return model

    labels_path = folder / "labels.json"
    keras_path, tflite_path = folder / "model.keras", folder / "model.tflite"
    if not labels_path.exists() or not (keras_path.exists() or tflite_path.exists()):
        model.problem = "not installed yet"
        return model
    try:
        raw = json.loads(labels_path.read_text(encoding="utf-8"))
        model.labels = {int(k): v for k, v in raw.items()}
        if keras_path.exists():
            runner = NumpyModel(keras_path)
            n_out = runner.layers[-1][2][1].shape[0]
        else:
            runner = TfliteRunner(tflite_path)
            n_out = runner.n_outputs
    except Exception as error:  # noqa: BLE001 — any broken file just means "not available"
        model.problem = f"could not load: {error}"
        return model
    if n_out != len(model.labels):
        model.problem = (f"the model has {n_out} outputs but labels.json has {len(model.labels)} "
                         "entries — files from different training runs?")
        return model
    if model.input == "holistic-32":
        features_path = folder / "features.json"
        try:
            if features_path.exists():
                wanted = json.loads(features_path.read_text(encoding="utf-8"))
                model.features = {key: bool(wanted.get(key, False)) for key in ("hand", "velocity")}
                model.aspect_corrected = model.aspect_corrected or bool(wanted.get("aspect_corrected", False))
        except (ValueError, TypeError, AttributeError) as error:
            model.problem = f"features.json is not valid: {error}"
            return model
        n_in = _input_width(runner)
        width = feature_width(**model.features)
        if n_in is not None and n_in != width:
            model.problem = (f"the model reads {n_in} numbers per frame but features.json gives {width} "
                             "— copy features.json from the same training run")
            return model
    model.runner = runner
    return model


def _input_width(runner):
    """Numbers per frame the model reads (None if it can't be told)."""
    if isinstance(runner, TfliteRunner):
        return int(runner.input["shape"][-1])
    for kind, conf, weights in runner.layers:
        if kind == "InputLayer":
            shape = conf.get("batch_shape") or conf.get("batch_input_shape")
            if shape:
                return int(shape[-1])
        if kind == "Dense" and weights:
            return int(weights[0].shape[0])
    return None


def load_all():
    """Every language × unit, installed or not (so the app can show "coming soon")."""
    return {(language, unit): _load(language, unit) for language in LANGUAGES for unit in UNITS}
