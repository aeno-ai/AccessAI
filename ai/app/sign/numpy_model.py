"""Run a trained AccessAI sign model with plain NumPy -- no TensorFlow needed.
(Copied unchanged from AccessAI-tester/numpy_model.py, where it was checked
against TensorFlow and gives the same predictions.)


A trained model is just (1) a list of layers and (2) the numbers ("knobs")
inside each layer. Both are stored in the model.keras file, which is really a
zip archive:

    model.keras
      config.json        -> the list of layers and their settings
      model.weights.h5   -> the knobs (weights), one group per layer

This file reads both and does the same multiply-and-add steps TensorFlow would.
It supports the Conv1D word model from notebook 03 (the default). The GRU
variant is not supported here.
"""
import io
import json
import zipfile

import h5py
import numpy as np

# Keras stores each layer's weights under "<class>", "<class>_1", "<class>_2"...
# in the order the layers appear, regardless of the display name in the summary.
_H5_PREFIX = {"Dense": "dense", "BatchNormalization": "batch_normalization",
              "Conv1D": "conv1d"}
_NO_WEIGHTS = {"InputLayer", "Dropout", "Activation", "GlobalAveragePooling1D"}


def _act(x, name):
    if name in (None, "linear"):
        return x
    if name == "relu":
        return np.maximum(x, 0.0)
    if name == "softmax":
        e = np.exp(x - x.max(axis=-1, keepdims=True))
        return e / e.sum(axis=-1, keepdims=True)
    raise ValueError(f"unsupported activation: {name}")


class NumpyModel:
    def __init__(self, keras_path):
        with zipfile.ZipFile(keras_path) as z:
            cfg = json.loads(z.read("config.json"))
            weights_blob = z.read("model.weights.h5")

        layer_cfgs = cfg["config"]["layers"]
        seen = {}
        self.layers = []   # list of (kind, settings, [weight arrays])
        with h5py.File(io.BytesIO(weights_blob), "r") as h5:
            for lc in layer_cfgs:
                kind, conf = lc["class_name"], lc["config"]
                if kind in _NO_WEIGHTS:
                    self.layers.append((kind, conf, []))
                    continue
                if kind not in _H5_PREFIX:
                    raise ValueError(
                        f"Layer type {kind} is not supported by the NumPy runner "
                        "(it handles the default Conv1D model, not the GRU one).")
                n = seen.get(kind, 0)
                seen[kind] = n + 1
                path = _H5_PREFIX[kind] + ("" if n == 0 else f"_{n}")
                group = h5["layers"][path]["vars"]
                arrs = [np.asarray(group[str(i)], dtype=np.float32)
                        for i in range(len(group))]
                self.layers.append((kind, conf, arrs))

        # input shape (frames, features), e.g. (32, 207)
        first = layer_cfgs[0]["config"]
        shape = first.get("batch_shape") or first.get("batch_input_shape")
        self.input_shape = tuple(shape[1:])
        self.n_params = sum(a.size for _, _, arrs in self.layers for a in arrs)

    def predict(self, x):
        """x: (frames, features) or (batch, frames, features) -> probabilities."""
        x = np.asarray(x, dtype=np.float32)
        single = x.ndim == 2
        if single:
            x = x[None]
        for kind, conf, w in self.layers:
            if kind == "Dense":
                # Every frame's numbers times the knob grid, plus the bias.
                x = _act(x @ w[0] + w[1], conf.get("activation"))
            elif kind == "BatchNormalization":
                gamma, beta, mean, var = w
                eps = conf.get("epsilon", 1e-3)
                x = gamma * (x - mean) / np.sqrt(var + eps) + beta
            elif kind == "Conv1D":
                # Slide a 5-frame window along time: each output frame is the
                # sum of 5 neighbouring input frames, each times its own knobs.
                kernel, bias = w
                k = kernel.shape[0]
                if conf.get("padding", "valid") != "same":
                    raise ValueError("only padding='same' is supported")
                left = (k - 1) // 2
                xp = np.pad(x, ((0, 0), (left, k - 1 - left), (0, 0)))
                T = x.shape[1]
                out = np.zeros((x.shape[0], T, kernel.shape[2]), np.float32)
                for j in range(k):
                    out += xp[:, j:j + T] @ kernel[j]
                x = _act(out + bias, conf.get("activation"))
            elif kind == "Activation":
                x = _act(x, conf.get("activation"))
            elif kind == "GlobalAveragePooling1D":
                x = x.mean(axis=1)            # 32 frames -> 1 summary
            # InputLayer and Dropout do nothing at prediction time
        return x[0] if single else x
