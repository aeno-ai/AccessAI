"""Exports the sign models for the phone (HANDOFF.md §49):

    cd ai
    .venv\\Scripts\\python scripts\\export_sign_model.py

For each installed model (ai/models/sign/<fsl|asl>/<words|letters>/model.keras)
writes frontend/assets/sign-models/<lang>/<unit>/:
  model.json    the layers in order, with their settings and weight shapes
  model.bin     every weight, float32 little-endian, in that same order
  labels.json   copied
  meta.json     what the app needs to read signs like the server did:
                fixed_seconds, min_confidence, features (hand / velocity),
                aspect_corrected (trained on real proportions)

The phone runs these with frontend/src/sign/net.ts — the same math as
app/sign/numpy_model.py (scripts/sign-check.ts proves the top 5 match).
No TensorFlow needed. A new letters folder also needs its lines in
frontend/src/sign/models.ts (BUNDLED).
"""
import json
import sys
from pathlib import Path

sys.modules.setdefault("tensorflow", None)
AI = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AI))

import numpy as np  # noqa: E402

from app.sign import registry  # noqa: E402
from app.sign.numpy_model import NumpyModel, _first  # noqa: E402

OUT = AI.parent / "frontend" / "assets" / "sign-models"


def aspect_corrected(folder):
    """Trained on real proportions (x × width ÷ height)? The notebooks say so in
    features.json (words) or meta.json (letters); older models don't."""
    for name in ("features.json", "meta.json"):
        path = folder / name
        if path.exists() and json.loads(path.read_text(encoding="utf-8")).get("aspect_corrected"):
            return True
    return False


def export(language, unit, model):
    keras = model.folder / "model.keras"
    if not model.available or not keras.exists():
        print(f"skip {language} {unit}: {model.problem or 'no model.keras'}")
        return
    net = NumpyModel(keras)
    layers, blobs, offset = [], [], 0
    for kind, conf, weights in net.layers:
        if kind in ("InputLayer", "Dropout"):
            continue
        entry = {"kind": kind}
        if conf.get("activation") not in (None, "linear"):
            entry["activation"] = conf["activation"]
        if kind == "BatchNormalization":
            if not (conf.get("center", True) and conf.get("scale", True)):
                sys.exit(f"{language} {unit}: BatchNormalization needs center=True and scale=True")
            entry["epsilon"] = float(conf.get("epsilon", 1e-3))
        if kind == "Conv1D":
            if conf.get("padding", "valid") != "same" or _first(conf.get("strides", 1)) != 1:
                sys.exit(f"{language} {unit}: only Conv1D with padding='same' and stride 1 is supported")
            dilation = _first(conf.get("dilation_rate", 1))
            if dilation != 1:
                entry["dilation"] = dilation
        entry["weights"] = []
        for array in weights:
            a = np.ascontiguousarray(array, dtype="<f4")
            entry["weights"].append({"shape": list(a.shape), "offset": offset})
            blobs.append(a.tobytes())
            offset += a.size
        layers.append(entry)

    folder = OUT / language / unit
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "model.bin").write_bytes(b"".join(blobs))
    (folder / "model.json").write_text(json.dumps({"inputShape": list(net.input_shape), "layers": layers}), encoding="utf-8")
    labels = {int(k): v for k, v in model.labels.items()}
    (folder / "labels.json").write_text(json.dumps([labels[i] for i in range(len(labels))]), encoding="utf-8")
    (folder / "meta.json").write_text(
        json.dumps({
            "language": language,
            "unit": unit,
            "fixedSeconds": model.fixed_seconds,
            "minConfidence": model.min_confidence,
            "features": model.features,
            "aspectCorrected": aspect_corrected(model.folder),
        }),
        encoding="utf-8",
    )
    print(f"{language} {unit}: {len(layers)} layers, {offset:,} weights ({offset * 4 / 1e6:.1f} MB), {len(labels)} signs → {folder}")


def main():
    models = registry.load_all()
    for language in registry.LANGUAGES:
        for unit in ("words", "letters"):
            export(language, unit, models[(language, unit)])


if __name__ == "__main__":
    main()
