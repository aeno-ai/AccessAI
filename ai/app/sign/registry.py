"""Which sign models are installed, and running them.

Models live in ai/models/sign/<language>/<unit>/:

    ai/models/sign/fsl/words/    model.keras + labels.json   (FSL-105)
    ai/models/sign/asl/words/    model.keras + labels.json   (WLASL100)
    ai/models/sign/fsl/letters/  empty until the letter model is trained
    ai/models/sign/asl/letters/  empty until the letter model is trained

To swap or add a model: put model.keras (or model.tflite) and labels.json
from the SAME training run in the folder, then restart the AI service. An
optional meta.json changes the settings below (see meta.example.json).
Nothing else in the app needs to change.
"""
import json
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from .features import OFF_LHAND, OFF_POSE, T_FRAMES, MIN_HAND_FRACTION, normalize, sample_frame_indices
from .numpy_model import NumpyModel

MODELS_DIR = Path(__file__).resolve().parents[2] / "models" / "sign"
LANGUAGES = ("fsl", "asl")
UNITS = ("words", "letters")

# Per-language defaults (meta.json can override them).
DEFAULTS = {
    # FSL-105 training clips are exactly 4 s with resting hands before and
    # after, so each sign is centred in a ~4 s window.
    "fsl": {"fixed_seconds": 4.0, "min_confidence": 0.5},
    # WLASL clips are trimmed to the sign itself.
    "asl": {"fixed_seconds": None, "min_confidence": 0.5},
}


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
    problem: str | None = None

    @property
    def available(self):
        return self.runner is not None

    def predict(self, frames):
        """frames: (n, 69, 3) raw landmarks -> dict with the top 5, or an error.
        Same checks as the tester's Lang.predict."""
        n = len(frames)
        if n < 8:
            return dict(error="That was too short. Sign a little slower.")
        seq = frames[sample_frame_indices(n, T_FRAMES)]
        hand_frames = int((seq[:, OFF_LHAND:OFF_POSE, 2].max(axis=1) > 0).sum())
        if hand_frames < T_FRAMES * MIN_HAND_FRACTION:
            return dict(error="Your hands weren't clear enough. Check the light and keep your hands in view.")
        x = normalize(seq[None])[0].reshape(T_FRAMES, -1)
        probs = np.asarray(self.runner.predict(x)).reshape(-1)
        order = np.argsort(probs)[::-1]
        return dict(top=[(int(i), float(probs[i])) for i in order[:5]])

    def describe(self):
        return {
            "language": self.language,
            "unit": self.unit,
            "available": self.available,
            "signs": len(self.labels),
            "problem": self.problem,
        }


def _load(language, unit):
    folder = MODELS_DIR / language / unit
    model = SignModel(language, unit, folder, **DEFAULTS[language])
    meta_path = folder / "meta.json"
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            # Every model so far takes 32 frames of the 69 Holistic points. A
            # model trained on something else (e.g. one hand, one frame — a
            # possible letters model) needs its own feature code here first.
            if meta.get("input", "holistic-32") != "holistic-32":
                model.problem = f"input '{meta['input']}' needs code in ai/app/sign/registry.py"
                return model
            if "fixed_seconds" in meta:
                model.fixed_seconds = meta["fixed_seconds"]
            if "min_confidence" in meta:
                model.min_confidence = float(meta["min_confidence"])
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
    model.runner = runner
    return model


def load_all():
    """Every language × unit, installed or not (so the app can show "coming soon")."""
    return {(language, unit): _load(language, unit) for language in LANGUAGES for unit in UNITS}
